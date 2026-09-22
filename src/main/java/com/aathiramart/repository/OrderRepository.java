package com.aathiramart.repository;

import com.aathiramart.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByUserIdOrderByPlacedAtDesc(Long userId);

    Optional<Order> findByUserIdAndId(Long userId, Long id);

    Optional<Order> findByOrderNumber(String orderNumber);

    long countByUserId(Long userId);

    List<Order> findByOrderByPlacedAtDesc();

    /** Orders that contain at least one line belonging to this seller. */
    @Query("""
            select distinct o from Order o join o.items i
            where i.product.seller.id = :sellerId
            order by o.placedAt desc
            """)
    List<Order> findBySellerId(@Param("sellerId") Long sellerId);
}
