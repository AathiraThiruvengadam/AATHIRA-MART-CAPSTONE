package com.aathiramart.service;

import com.aathiramart.dto.CheckoutRequest;
import com.aathiramart.dto.OrderDTO;
import com.aathiramart.dto.OrderItemDTO;
import com.aathiramart.entity.Order;
import com.aathiramart.entity.OrderItem;
import com.aathiramart.entity.Product;
import com.aathiramart.entity.Role;
import com.aathiramart.entity.User;
import com.aathiramart.exception.BadRequestException;
import com.aathiramart.exception.OutOfStockException;
import com.aathiramart.exception.ResourceNotFoundException;
import com.aathiramart.repository.OrderRepository;
import com.aathiramart.repository.ProductRepository;
import com.aathiramart.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/** Checkout, stock reservation and order history. */
@Service
public class OrderService {

    private static final DateTimeFormatter ORDER_SEQ =
            DateTimeFormatter.ofPattern("yyyyMMdd");

    /** Flat delivery fee, waived for orders at or above this subtotal. */
    private static final BigDecimal DELIVERY_FEE = new BigDecimal("49.00");
    private static final BigDecimal FREE_DELIVERY_ABOVE = new BigDecimal("999.00");

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    /**
     * Places an order atomically: every requested quantity is stock-checked,
     * stock is decremented and order + items are persisted in one transaction.
     */
    @Transactional
    public OrderDTO placeOrder(String userEmail, CheckoutRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        // Merge duplicate product lines coming from the client
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (CheckoutRequest.CheckoutItem item : request.getItems()) {
            quantities.merge(item.getProductId(), item.getQuantity(), Integer::sum);
        }

        Order order = new Order();
        order.setUser(user);
        order.setPaymentMethod(request.getPaymentMethod());
        order.setOrderNumber(generateOrderNumber());

        CheckoutRequest.Address address = request.getShipping();
        order.setShipName(address.getName().trim());
        order.setShipPhone(address.getPhone());
        order.setShipLine1(address.getLine1().trim());
        order.setShipLine2(blankToNull(address.getLine2()));
        order.setShipCity(address.getCity().trim());
        order.setShipState(address.getState().trim());
        order.setShipPincode(address.getPincode());
        order.setPlacedAt(LocalDateTime.now());

        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Long productId = entry.getKey();
            int requested = entry.getValue();

            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Product", productId));

            if (product.getStock() < requested) {
                throw new OutOfStockException(product.getName(), product.getStock());
            }

            product.setStock(product.getStock() - requested);
            productRepository.save(product);

            OrderItem item = new OrderItem(product, requested);
            order.addItem(item);
            total = total.add(item.getSubtotal());
        }

        order.setTotalAmount(total.add(deliveryFee(total)));
        Order saved = orderRepository.save(order);
        return toDto(saved);
    }

    /** ₹49 delivery, free at ₹999+. Mirrored by the front-end summary. */
    private BigDecimal deliveryFee(BigDecimal subtotal) {
        return subtotal.compareTo(FREE_DELIVERY_ABOVE) >= 0 ? BigDecimal.ZERO : DELIVERY_FEE;
    }

    @Transactional(readOnly = true)
    public List<OrderDTO> listOrders(String userEmail) {
        User user = requireUser(userEmail);
        return orderRepository.findByUserIdOrderByPlacedAtDesc(user.getId()).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrder(String userEmail, Long orderId) {
        User user = requireUser(userEmail);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ResourceNotFoundException.of("Order", orderId));

        boolean owner = order.getUser() != null && order.getUser().getId().equals(user.getId());
        if (!owner && user.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("You can only view your own orders");
        }
        return toDto(order);
    }

    /** Full unfiltered list for the admin dashboard (newest first). */
    @Transactional(readOnly = true)
    public List<OrderDTO> listAllOrders() {
        return orderRepository.findByOrderByPlacedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    /** Any order, admin only (called from /api/admin/**). */
    @Transactional(readOnly = true)
    public OrderDTO getAnyOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ResourceNotFoundException.of("Order", orderId));
        return toDto(order);
    }

    @Transactional(readOnly = true)
    public long countOrders(String userEmail) {
        return orderRepository.countByUserId(requireUser(userEmail).getId());
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
    }

    private String generateOrderNumber() {
        String number;
        do {
            number = "AM" + LocalDateTime.now().format(ORDER_SEQ) + "-"
                    + (100000 + ThreadLocalRandom.current().nextInt(900000));
        } while (orderRepository.findByOrderNumber(number).isPresent());
        return number;
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    public OrderDTO toDto(Order order) {
        OrderDTO dto = new OrderDTO();
        dto.setId(order.getId());
        dto.setOrderNumber(order.getOrderNumber());
        dto.setPlacedAt(order.getPlacedAt());
        dto.setStatus(order.getStatus().name());
        dto.setPaymentMethod(order.getPaymentMethod());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setShipName(order.getShipName());
        dto.setShipPhone(order.getShipPhone());
        dto.setShipLine1(order.getShipLine1());
        dto.setShipLine2(order.getShipLine2());
        dto.setShipCity(order.getShipCity());
        dto.setShipState(order.getShipState());
        dto.setShipPincode(order.getShipPincode());
        if (order.getUser() != null) {
            dto.setCustomerName(order.getUser().getFullName());
        }

        List<OrderItemDTO> items = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            OrderItemDTO itemDto = new OrderItemDTO();
            itemDto.setId(item.getId());
            itemDto.setStatus(item.getStatus().name());
            itemDto.setProductId(item.getProduct() != null ? item.getProduct().getId() : null);
            itemDto.setProductName(item.getProductName());
            itemDto.setProductImage(item.getProductImage());
            itemDto.setUnitPrice(item.getUnitPrice());
            itemDto.setQuantity(item.getQuantity());
            itemDto.setSubtotal(item.getSubtotal());
            if (item.getProduct() != null && item.getProduct().getSeller() != null) {
                itemDto.setSellerId(item.getProduct().getSeller().getId());
                itemDto.setSellerName(item.getProduct().getSeller().getFullName());
            }
            items.add(itemDto);
        }
        dto.setItems(items);
        dto.setItemCount(items.stream().mapToInt(OrderItemDTO::getQuantity).sum());
        return dto;
    }
}
