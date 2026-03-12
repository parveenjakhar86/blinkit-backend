const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const allowedCategories = ['grocery', 'electric', 'buteque', 'dairy', 'snacks', 'beverages', 'personalcare', 'household'];
const allowedPaymentModes = ['cod', 'upi', 'card', 'credit_card'];
const allowedOrderStatus = ['placed', 'confirmed', 'delivered', 'cancelled'];

const collectionNames = {
  products: String(process.env.MONGO_PRODUCTS_COLLECTION || 'products').trim(),
  orders: String(process.env.MONGO_ORDERS_COLLECTION || 'orders').trim(),
  adminUsers: String(process.env.MONGO_ADMIN_USERS_COLLECTION || 'admin_users').trim()
};

let client;
let db;

const getMongoUri = () => String(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017').trim();
const getDatabaseName = () => String(process.env.MONGO_DB_NAME || 'blinkit').trim();

const toBool = value => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const getMongoClientOptions = uri => {
  const options = {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000),
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 15000)
  };

  // Atlas endpoints always require TLS. Keep it explicit for hosted environments.
  if (/mongodb\.net/i.test(uri)) {
    options.tls = true;
  }

  if (toBool(process.env.MONGO_TLS_ALLOW_INVALID_CERTS)) {
    options.tlsAllowInvalidCertificates = true;
  }

  if (toBool(process.env.MONGO_TLS_ALLOW_INVALID_HOSTNAMES)) {
    options.tlsAllowInvalidHostnames = true;
  }

  return options;
};

const initMongo = async () => {
  if (db) return db;

  const uri = getMongoUri();

  try {
    client = new MongoClient(uri, getMongoClientOptions(uri));
    await client.connect();
  } catch (error) {
    const details = String(error?.message || error || 'MongoDB connection failed');
    const atlasHint = /mongodb\.net/i.test(uri)
      ? ' Atlas hint: set Render MONGO_URI to the Atlas Driver URI format (mongodb+srv://...), and in Atlas Network Access allow 0.0.0.0/0 for Render.'
      : '';
    throw new Error(`${details}.${atlasHint}`.trim());
  }

  db = client.db(getDatabaseName());

  await Promise.all([
    db.collection(collectionNames.products).createIndex({ category: 1, createdAt: -1 }),
    db.collection(collectionNames.orders).createIndex({ createdAt: -1 }),
    db.collection(collectionNames.orders).createIndex({ status: 1, createdAt: -1 }),
    db.collection(collectionNames.orders).createIndex({ 'customer.phone': 1, createdAt: -1 }),
    db.collection(collectionNames.adminUsers).createIndex({ username: 1 }, { unique: true }),
    db.collection(collectionNames.adminUsers).createIndex({ email: 1 }, { unique: true })
  ]);

  return db;
};

const assertDb = () => {
  if (!db) {
    throw new Error('MongoDB is not initialized');
  }
};

const getCollection = name => {
  assertDb();
  const collectionName = collectionNames[name];
  if (!collectionName) {
    throw new Error(`Unknown collection key: ${name}`);
  }
  return db.collection(collectionName);
};

const generateId = () => crypto.randomBytes(12).toString('hex');

module.exports = {
  allowedCategories,
  allowedPaymentModes,
  allowedOrderStatus,
  initMongo,
  getCollection,
  generateId
};
