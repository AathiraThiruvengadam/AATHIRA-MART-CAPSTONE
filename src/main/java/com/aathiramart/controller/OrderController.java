package com.aathiramart.controller;

import com.aathiramart.dto.ApiResponse;
import com.aathiramart.dto.CheckoutRequest;
import com.aathiramart.dto.OrderDTO;
import com.aathiramart.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Checkout + order history (login required). */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrderDTO>> checkout(Authentication authentication,
                                                          @Valid @RequestBody CheckoutRequest request) {
        OrderDTO order = orderService.placeOrder(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Order placed successfully", order));
    }

    @GetMapping
    public ResponseEntity<List<OrderDTO>> history(Authentication authentication) {
        return ResponseEntity.ok(orderService.listOrders(authentication.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDTO>> detail(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Order loaded", orderService.getOrder(authentication.getName(), id)));
    }
}
