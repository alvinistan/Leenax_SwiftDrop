package lk.swiftdrop.media;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import lk.swiftdrop.common.error.BadRequestException;
import org.springframework.stereotype.Component;

/**
 * Cleans an uploaded photo before it is stored and shown to the public:
 * <ul>
 *   <li><b>Removes metadata</b> (EXIF, XMP): phone photos can contain the GPS
 *       position of the owner's home, the camera serial number and the time.</li>
 *   <li>Turns the picture the right way up first (the EXIF "orientation" that
 *       phones use would otherwise be lost with the metadata).</li>
 *   <li>Shrinks very large photos to at most {@value #MAX_SIDE} px on the
 *       longest side (faster pages, smaller storage bills).</li>
 *   <li>Refuses "decompression bombs": a small file that claims enormous
 *       dimensions and would use gigabytes of memory when opened.</li>
 * </ul>
 * JPEG and PNG are decoded and saved again (only the pixels survive). Java
 * cannot decode WebP, so for WebP the metadata chunks are cut out instead.
 */
@Component
public class ImageSanitizer {

    static final int MAX_SIDE = 2000;
    /** 40 megapixels: more than any phone camera; anything bigger is refused. */
    static final long MAX_PIXELS = 40_000_000L;
    private static final float JPEG_QUALITY = 0.85f;

    public byte[] clean(byte[] bytes, ImageType type) {
        return switch (type) {
            case JPEG, PNG -> reencode(bytes, type);
            case WEBP -> WebpMetadata.strip(bytes, MAX_PIXELS);
        };
    }

    private byte[] reencode(byte[] bytes, ImageType type) {
        checkDimensions(bytes);
        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException | RuntimeException e) {
            image = null;
        }
        if (image == null) {
            throw new BadRequestException("This image could not be opened. Save it again as a normal JPEG or PNG.");
        }
        image = shrink(image, type); // first: turning a smaller picture is faster
        if (type == ImageType.JPEG) {
            image = orient(image, JpegOrientation.read(bytes));
        }
        return type == ImageType.JPEG ? writeJpeg(image) : writePng(image);
    }

    /** Reads only the header (no pixels) to check the size before decoding. */
    private static void checkDimensions(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new BadRequestException("This image could not be opened. Save it again as a normal JPEG or PNG.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long width = reader.getWidth(0);
                long height = reader.getHeight(0);
                if (width * height > MAX_PIXELS) {
                    throw new BadRequestException("This image is too large (more than 40 megapixels).");
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new BadRequestException("This image could not be opened. Save it again as a normal JPEG or PNG.");
        }
    }

    /**
     * EXIF orientation 1–8 → the picture as the camera holder saw it. For each
     * displayed pixel (x, y) this picks the stored pixel, as in the EXIF table.
     */
    static BufferedImage orient(BufferedImage src, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = orientation >= 5;
        int ow = swap ? h : w;
        int oh = swap ? w : h;
        BufferedImage out = new BufferedImage(ow, oh, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < oh; y++) {
            for (int x = 0; x < ow; x++) {
                int sx;
                int sy;
                switch (orientation) {
                    case 2 -> { sx = w - 1 - x; sy = y; }
                    case 3 -> { sx = w - 1 - x; sy = h - 1 - y; }
                    case 4 -> { sx = x; sy = h - 1 - y; }
                    case 5 -> { sx = y; sy = x; }
                    case 6 -> { sx = y; sy = h - 1 - x; }
                    case 7 -> { sx = w - 1 - y; sy = h - 1 - x; }
                    default -> { sx = w - 1 - y; sy = x; } // 8
                }
                out.setRGB(x, y, src.getRGB(sx, sy));
            }
        }
        return out;
    }

    private static BufferedImage shrink(BufferedImage src, ImageType type) {
        int w = src.getWidth();
        int h = src.getHeight();
        int longest = Math.max(w, h);
        boolean jpeg = type == ImageType.JPEG;
        // JPEG has no transparency: always draw onto plain RGB (also fixes odd colour models).
        if (longest <= MAX_SIDE && (!jpeg || src.getType() == BufferedImage.TYPE_INT_RGB
                || src.getType() == BufferedImage.TYPE_3BYTE_BGR)) {
            return src;
        }
        double scale = Math.min(1.0, MAX_SIDE / (double) longest);
        int nw = Math.max(1, (int) Math.round(w * scale));
        int nh = Math.max(1, (int) Math.round(h * scale));
        BufferedImage out = new BufferedImage(nw, nh, jpeg ? BufferedImage.TYPE_INT_RGB : BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(src, 0, 0, nw, nh, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static byte[] writeJpeg(BufferedImage image) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ImageOutputStream out = ImageIO.createImageOutputStream(bytes)) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.setOutput(out);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            writer.dispose();
        }
        return bytes.toByteArray();
    }

    private static byte[] writePng(BufferedImage image) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, "png", bytes);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }
}
