package lk.swiftdrop.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import lk.swiftdrop.common.error.BadRequestException;
import org.junit.jupiter.api.Test;

/** Phase 11: metadata removed, photo turned upright, shrunk, bombs refused. */
class ImageSanitizerTest {

    private final ImageSanitizer sanitizer = new ImageSanitizer();

    /** Left half red, right half blue. */
    private static BufferedImage halves(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, w / 2, h);
        g.setColor(Color.BLUE);
        g.fillRect(w / 2, 0, w - w / 2, h);
        g.dispose();
        return img;
    }

    private static byte[] encode(BufferedImage img, String format) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    /** A JPEG with an EXIF block: orientation + a fake GPS text, as phones write it. */
    private static byte[] jpegWithExif(BufferedImage img, int orientation) throws IOException {
        byte[] jpeg = encode(img, "jpeg");
        ByteBuffer tiff = ByteBuffer.allocate(8 + 2 + 12 + 4 + 16).order(ByteOrder.BIG_ENDIAN);
        tiff.put((byte) 'M').put((byte) 'M').putShort((short) 42).putInt(8);
        tiff.putShort((short) 1); // one entry
        tiff.putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) orientation).putShort((short) 0);
        tiff.putInt(0); // no next IFD
        tiff.put("GPS-SECRET-9.66N".getBytes(StandardCharsets.US_ASCII));
        byte[] exif = tiff.array();
        int length = 2 + 6 + exif.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2); // FF D8
        out.write(0xFF);
        out.write(0xE1);
        out.write(length >> 8);
        out.write(length & 0xFF);
        out.writeBytes("Exif\0\0".getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(exif);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    private static BufferedImage decode(byte[] bytes) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(bytes));
    }

    private static boolean reddish(int rgb) {
        Color c = new Color(rgb);
        return c.getRed() > 180 && c.getBlue() < 80;
    }

    private static boolean contains(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(needle);
    }

    @Test
    void removesExifAndTurnsAPhoneShotUpright() throws IOException {
        byte[] original = jpegWithExif(halves(40, 20), 6); // stored sideways, "rotate 90° clockwise"
        assertThat(JpegOrientation.read(original)).isEqualTo(6);

        byte[] cleaned = sanitizer.clean(original, ImageType.JPEG);

        assertThat(contains(cleaned, "GPS-SECRET")).isFalse();
        assertThat(contains(cleaned, "Exif")).isFalse();
        BufferedImage upright = decode(cleaned);
        assertThat(upright.getWidth()).isEqualTo(20);
        assertThat(upright.getHeight()).isEqualTo(40);
        assertThat(reddish(upright.getRGB(10, 5))).isTrue();   // the left half is now on top
        assertThat(reddish(upright.getRGB(10, 35))).isFalse();
    }

    @Test
    void everyExifOrientationMapsPixelsAsTheStandardSays() {
        // A 3×2 picture with a different value in every pixel.
        BufferedImage src = new BufferedImage(3, 2, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 2; y++) {
            for (int x = 0; x < 3; x++) {
                src.setRGB(x, y, y * 3 + x + 1);
            }
        }
        // Displayed top-left pixel for each orientation (EXIF table): 1 2 3 / 4 5 6 stored.
        int[] topLeft = {0, 1, 3, 6, 4, 1, 4, 6, 3};
        for (int o = 1; o <= 8; o++) {
            BufferedImage out = ImageSanitizer.orient(src, o);
            assertThat(out.getWidth()).as("width for %d", o).isEqualTo(o >= 5 ? 2 : 3);
            assertThat(out.getRGB(0, 0) & 0xFFFFFF).as("top-left for %d", o).isEqualTo(topLeft[o]);
        }
    }

    @Test
    void shrinksLargePhotosAndKeepsTheShape() throws IOException {
        byte[] big = encode(halves(3000, 1000), "png");
        BufferedImage out = decode(sanitizer.clean(big, ImageType.PNG));
        assertThat(out.getWidth()).isEqualTo(2000);
        assertThat(out.getHeight()).isEqualTo(667);
    }

    @Test
    void refusesADecompressionBomb() {
        // A tiny PNG whose header claims 20 000 × 20 000 pixels (400 megapixels).
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        png.writeBytes(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A});
        ByteBuffer ihdr = ByteBuffer.allocate(13).putInt(20_000).putInt(20_000)
                .put((byte) 8).put((byte) 2).put((byte) 0).put((byte) 0).put((byte) 0);
        chunk(png, "IHDR", ihdr.array());
        chunk(png, "IEND", new byte[0]);
        assertThatThrownBy(() -> sanitizer.clean(png.toByteArray(), ImageType.PNG))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("40 megapixels");
    }

    @Test
    void refusesAFileThatOnlyLooksLikeAJpeg() {
        byte[] fake = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3, 4, 5};
        assertThatThrownBy(() -> sanitizer.clean(fake, ImageType.JPEG)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void cutsMetadataOutOfAWebp() {
        byte[] webp = webp(100, 50, true);
        byte[] cleaned = sanitizer.clean(webp, ImageType.WEBP);
        assertThat(contains(cleaned, "EXIF")).isFalse();
        assertThat(contains(cleaned, "GPS-SECRET")).isFalse();
        assertThat(contains(cleaned, "VP8L")).isTrue();
        assertThat(cleaned[20] & 0x08).as("EXIF flag cleared").isZero();
        // RIFF size = file length − 8
        int riff = ByteBuffer.wrap(cleaned, 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
        assertThat(riff).isEqualTo(cleaned.length - 8);

        assertThatThrownBy(() -> sanitizer.clean(webp(20_000, 20_000, false), ImageType.WEBP))
                .isInstanceOf(BadRequestException.class);
    }

    private static void chunk(ByteArrayOutputStream out, String type, byte[] data) {
        ByteBuffer len = ByteBuffer.allocate(4).putInt(data.length);
        out.writeBytes(len.array());
        byte[] t = type.getBytes(StandardCharsets.US_ASCII);
        out.writeBytes(t);
        out.writeBytes(data);
        CRC32 crc = new CRC32();
        crc.update(t);
        crc.update(data);
        out.writeBytes(ByteBuffer.allocate(4).putInt((int) crc.getValue()).array());
    }

    /** RIFF/WEBP with VP8X (+EXIF flag), an EXIF chunk and a tiny VP8L chunk. */
    private static byte[] webp(int w, int h, boolean withExif) {
        ByteBuffer body = ByteBuffer.allocate(200).order(ByteOrder.LITTLE_ENDIAN);
        body.put("WEBP".getBytes(StandardCharsets.US_ASCII));
        body.put("VP8X".getBytes(StandardCharsets.US_ASCII)).putInt(10);
        body.put((byte) (withExif ? 0x08 : 0)).put((byte) 0).put((byte) 0).put((byte) 0);
        put24(body, w - 1);
        put24(body, h - 1);
        if (withExif) {
            byte[] exif = "GPS-SECRET-9.66N".getBytes(StandardCharsets.US_ASCII);
            body.put("EXIF".getBytes(StandardCharsets.US_ASCII)).putInt(exif.length).put(exif);
        }
        body.put("VP8L".getBytes(StandardCharsets.US_ASCII)).putInt(6);
        int bits = (w - 1) | (h - 1) << 14;
        body.put((byte) 0x2F).putInt(bits).put((byte) 0);
        byte[] payload = java.util.Arrays.copyOf(body.array(), body.position());
        ByteBuffer file = ByteBuffer.allocate(8 + payload.length).order(ByteOrder.LITTLE_ENDIAN);
        file.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(payload.length).put(payload);
        return file.array();
    }

    private static void put24(ByteBuffer b, int v) {
        b.put((byte) v).put((byte) (v >> 8)).put((byte) (v >> 16));
    }
}
