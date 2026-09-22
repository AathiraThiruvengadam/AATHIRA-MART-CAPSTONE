package com.aathiramart.controller;

import com.aathiramart.dto.ApiResponse;
import com.aathiramart.dto.OrderDTO;
import com.aathiramart.dto.ProductDTO;
import com.aathiramart.dto.ProductRequest;
import com.aathiramart.dto.UpdateItemStatusRequest;
import com.aathiramart.service.SellerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Seller dashboard API (ROLE_SELLER or ROLE_ADMIN enforced by URL rule):
 *   GET/POST     /api/seller/products
 *   PUT/DELETE   /api/seller/products/{id}
 *   GET          /api/seller/orders
 *   GET          /api/seller/orders/{id}
 *   PUT          /api/seller/order-items/{id}/status
 */
@RestController
@RequestMapping("/api/seller")
public class SellerController {

    private final SellerService sellerService;

    public SellerController(SellerService sellerService) {
        this.sellerService = sellerService;
    }

    /* ------------------------- products ------------------------- */

    @GetMapping("/products")
    public ResponseEntity<List<ProductDTO>> myProducts(Authentication authentication) {
        return ResponseEntity.ok(sellerService.listProducts(authentication.getName()));
    }

    @PostMapping("/products")
    public ResponseEntity<ApiResponse<ProductDTO>> create(Authentication authentication,
                                                          @Valid @RequestBody ProductRequest request) {
        ProductDTO created = sellerService.createProduct(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Product created", created));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<ApiResponse<ProductDTO>> update(Authentication authentication,
                                                          @PathVariable Long id,
                                                          @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Product updated",
                sellerService.updateProduct(authentication.getName(), id, request)));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(sellerService.deleteProduct(authentication.getName(), id));
    }

    /* ------------------------- orders ------------------------- */

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDTO>> orders(Authentication authentication) {
        return ResponseEntity.ok(sellerService.listOrders(authentication.getName()));
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<ApiResponse<OrderDTO>> order(Authentication authentication,
                                                       @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Order loaded",
                sellerService.getOrder(authentication.getName(), id)));
    }

    @PutMapping("/order-items/{id}/status")
    public ResponseEntity<ApiResponse<OrderDTO>> updateItemStatus(Authentication authentication,
                                                                  @PathVariable Long id,
                                                                  @Valid @RequestBody UpdateItemStatusRequest request) {
        return ResponseEntity.ok(sellerService.updateItemStatus(
                authentication.getName(), id, request.getStatus()));
    }
}
