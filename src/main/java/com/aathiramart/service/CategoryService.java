package com.aathiramart.service;

import com.aathiramart.dto.CategoryDTO;
import com.aathiramart.entity.Category;
import com.aathiramart.exception.ResourceNotFoundException;
import com.aathiramart.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Read access to gadget categories. */
@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryDTO> listWithCounts() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : categoryRepository.countProductsPerCategory()) {
            Category category = (Category) row[0];
            counts.put(category.getId(), (Long) row[1]);
        }

        return categoryRepository.findAllByOrderByDisplayOrderAsc().stream()
                .map(category -> {
                    CategoryDTO dto = toDto(category);
                    dto.setProductCount(counts.getOrDefault(category.getId(), 0L));
                    return dto;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public Category requireBySlug(String slug) {
        return categoryRepository.findBySlug(slug)
                .orElseThrow(() -> ResourceNotFoundException.of("Category", slug));
    }

    public CategoryDTO toDto(Category category) {
        CategoryDTO dto = new CategoryDTO();
        dto.setId(category.getId());
        dto.setName(category.getName());
        dto.setSlug(category.getSlug());
        dto.setDescription(category.getDescription());
        dto.setIcon(category.getIcon());
        return dto;
    }
}
