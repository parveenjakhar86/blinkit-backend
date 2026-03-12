const express = require('express');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { getCollection } = require('../db/mongo');

const router = express.Router();

const mapAdminUser = doc => {
  if (!doc) return null;
  return {
    id: doc._id,
    username: doc.username,
    email: doc.email,
    passwordHash: doc.passwordHash,
    qrResetPasswordHash: doc.qrResetPasswordHash,
    twoFactorEnabled: Boolean(doc.twoFactorEnabled),
    twoFactorSecret: doc.twoFactorSecret || '',
    credentialsTwoFactorEnabled: Boolean(doc.credentialsTwoFactorEnabled),
    credentialsTwoFactorSecret: doc.credentialsTwoFactorSecret || ''
  };
};

const findAdminByUsernameOrEmail = async usernameOrEmail => {
  const value = String(usernameOrEmail || '').trim().toLowerCase();
  if (!value) return null;

  const doc = await getCollection('adminUsers').findOne({
    $or: [{ username: value }, { email: value }]
  });
  return mapAdminUser(doc);
};

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const otp = String(req.body?.otp || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    if (!adminUser.twoFactorEnabled || !adminUser.twoFactorSecret) {
      return res.status(403).json({
        error: 'Google Authenticator setup is required for admin login',
        code: 'TWO_FA_SETUP_REQUIRED'
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(401).json({ error: 'Enter valid 6-digit authenticator code' });
    }

    const validOtp = speakeasy.totp.verify({
      secret: adminUser.twoFactorSecret,
      encoding: 'base32',
      token: otp,
      window: 1
    });

    if (!validOtp) {
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }

    return res.json({ authenticated: true, admin: { username: adminUser.username, email: adminUser.email } });
  } catch (err) {
    return res.status(500).json({ error: 'Admin login failed' });
  }
});

router.post('/credentials-login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const authCode = String(req.body?.authCode || '').trim();

    if (!username || !authCode) {
      return res.status(400).json({ error: 'Admin email and credentials authenticator code are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid admin email' });
    }

    if (!adminUser.credentialsTwoFactorEnabled || !adminUser.credentialsTwoFactorSecret) {
      return res.status(403).json({
        error: 'Credentials authenticator setup is required for admin credentials login',
        code: 'CREDENTIALS_TWO_FA_SETUP_REQUIRED'
      });
    }

    if (!/^\d{6}$/.test(authCode)) {
      return res.status(401).json({ error: 'Enter valid 6-digit credentials authenticator code' });
    }

    const validOtp = speakeasy.totp.verify({
      secret: adminUser.credentialsTwoFactorSecret,
      encoding: 'base32',
      token: authCode,
      window: 1
    });

    if (!validOtp) {
      return res.status(401).json({ error: 'Invalid credentials authenticator code' });
    }

    return res.json({ authenticated: true, admin: { username: adminUser.username, email: adminUser.email } });
  } catch (err) {
    return res.status(500).json({ error: 'Admin credentials login failed' });
  }
});

router.post('/credentials-2fa/setup', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Admin email and password are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid admin email or password' });
    }

    const secret = speakeasy.generateSecret({
      name: `Blinkit Credentials (${adminUser.email})`,
      issuer: 'Blinkit'
    });

    await getCollection('adminUsers').updateOne(
      { _id: adminUser.id },
      {
        $set: {
          credentialsTwoFactorEnabled: false,
          credentialsTwoFactorSecret: secret.base32,
          updatedAt: new Date()
        }
      }
    );

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      message: 'Scan QR in Google Authenticator and verify credentials authenticator code',
      qrCodeDataUrl,
      manualKey: secret.base32
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to setup credentials authenticator' });
  }
});

router.post('/credentials-2fa/verify', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const authCode = String(req.body?.authCode || '').trim();

    if (!username || !authCode) {
      return res.status(400).json({ error: 'Admin email and credentials authenticator code are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser || !adminUser.credentialsTwoFactorSecret) {
      return res.status(404).json({ error: 'Credentials authenticator setup not found for this user' });
    }

    if (!/^\d{6}$/.test(authCode)) {
      return res.status(400).json({ error: 'Enter valid 6-digit credentials authenticator code' });
    }

    const validOtp = speakeasy.totp.verify({
      secret: adminUser.credentialsTwoFactorSecret,
      encoding: 'base32',
      token: authCode,
      window: 1
    });

    if (!validOtp) {
      return res.status(401).json({ error: 'Invalid credentials authenticator code' });
    }

    await getCollection('adminUsers').updateOne(
      { _id: adminUser.id },
      { $set: { credentialsTwoFactorEnabled: true, updatedAt: new Date() } }
    );

    return res.json({ message: 'Credentials authenticator enabled successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify credentials authenticator setup' });
  }
});

router.post('/2fa/setup', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    const secret = speakeasy.generateSecret({
      name: `Blinkit Admin (${adminUser.email})`,
      issuer: 'Blinkit'
    });

    await getCollection('adminUsers').updateOne(
      { _id: adminUser.id },
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: secret.base32,
          updatedAt: new Date()
        }
      }
    );

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      message: 'Scan QR in Google Authenticator and verify code',
      qrCodeDataUrl,
      manualKey: secret.base32
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to setup authenticator' });
  }
});

router.post('/2fa/reset-and-generate', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const authCode = String(req.body?.authCode || '').trim();

    if (!username || !authCode) {
      return res.status(400).json({ error: 'Username and credentials authenticator code are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    if (!adminUser.credentialsTwoFactorEnabled || !adminUser.credentialsTwoFactorSecret) {
      return res.status(400).json({ error: 'Credentials authenticator is not enabled. Reset credentials authenticator first.' });
    }

    if (!/^\d{6}$/.test(authCode)) {
      return res.status(400).json({ error: 'Enter valid 6-digit Credentials Authenticator code' });
    }

    const validOtp = speakeasy.totp.verify({
      secret: adminUser.credentialsTwoFactorSecret,
      encoding: 'base32',
      token: authCode,
      window: 1
    });

    if (!validOtp) {
      return res.status(401).json({ error: 'Invalid credentials authenticator code' });
    }

    const secret = speakeasy.generateSecret({
      name: `Blinkit Admin (${adminUser.email})`,
      issuer: 'Blinkit'
    });

    await getCollection('adminUsers').updateOne(
      { _id: adminUser.id },
      {
        $set: {
          twoFactorSecret: secret.base32,
          twoFactorEnabled: true,
          updatedAt: new Date()
        }
      }
    );

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      message: 'Login authenticator reset. New QR generated successfully',
      qrCodeDataUrl,
      manualKey: secret.base32
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reset and generate authenticator QR' });
  }
});

router.post('/2fa/current-qr', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const authCode = String(req.body?.authCode || '').trim();

    if (!username || !authCode) {
      return res.status(400).json({ error: 'Username and authenticator code are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    if (!adminUser.twoFactorEnabled || !adminUser.twoFactorSecret) {
      return res.status(400).json({ error: 'Login authenticator is not enabled for this user' });
    }

    if (!adminUser.credentialsTwoFactorEnabled || !adminUser.credentialsTwoFactorSecret) {
      return res.status(400).json({ error: 'Credentials authenticator is not enabled. Reset credentials authenticator first.' });
    }

    if (!/^\d{6}$/.test(authCode)) {
      return res.status(400).json({ error: 'Enter valid 6-digit Google Authenticator code' });
    }

    const validOtp = speakeasy.totp.verify({
      secret: adminUser.credentialsTwoFactorSecret,
      encoding: 'base32',
      token: authCode,
      window: 1
    });

    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid credentials authenticator code' });
    }

    const otpauthUrl = speakeasy.otpauthURL({
      secret: adminUser.twoFactorSecret,
      label: `Blinkit Admin (${adminUser.email})`,
      issuer: 'Blinkit',
      encoding: 'base32'
    });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return res.json({
      message: 'Current login authenticator QR generated successfully',
      qrCodeDataUrl,
      manualKey: adminUser.twoFactorSecret
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate current authenticator QR' });
  }
});

router.post('/2fa/verify-setup', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const token = String(req.body?.token || '').trim();

    if (!username || !token) {
      return res.status(400).json({ error: 'Username and code are required' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser || !adminUser.twoFactorSecret) {
      return res.status(404).json({ error: '2FA setup not found for this user' });
    }

    const validToken = speakeasy.totp.verify({
      secret: adminUser.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!validToken) {
      return res.status(400).json({ error: 'Invalid authenticator code' });
    }

    await getCollection('adminUsers').updateOne(
      { _id: adminUser.id },
      { $set: { twoFactorEnabled: true, updatedAt: new Date() } }
    );

    return res.json({ message: 'Google Authenticator enabled successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify authenticator setup' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const authCode = String(req.body?.authCode || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!username || !newPassword) {
      return res.status(400).json({ error: 'Username and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const adminUser = await findAdminByUsernameOrEmail(username);
    if (!adminUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!adminUser.twoFactorEnabled || !adminUser.twoFactorSecret) {
      return res.status(400).json({ error: 'Google Authenticator is not enabled for this user' });
    }

    if (!/^\d{6}$/.test(authCode)) {
      return res.status(400).json({ error: 'Enter valid 6-digit Google Authenticator code' });
    }

    const validOtp = speakeasy.totp.verify({
      secret: adminUser.twoFactorSecret,
      encoding: 'base32',
      token: authCode,
      window: 1
    });

    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid Google Authenticator code' });
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, 10);
    await getCollection('adminUsers').updateOne(
      { _id: adminUser.id },
      { $set: { passwordHash: nextPasswordHash, updatedAt: new Date() } }
    );

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
