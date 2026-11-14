package lk.swiftdrop.order;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Address snapshot. Personal data: never written to logs. */
@Embeddable
public record DeliveryAddress(
        @Column(name = "recipient_name", nullable = false, length = 100) String recipientName,
        @Column(name = "recipient_phone", nullable = false, length = 30) String phone,
        @Column(name = "address_line1", nullable = false, length = 150) String line1,
        @Column(name = "address_line2", length = 150) String line2,
        @Column(nullable = false, length = 100) String city,
        @Column(length = 100) String region,
        @Column(name = "postal_code", length = 20) String postalCode,
        @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "country_code", nullable = false, length = 2) String countryCode) {
}
