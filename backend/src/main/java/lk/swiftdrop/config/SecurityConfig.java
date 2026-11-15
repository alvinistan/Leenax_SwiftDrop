package lk.swiftdrop.config;

import static org.springframework.security.config.Customizer.withDefaults;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import lk.swiftdrop.security.LoginAttemptService;
import lk.swiftdrop.security.RateLimitFilter;
import lk.swiftdrop.security.RateLimitProperties;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.web.filter.CorsFilter;

/**
 * All security rules in one place.
 *
 * <p><b>How login works:</b> the React app POSTs email and password to
 * /api/auth/login. Spring Security checks them and stores the login in a
 * server-side session. The browser keeps only the session id, in an HttpOnly
 * cookie that JavaScript cannot read (so an injected script cannot steal it).
 *
 * <p><b>CSRF:</b> because the browser sends that cookie automatically, another
 * website could try to make the browser call our API ("cross-site request
 * forgery"). So every POST/PUT/PATCH/DELETE must also send the token from the
 * XSRF-TOKEN cookie in an X-XSRF-TOKEN header, which only our own pages can
 * read. csrf.spa() sets this up for single-page apps.
 *
 * <p><b>Authorization:</b> the rules below are checked on the server for every
 * request. Hiding a button in the UI is never enough.
 */
@Configuration
@org.springframework.boot.context.properties.EnableConfigurationProperties(RateLimitProperties.class)
public class SecurityConfig {

    @Bean
    LoginAttemptService loginAttemptService(RateLimitProperties properties, ObjectProvider<Clock> clock) {
        return new LoginAttemptService(properties, clock.getIfAvailable(Clock::systemUTC));
    }

    @Bean
    RateLimitFilter rateLimitFilter(RateLimitProperties properties, LoginAttemptService loginAttempts,
                                    ObjectProvider<Clock> clock) {
        return new RateLimitFilter(properties, loginAttempts, clock.getIfAvailable(Clock::systemUTC));
    }

    /**
     * The rate limiter runs inside the security chain (below), right after
     * CORS, so it also protects the login. Spring Boot must not ALSO run it as
     * a plain servlet filter.
     */
    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, RateLimitFilter rateLimit,
                                            LoginAttemptService loginAttempts) throws Exception {
        http
                .cors(withDefaults()) // uses the CorsConfigurationSource bean (CorsConfig)
                // 429 answers still carry CORS headers, so the browser can show the message.
                .addFilterAfter(rateLimit, CorsFilter.class)
                .headers(headers -> headers
                        // The API returns data, never pages: nothing may be loaded or framed from it.
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(
                                PathPatternRequestMatcher.withDefaults().matcher("/api/**"),
                                new StaticHeadersWriter("Content-Security-Policy",
                                        "default-src 'none'; frame-ancestors 'none'")))
                        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER))
                        // HSTS is sent on HTTPS requests only (production, Phase 14).
                        .httpStrictTransportSecurity(hsts -> hsts.maxAgeInSeconds(31_536_000)))
                .csrf(csrf -> csrf.spa()
                        // PayHere calls this server to server (no browser, no CSRF token);
                        // its md5sig signature is checked instead (PaymentService).
                        .ignoringRequestMatchers("/api/payments/payhere/notify"))
                .authorizeHttpRequests(auth -> auth
                        // The order matters: the first matching rule wins.
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/categories/**", "/api/products/**").permitAll()
                        // Shipping quotes: guests may ask for a delivery price (prices are worked out on the server).
                        .requestMatchers(HttpMethod.POST, "/api/shipping/quotes").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/shipping/quotes/*").permitAll()
                        // Countries we deliver to (checkout address form)
                        .requestMatchers(HttpMethod.GET, "/api/shipping/destinations").permitAll()
                        // Online payments: is card payment offered? / PayHere's signed notification
                        .requestMatchers(HttpMethod.GET, "/api/payments/options").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments/payhere/notify").permitAll()
                        // Customers create their own account (no guest checkout)
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        // Prices for the items in a cart (the browser keeps only ids and quantities)
                        .requestMatchers(HttpMethod.POST, "/api/cart/price").permitAll()
                        // A customer's own orders (checked again in OrderService)
                        .requestMatchers("/api/orders", "/api/orders/**").hasRole("CUSTOMER")
                        // Delivery staff: only their own parcels (checked again in DeliveryJobService)
                        .requestMatchers("/api/delivery/**").hasRole("DELIVERY")
                        .requestMatchers("/api/auth/me", "/api/auth/password").authenticated()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/error").permitAll()
                        // API documentation (disable with API_DOCS_ENABLED=false in production)
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // Anything not listed above is refused ("deny by default").
                        .anyRequest().denyAll())
                .formLogin(login -> login
                        .loginProcessingUrl("/api/auth/login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        // An API answers with status codes, not redirects to HTML pages.
                        .successHandler((request, response, authentication) -> {
                            loginAttempts.succeeded(authentication.getName());
                            response.setStatus(HttpStatus.NO_CONTENT.value());
                        })
                        .failureHandler((request, response, exception) -> {
                            // Counts towards the account lockout (RateLimitFilter refuses locked emails).
                            loginAttempts.failed(request.getParameter("email"));
                            writeProblem(response, HttpStatus.UNAUTHORIZED, "The email or password is incorrect.");
                        })
                        .permitAll())
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                // Don't remember the last request to "redirect back" to: there are no server pages.
                .requestCache(cache -> cache.disable())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> writeProblem(
                                response, HttpStatus.UNAUTHORIZED, "Please log in to continue."))
                        .accessDeniedHandler((request, response, exception) -> writeProblem(
                                response, HttpStatus.FORBIDDEN, "You do not have permission to do this.")));
        return http.build();
    }

    /**
     * Hashes passwords with bcrypt (slow on purpose, salted). The "{bcrypt}" prefix
     * stored with each hash lets us move to a stronger algorithm later.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /** The same RFC 9457 JSON shape as GlobalExceptionHandler. Messages are fixed text, never user input. */
    private static void writeProblem(HttpServletResponse response, HttpStatus status, String detail)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/problem+json");
        response.getWriter().write("""
                {"title":"%s","status":%d,"detail":"%s"}""".formatted(status.getReasonPhrase(), status.value(), detail));
    }
}
