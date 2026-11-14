package lk.swiftdrop.shipping.config;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lk.swiftdrop.shipping.parcel.BoxSpec;

/** A box size the shop packs orders in. */
@Entity
@Table(name = "package_presets")
public class PackagePreset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    @Column(name = "length_cm", nullable = false, precision = 8, scale = 1)
    private BigDecimal lengthCm;

    @Column(name = "width_cm", nullable = false, precision = 8, scale = 1)
    private BigDecimal widthCm;

    @Column(name = "height_cm", nullable = false, precision = 8, scale = 1)
    private BigDecimal heightCm;

    @Column(name = "empty_weight_kg", nullable = false, precision = 10, scale = 3)
    private BigDecimal emptyWeightKg;

    @Column(name = "max_weight_kg", precision = 10, scale = 3)
    private BigDecimal maxWeightKg;

    @Column(nullable = false)
    private boolean enabled;

    protected PackagePreset() {
    }

    public PackagePreset(String name, BigDecimal lengthCm, BigDecimal widthCm, BigDecimal heightCm,
                         BigDecimal emptyWeightKg, BigDecimal maxWeightKg, boolean enabled) {
        update(name, lengthCm, widthCm, heightCm, emptyWeightKg, maxWeightKg, enabled);
    }

    public void update(String name, BigDecimal lengthCm, BigDecimal widthCm, BigDecimal heightCm,
                       BigDecimal emptyWeightKg, BigDecimal maxWeightKg, boolean enabled) {
        this.name = name;
        this.lengthCm = lengthCm;
        this.widthCm = widthCm;
        this.heightCm = heightCm;
        this.emptyWeightKg = emptyWeightKg;
        this.maxWeightKg = maxWeightKg;
        this.enabled = enabled;
    }

    public BoxSpec toBoxSpec() {
        return new BoxSpec(name, lengthCm, widthCm, heightCm, emptyWeightKg, maxWeightKg);
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getLengthCm() {
        return lengthCm;
    }

    public BigDecimal getWidthCm() {
        return widthCm;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public BigDecimal getEmptyWeightKg() {
        return emptyWeightKg;
    }

    public BigDecimal getMaxWeightKg() {
        return maxWeightKg;
    }

    public boolean isEnabled() {
        return enabled;
    }
}
