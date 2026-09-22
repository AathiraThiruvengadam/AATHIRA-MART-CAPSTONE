package com.aathiramart.service;

import com.aathiramart.dto.ProductDTO;
import com.aathiramart.dto.ProductPageResponse;
import com.aathiramart.dto.ProductRequest;
import com.aathiramart.entity.Category;
import com.aathiramart.entity.Product;
import com.aathiramart.entity.Role;
import com.aathiramart.entity.User;
import com.aathiramart.exception.BadRequestException;
import com.aathiramart.exception.ResourceNotFoundException;
import com.aathiramart.repository.CategoryRepository;
import com.aathiramart.repository.OrderItemRepository;
import com.aathiramart.repository.ProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Catalogue search, details and admin CRUD for products. */
@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final OrderItemRepository orderItemRepository;

    public ProductService(ProductRepository productRepository,
                          CategoryRepository categoryRepository,
                          OrderItemRepository orderItemRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.orderItemRepository = orderItemRepository;
    }

    @Transactional(readOnly = true)
    public ProductPageResponse search(String query, String categorySlug, BigDecimal minPrice,
                                      BigDecimal maxPrice, String sort, int page, int size) {
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new BadRequestException("Minimum price cannot be greater than maximum price");
        }

        Long categoryId = null;
        if (categorySlug != null && !categorySlug.isBlank()) {
            categoryId = categoryRepository.findBySlug(categorySlug.trim())
                    .orElseThrow(() -> ResourceNotFoundException.of("Category", categorySlug))
                    .getId();
        }

        String q = (query == null || query.isBlank()) ? null : query.trim().toLowerCase();
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 48);

        Pageable pageable = PageRequest.of(safePage, safeSize, sortSpec(sort));
        Page<Product> result = productRepository.search(q, categoryId, minPrice, maxPrice, pageable);

        return new ProductPageResponse(
                result.getContent().stream().map(this::toDto).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public ProductPageResponse featured(int page, int size) {
        Page<Product> result = productRepository
                .findByFeaturedTrue(PageRequest.of(Math.max(0, page), Math.max(1, size),
                        Sort.by("createdAt").descending()));
        return new ProductPageResponse(
                result.getContent().stream().map(this::toDto).toList(),
                result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public Product requireProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Product", id));
    }

    @Transactional(readOnly = true)
    public List<ProductDTO> related(Long categoryId, Long excludeId) {
        return productRepository.findByCategoryId(categoryId).stream()
                .filter(p -> !p.getId().equals(excludeId))
                .limit(4)
                .map(this::toDto)
                .toList();
    }

    /* ------------------------- admin CRUD ------------------------- */

    /** Full catalogue for the admin dashboard (newest first). */
    @Transactional(readOnly = true)
    public List<ProductDTO> listAll() {
        return productRepository.findAll(Sort.by("createdAt").descending()).stream()
                .map(this::toDto)
                .toList();
    }

    /** All products owned by one seller. */
    @Transactional(readOnly = true)
    public List<ProductDTO> listForSeller(Long sellerId) {
        return productRepository.findBySellerId(sellerId).stream()
                .map(this::toDto)
                .toList();
    }

    /** Admin create: platform listing (no owning seller). */
    @Transactional
    public ProductDTO create(ProductRequest request) {
        return create(request, null);
    }

    /** Create a product owned by the given seller. */
    @Transactional
    public ProductDTO create(ProductRequest request, User seller) {
        Product product = new Product();
        product.setSeller(seller);
        apply(product, request);
        return toDto(productRepository.save(product));
    }

    @Transactional
    public ProductDTO update(Long id, ProductRequest request) {
        Product product = requireProduct(id);
        apply(product, request);
        return toDto(productRepository.save(product));
    }

    /**
     * Update with ownership rules: admins may edit any product,
     * sellers only products they own.
     */
    @Transactional
    public ProductDTO updateOwned(Long id, ProductRequest request, User actor) {
        Product product = requireProduct(id);
        requireCanManage(product, actor);
        apply(product, request);
        return toDto(productRepository.save(product));
    }

    @Transactional
    public void delete(Long id) {
        Product product = requireProduct(id);
        if (orderItemRepository.countByProductId(id) > 0) {
            throw new BadRequestException(
                    "\"" + product.getName() + "\" has already been ordered and cannot be deleted. "
                            + "Set its stock to 0 instead.");
        }
        productRepository.delete(product);
    }

    /** Delete with ownership rules (admins any product, sellers only their own). */
    @Transactional
    public void deleteOwned(Long id, User actor) {
        Product product = requireProduct(id);
        requireCanManage(product, actor);
        delete(id);
    }

    private void requireCanManage(Product product, User actor) {
        if (actor.getRole() == Role.ADMIN) {
            return;
        }
        boolean owned = product.getSeller() != null
                && product.getSeller().getId().equals(actor.getId());
        if (!owned) {
            throw new AccessDeniedException("You can only manage your own products");
        }
    }

    private void apply(Product product, ProductRequest request) {
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> ResourceNotFoundException.of("Category", request.getCategoryId()));

        product.setName(request.getName().trim());
        product.setDescription(request.getDescription().trim());
        product.setBrand(request.getBrand().trim());
        product.setPrice(request.getPrice());
        product.setMrp(request.getMrp() == null || request.getMrp().compareTo(request.getPrice()) < 0
                ? request.getPrice() : request.getMrp());
        product.setStock(request.getStock());
        product.setImage(request.getImage() == null || request.getImage().isBlank()
                ? "/images/gadgets/accessories.svg" : request.getImage().trim());
        product.setFeatured(request.isFeatured());
        product.setCategory(category);
    }

    private Sort sortSpec(String sort) {
        if (sort == null) {
            return Sort.by("createdAt").descending();
        }
        return switch (sort) {
            case "price_asc" -> Sort.by("price").ascending();
            case "price_desc" -> Sort.by("price").descending();
            case "name_asc" -> Sort.by("name").ascending();
            case "name_desc" -> Sort.by("name").descending();
            case "newest" -> Sort.by("createdAt").descending();
            default -> Sort.by("createdAt").descending();
        };
    }

    public ProductDTO toDto(Product product) {
        ProductDTO dto = new ProductDTO();
        dto.setId(product.getId());
        dto.setName(product.getName());
        dto.setDescription(product.getDescription());
        dto.setBrand(product.getBrand());
        dto.setPrice(product.getPrice());
        dto.setMrp(product.getMrp());
        dto.setStock(product.getStock());
        dto.setInStock(product.getStock() > 0);
        dto.setFeatured(product.isFeatured());
        dto.setImage(product.getImage());
        if (product.getCategory() != null) {
            dto.setCategoryId(product.getCategory().getId());
            dto.setCategoryName(product.getCategory().getName());
            dto.setCategorySlug(product.getCategory().getSlug());
        }
        if (product.getSeller() != null) {
            dto.setSellerId(product.getSeller().getId());
            dto.setSellerName(product.getSeller().getFullName());
        }
        dto.setDiscountPercent(discountPercent(product));
        return dto;
    }

    private int discountPercent(Product product) {
        if (product.getMrp() == null || product.getPrice() == null
                || product.getMrp().compareTo(product.getPrice()) <= 0) {
            return 0;
        }
        BigDecimal diff = product.getMrp().subtract(product.getPrice());
        return diff.multiply(BigDecimal.valueOf(100))
                .divide(product.getMrp(), 0, RoundingMode.HALF_UP)
                .intValue();
    }
}
