package com.aathiramart.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Payload for POST /api/orders (Buy Now / Checkout). */
public class CheckoutRequest {

    @NotEmpty(message = "Cart is empty")
    @Valid
    private List<CheckoutItem> items;

    @NotBlank(message = "Payment method is required")
    @Pattern(regexp = "^(COD|UPI)$", message = "Payment method must be COD or UPI")
    private String paymentMethod;

    @NotNull(message = "Shipping address is required")
    @Valid
    private Address shipping;

    public List<CheckoutItem> getItems() {
        return items;
    }

    public void setItems(List<CheckoutItem> items) {
        this.items = items;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public Address getShipping() {
        return shipping;
    }

    public void setShipping(Address shipping) {
        this.shipping = shipping;
    }

    public static class CheckoutItem {

        @NotNull(message = "Product id is required")
        private Long productId;

        @NotNull(message = "Quantity is required")
        @jakarta.validation.constraints.Min(value = 1, message = "Quantity must be at least 1")
        @jakarta.validation.constraints.Max(value = 10, message = "You can order up to 10 units per product")
        private Integer quantity;

        public CheckoutItem() {
        }

        public CheckoutItem(Long productId, Integer quantity) {
            this.productId = productId;
            this.quantity = quantity;
        }

        public Long getProductId() {
            return productId;
        }

        public void setProductId(Long productId) {
            this.productId = productId;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }
    }

    public static class Address {

        @NotBlank(message = "Receiver name is required")
        @Size(max = 120)
        private String name;

        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "^[6-9][0-9]{9}$", message = "Enter a valid 10-digit mobile number")
        private String phone;

        @NotBlank(message = "Address line is required")
        @Size(max = 255, message = "Address line is too long")
        private String line1;

        @Size(max = 255, message = "Landmark is too long")
        private String line2;

        @NotBlank(message = "City is required")
        @Size(max = 80)
        private String city;

        @NotBlank(message = "State is required")
        @Size(max = 80)
        private String state;

        @NotBlank(message = "Pincode is required")
        @Pattern(regexp = "^[1-9][0-9]{5}$", message = "Enter a valid 6-digit pincode")
        private String pincode;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getPhone() {
            return phone;
        }

        public void setPhone(String phone) {
            this.phone = phone;
        }

        public String getLine1() {
            return line1;
        }

        public void setLine1(String line1) {
            this.line1 = line1;
        }

        public String getLine2() {
            return line2;
        }

        public void setLine2(String line2) {
            this.line2 = line2;
        }

        public String getCity() {
            return city;
        }

        public void setCity(String city) {
            this.city = city;
        }

        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public String getPincode() {
            return pincode;
        }

        public void setPincode(String pincode) {
            this.pincode = pincode;
        }
    }
}
