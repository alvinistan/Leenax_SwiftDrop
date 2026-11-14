package lk.swiftdrop.shipping.config;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** ISO 3166 two-letter country codes and English names, from the Java runtime (no hand-typed list). */
public final class Countries {

    public record Country(String code, String name) {
    }

    private static final Set<String> CODES = Set.of(Locale.getISOCountries());

    private static final List<Country> ALL = CODES.stream()
            .map(code -> new Country(code, Locale.of("", code).getDisplayCountry(Locale.ENGLISH)))
            .sorted(Comparator.comparing(Country::name))
            .toList();

    private Countries() {
    }

    public static boolean isValid(String code) {
        return code != null && CODES.contains(code);
    }

    public static List<Country> all() {
        return ALL;
    }
}
