package com.paralleliq.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Standard envelope for all REST responses.
 *
 * Success:  { "success": true,  "data": {...} }
 * Error:    { "success": false, "error": "message", "code": "ERROR_CODE" }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
    boolean success,
    T data,
    String error,
    String code
) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null, null);
    }

    public static <T> ApiResponse<T> error(String message, String code) {
        return new ApiResponse<>(false, null, message, code);
    }
}
