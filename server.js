const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initMongo, getCollection } = require('./db/mongo');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// routes
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminAuthRoutes = require('./routes/adminAuth');
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminAuthRoutes);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const ensureDefaultAdminUser = async () => {
  const adminEmail = String(process.env.ADMIN_EMAIL || 'parveen@marioxsoftware.com').trim().toLowerCase();
  const adminUsername = String(process.env.ADMIN_USERNAME || adminEmail).trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'parveen');
  const qrResetPasswordEnv = String(process.env.ADMIN_QR_RESET_PASSWORD || `${adminPassword}_qr`);
  const qrResetPassword = qrResetPasswordEnv === adminPassword ? `${adminPassword}_qr` : qrResetPasswordEnv;

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const qrResetPasswordHash = await bcrypt.hash(qrResetPassword, 10);

  const adminUsers = getCollection('adminUsers');
  await adminUsers.updateOne(
    { $or: [{ username: adminUsername }, { email: adminEmail }] },
    {
      $set: {
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        qrResetPasswordHash,
        updatedAt: new Date()
      },
      $setOnInsert: {
        twoFactorEnabled: false,
        twoFactorSecret: '',
        credentialsTwoFactorEnabled: false,
        credentialsTwoFactorSecret: '',
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
};

const startServer = async () => {
  try {
    await initMongo();
    console.log('MongoDB connected');
  } catch (dbError) {
    console.error('MongoDB connection failed.');
    console.error(dbError);
    process.exit(1);
  }

  await ensureDefaultAdminUser();
  app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
};

startServer();
