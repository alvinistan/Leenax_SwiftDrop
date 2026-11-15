package lk.swiftdrop.shipping.shipment;

/** Why a delivery attempt failed (Phase 10). Customers see these words too. */
public enum FailureReason {
    NOT_AT_HOME("Nobody was at home"),
    WRONG_ADDRESS("The address could not be found"),
    PHONE_UNREACHABLE("The phone could not be reached"),
    REFUSED("The parcel was refused"),
    NO_CASH("The cash payment was not ready"),
    OTHER("Other reason");

    private final String label;

    FailureReason(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
