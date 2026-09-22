package com.aathiramart.repository;

import com.aathiramart.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Dynamic catalogue search: free-text, category, min/max price.
     * Null parameters are simply ignored.
     */
    @Query("""
            select p from Product p
            where (:q is null
                   or lower(p.name) like lower(concat('%', :q, '%'))
                   or lower(p.brand) like lower(concat('%', :q, '%'))
                   or lower(p.description) like lower(concat('%', :q, '%')))
              and (:categoryId is null or p.category.id = :categoryId)
              and (:minPrice is null or p.price >= :minPrice)
              and (:maxPrice is null or p.price <= :maxPrice)
            """)
    Page<Product> search(@Param("q") String q,
                         @Param("categoryId") Long categoryId,
                         @Param("minPrice") BigDecimal minPrice,
                         @Param("maxPrice") BigDecimal maxPrice,
                         Pageable pageable);

    Page<Product> findByFeaturedTrue(Pageable pageable);

    List<Product> findByCategoryId(Long categoryId);

    List<Product> findBySellerId(Long sellerId);

    long countBySellerId(Long sellerId);

    long countByCategoryId(Long categoryId);

    boolean existsByCategoryId(Long categoryId);
}
