'use strict';
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const config   = require('../config');
const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    // Try to get token from cookie first, then from Authorization header (for mobile fallback)
    let token = req.cookies?.accessToken;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) throw new AppError('Authentication required', 401);

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }

    // ✅ decoded.userId — must match what authService.js signs
    const user = await User.findById(decoded.userId).select('+isLocked +lockUntil');
    if (!user)          throw new AppError('User no longer exists', 401);
    if (!user.isActive) throw new AppError('Account has been deactivated', 401);
    if (user.isLocked && user.lockUntil > Date.now())
      throw new AppError('Account temporarily locked due to failed login attempts', 423);

    req.user = user;
    req.id   = req.headers['x-request-id'] || decoded.jti;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    logger.warn({
      userId:   req.user._id,
      role:     req.user.role,
      required: roles,
      url:      req.url,
    }, 'Authorization denied');
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

const enforceCustomerOwnership = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();

    const CustomerProfile = require('../models/CustomerProfile');
    const profile = await CustomerProfile.findOne({ userId: req.user._id });
    if (!profile) return next(new AppError('Customer profile not found', 404));

    // ✅ Inject verified customerId — cannot be spoofed via query param
    req.customerId = profile._id.toString();
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, authorize, enforceCustomerOwnership };