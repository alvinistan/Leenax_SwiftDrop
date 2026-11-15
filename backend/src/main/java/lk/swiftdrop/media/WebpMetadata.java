package lk.swiftdrop.media;

import java.io.ByteArrayOutputStream;
import lk.swiftdrop.common.error.BadRequestException;

/**
 * WebP files are a list of "chunks" (RIFF). The picture is in VP8/VP8L/ALPH/
 * ANIM chunks; metadata is in separate EXIF and XMP chunks, which are cut out
 * here (and their flags cleared in the VP8X header). The pixels are untouched.
 */
final class WebpMetadata {

    private static final int EXIF_FLAG = 0x08;
    private static final int XMP_FLAG = 0x04;

    private WebpMetadata() {
    }

    static byte[] strip(byte[] b, long maxPixels) {
        if (b.length < 12) {
            throw unreadable();
        }
        ByteArrayOutputStream body = new ByteArrayOutputStream(b.length);
        body.write(b, 8, 4); // "WEBP"
        int i = 12;
        boolean hasImage = false;
        while (i + 8 <= b.length) {
            String id = new String(b, i, 4, java.nio.charset.StandardCharsets.US_ASCII);
            long size = le32(b, i + 4);
            long padded = size + (size & 1);
            if (size < 0 || i + 8 + padded > b.length + (size & 1)) {
                throw unreadable();
            }
            int dataStart = i + 8;
            int chunkEnd = (int) Math.min(b.length, dataStart + padded);
            switch (id) {
                case "EXIF", "XMP " -> { } // dropped
                case "VP8X" -> {
                    if (size < 10) {
                        throw unreadable();
                    }
                    long w = 1 + le24(b, dataStart + 4);
                    long h = 1 + le24(b, dataStart + 7);
                    checkPixels(w, h, maxPixels);
                    byte[] copy = java.util.Arrays.copyOfRange(b, i, chunkEnd);
                    copy[8] = (byte) (copy[8] & ~(EXIF_FLAG | XMP_FLAG));
                    body.writeBytes(copy);
                }
                case "VP8 " -> {
                    if (size >= 10) {
                        checkPixels(le16(b, dataStart + 6) & 0x3FFF, le16(b, dataStart + 8) & 0x3FFF, maxPixels);
                    }
                    hasImage = true;
                    body.write(b, i, chunkEnd - i);
                }
                case "VP8L" -> {
                    if (size >= 5) {
                        long bits = le32(b, dataStart + 1);
                        checkPixels((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1, maxPixels);
                    }
                    hasImage = true;
                    body.write(b, i, chunkEnd - i);
                }
                default -> {
                    if ("ANMF".equals(id)) {
                        hasImage = true;
                    }
                    body.write(b, i, chunkEnd - i);
                }
            }
            i = chunkEnd;
        }
        if (!hasImage) {
            throw unreadable();
        }
        byte[] payload = body.toByteArray();
        ByteArrayOutputStream out = new ByteArrayOutputStream(payload.length + 8);
        out.writeBytes(new byte[] {'R', 'I', 'F', 'F'});
        int riffSize = payload.length;
        out.writeBytes(new byte[] {(byte) riffSize, (byte) (riffSize >> 8), (byte) (riffSize >> 16),
            (byte) (riffSize >> 24)});
        out.writeBytes(payload);
        return out.toByteArray();
    }

    private static void checkPixels(long w, long h, long max) {
        if (w * h > max) {
            throw new BadRequestException("This image is too large (more than 40 megapixels).");
        }
    }

    private static BadRequestException unreadable() {
        return new BadRequestException("This WebP image could not be read. Save it again or upload a JPEG.");
    }

    private static int le16(byte[] b, int at) {
        return at + 2 > b.length ? 0 : (b[at] & 0xFF) | (b[at + 1] & 0xFF) << 8;
    }

    private static long le24(byte[] b, int at) {
        return at + 3 > b.length ? 0 : (b[at] & 0xFF) | (b[at + 1] & 0xFF) << 8 | (long) (b[at + 2] & 0xFF) << 16;
    }

    private static long le32(byte[] b, int at) {
        return at + 4 > b.length ? -1 : le24(b, at) | (long) (b[at + 3] & 0xFF) << 24;
    }
}
