package com.aathiramart.entity;

/**
 * Fulfilment status of a single order line.
 * Sellers progress their own items: PROCESSING -> SHIPPED -> DELIVERED.
 */
public enum ItemStatus {
    PROCESSING,
    SHIPPED,
    DELIVERED
}
