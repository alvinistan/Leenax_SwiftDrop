package lk.swiftdrop.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class ImageTypeTest {

    private static byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = (byte) values[i];
        }
        return result;
    }

    @Test
    void recognisesRealImagesByTheirFirstBytes() {
        assertThat(ImageType.detect(bytes(0xFF, 0xD8, 0xFF, 0xE0))).contains(ImageType.JPEG);
        assertThat(ImageType.detect(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0))).contains(ImageType.PNG);
        assertThat(ImageType.detect("RIFF1234WEBPVP8 ".getBytes(StandardCharsets.US_ASCII))).contains(ImageType.WEBP);
    }

    @Test
    void rejectsEverythingElseWhateverItIsCalled() {
        // An SVG (can contain scripts), a text file renamed to .png, a GIF, an empty file
        assertThat(ImageType.detect("<svg onload=alert(1)>".getBytes(StandardCharsets.UTF_8))).isEmpty();
        assertThat(ImageType.detect("just some text".getBytes(StandardCharsets.UTF_8))).isEmpty();
        assertThat(ImageType.detect("GIF89a".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(ImageType.detect(new byte[0])).isEmpty();
        assertThat(ImageType.detect(bytes(0xFF, 0xD8))).isEmpty(); // too short
    }
}
