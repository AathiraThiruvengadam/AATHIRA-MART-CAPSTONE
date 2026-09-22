# AATHIRA MART

**Smart Gadgets. Easy Shopping.**

A complete, runnable full-stack e-commerce website focused on gadgets and electronics
(smartphones, laptops, headphones, smartwatches, keyboards, mice, speakers, chargers,
power banks, tablets, cameras, USB drives and accessories).

| Layer     | Technology |
|-----------|------------|
| Front-end | HTML5, CSS3, JavaScript (ES6), Bootstrap 5, Bootstrap Icons, `fetch()` |
| Back-end  | Java 17, Spring Boot 3, Spring MVC (REST), Spring Data JPA, Spring Security |
| Auth      | JWT (jjwt 0.12) + BCrypt password hashing, stateless sessions |
| Database  | MySQL 8 (`aathira_mart`), Hibernate DDL auto-update |
| Build     | Maven |

---

## 1. Features

**Authentication & roles**
- Registration, Login, Forgot Password (one-time reset token), Logout
- JWT Bearer tokens, BCrypt-hashed passwords, no hardcoded credentials
- **Three roles: BUYER, SELLER, ADMIN** — chosen at registration (buyer/seller);
  admin accounts are created only by an existing admin
- JWT role claim resolved against the DB on every request, so role changes and
  account deletions take effect immediately
- Route + API protection, JSON 401/403 handling, unauthorized-user redirects

**Dashboards (one per role)**
- **Buyer** (`buyer-dashboard.html`) — order/spend stats, recent orders, quick links
- **Seller** (`seller-dashboard.html`) — product CRUD for own listings, orders that
  contain their items (only their own lines are visible), per-line fulfilment
  updates `PROCESSING → SHIPPED → DELIVERED`
- **Admin** (`admin-dashboard.html`) — manage users (role change / delete),
  sellers, the full catalogue (incl. seller-owned products) and every order
  (status changes; cancelling restocks, un-cancelling re-reserves)

**Storefront**
- Home page (hero, categories, featured gadgets, trust strip)
- Gadget categories (13) with live product counts
- Products catalogue with **search**, **category filter**, **min/max price filter**,
  **price/name/newest sorting** and **pagination** (all synced to the URL)
- Product details with quantity picker, stock status, related products
- Cart (localStorage), **Buy Now**, **Checkout** (address + COD/UPI demo payment)
- Server-side **stock checking** with 409 conflict handling on checkout
- Orders list (**Order History**) and Order Details with status timeline
- My Account: profile edit + password change
- Loading skeletons, empty states, toasts, responsive UI

**Backend REST APIs**

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | public | Create BUYER/SELLER account, returns JWT |
| POST | `/api/auth/login` | public | Sign in, returns JWT |
| POST | `/api/auth/forgot-password` | public | Generate one-time reset link |
| POST | `/api/auth/reset-password` | public | Set new password via token |
| GET  | `/api/categories` | public | Categories + product counts |
| GET  | `/api/products` | public | Search/filter/sort/paginate |
| GET  | `/api/products/featured` | public | Featured gadgets |
| GET  | `/api/products/{id}` | public | Product details |
| GET  | `/api/products/{id}/related` | public | Related products |
| POST | `/api/orders` | user | Place order (stock checked) |
| GET  | `/api/orders` | user | Own order history |
| GET  | `/api/orders/{id}` | user | Own order details (admin: any) |
| GET/PUT | `/api/account/profile` | user | View / update profile |
| PUT | `/api/account/password` | user | Change password |
| GET/POST/PUT/DELETE | `/api/seller/products/**` | seller | Own product CRUD (admins any) |
| GET | `/api/seller/orders` | seller | Orders containing seller's items (own lines only) |
| GET | `/api/seller/orders/{id}` | seller | One relevant order (own lines only) |
| PUT | `/api/seller/order-items/{id}/status` | seller | PROCESSING/SHIPPED/DELIVERED on own line |
| GET | `/api/admin/products` | admin | Full catalogue incl. seller listings |
| POST/PUT/DELETE | `/api/admin/products/**` | admin | Catalogue management |
| GET | `/api/admin/users` | admin | All users with roles |
| GET | `/api/admin/sellers` | admin | Registered sellers |
| PUT | `/api/admin/users/{id}/role` | admin | Change role (BUYER/SELLER/ADMIN) |
| DELETE | `/api/admin/users/{id}` | admin | Delete user (blocked if they have orders/products) |
| GET | `/api/admin/orders` | admin | Every order, full details |
| PUT | `/api/admin/orders/{id}/status` | admin | Update status (cancel restocks, un-cancel re-reserves) |

Cross-role access is rejected with **403** (e.g. buyer → `/api/admin/**`,
seller → `/api/admin/**`), missing token → **401**.

---

## 2. Requirements

- **JDK 17+** (also verified on JDK 21)
- **Maven 3.9+**
- **MySQL 8** running on `localhost:3306`

## 3. Quick start

```bash
# 1) (Optional) create the database + seed catalogue manually:
#    mysql -u root -p < database.sql
#    -> If you skip this, the app creates the database, schema,
#       categories and 27 sample products automatically on first start.

# 2) Adjust MySQL credentials if yours differ:
#    src/main/resources/application.properties
#      spring.datasource.username=root
#      spring.datasource.password=<your MySQL root password>

# 3) Run
cd AATHIRA-MART
mvn spring-boot:run

# 4) Open
#    http://localhost:8080
```

### Demo accounts (seeded automatically on first start)

| Role | Email | Password | Landing page |
|------|-------|----------|--------------|
| Buyer | `demo@aathiramart.com` | `Demo@1234` | `/buyer-dashboard.html` |
| Seller | `seller@aathiramart.com` | `Seller@123` | `/seller-dashboard.html` |
| Admin | `admin@aathiramart.com` | `Admin@123` | `/admin-dashboard.html` |

After login users land on their role's dashboard (or `?next=` if present).
New buyers and sellers register themselves from `register.html` by picking
"I want to shop" or "I want to sell".

> Passwords are stored **only** as BCrypt hashes (encoded at runtime by the data seeder).
> Change `app.jwt.secret` in `application.properties` before deploying anywhere real.

### Forgot password (demo mode)

No SMTP server is configured: `/api/auth/forgot-password` creates a real expiring
one-time token (stored in `password_reset_tokens`) and returns the reset link in the
response, so the flow is fully usable: enter email → click the shown link → set a new password.

---

## 4. Project structure

```
AATHIRA-MART/
├── database.sql                         # MySQL 8 schema + 13 categories + 27 gadgets
├── pom.xml                              # Spring Boot 3.3, Java 17, JPA, Security, JWT, MySQL
├── README.md
└── src/main/
    ├── java/com/aathiramart/
    │   ├── AathiraMartApplication.java
    │   ├── config/                      # SecurityConfig, JwtUtil, JwtAuthenticationFilter,
    │   │                                # RestAuthenticationEntryPoint, RestAccessDeniedHandler,
    │   │                                # UserDetailsServiceImpl
    │   ├── controller/                  # Auth, Category, Product, Order, Account,
    │   │                                # AdminProduct, Admin, Seller
    │   ├── dto/                         # Requests/responses + Bean Validation
    │   ├── entity/                      # User, Category, Product, Order, OrderItem,
    │   │                                # PasswordResetToken, Role, OrderStatus, ItemStatus
    │   ├── exception/                   # GlobalExceptionHandler + 400/404/409 exceptions
    │   ├── repository/                  # Spring Data JPA repositories
    │   └── service/                     # Auth, Category, Product, Order, Account,
    │                                    # Seller, Admin, DataSeeder
    └── resources/
        ├── application.properties       # MySQL, JPA, JWT settings
        └── static/
            ├── index.html               # Home
            ├── login.html / register.html / forgot-password.html / reset-password.html
            ├── products.html            # Search + filter + sort + pagination
            ├── product-details.html
            ├── cart.html / checkout.html
            ├── orders.html / order-details.html
            ├── account.html             # My Account
            ├── buyer-dashboard.html     # Buyer dashboard
            ├── seller-dashboard.html    # Seller dashboard (products + fulfilment)
            ├── admin-dashboard.html     # Admin dashboard (users/sellers/products/orders)
            ├── css/style.css            # Full custom responsive theme
            ├── js/                      # api.js (fetch+JWT+cart+role guards), navbar.js,
            │                            # auth.js, home.js, products.js, product-details.js,
            │                            # cart.js, checkout.js, orders.js, order-details.js,
            │                            # account.js, buyer/seller/admin-dashboard.js
            └── images/gadgets/*.svg     # 13 offline product images
```

### Data model

```
users(BUYER|SELLER|ADMIN)1 ──── * orders 1 ──── * order_items * ──── 1 products * ──── 1 categories
users(SELLER)1 ──── * products            users 1 ──── * password_reset_tokens
```

- `products.seller_id` = owning seller (NULL = platform listing managed by admins)
- `order_items.status` = per-line fulfilment (`PROCESSING/SHIPPED/DELIVERED`),
  updated by the line's seller; the order auto-advances to `SHIPPED`/`DELIVERED`
- `orders.total_amount` = item subtotal + ₹49 delivery (free above ₹999)
- `order_items` store name/image/price snapshots so history survives catalogue edits
- Stock is decremented inside the same `@Transactional` checkout that creates the order;
  insufficient stock returns **409 Conflict** and the cart is refreshed

---

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Access denied for user 'root'@'localhost'` | Set your MySQL user/password in `application.properties` |
| Port 8080 busy | Change `server.port` in `application.properties` |
| Tables empty / no products | Run `database.sql`, or restart the app (seeder runs when tables are empty) |
| 401 on cart/orders | You are signed out — log in again (tokens expire after 24 h) |
| 403 on `/api/admin/**` | Log in with the admin account (buyers/sellers are rejected) |
| 403 on `/api/seller/**` | Log in with a seller (or admin) account |

### E2E role test

```bash
# app must be running on http://localhost:8080
powershell -ExecutionPolicy Bypass -File scripts\e2e-roles.ps1
```

Verifies all three roles end to end: registration role rules, cross-role 401/403,
seller product CRUD + ownership isolation, checkout/stock/delivery-fee rules,
seller fulfilment (item statuses, order auto-advance, buyer visibility),
admin user/seller/order management (role change, guarded deletes, cancel restock)
and the three dashboard pages.
