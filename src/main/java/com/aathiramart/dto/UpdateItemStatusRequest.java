package com.aathiramart.dto;

import jakarta.validation.constraints.NotBlank;

/** Payload for PUT /api/seller/order-items/{id}/status. */
public class UpdateItemStatusRequest {

    /** PROCESSING | SHIPPED | DELIVERED */
    @NotBlank(message = "Status is required")
    private String status;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
