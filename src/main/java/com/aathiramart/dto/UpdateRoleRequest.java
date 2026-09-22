package com.aathiramart.dto;

import jakarta.validation.constraints.NotBlank;

/** Payload for PUT /api/admin/users/{id}/role. */
public class UpdateRoleRequest {

    @NotBlank(message = "Role is required")
    private String role;

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
