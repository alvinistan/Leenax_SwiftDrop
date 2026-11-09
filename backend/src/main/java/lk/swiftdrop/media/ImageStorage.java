package lk.swiftdrop.media;

/**
 * Where image files are kept. The application only talks to this interface;
 * S3ImageStorage is the real implementation (AWS S3, or an S3-compatible
 * server such as S3Mock locally).
 */
public interface ImageStorage {

    /** Saves the bytes under the given key, e.g. "products/{id}/{uuid}.webp". */
    void store(String key, byte[] bytes, String contentType);

    /** Deletes the file. Deleting a key that does not exist is not an error. */
    void delete(String key);

    /** A short-lived URL a browser can use to show the (private) image. */
    String urlFor(String key);
}
