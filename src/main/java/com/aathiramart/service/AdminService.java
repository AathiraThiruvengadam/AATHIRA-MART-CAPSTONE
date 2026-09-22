package com.aathiramart.service;

import com.aathiramart.dto.ApiResponse;
import com.aathiramart.dto.OrderDTO;
import com.aathiramart.dto.UserDTO;
import com.aathiramart.entity.Order;
import com.aathiramart.entity.OrderStatus;
import com.aathiramart.entity.Role;
import com.aathiramart.entity.User;
import com.aathiramart.exception.BadRequestException;
import com.aathiramart.exception.OutOfStockException;
import com.aathiramart.exception.ResourceNotFoundException;
import com.aathiramart.repository.OrderRepository;
import com.aathiramart.repository.PasswordResetTokenRepository;
import com.aathiramart.repository.ProductRepository;
import com.aathiramart.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Admin dashboard operations: user / seller management and full order control.
 * URL rules (/api/admin/**) already require ROLE_ADMIN; this service adds
 * safety checks (no self-lockout, no FK-breaking deletes, stock-safe cancels).
 */
@Service
public class AdminService {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final OrderService orderService;
    private final AuthService authService;

    public AdminService(UserRepository userRepository,
                        ProductRepository productRepository,
                        OrderRepository orderRepository,
                        PasswordResetTokenRepository tokenRepository,
                        OrderService orderService,
                        AuthService authService) {
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.tokenRepository = tokenRepository;
        this.orderService = orderService;
        this.authService = authService;
    }

    /* ------------------------- users & sellers ------------------------- */

    @Transactional(readOnly = true)
    public List<UserDTO> listUsers() {
        return userRepository.findAll().stream()
                .map(authService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserDTO> listSellers() {
        return userRepository.findByRoleOrderByCreatedAtDesc(Role.SELLER).stream()
                .map(authService::toDto)
                .toList();
    }

    @Transactional
    public UserDTO updateRole(String adminEmail, Long userId, String roleValue) {
        User admin = requireUser(adminEmail);
        User target = userRepository.findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.of("User", userId));
        Role newRole = parseRole(roleValue);

        if (target.getId().equals(admin.getId()) && target.getRole() != newRole) {
            throw new BadRequestException("You cannot change your own role");
        }
        if (target.getRole() == Role.ADMIN && newRole != Role.ADMIN
                && userRepository.countByRole(Role.ADMIN) <= 1) {
            throw new BadRequestException("You cannot demote the last administrator");
        }

        target.setRole(newRole);
        userRepository.save(target);
        return authService.toDto(target);
    }

    @Transactional
    public ApiResponse<Void> deleteUser(String adminEmail, Long userId) {
        User admin = requireUser(adminEmail);
        User target = userRepository.findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.of("User", userId));

        if (target.getId().equals(admin.getId())) {
            throw new BadRequestException("You cannot delete your own account");
        }
        if (target.getRole() == Role.ADMIN && userRepository.countByRole(Role.ADMIN) <= 1) {
            throw new BadRequestException("You cannot delete the last administrator");
        }
        if (orderRepository.countByUserId(target.getId()) > 0) {
            throw new BadRequestException(
                    "\"" + target.getFullName() + "\" has placed orders and cannot be deleted. "
                            + "Change their role instead.");
        }
        if (productRepository.countBySellerId(target.getId()) > 0) {
            throw new BadRequestException(
                    "\"" + target.getFullName() + "\" still owns products. "
                            + "Delete those products first.");
        }

        tokenRepository.deleteByUserId(target.getId());
        userRepository.delete(target);
        return ApiResponse.ok("User deleted", null);
    }

    /* ------------------------- orders ------------------------- */

    @Transactional(readOnly = true)
    public List<OrderDTO> listOrders() {
        return orderService.listAllOrders();
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrder(Long orderId) {
        return orderService.getAnyOrder(orderId);
    }

    /**
     * Admin can move an order to any status.
     * Cancelling restores stock; un-cancelling re-reserves it (409 when short).
     */
    @Transactional
    public ApiResponse<OrderDTO> updateStatus(Long orderId, String statusValue) {
        OrderStatus newStatus = parseOrderStatus(statusValue);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ResourceNotFoundException.of("Order", orderId));
        OrderStatus previous = order.getStatus();

        if (newStatus == OrderStatus.CANCELLED && previous != OrderStatus.CANCELLED) {
            restock(order);
        } else if (previous == OrderStatus.CANCELLED && newStatus != OrderStatus.CANCELLED) {
            reserveStock(order);
        }

        order.setStatus(newStatus);
        orderRepository.save(order);
        return ApiResponse.ok("Order status updated", orderService.toDto(order));
    }

    private void restock(Order order) {
        order.getItems().forEach(item -> {
            if (item.getProduct() == null) {
                return;
            }
            var product = item.getProduct();
            product.setStock(product.getStock() + item.getQuantity());
            productRepository.save(product);
        });
    }

    private void reserveStock(Order order) {
        order.getItems().forEach(item -> {
            if (item.getProduct() == null) {
                return;
            }
            var product = item.getProduct();
            if (product.getStock() < item.getQuantity()) {
                throw new OutOfStockException(product.getName(), product.getStock());
            }
            product.setStock(product.getStock() - item.getQuantity());
            productRepository.save(product);
        });
    }

    /* ------------------------- helpers ------------------------- */

    private Role parseRole(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Role is required. Use BUYER, SELLER or ADMIN");
        }
        try {
            return Role.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid role. Use BUYER, SELLER or ADMIN");
        }
    }

    private OrderStatus parseOrderStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Status is required");
        }
        try {
            return OrderStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException(
                    "Invalid status. Use PLACED, CONFIRMED, SHIPPED, DELIVERED or CANCELLED");
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
    }
}
