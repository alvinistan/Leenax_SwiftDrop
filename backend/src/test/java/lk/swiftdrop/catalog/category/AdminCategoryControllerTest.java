package lk.swiftdrop.catalog.category;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Web-layer test: starts only the controller (+ JSON and the exception handler),
 * with the service replaced by a Mockito mock. No database. Fast.
 * It checks the HTTP contract: status codes, headers and JSON.
 */
@WebMvcTest(AdminCategoryController.class)
class AdminCategoryControllerTest {

    private static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String VALID_BODY = """
            {"name": "Fashion", "slug": "fashion"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CategoryService categoryService;

    @Test
    void createReturns201WithLocationHeader() throws Exception {
        given(categoryService.create(any()))
                .willReturn(new CategoryResponse(ID, "Fashion", "fashion", null, null, 0, true));

        mockMvc.perform(post("/api/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/admin/categories/" + ID))
                .andExpect(jsonPath("$.slug").value("fashion"));
    }

    @Test
    void invalidBodyReturns400WithFieldErrorsAndNeverCallsTheService() throws Exception {
        mockMvc.perform(post("/api/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "slug": "Not A Slug!"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[?(@.field == 'name')].message").value("Name is required."))
                .andExpect(jsonPath("$.errors[?(@.field == 'slug')]").exists());

        verify(categoryService, never()).create(any());
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        mockMvc.perform(post("/api/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ this is not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatingAMissingCategoryReturns404() throws Exception {
        given(categoryService.update(eq(ID), any())).willThrow(new ResourceNotFoundException("Category", ID));

        mockMvc.perform(put("/api/admin/categories/{id}", ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Category not found: " + ID));
    }

    @Test
    void deleteReturns204WithNoBody() throws Exception {
        mockMvc.perform(delete("/api/admin/categories/{id}", ID))
                .andExpect(status().isNoContent())
                .andExpect(jsonPath("$").doesNotExist());
    }

    @Test
    void deletingACategoryWithProductsReturns409() throws Exception {
        willThrow(new ConflictException("Category 'fashion' still has products."))
                .given(categoryService).delete(ID);

        mockMvc.perform(delete("/api/admin/categories/{id}", ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Category 'fashion' still has products."));
    }

    @Test
    void invalidIdInUrlReturns400() throws Exception {
        mockMvc.perform(delete("/api/admin/categories/not-a-uuid"))
                .andExpect(status().isBadRequest());
    }
}
