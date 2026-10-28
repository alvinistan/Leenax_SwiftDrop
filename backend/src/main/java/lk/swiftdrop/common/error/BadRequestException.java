package lk.swiftdrop.common.error;

/** Thrown when a request parameter is invalid in a way Bean Validation cannot express. Becomes HTTP 400. */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
