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

const initMongo = async () => {
  if (db) return db;

  client = new MongoClient(getMongoUri());
  await client.connect();
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
