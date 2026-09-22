package com.aathiramart.controller;

import com.aathiramart.dto.ApiResponse;
import com.aathiramart.dto.OrderDTO;
import com.aathiramart.dto.UpdateOrderStatusRequest;
import com.aathiramart.dto.UpdateRoleRequest;
import com.aathiramart.dto.UserDTO;
import com.aathiramart.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin dashboard API (ROLE_ADMIN enforced by URL rule):
 *   GET    /api/admin/users
 *   GET    /api/admin/sellers
 *   PUT    /api/admin/users/{id}/role
 *   DELETE /api/admin/users/{id}
 *   GET    /api/admin/orders
 *   GET    /api/admin/orders/{id}
 *   PUT    /api/admin/orders/{id}/status
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    /* ------------------------- users & sellers ------------------------- */

    @GetMapping("/users")
    public ResponseEntity<List<UserDTO>> users() {
        return ResponseEntity.ok(adminService.listUsers());
    }

    @GetMapping("/sellers")
    public ResponseEntity<List<UserDTO>> sellers() {
        return ResponseEntity.ok(adminService.listSellers());
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<UserDTO>> updateRole(Authentication authentication,
                                                           @PathVariable Long id,
                                                           @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Role updated",
                adminService.updateRole(authentication.getName(), id, request.getRole())));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(Authentication authentication,
                                                        @PathVariable Long id) {
        return ResponseEntity.ok(adminService.deleteUser(authentication.getName(), id));
    }

    /* ------------------------- orders ------------------------- */

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDTO>> orders() {
        return ResponseEntity.ok(adminService.listOrders());
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<ApiResponse<OrderDTO>> order(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Order loaded", adminService.getOrder(id)));
    }

    @PutMapping("/orders/{id}/status")
    public ResponseEntity<ApiResponse<OrderDTO>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        return ResponseEntity.ok(adminService.updateStatus(id, request.getStatus()));
    }
}
