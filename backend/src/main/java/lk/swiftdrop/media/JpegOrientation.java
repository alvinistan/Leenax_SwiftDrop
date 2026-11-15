package lk.swiftdrop.media;

/**
 * Reads the EXIF "orientation" (1–8) from a JPEG, which phones use instead of
 * turning the pixels. Returns 1 (normal) when there is none or it is damaged.
 * Only bounds-checked reads: a broken file never causes an error here.
 */
final class JpegOrientation {

    private static final int ORIENTATION_TAG = 0x0112;

    private JpegOrientation() {
    }

    static int read(byte[] b) {
        int i = 2; // after the SOI marker FF D8
        while (i + 4 <= b.length && (b[i] & 0xFF) == 0xFF) {
            int marker = b[i + 1] & 0xFF;
            int length = u16(b, i + 2, false);
            if (marker == 0xDA || length < 2) { // start of the picture data: no more headers
                return 1;
            }
            int start = i + 4;
            if (marker == 0xE1 && start + 6 <= b.length && b[start] == 'E' && b[start + 1] == 'x'
                    && b[start + 2] == 'i' && b[start + 3] == 'f') {
                return fromTiff(b, start + 6, Math.min(b.length, i + 2 + length));
            }
            i += 2 + length;
        }
        return 1;
    }

    private static int fromTiff(byte[] b, int tiff, int end) {
        if (tiff + 8 > end) {
            return 1;
        }
        boolean little = b[tiff] == 'I' && b[tiff + 1] == 'I';
        long ifd = u32(b, tiff + 4, little);
        if (ifd < 8 || tiff + ifd + 2 > end) {
            return 1;
        }
        int entries = u16(b, (int) (tiff + ifd), little);
        for (int n = 0; n < entries; n++) {
            int entry = (int) (tiff + ifd + 2 + 12L * n);
            if (entry + 12 > end) {
                return 1;
            }
            if (u16(b, entry, little) == ORIENTATION_TAG) {
                int value = u16(b, entry + 8, little);
                return value >= 1 && value <= 8 ? value : 1;
            }
        }
        return 1;
    }

    private static int u16(byte[] b, int at, boolean little) {
        if (at + 2 > b.length) {
            return 0;
        }
        int x = b[at] & 0xFF;
        int y = b[at + 1] & 0xFF;
        return little ? (y << 8) | x : (x << 8) | y;
    }

    private static long u32(byte[] b, int at, boolean little) {
        if (at + 4 > b.length) {
            return 0;
        }
        long v = 0;
        for (int k = 0; k < 4; k++) {
            int idx = little ? at + 3 - k : at + k;
            v = (v << 8) | (b[idx] & 0xFF);
        }
        return v;
    }
}
