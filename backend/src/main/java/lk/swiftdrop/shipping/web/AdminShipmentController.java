package lk.swiftdrop.shipping.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.UUID;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.CreateShipmentRequest;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ShipmentDetail;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ShipmentDetailsRequest;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ShipmentSummary;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.TrackingUpdateRequest;
import lk.swiftdrop.shipping.shipment.ShipmentService;
import lk.swiftdrop.shipping.shipment.TrackingStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/** Manual shipments and tracking (ADMIN only, via /api/admin/**). */
@RestController
@Validated
@RequestMapping("/api/admin/shipping/shipments")
public class AdminShipmentController {

    private final ShipmentService shipments;

    public AdminShipmentController(ShipmentService shipments) {
        this.shipments = shipments;
    }

    /** GET ?q=AWB-or-order-ref&status=IN_TRANSIT&providerId=…&page=0&size=20, newest first. */
    @GetMapping
    public ResponseEntity<PageResponse<ShipmentSummary>> search(
            @RequestParam(required = false) @Size(max = 60) String q,
            @RequestParam(required = false) TrackingStatus status,
            @RequestParam(required = false) UUID providerId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok(shipments.search(q, status, providerId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ShipmentDetail> get(@PathVariable UUID id) {
        return ResponseEntity.ok(shipments.get(id));
    }

    @PostMapping
    public ResponseEntity<ShipmentDetail> create(@Valid @RequestBody CreateShipmentRequest request) {
        ShipmentDetail created = shipments.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    /** Correct the details (e.g. a mistyped AWB). The status changes only through tracking updates. */
    @PutMapping("/{id}")
    public ResponseEntity<ShipmentDetail> update(@PathVariable UUID id,
                                                 @Valid @RequestBody ShipmentDetailsRequest request) {
        return ResponseEntity.ok(shipments.updateDetails(id, request));
    }

    @PostMapping("/{id}/tracking")
    public ResponseEntity<ShipmentDetail> addTrackingUpdate(@PathVariable UUID id,
                                                            @Valid @RequestBody TrackingUpdateRequest request) {
        return ResponseEntity.ok(shipments.addTrackingUpdate(id, request));
    }
}
