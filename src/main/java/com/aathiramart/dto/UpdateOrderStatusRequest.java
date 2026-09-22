package com.aathiramart.dto;

import jakarta.validation.constraints.NotBlank;

/** Payload for PUT /api/admin/orders/{id}/status. */
public class UpdateOrderStatusRequest {

    @NotBlank(message = "Status is required")
    private String status;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
