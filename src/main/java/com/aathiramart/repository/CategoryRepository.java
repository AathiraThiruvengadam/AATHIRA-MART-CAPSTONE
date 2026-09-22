package com.aathiramart.repository;

import com.aathiramart.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findBySlug(String slug);

    Optional<Category> findByName(String name);

    boolean existsBySlug(String slug);

    List<Category> findAllByOrderByDisplayOrderAsc();

    /** Returns rows of [Category, productCount]. */
    @Query("select p.category, count(p) from Product p group by p.category")
    List<Object[]> countProductsPerCategory();
}
