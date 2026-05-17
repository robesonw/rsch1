package com.paralleliq.api;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Creates Pageable from request params safely:
 * - Caps page size at MAX_PAGE_SIZE (prevents abuse)
 * - Validates sort field against an allowlist (prevents SQL injection via sort)
 * - Defaults to createdAt DESC if no valid sort provided
 *
 * Usage in controllers:
 *   var pageable = PageableFactory.of(page, size, sort, Set.of("name", "createdAt", "lastRunAt"));
 */
public final class PageableFactory {

    public static final int MAX_PAGE_SIZE = 100;
    public static final int DEFAULT_PAGE_SIZE = 20;

    private PageableFactory() {}

    public static Pageable of(int page, int size, String sort, Set<String> allowedFields) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

        Sort resolvedSort = parseSort(sort, allowedFields);
        return PageRequest.of(safePage, safeSize, resolvedSort);
    }

    public static Pageable ofDefault(int page, int size) {
        return of(page, size, "createdAt,desc", Set.of("createdAt"));
    }

    private static Sort parseSort(String sort, Set<String> allowedFields) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        String[] parts = sort.split(",");
        String field = parts[0].trim();
        String direction = parts.length > 1 ? parts[1].trim() : "asc";

        if (!allowedFields.contains(field)) {
            // Reject unknown sort field — fall back to default
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }

        Sort.Direction dir = "desc".equalsIgnoreCase(direction)
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;

        return Sort.by(dir, field);
    }
}
