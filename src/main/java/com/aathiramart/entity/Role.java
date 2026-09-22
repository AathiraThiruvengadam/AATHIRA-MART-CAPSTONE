package com.aathiramart.entity;

/**
 * Application user roles.
 *  - BUYER  : shops, places orders, sees own order history
 *  - SELLER : manages own products and fulfils orders containing them
 *  - ADMIN  : full access (users, sellers, catalogue, all orders)
 */
public enum Role {
    BUYER,
    SELLER,
    ADMIN
}
