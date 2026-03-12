-- Product queries
SELECT id, name, category, price, image, description, created_at, updated_at
FROM products
WHERE (? = 'all' OR category = ?)
ORDER BY created_at DESC;

INSERT INTO products (id, name, category, price, description, image)
VALUES (?, ?, ?, ?, ?, ?);

UPDATE products
SET name = ?, category = ?, price = ?, description = ?, image = ?
WHERE id = ?;

DELETE FROM products WHERE id = ?;

-- Order queries
INSERT INTO orders (
  id, customer_full_name, customer_phone, customer_address,
  customer_latitude, customer_longitude, customer_map_url,
  payment_mode, subtotal, delivery_fee, total, status
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed');

INSERT INTO order_items (order_id, product_id, name, price, quantity)
VALUES (?, ?, ?, ?, ?);

SELECT
  o.id,
  o.customer_full_name,
  o.customer_phone,
  o.customer_address,
  o.customer_latitude,
  o.customer_longitude,
  o.customer_map_url,
  o.payment_mode,
  o.subtotal,
  o.delivery_fee,
  o.total,
  o.status,
  o.created_at,
  o.updated_at
FROM orders o
ORDER BY o.created_at DESC;

SELECT
  oi.order_id,
  oi.product_id,
  oi.name,
  oi.price,
  oi.quantity,
  p.image AS product_image
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE oi.order_id IN (?);

UPDATE orders SET status = ? WHERE id = ?;

-- Admin queries
SELECT id, username, email, password_hash, qr_reset_password_hash,
       two_factor_enabled, two_factor_secret,
       credentials_two_factor_enabled, credentials_two_factor_secret
FROM admin_users
WHERE username = ? OR email = ?
LIMIT 1;

INSERT INTO admin_users (
  username, email, password_hash, qr_reset_password_hash,
  two_factor_enabled, two_factor_secret,
  credentials_two_factor_enabled, credentials_two_factor_secret
)
VALUES (?, ?, ?, ?, 0, '', 0, '')
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  qr_reset_password_hash = VALUES(qr_reset_password_hash);
