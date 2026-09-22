package com.aathiramart.service;

import com.aathiramart.entity.Category;
import com.aathiramart.entity.Product;
import com.aathiramart.entity.Role;
import com.aathiramart.entity.User;
import com.aathiramart.repository.CategoryRepository;
import com.aathiramart.repository.ProductRepository;
import com.aathiramart.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds the database on first start:
 *  - upgrades legacy USER roles to BUYER
 *  - admin + demo buyer accounts, plus a demo seller account (BCrypt encoded)
 *  - 13 gadget categories
 *  - 27 sample gadget products
 * Every block only runs when its table is empty, so it is safe to restart.
 */
@Service
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;

    public DataSeeder(UserRepository userRepository,
                      CategoryRepository categoryRepository,
                      ProductRepository productRepository,
                      PasswordEncoder passwordEncoder,
                      EntityManager entityManager) {
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.passwordEncoder = passwordEncoder;
        this.entityManager = entityManager;
    }

    @Override
    @Transactional
    public void run(String... args) {
        migrateLegacyRoles();
        seedUsers();
        ensureSellerAccount();
        seedCategories();
        seedProducts();
    }

    /**
     * Upgrades rows created before the BUYER/SELLER/ADMIN role system existed.
     * Older schemas stored the role as an ENUM('ADMIN','USER') column that cannot
     * represent 'BUYER', so the column is widened to VARCHAR first, then remapped.
     */
    private void migrateLegacyRoles() {
        Number legacy = (Number) entityManager
                .createNativeQuery("SELECT COUNT(*) FROM users WHERE role = 'USER'")
                .getSingleResult();
        if (legacy.longValue() == 0) {
            return;
        }
        entityManager.createNativeQuery(
                "ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'BUYER'")
                .executeUpdate();
        int migrated = entityManager.createNativeQuery(
                "UPDATE users SET role = 'BUYER' WHERE role = 'USER'")
                .executeUpdate();
        log.info("Migrated {} legacy USER account(s) to BUYER", migrated);
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            return;
        }
        userRepository.save(new User("Aathira Admin", "admin@aathiramart.com",
                passwordEncoder.encode("Admin@123"), "9876543210", Role.ADMIN));
        userRepository.save(new User("Demo Customer", "demo@aathiramart.com",
                passwordEncoder.encode("Demo@1234"), "9876501234", Role.BUYER));
        log.info("Seeded user accounts: admin@aathiramart.com / Admin@123 , demo@aathiramart.com / Demo@1234");
    }

    /** Makes sure a demo seller account always exists (created even on non-empty tables). */
    private void ensureSellerAccount() {
        String email = "seller@aathiramart.com";
        if (userRepository.findByEmail(email).isPresent()) {
            return;
        }
        userRepository.save(new User("Demo Seller", email,
                passwordEncoder.encode("Seller@123"), "9876512345", Role.SELLER));
        log.info("Seeded seller account: {} / Seller@123", email);
    }

    private void seedCategories() {
        if (categoryRepository.count() > 0) {
            return;
        }
        List<Category> categories = List.of(
                new Category("Smartphones", "smartphones", "Latest 5G phones with flagship cameras", "bi-phone", 1),
                new Category("Laptops", "laptops", "Ultrabooks, gaming and everyday laptops", "bi-laptop", 2),
                new Category("Headphones", "headphones", "Wired & wireless headphones with deep bass", "bi-headphones", 3),
                new Category("Smartwatches", "smartwatches", "Fitness trackers & smart watches", "bi-smartwatch", 4),
                new Category("Keyboards", "keyboards", "Mechanical & wireless keyboards", "bi-keyboard", 5),
                new Category("Mice", "mice", "Ergonomic and gaming mice", "bi-mouse", 6),
                new Category("Speakers", "speakers", "Bluetooth speakers & sound bars", "bi-speaker", 7),
                new Category("Chargers", "chargers", "Fast, GaN and wireless chargers", "bi-plug", 8),
                new Category("Power Banks", "power-banks", "High capacity power banks on the go", "bi-battery-charging", 9),
                new Category("Tablets", "tablets", "Tablets for work, study and play", "bi-tablet", 10),
                new Category("Cameras", "cameras", "Mirrorless, action & instant cameras", "bi-camera", 11),
                new Category("USB Drives", "usb-drives", "Pen drives, OTG & storage", "bi-usb-drive", 12),
                new Category("Accessories", "accessories", "Hubs, stands, guards & more", "bi-tools", 13));
        categoryRepository.saveAll(categories);
        log.info("Seeded {} gadget categories", categories.size());
    }

    private void seedProducts() {
        if (productRepository.count() > 0) {
            return;
        }

        Map<String, Category> cat = new HashMap<>();
        categoryRepository.findAll().forEach(c -> cat.put(c.getSlug(), c));

        record Seed(String cat, String name, String brand, String price, String mrp,
                    int stock, String image, boolean featured, String description) {
        }

        List<Seed> seeds = List.of(
                new Seed("smartphones", "Nexon X5 Pro 5G Smartphone", "Nexon", "54999.00", "59999.00", 25,
                        "/images/gadgets/smartphone.svg", true,
                        "6.7\" AMOLED 120Hz display, 108MP OIS triple camera, 5000mAh battery with 67W fast charging, 12GB RAM / 256GB storage, 5G dual SIM."),
                new Seed("smartphones", "Volt Edge 5G Smartphone", "Volt", "24999.00", "27999.00", 40,
                        "/images/gadgets/smartphone.svg", false,
                        "6.4\" FHD+ 90Hz display, 64MP AI camera, 5000mAh battery, 8GB RAM / 128GB storage, side fingerprint, Android 14."),
                new Seed("laptops", "Titan Book Pro 15 Laptop", "Titan", "92499.00", "99999.00", 15,
                        "/images/gadgets/laptop.svg", true,
                        "15.6\" 2K 165Hz display, Intel Core i7 13th gen, RTX 4060 8GB, 16GB DDR5 RAM, 1TB NVMe SSD, backlit keyboard, 80Wh battery."),
                new Seed("laptops", "Aero Slim 13 Ultrabook", "Aero", "68999.00", "74999.00", 18,
                        "/images/gadgets/laptop.svg", false,
                        "13.3\" IPS display, Intel Core Ultra 5, 16GB LPDDR5 RAM, 512GB SSD, 1.1kg aluminium body, 16-hour battery life, Thunderbolt 4."),
                new Seed("headphones", "SonicBass Pro Wireless Headphones", "Sonic", "8999.00", "11999.00", 60,
                        "/images/gadgets/headphones.svg", true,
                        "40mm drivers with deep bass, active noise cancellation, 50-hour battery, Bluetooth 5.3, dual pairing, memory-foam earcups."),
                new Seed("headphones", "AeroTune Studio Headphones", "Aero", "5499.00", "6999.00", 45,
                        "/images/gadgets/headphones.svg", false,
                        "Flat-response studio tuning, detachable 3.5mm cable, lightweight foldable frame, memory-foam cushions for long sessions."),
                new Seed("smartwatches", "Pulse Fit 3 Smartwatch", "Pulse", "4299.00", "5999.00", 70,
                        "/images/gadgets/smartwatch.svg", true,
                        "1.43\" AMOLED display, Bluetooth calling, SpO2 & heart-rate tracking, 100+ sports modes, 7-day battery, 5ATM water resistant."),
                new Seed("smartwatches", "Orbit Watch Ultra", "Orbit", "12999.00", "15999.00", 20,
                        "/images/gadgets/smartwatch.svg", false,
                        "1.9\" sapphire AMOLED, dual-band GPS, titanium bezel, ECG + SpO2, 14-day battery, built-in speaker and mic, 10ATM water resistant."),
                new Seed("keyboards", "BlazeMech RGB Mechanical Keyboard", "Blaze", "4999.00", "6499.00", 35,
                        "/images/gadgets/keyboard.svg", true,
                        "Hot-swappable red switches, per-key RGB, aluminium top plate, detachable USB-C cable, anti-ghosting, wrist rest included."),
                new Seed("keyboards", "QuietType Wireless Keyboard", "Pulse", "2499.00", "3199.00", 55,
                        "/images/gadgets/keyboard.svg", false,
                        "Scissor-switch silent keys, 2.4GHz + Bluetooth dual mode, slim profile, spill resistant, up to 12 months battery."),
                new Seed("mice", "HyperGlide Gaming Mouse", "Hyper", "2999.00", "3799.00", 80,
                        "/images/gadgets/mouse.svg", true,
                        "26000 DPI optical sensor, 8 programmable buttons, RGB lighting, 70g lightweight, braided cable, 1000Hz polling rate."),
                new Seed("mice", "SilentClick Pro Mouse", "Nexon", "1499.00", "1999.00", 90,
                        "/images/gadgets/mouse.svg", false,
                        "Silent clicks, ergonomic right-hand shape, 3 DPI levels, Bluetooth + USB receiver, 18-month battery life."),
                new Seed("speakers", "BoomPods 360 Bluetooth Speaker", "Sonic", "3799.00", "4999.00", 50,
                        "/images/gadgets/speaker.svg", true,
                        "20W stereo sound with 360-degree bass, IPX7 waterproof, 24-hour playtime, TWS pairing, RGB light ring, USB-C fast charge."),
                new Seed("speakers", "Crystal Sound Bar Mini", "Crystal", "6499.00", "8499.00", 25,
                        "/images/gadgets/speaker.svg", false,
                        "Compact 40W sound bar with dual passive radiators, HDMI ARC + optical + Bluetooth, wall mountable, TV & PC ready."),
                new Seed("chargers", "VoltDash 65W GaN Charger", "Volt", "2199.00", "2799.00", 100,
                        "/images/gadgets/charger.svg", true,
                        "65W USB-C PD 3.0 in a pocket-size GaN body, charges laptop + phone together, 3 ports (2xC + 1xA), foldable pins."),
                new Seed("chargers", "DualPort 30W Fast Charger", "Volt", "1299.00", "1699.00", 120,
                        "/images/gadgets/charger.svg", false,
                        "30W dual USB (USB-C PD + USB-A QC), charges two devices at once, over-voltage & over-heat protection, travel friendly."),
                new Seed("power-banks", "PowerVault 20000mAh Power Bank", "Nova", "2899.00", "3499.00", 65,
                        "/images/gadgets/powerbank.svg", true,
                        "20000mAh with 22.5W fast charging, dual USB + USB-C in/out, digital battery display, airline safe, low-power mode."),
                new Seed("power-banks", "SlimCell 10000mAh Power Bank", "Nova", "1599.00", "1999.00", 85,
                        "/images/gadgets/powerbank.svg", false,
                        "Ultra-slim 10000mAh, 20W USB-C PD, pass-through charging, aluminium body, 4-LED indicator, weighs just 180g."),
                new Seed("tablets", "TabNova 11 Pro Tablet", "Nova", "32999.00", "36999.00", 22,
                        "/images/gadgets/tablet.svg", true,
                        "11\" 2.5K 120Hz display, 8GB RAM / 256GB storage, quad speakers with Dolby Atmos, 8000mAh battery, stylus support."),
                new Seed("tablets", "TabLite 10 Tablet", "Pulse", "15499.00", "17999.00", 30,
                        "/images/gadgets/tablet.svg", false,
                        "10.4\" 2K display, 6GB RAM / 128GB storage (expandable), 7040mAh battery, dual speakers - perfect for study and streaming."),
                new Seed("cameras", "ClearShot X200 Mirrorless Camera", "Crystal", "58999.00", "64999.00", 12,
                        "/images/gadgets/camera.svg", true,
                        "24.2MP APS-C sensor, 4K60 video, 5-axis in-body stabilisation, eye-detection AF, includes 18-55mm kit lens."),
                new Seed("cameras", "VividCam 4K Action Camera", "Hyper", "18999.00", "22499.00", 28,
                        "/images/gadgets/camera.svg", false,
                        "4K60 action camera with HyperSteady stabilisation, waterproof case (30m), 120fps slow motion, touch screen, Wi-Fi + app control."),
                new Seed("usb-drives", "DataBolt 128GB USB 3.2 Flash Drive", "DataBolt", "1299.00", "1699.00", 150,
                        "/images/gadgets/usbdrive.svg", false,
                        "128GB pen drive with 100MB/s read speed, metal body, keyring loop, plug-and-play with laptops, TVs and car stereos."),
                new Seed("usb-drives", "HyperDrive 64GB Dual OTG Pen Drive", "Hyper", "799.00", "999.00", 180,
                        "/images/gadgets/usbdrive.svg", false,
                        "64GB dual OTG drive with USB-C + USB-A connectors, 150MB/s transfer, direct phone-to-drive backup, aluminium body."),
                new Seed("accessories", "NexLink USB-C Hub 7-in-1", "Nexon", "3499.00", "4499.00", 60,
                        "/images/gadgets/accessories.svg", false,
                        "4K HDMI, USB 3.0 x3, SD/TF card readers and 100W PD pass-through in one aluminium hub - works with laptops, tablets and phones."),
                new Seed("accessories", "BreezeCool Laptop Cooling Pad", "Breeze", "2199.00", "2799.00", 40,
                        "/images/gadgets/accessories.svg", false,
                        "Dual-fan cooling pad with height adjustment, 5-speed fans, USB passthrough, fits up to 17\" laptops, silent operation."),
                new Seed("accessories", "ShieldGuard 9H Screen Guard (2-Pack)", "Shield", "499.00", "799.00", 200,
                        "/images/gadgets/accessories.svg", false,
                        "9H tempered glass screen guards with anti-bubble silicone adhesive, oleophobic coating, easy-install frame included."));

        for (Seed s : seeds) {
            Category category = cat.get(s.cat());
            if (category == null) {
                continue;
            }
            Product product = new Product();
            product.setName(s.name());
            product.setBrand(s.brand());
            product.setDescription(s.description());
            product.setPrice(new BigDecimal(s.price()));
            product.setMrp(new BigDecimal(s.mrp()));
            product.setStock(s.stock());
            product.setImage(s.image());
            product.setFeatured(s.featured());
            product.setCategory(category);
            productRepository.save(product);
        }
        log.info("Seeded {} sample gadget products", productRepository.count());
    }
}
