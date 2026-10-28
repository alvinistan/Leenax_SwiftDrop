package lk.swiftdrop.common.error;

/**
 * Thrown when a request is valid but clashes with the current data,
 * e.g. a duplicate slug or deleting a category that still has products.
 * Becomes HTTP 409.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
