package lk.swiftdrop.common.error;

/** Thrown when a requested record does not exist. Becomes HTTP 404. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resourceName, Object id) {
        super(resourceName + " not found: " + id);
    }
}
