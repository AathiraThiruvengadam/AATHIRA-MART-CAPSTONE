-- ==================================================================
--  AATHIRA MART  -  Smart Gadgets. Easy Shopping.
--  Database setup script for MySQL 8
--
--  How to use:
--    1. Open MySQL Workbench / mysql CLI and run this entire script.
--       OR simply start the Spring Boot application - the database is
--       created automatically (createDatabaseIfNotExist=true) and the
--       schema + sample data are seeded on first run.
--    2. User accounts (admin + demo buyer + demo seller) are created
--       automatically by the application on first start with BCrypt
--       encoded passwords:
--          Admin  : admin@aathiramart.com  /  Admin@123
--          Buyer  : demo@aathiramart.com   /  Demo@1234
--          Seller : seller@aathiramart.com /  Seller@123
-- ==================================================================

CREATE DATABASE IF NOT EXISTS aathira_mart
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE aathira_mart;

-- ------------------------------------------------------------------
-- TABLES (identical to the JPA entities; Spring Boot also keeps the
-- schema in sync automatically with ddl-auto=update)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    full_name   VARCHAR(120) NOT NULL,
    email       VARCHAR(190) NOT NULL,
    password    VARCHAR(100) NOT NULL,
    phone       VARCHAR(20)  DEFAULT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'BUYER', -- BUYER | SELLER | ADMIN
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    token       VARCHAR(64) NOT NULL,
    user_id     BIGINT      NOT NULL,
    expires_at  DATETIME    NOT NULL,
    used        BIT(1)      NOT NULL DEFAULT b'0',
    PRIMARY KEY (id),
    UNIQUE KEY uk_prt_token (token),
    CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    name          VARCHAR(80)  NOT NULL,
    slug          VARCHAR(90)  NOT NULL,
    description   VARCHAR(255) DEFAULT NULL,
    icon          VARCHAR(60)  DEFAULT NULL,
    display_order INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_slug (slug),
    UNIQUE KEY uk_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    name         VARCHAR(180)  NOT NULL,
    description  VARCHAR(1000) NOT NULL,
    brand        VARCHAR(80)   NOT NULL,
    price        DECIMAL(10,2) NOT NULL,
    mrp          DECIMAL(10,2) DEFAULT NULL,
    stock        INT           NOT NULL DEFAULT 0,
    image        VARCHAR(255)  DEFAULT NULL,
    featured     BIT(1)        NOT NULL DEFAULT b'0',
    category_id  BIGINT        NOT NULL,
    seller_id    BIGINT        DEFAULT NULL,  -- owning seller (NULL = platform listing)
    created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_products_name (name),
    KEY idx_products_category (category_id),
    KEY idx_products_price (price),
    KEY idx_products_seller (seller_id),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT fk_products_seller   FOREIGN KEY (seller_id)   REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    order_number   VARCHAR(40)   NOT NULL,
    user_id        BIGINT        NOT NULL,
    total_amount   DECIMAL(10,2) NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'PLACED',
    payment_method VARCHAR(30)   NOT NULL DEFAULT 'COD',
    ship_name      VARCHAR(120)  NOT NULL,
    ship_phone     VARCHAR(20)   NOT NULL,
    ship_line1     VARCHAR(255)  NOT NULL,
    ship_line2     VARCHAR(255)  DEFAULT NULL,
    ship_city      VARCHAR(80)   NOT NULL,
    ship_state     VARCHAR(80)   NOT NULL,
    ship_pincode   VARCHAR(10)   NOT NULL,
    placed_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_orders_number (order_number),
    KEY idx_orders_user (user_id),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    order_id      BIGINT        NOT NULL,
    product_id    BIGINT        DEFAULT NULL,
    product_name  VARCHAR(180)  NOT NULL,
    product_image VARCHAR(255)  DEFAULT NULL,
    unit_price    DECIMAL(10,2) NOT NULL,
    quantity      INT           NOT NULL,
    subtotal      DECIMAL(10,2) NOT NULL,
    status        VARCHAR(20)   DEFAULT 'PROCESSING', -- PROCESSING | SHIPPED | DELIVERED
    PRIMARY KEY (id),
    KEY idx_oi_order (order_id),
    KEY idx_oi_product (product_id),
    CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------------
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
 ('Smartphones',  'smartphones',  'Latest 5G phones with flagship cameras',      'bi-phone',        1),
 ('Laptops',      'laptops',      'Ultrabooks, gaming and everyday laptops',     'bi-laptop',       2),
 ('Headphones',   'headphones',   'Wired & wireless headphones with deep bass',  'bi-headphones',   3),
 ('Smartwatches', 'smartwatches', 'Fitness trackers & smart watches',            'bi-smartwatch',   4),
 ('Keyboards',    'keyboards',    'Mechanical & wireless keyboards',             'bi-keyboard',     5),
 ('Mice',         'mice',         'Ergonomic and gaming mice',                   'bi-mouse',        6),
 ('Speakers',     'speakers',     'Bluetooth speakers & sound bars',             'bi-speaker',      7),
 ('Chargers',     'chargers',     'Fast, GaN and wireless chargers',             'bi-plug',         8),
 ('Power Banks',  'power-banks',  'High capacity power banks on the go',         'bi-battery-charging', 9),
 ('Tablets',     'tablets',      'Tablets for work, study and play',            'bi-tablet',      10),
 ('Cameras',      'cameras',      'Mirrorless, action & instant cameras',        'bi-camera',      11),
 ('USB Drives',   'usb-drives',   'Pen drives, OTG & storage',                   'bi-usb-drive',   12),
 ('Accessories',  'accessories',  'Hubs, stands, guards & more',                 'bi-tools',       13)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
                        icon = VALUES(icon), display_order = VALUES(display_order);

-- ------------------------------------------------------------------
-- SAMPLE GADGET PRODUCTS
-- (image files live under src/main/resources/static/images/gadgets)
-- ------------------------------------------------------------------
INSERT INTO products (name, description, brand, price, mrp, stock, image, featured, category_id, created_at) VALUES
('Nexon X5 Pro 5G Smartphone',
 '6.7" AMOLED 120Hz display, 108MP OIS triple camera, 5000mAh battery with 67W fast charging, 12GB RAM / 256GB storage, 5G dual SIM.',
 'Nexon', 54999.00, 59999.00, 25, '/images/gadgets/smartphone.svg', b'1', (SELECT id FROM categories WHERE slug='smartphones'), NOW()),
('Volt Edge 5G Smartphone',
 '6.4" FHD+ 90Hz display, 64MP AI camera, 5000mAh battery, 8GB RAM / 128GB storage, side fingerprint, Android 14.',
 'Volt', 24999.00, 27999.00, 40, '/images/gadgets/smartphone.svg', b'0', (SELECT id FROM categories WHERE slug='smartphones'), NOW()),
('Titan Book Pro 15 Laptop',
 '15.6" 2K 165Hz display, Intel Core i7 13th gen, RTX 4060 8GB, 16GB DDR5 RAM, 1TB NVMe SSD, backlit keyboard, 80Wh battery.',
 'Titan', 92499.00, 99999.00, 15, '/images/gadgets/laptop.svg', b'1', (SELECT id FROM categories WHERE slug='laptops'), NOW()),
('Aero Slim 13 Ultrabook',
 '13.3" IPS display, Intel Core Ultra 5, 16GB LPDDR5 RAM, 512GB SSD, 1.1kg aluminium body, 16-hour battery life, Thunderbolt 4.',
 'Aero', 68999.00, 74999.00, 18, '/images/gadgets/laptop.svg', b'0', (SELECT id FROM categories WHERE slug='laptops'), NOW()),
('SonicBass Pro Wireless Headphones',
 '40mm drivers with deep bass, active noise cancellation, 50-hour battery, Bluetooth 5.3, dual pairing, memory-foam earcups.',
 'Sonic', 8999.00, 11999.00, 60, '/images/gadgets/headphones.svg', b'1', (SELECT id FROM categories WHERE slug='headphones'), NOW()),
('AeroTune Studio Headphones',
 'Flat-response studio tuning, detachable 3.5mm cable, lightweight foldable frame, memory-foam cushions for long sessions.',
 'Aero', 5499.00, 6999.00, 45, '/images/gadgets/headphones.svg', b'0', (SELECT id FROM categories WHERE slug='headphones'), NOW()),
('Pulse Fit 3 Smartwatch',
 '1.43" AMOLED display, Bluetooth calling, SpO2 & heart-rate tracking, 100+ sports modes, 7-day battery, 5ATM water resistant.',
 'Pulse', 4299.00, 5999.00, 70, '/images/gadgets/smartwatch.svg', b'1', (SELECT id FROM categories WHERE slug='smartwatches'), NOW()),
('Orbit Watch Ultra',
 '1.9" sapphire AMOLED, dual-band GPS, titanium bezel, ECG + SpO2, 14-day battery, built-in speaker and mic, 10ATM water resistant.',
 'Orbit', 12999.00, 15999.00, 20, '/images/gadgets/smartwatch.svg', b'0', (SELECT id FROM categories WHERE slug='smartwatches'), NOW()),
('BlazeMech RGB Mechanical Keyboard',
 'Hot-swappable red switches, per-key RGB, aluminium top plate, detachable USB-C cable, anti-ghosting, wrist rest included.',
 'Blaze', 4999.00, 6499.00, 35, '/images/gadgets/keyboard.svg', b'1', (SELECT id FROM categories WHERE slug='keyboards'), NOW()),
('QuietType Wireless Keyboard',
 'Scissor-switch silent keys, 2.4GHz + Bluetooth dual mode, slim profile, spill resistant, up to 12 months battery.',
 'Pulse', 2499.00, 3199.00, 55, '/images/gadgets/keyboard.svg', b'0', (SELECT id FROM categories WHERE slug='keyboards'), NOW()),
('HyperGlide Gaming Mouse',
 '26000 DPI optical sensor, 8 programmable buttons, RGB lighting, 70g lightweight, braided cable, 1000Hz polling rate.',
 'Hyper', 2999.00, 3799.00, 80, '/images/gadgets/mouse.svg', b'1', (SELECT id FROM categories WHERE slug='mice'), NOW()),
('SilentClick Pro Mouse',
 'Silent clicks, ergonomic right-hand shape, 3 DPI levels, Bluetooth + USB receiver, 18-month battery life.',
 'Nexon', 1499.00, 1999.00, 90, '/images/gadgets/mouse.svg', b'0', (SELECT id FROM categories WHERE slug='mice'), NOW()),
('BoomPods 360 Bluetooth Speaker',
 '20W stereo sound with 360-degree bass, IPX7 waterproof, 24-hour playtime, TWS pairing, RGB light ring, USB-C fast charge.',
 'Sonic', 3799.00, 4999.00, 50, '/images/gadgets/speaker.svg', b'1', (SELECT id FROM categories WHERE slug='speakers'), NOW()),
('Crystal Sound Bar Mini',
 'Compact 40W sound bar with dual passive radiators, HDMI ARC + optical + Bluetooth, wall mountable, TV & PC ready.',
 'Crystal', 6499.00, 8499.00, 25, '/images/gadgets/speaker.svg', b'0', (SELECT id FROM categories WHERE slug='speakers'), NOW()),
('VoltDash 65W GaN Charger',
 '65W USB-C PD 3.0 in a pocket-size GaN body, charges laptop + phone together, 3 ports (2xC + 1xA), foldable pins.',
 'Volt', 2199.00, 2799.00, 100, '/images/gadgets/charger.svg', b'1', (SELECT id FROM categories WHERE slug='chargers'), NOW()),
('DualPort 30W Fast Charger',
 '30W dual USB (USB-C PD + USB-A QC), charges two devices at once, over-voltage & over-heat protection, travel friendly.',
 'Volt', 1299.00, 1699.00, 120, '/images/gadgets/charger.svg', b'0', (SELECT id FROM categories WHERE slug='chargers'), NOW()),
('PowerVault 20000mAh Power Bank',
 '20000mAh with 22.5W fast charging, dual USB + USB-C in/out, digital battery display, airline safe, low-power mode.',
 'Nova', 2899.00, 3499.00, 65, '/images/gadgets/powerbank.svg', b'1', (SELECT id FROM categories WHERE slug='power-banks'), NOW()),
('SlimCell 10000mAh Power Bank',
 'Ultra-slim 10000mAh, 20W USB-C PD, pass-through charging, aluminium body, 4-LED indicator, weighs just 180g.',
 'Nova', 1599.00, 1999.00, 85, '/images/gadgets/powerbank.svg', b'0', (SELECT id FROM categories WHERE slug='power-banks'), NOW()),
('TabNova 11 Pro Tablet',
 '11" 2.5K 120Hz display, 8GB RAM / 256GB storage, quad speakers with Dolby Atmos, 8000mAh battery, stylus support.',
 'Nova', 32999.00, 36999.00, 22, '/images/gadgets/tablet.svg', b'1', (SELECT id FROM categories WHERE slug='tablets'), NOW()),
('TabLite 10 Tablet',
 '10.4" 2K display, 6GB RAM / 128GB storage (expandable), 7040mAh battery, dual speakers - perfect for study and streaming.',
 'Pulse', 15499.00, 17999.00, 30, '/images/gadgets/tablet.svg', b'0', (SELECT id FROM categories WHERE slug='tablets'), NOW()),
('ClearShot X200 Mirrorless Camera',
 '24.2MP APS-C sensor, 4K60 video, 5-axis in-body stabilisation, eye-detection AF, includes 18-55mm kit lens.',
 'Crystal', 58999.00, 64999.00, 12, '/images/gadgets/camera.svg', b'1', (SELECT id FROM categories WHERE slug='cameras'), NOW()),
('VividCam 4K Action Camera',
 '4K60 action camera with HyperSteady stabilisation, waterproof case (30m), 120fps slow motion, touch screen, Wi-Fi + app control.',
 'Hyper', 18999.00, 22499.00, 28, '/images/gadgets/camera.svg', b'0', (SELECT id FROM categories WHERE slug='cameras'), NOW()),
('DataBolt 128GB USB 3.2 Flash Drive',
 '128GB pen drive with 100MB/s read speed, metal body, keyring loop, plug-and-play with laptops, TVs and car stereos.',
 'DataBolt', 1299.00, 1699.00, 150, '/images/gadgets/usbdrive.svg', b'0', (SELECT id FROM categories WHERE slug='usb-drives'), NOW()),
('HyperDrive 64GB Dual OTG Pen Drive',
 '64GB dual OTG drive with USB-C + USB-A connectors, 150MB/s transfer, direct phone-to-drive backup, aluminium body.',
 'Hyper', 799.00, 999.00, 180, '/images/gadgets/usbdrive.svg', b'0', (SELECT id FROM categories WHERE slug='usb-drives'), NOW()),
('NexLink USB-C Hub 7-in-1',
 '4K HDMI, USB 3.0 x3, SD/TF card readers and 100W PD pass-through in one aluminium hub - works with laptops, tablets and phones.',
 'Nexon', 3499.00, 4499.00, 60, '/images/gadgets/accessories.svg', b'0', (SELECT id FROM categories WHERE slug='accessories'), NOW()),
('BreezeCool Laptop Cooling Pad',
 'Dual-fan cooling pad with height adjustment, 5-speed fans, USB passthrough, fits up to 17" laptops, silent operation.',
 'Breeze', 2199.00, 2799.00, 40, '/images/gadgets/accessories.svg', b'0', (SELECT id FROM categories WHERE slug='accessories'), NOW()),
('ShieldGuard 9H Screen Guard (2-Pack)',
 '9H tempered glass screen guards with anti-bubble silicone adhesive, oleophobic coating, easy-install frame included.',
 'Shield', 499.00, 799.00, 200, '/images/gadgets/accessories.svg', b'0', (SELECT id FROM categories WHERE slug='accessories'), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ------------------------------------------------------------------
-- USER ACCOUNTS (BUYER / SELLER / ADMIN roles)
-- User rows are created by the application on first start
-- (BCrypt-encoded passwords cannot be inserted safely by hand).
--   Admin  : admin@aathiramart.com  / Admin@123   (role ADMIN)
--   Buyer  : demo@aathiramart.com   / Demo@1234   (role BUYER)
--   Seller : seller@aathiramart.com / Seller@123  (role SELLER)
-- New buyers/sellers register themselves from register.html.
-- ------------------------------------------------------------------
