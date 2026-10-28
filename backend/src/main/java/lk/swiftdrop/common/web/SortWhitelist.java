package lk.swiftdrop.common.web;

import java.util.Set;
import lk.swiftdrop.common.error.BadRequestException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Only lets clients sort by fields we chose. Without this, ?sort= could name
 * any entity field (including nested ones), causing errors or slow queries.
 */
public final class SortWhitelist {

    private SortWhitelist() {
    }

    public static Pageable requireAllowed(Pageable pageable, Set<String> allowedProperties) {
        for (Sort.Order order : pageable.getSort()) {
            if (!allowedProperties.contains(order.getProperty())) {
                throw new BadRequestException("Cannot sort by '" + order.getProperty()
                        + "'. Allowed: " + String.join(", ", allowedProperties.stream().sorted().toList()) + ".");
            }
        }
        return pageable;
    }
}
