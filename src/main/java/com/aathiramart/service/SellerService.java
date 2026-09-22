package com.aathiramart.service;

import com.aathiramart.dto.ApiResponse;
import com.aathiramart.dto.OrderDTO;
import com.aathiramart.dto.OrderItemDTO;
import com.aathiramart.dto.ProductDTO;
import com.aathiramart.dto.ProductRequest;
import com.aathiramart.entity.ItemStatus;
import com.aathiramart.entity.Order;
import com.aathiramart.entity.OrderStatus;
import com.aathiramart.entity.Role;
import com.aathiramart.entity.User;
import com.aathiramart.exception.BadRequestException;
import com.aathiramart.exception.ResourceNotFoundException;
import com.aathiramart.repository.OrderItemRepository;
import com.aathiramart.repository.OrderRepository;
import com.aathiramart.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Seller-scoped operations:
 *  - CRUD for products owned by the signed-in seller
 *  - orders that contain the seller's items (only those lines are exposed)
 *  - fulfilment updates for the seller's own order lines
 * URL rules (/api/seller/**) allow SELLER + ADMIN; ownership is re-checked here.
 */
@Service
public class SellerService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductService productService;
    private final OrderService orderService;

    public SellerService(UserRepository userRepository,
                         OrderRepository orderRepository,
                         OrderItemRepository orderItemRepository,
                         ProductService productService,
                         OrderService orderService) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productService = productService;
        this.orderService = orderService;
    }

    /* ------------------------- products ------------------------- */

    @Transactional(readOnly = true)
    public List<ProductDTO> listProducts(String sellerEmail) {
        User seller = requireSeller(sellerEmail);
        return productService.listForSeller(seller.getId());
    }

    @Transactional
    public ProductDTO createProduct(String sellerEmail, ProductRequest request) {
        User seller = requireSeller(sellerEmail);
        return productService.create(request, seller);
    }

    @Transactional
    public ProductDTO updateProduct(String sellerEmail, Long productId, ProductRequest request) {
        User seller = requireSeller(sellerEmail);
        return productService.updateOwned(productId, request, seller);
    }

    @Transactional
    public ApiResponse<Void> deleteProduct(String sellerEmail, Long productId) {
        User seller = requireSeller(sellerEmail);
        productService.deleteOwned(productId, seller);
        return ApiResponse.ok("Product deleted", null);
    }

    /* ------------------------- orders ------------------------- */

    /** Orders containing this seller's items, reduced to the seller's own lines. */
    @Transactional(readOnly = true)
    public List<OrderDTO> listOrders(String sellerEmail) {
        User seller = requireSeller(sellerEmail);
        return orderRepository.findBySellerId(seller.getId()).stream()
                .map(order -> scopedToSeller(orderService.toDto(order), seller))
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrder(String sellerEmail, Long orderId) {
        User seller = requireSeller(sellerEmail);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ResourceNotFoundException.of("Order", orderId));

        boolean relevant = order.getItems().stream().anyMatch(item ->
                item.getProduct() != null && item.getProduct().getSeller() != null
                        && item.getProduct().getSeller().getId().equals(seller.getId()));
        if (!relevant && seller.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("This order does not contain any of your products");
        }
        return scopedToSeller(orderService.toDto(order), seller);
    }

    /** Seller progresses one of their own order lines: PROCESSING -> SHIPPED -> DELIVERED. */
    @Transactional
    public ApiResponse<OrderDTO> updateItemStatus(String sellerEmail, Long itemId, String statusValue) {
        User seller = requireSeller(sellerEmail);
        ItemStatus status = parseItemStatus(statusValue);

        var item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> ResourceNotFoundException.of("Order item", itemId));

        boolean owned = item.getProduct() != null && item.getProduct().getSeller() != null
                && item.getProduct().getSeller().getId().equals(seller.getId());
        if (!owned && seller.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("You can only update status of your own order items");
        }

        Order order = item.getOrder();
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BadRequestException("This order has been cancelled and can no longer be updated");
        }

        item.setStatus(status);
        orderItemRepository.save(item);

        // Advance the overall order status as fulfilment progresses
        if (status == ItemStatus.SHIPPED && rank(order.getStatus()) < rank(OrderStatus.SHIPPED)) {
            order.setStatus(OrderStatus.SHIPPED);
        }
        if (status == ItemStatus.DELIVERED && order.getItems().stream()
                .allMatch(i -> i.getStatus() == ItemStatus.DELIVERED)) {
            order.setStatus(OrderStatus.DELIVERED);
        }
        orderRepository.save(order);

        return ApiResponse.ok("Item status updated",
                scopedToSeller(orderService.toDto(order), seller));
    }

    /* ------------------------- helpers ------------------------- */

    /** Keeps only the seller's own lines and masks the buyer details others bought. */
    private OrderDTO scopedToSeller(OrderDTO dto, User seller) {
        if (seller.getRole() == Role.ADMIN) {
            return dto;
        }
        List<OrderItemDTO> own = dto.getItems() == null ? List.of() : dto.getItems().stream()
                .filter(item -> seller.getId().equals(item.getSellerId()))
                .toList();
        dto.setItems(own);
        dto.setItemCount(own.stream().mapToInt(OrderItemDTO::getQuantity).sum());
        return dto;
    }

    private ItemStatus parseItemStatus(String raw) {
        try {
            return ItemStatus.valueOf(raw.trim().toUpperCase());
        } catch (RuntimeException ex) {
            throw new BadRequestException("Invalid status. Use PROCESSING, SHIPPED or DELIVERED");
        }
    }

    private int rank(OrderStatus status) {
        return switch (status) {
            case PLACED -> 0;
            case CONFIRMED -> 1;
            case SHIPPED -> 2;
            case DELIVERED -> 3;
            default -> 4; // CANCELLED
        };
    }

    private User requireSeller(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        if (user.getRole() != Role.SELLER && user.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("A seller account is required for this action");
        }
        return user;
    }
}
