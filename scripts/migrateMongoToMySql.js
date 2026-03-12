require('dotenv').config();
const { MongoClient } = require('mongodb');
const { initMySql, getConnection } = require('../db/mysql');

const parseArg = name => process.argv.includes(name);

const dryRun = parseArg('--dry-run');

const getMongoDbNameFromUri = mongoUri => {
  try {
    const withoutQuery = String(mongoUri || '').split('?')[0];
    const dbName = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);
    return dbName || 'blinkit';
  } catch (_) {
    return 'blinkit';
  }
};

const toNumber = value => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

async function migrate() {
  const mongoUri = String(process.env.MONGO_URI || process.env.MIGRATE_MONGO_URI || '').trim();
  if (!mongoUri) {
    throw new Error('Set MONGO_URI (or MIGRATE_MONGO_URI) to run migration.');
  }

  const mongoDbName = String(process.env.MONGO_DB_NAME || getMongoDbNameFromUri(mongoUri)).trim() || 'blinkit';
  const productsCollectionName = String(process.env.MONGO_PRODUCTS_COLLECTION || 'products').trim();
  const ordersCollectionName = String(process.env.MONGO_ORDERS_COLLECTION || 'orders').trim();
  const adminUsersCollectionName = String(process.env.MONGO_ADMIN_USERS_COLLECTION || 'adminusers').trim();

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();

  try {
    const mongoDb = mongoClient.db(mongoDbName);
    const [mongoProducts, mongoOrders, mongoAdminUsers] = await Promise.all([
      mongoDb.collection(productsCollectionName).find({}).toArray(),
      mongoDb.collection(ordersCollectionName).find({}).toArray(),
      mongoDb.collection(adminUsersCollectionName).find({}).toArray()
    ]);

    console.log(`Mongo source => products=${mongoProducts.length}, orders=${mongoOrders.length}, adminUsers=${mongoAdminUsers.length}`);

    if (dryRun) {
      console.log('Dry run complete. No MySQL writes were made.');
      return;
    }

    await initMySql();
    const conn = await getConnection();

    try {
      await conn.beginTransaction();

      const productIdSet = new Set();
      for (const product of mongoProducts) {
        const id = String(product._id);
        productIdSet.add(id);

        await conn.execute(
          `
            INSERT INTO products (id, name, category, price, image, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              category = VALUES(category),
              price = VALUES(price),
              image = VALUES(image),
              description = VALUES(description),
              updated_at = VALUES(updated_at)
          `,
          [
            id,
            String(product.name || ''),
            String(product.category || ''),
            toNumber(product.price),
            String(product.image || ''),
            String(product.description || ''),
            product.createdAt ? new Date(product.createdAt) : new Date(),
            product.updatedAt ? new Date(product.updatedAt) : new Date()
          ]
        );
      }

      for (const order of mongoOrders) {
        const orderId = String(order._id);
        const fullName = String(order?.customer?.fullName || '');
        const phone = String(order?.customer?.phone || '');
        const address = String(order?.customer?.address || '');

        const latitudeValue = order?.customer?.location?.latitude;
        const longitudeValue = order?.customer?.location?.longitude;
        const latitude = Number.isFinite(Number(latitudeValue)) ? Number(latitudeValue) : null;
        const longitude = Number.isFinite(Number(longitudeValue)) ? Number(longitudeValue) : null;
        const mapUrl = String(order?.customer?.location?.mapUrl || '').trim() || null;

        await conn.execute(
          `
            INSERT INTO orders (
              id,
              customer_full_name,
              customer_phone,
              customer_address,
              customer_latitude,
              customer_longitude,
              customer_map_url,
              payment_mode,
              subtotal,
              delivery_fee,
              total,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              customer_full_name = VALUES(customer_full_name),
              customer_phone = VALUES(customer_phone),
              customer_address = VALUES(customer_address),
              customer_latitude = VALUES(customer_latitude),
              customer_longitude = VALUES(customer_longitude),
              customer_map_url = VALUES(customer_map_url),
              payment_mode = VALUES(payment_mode),
              subtotal = VALUES(subtotal),
              delivery_fee = VALUES(delivery_fee),
              total = VALUES(total),
              status = VALUES(status),
              updated_at = VALUES(updated_at)
          `,
          [
            orderId,
            fullName,
            phone,
            address,
            latitude,
            longitude,
            mapUrl,
            order.paymentMode === 'upi' ? 'upi' : 'cod',
            toNumber(order.subtotal),
            toNumber(order.deliveryFee),
            toNumber(order.total),
            String(order.status || 'placed'),
            order.createdAt ? new Date(order.createdAt) : new Date(),
            order.updatedAt ? new Date(order.updatedAt) : new Date()
          ]
        );

        await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);

        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const rawProductId = item?.product ? String(item.product) : '';
          const productId = rawProductId && productIdSet.has(rawProductId) ? rawProductId : null;

          await conn.execute(
            `
              INSERT INTO order_items (order_id, product_id, name, price, quantity)
              VALUES (?, ?, ?, ?, ?)
            `,
            [
              orderId,
              productId,
              String(item?.name || ''),
              toNumber(item?.price),
              Math.max(1, Number(item?.quantity || 1))
            ]
          );
        }
      }

      for (const admin of mongoAdminUsers) {
        await conn.execute(
          `
            INSERT INTO admin_users (
              username,
              email,
              password_hash,
              qr_reset_password_hash,
              two_factor_enabled,
              two_factor_secret,
              credentials_two_factor_enabled,
              credentials_two_factor_secret,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              username = VALUES(username),
              password_hash = VALUES(password_hash),
              qr_reset_password_hash = VALUES(qr_reset_password_hash),
              two_factor_enabled = VALUES(two_factor_enabled),
              two_factor_secret = VALUES(two_factor_secret),
              credentials_two_factor_enabled = VALUES(credentials_two_factor_enabled),
              credentials_two_factor_secret = VALUES(credentials_two_factor_secret),
              updated_at = VALUES(updated_at)
          `,
          [
            String(admin.username || '').toLowerCase(),
            String(admin.email || '').toLowerCase(),
            String(admin.passwordHash || ''),
            String(admin.qrResetPasswordHash || ''),
            admin.twoFactorEnabled ? 1 : 0,
            String(admin.twoFactorSecret || ''),
            admin.credentialsTwoFactorEnabled ? 1 : 0,
            String(admin.credentialsTwoFactorSecret || ''),
            admin.createdAt ? new Date(admin.createdAt) : new Date(),
            admin.updatedAt ? new Date(admin.updatedAt) : new Date()
          ]
        );
      }

      await conn.commit();
      console.log('Migration completed successfully.');
      console.log(`Migrated products=${mongoProducts.length}, orders=${mongoOrders.length}, adminUsers=${mongoAdminUsers.length}`);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } finally {
    await mongoClient.close();
  }
}

migrate()
  .catch(error => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  });
