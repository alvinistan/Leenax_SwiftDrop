package lk.swiftdrop.delivery;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.delivery.DeliveryJobService.JobDetail;
import lk.swiftdrop.delivery.DeliveryJobService.JobSummary;
import lk.swiftdrop.delivery.DeliveryJobService.JobUpdateRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The delivery staff pages (role DELIVERY, see SecurityConfig): only their own parcels. */
@RestController
@RequestMapping("/api/delivery/jobs")
public class DeliveryController {

    private final DeliveryJobService jobs;

    public DeliveryController(DeliveryJobService jobs) {
        this.jobs = jobs;
    }

    @GetMapping
    public ResponseEntity<List<JobSummary>> myJobs(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(jobs.myJobs(user.getUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobDetail> myJob(@AuthenticationPrincipal UserDetails user, @PathVariable UUID id) {
        return ResponseEntity.ok(jobs.myJob(user.getUsername(), id));
    }

    @PostMapping("/{id}/updates")
    public ResponseEntity<JobDetail> update(@AuthenticationPrincipal UserDetails user, @PathVariable UUID id,
                                            @Valid @RequestBody JobUpdateRequest request) {
        return ResponseEntity.ok(jobs.update(user.getUsername(), id, request));
    }
}
