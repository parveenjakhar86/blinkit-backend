CREATE DATABASE IF NOT EXISTS `blinkit` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `blinkit`;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(32) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image TEXT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category),
  INDEX idx_products_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(24) PRIMARY KEY,
  customer_full_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_address TEXT NOT NULL,
  customer_latitude DECIMAL(10,6) NULL,
  customer_longitude DECIMAL(10,6) NULL,
  customer_map_url TEXT NULL,
  payment_mode VARCHAR(12) NOT NULL DEFAULT 'cod',
  subtotal DECIMAL(12,2) NOT NULL,
  delivery_fee DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'placed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_phone (customer_phone),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(24) NOT NULL,
  product_id VARCHAR(24) NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order_items_order_id (order_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(190) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  qr_reset_password_hash VARCHAR(255) NOT NULL,
  two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0,
  two_factor_secret TEXT NULL,
  credentials_two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0,
  credentials_two_factor_secret TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
