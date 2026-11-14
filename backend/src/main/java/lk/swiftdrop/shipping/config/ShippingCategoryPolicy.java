package lk.swiftdrop.shipping.config;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.Collection;
import java.util.Set;
import java.util.TreeSet;
import lk.swiftdrop.catalog.product.ShippingCategory;

/**
 * Where products of one shipping category may be sent: abroad at all, and
 * which destination countries are blocked (owner request: e.g. countries that
 * forbid importing dried fish).
 */
@Entity
@Table(name = "shipping_category_policies")
public class ShippingCategoryPolicy {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "shipping_category", length = 30)
    private ShippingCategory category;

    @Column(name = "international_allowed", nullable = false)
    private boolean internationalAllowed;

    @ElementCollection
    @CollectionTable(name = "shipping_category_blocked_countries",
            joinColumns = @JoinColumn(name = "shipping_category"))
    @Column(name = "country_code", length = 2, nullable = false)
    private Set<String> blockedCountries = new TreeSet<>();

    protected ShippingCategoryPolicy() {
    }

    public void update(boolean internationalAllowed, Collection<String> blockedCountries) {
        this.internationalAllowed = internationalAllowed;
        this.blockedCountries.clear();
        this.blockedCountries.addAll(blockedCountries);
    }

    /** May this category be delivered to that country? Domestic delivery is always allowed. */
    public boolean allows(String destinationCountry, boolean domestic) {
        if (domestic) {
            return true;
        }
        return internationalAllowed && !blockedCountries.contains(destinationCountry);
    }

    public ShippingCategory getCategory() {
        return category;
    }

    public boolean isInternationalAllowed() {
        return internationalAllowed;
    }

    public Set<String> getBlockedCountries() {
        return new TreeSet<>(blockedCountries);
    }
}
