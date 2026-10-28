package lk.swiftdrop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point of the SwiftDrop backend.
 *
 * <p>{@code @SpringBootApplication} turns on auto-configuration and component
 * scanning for this package and every package below it ({@code lk.swiftdrop.*}),
 * which is why all modules must live under {@code lk.swiftdrop}.
 */
@SpringBootApplication
public class SwiftDropApplication {

    public static void main(String[] args) {
        SpringApplication.run(SwiftDropApplication.class, args);
    }
}
