'use strict';
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authService = require('../services/authService');
const { sendSuccess } = require('../utils/apiResponse');
const config = require('../config');
const logger = require('../utils/logger');
const generateRecoveryKey = require('../utils/generateRecoveryKey');

const isProd = config.env === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax', // Changed from 'strict' to 'none' for cross-origin
  path: '/',
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    });

    // ✅ Set access token with path '/' so it's sent with all requests
    res.cookie('accessToken', result.accessToken, {
      ...COOKIE_OPTS,
      maxAge: 15 * 60 * 1000,
    });

    // ✅ FIXED: Set refresh token with path '/api/v1/auth/' instead of '/api/v1/auth/refresh'
    // This allows the cookie to be sent to the refresh endpoint correctly
    res.cookie('refreshToken', result.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/',
    });

    return sendSuccess(res, result.user, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const result = await authService.refreshAccessToken({
      rawRefreshToken,
      ipAddress: req.ip,
      requestId: req.id,
    });

    res.cookie('accessToken', result.accessToken, {
      ...COOKIE_OPTS,
      maxAge: 15 * 60 * 1000,
    });

    // ✅ FIXED: Set refresh token with path '/api/v1/auth/' for consistency
    res.cookie('refreshToken', result.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/',
    });

    return sendSuccess(res, null, 'Token refreshed successfully');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout({
      userId: req.user._id,
      rawRefreshToken: req.cookies?.refreshToken,
      requestId: req.id,
    });

    res.clearCookie('accessToken', COOKIE_OPTS);
    // ✅ FIXED: Clear refresh token with matching path '/api/v1/auth/'
    res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/api/v1/auth/' });

    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

const me = (req, res) => {
  return sendSuccess(res, {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  });
};

const recoverAdminPassword = async (req, res, next) => {
  try {
    const { email, recoveryKey, newPassword } = req.body;

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role: 'admin',
      isActive: true,
    }).select('+recoveryKeyHash');

    if (!user || !user.recoveryKeyHash) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isRecoveryKeyValid = await bcrypt.compare(recoveryKey.trim(), user.recoveryKeyHash);
    if (!isRecoveryKeyValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const newRecoveryKey = generateRecoveryKey();
    const [newPasswordHash, newRecoveryKeyHash] = await Promise.all([
      bcrypt.hash(newPassword, 12),
      bcrypt.hash(newRecoveryKey, 12),
    ]);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: newPasswordHash,
          recoveryKeyHash: newRecoveryKeyHash,
          passwordChangedAt: new Date(Date.now() - 1000),
        },
      }
    );

    logger.info({ adminId: user._id, event: 'admin_password_recovered' }, 'Admin password recovered');

    // Do NOT return recovery keys in API responses. The new key is stored hashed in DB.
    return res.status(200).json({
      success: true,
      message: 'Password reset successful. The new recovery key has been issued to the owner via secure channels.',
    });
  } catch (err) {
    next(err);
  }
};

const regenerateRecoveryKey = async (req, res, next) => {
  try {
    // req.user is set by auth middleware
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const newRecoveryKey = generateRecoveryKey();
    const newRecoveryKeyHash = await bcrypt.hash(newRecoveryKey, 12);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          recoveryKeyHash: newRecoveryKeyHash,
        },
      }
    );

    logger.info({ adminId: user._id, event: 'recovery_key_regenerated' }, 'Admin recovery key regenerated');

    // Audit log for recovery key regeneration
    await require('../services/auditService').createAuditLog({
      action: 'ADMIN_RECOVERY_KEY_REGENERATED',
      actor: user._id,
      actorEmail: user.email,
      actorRole: 'admin',
      targetId: user._id,
      targetModel: 'User',
      details: { email: user.email, action: 'recovery_key_regenerated' },
      requestId: req.id,
    });

    // Do NOT return recovery keys in API responses
    return res.status(200).json({
      success: true,
      message: 'Recovery key regenerated. Deliver the new key via a secure channel.',
    });
  } catch (err) {
    next(err);
  }
};

const adminChangePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // req.user is set by auth middleware
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const userDoc = await User.findById(user._id).select('+password');
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword.trim(), userDoc.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: newPasswordHash,
          passwordChangedAt: new Date(Date.now() - 1000),
        },
      }
    );

    logger.info({ adminId: user._id, event: 'admin_password_changed' }, 'Admin password changed');

    // Audit log for password change
    await require('../services/auditService').createAuditLog({
      action: 'ADMIN_PASSWORD_CHANGED',
      actor: user._id,
      actorEmail: user.email,
      actorRole: 'admin',
      targetId: user._id,
      targetModel: 'User',
      details: { email: user.email, action: 'password_change' },
      requestId: req.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, refresh, logout, me, recoverAdminPassword, regenerateRecoveryKey, adminChangePassword };