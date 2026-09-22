package com.aathiramart.exception;

/** 409 - not enough stock to fulfil the requested quantity. */
public class OutOfStockException extends RuntimeException {

    private final String productName;
    private final int available;

    public OutOfStockException(String productName, int available) {
        super("Only " + available + " unit(s) of \"" + productName + "\" left in stock");
        this.productName = productName;
        this.available = available;
    }

    public String getProductName() {
        return productName;
    }

    public int getAvailable() {
        return available;
    }
}
