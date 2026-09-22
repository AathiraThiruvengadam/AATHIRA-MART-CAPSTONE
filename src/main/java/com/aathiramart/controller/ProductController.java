package com.aathiramart.controller;

import com.aathiramart.dto.ApiResponse;
import com.aathiramart.dto.ProductDTO;
import com.aathiramart.dto.ProductPageResponse;
import com.aathiramart.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * Public product endpoints:
 *   GET /api/products?search=&category=&minPrice=&maxPrice=&sort=&page=&size=
 *   GET /api/products/featured
 *   GET /api/products/{id}
 *   GET /api/products/{id}/related
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<ProductPageResponse> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false, defaultValue = "newest") String sort,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "12") int size) {
        return ResponseEntity.ok(productService.search(search, category, minPrice, maxPrice, sort, page, size));
    }

    @GetMapping("/featured")
    public ResponseEntity<ProductPageResponse> featured(
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "8") int size) {
        return ResponseEntity.ok(productService.featured(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDTO>> detail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Product loaded", productService.toDto(productService.requireProduct(id))));
    }

    @GetMapping("/{id}/related")
    public ResponseEntity<List<ProductDTO>> related(@PathVariable Long id) {
        ProductDTO product = productService.toDto(productService.requireProduct(id));
        return ResponseEntity.ok(productService.related(product.getCategoryId(), id));
    }
}
