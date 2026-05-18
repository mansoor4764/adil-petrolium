'use strict';
const User = require('../models/User');
const CustomerProfile = require('../models/CustomerProfile');
const { createAuditLog } = require('./auditService');
const AppError = require('../utils/AppError');
const config   = require('../config');
const cache = require('../utils/cache');

const createCustomer = async ({ name, email, password, customerCode, phone, address, creditLimit, notes, createdBy, requestId }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 409);

  // Use provided password OR default to phone number if not provided
  const finalPassword = password || phone;
  if (!finalPassword) throw new AppError('Either password or phone is required', 400);

  const user = await User.create({ 
    name, 
    email, 
    password: finalPassword, 
    phone,
    role: 'customer' 
  });

  const profile = await CustomerProfile.create({
    userId: user._id,
    customerCode: customerCode.toUpperCase(),
    phone, 
    address, 
    creditLimit: creditLimit || 0,
    notes, 
    createdBy,
  });

  await createAuditLog({
    action: 'CUSTOMER_CREATED', actor: createdBy,
    target: profile._id, targetModel: 'CustomerProfile',
    details: { customerCode: profile.customerCode, email },
    requestId,
  });

  // Invalidate customer list cache
  cache.clear();

  return { user, profile };
};

const getCustomers = async ({ page = 1, limit = 20, search, isActive, sort = '-createdAt', requestingUser = null }) => {
  // Create cache key based on query parameters
  const cacheKey = `customers:${requestingUser?._id || 'all'}:${page}:${limit}:${search || ''}:${isActive}:${sort}`;
  
  // Try to get from cache (30 second TTL for customer list)
  return cache.wrap(cacheKey, async () => {
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true' || isActive === true;

    // If an admin is requesting, restrict to customers created by that admin
    if (requestingUser && requestingUser.role === 'admin') {
      query.createdBy = requestingUser._id;
    }

    // Optimize search: if searching, do it more efficiently
    if (search) {
      // First, find matching users by name/email
      const users = await User.find({
        $or: [
          { name:  { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();
      
      const userIds = users.map(u => u._id);
      
      // Combine with customerCode search
      query.$or = [
        { userId: { $in: userIds } },
        { customerCode: { $regex: search, $options: 'i' } },
      ];
    }

    // Use lean() for better performance and select only needed fields initially
    const profileQuery = CustomerProfile.find(query)
      .populate({ path: 'userId', select: 'name email', options: { lean: true } })
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // Run queries in parallel for better performance
    const [customers, total] = await Promise.all([
      profileQuery,
      CustomerProfile.countDocuments(query),
    ]);

    return {
      customers,
      meta: { 
        total, 
        page: parseInt(page), 
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)) 
      },
    };
  }, 30000); // 30 second cache
};

const updateCustomer = async ({ profileId, updates, updatedBy, requestId }) => {
  const allowedFields = ['phone', 'address', 'vehicleInfo', 'creditLimit', 'notes', 'isActive'];
  const sanitized = {};
  allowedFields.forEach(f => { if (updates[f] !== undefined) sanitized[f] = updates[f]; });

  // Block deactivation when customer has an outstanding balance
  if (sanitized.isActive === false) {
    const current = await CustomerProfile.findById(profileId).select('currentBalance').lean();
    if (current && Number(current.currentBalance) > 0) {
      throw new AppError(
        `Cannot deactivate customer with an outstanding balance of PKR ${Number(current.currentBalance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}. Clear the balance first.`,
        400
      );
    }
  }

  const profile = await CustomerProfile.findByIdAndUpdate(
    profileId, sanitized, { new: true, runValidators: true }
  ).populate('userId', 'name email');

  if (!profile) throw new AppError('Customer not found', 404);

  await createAuditLog({
    action: 'CUSTOMER_UPDATED', actor: updatedBy,
    target: profileId, targetModel: 'CustomerProfile',
    details: sanitized, requestId,
  });

  // Invalidate customer list cache
  cache.clear();

  return profile;
};

module.exports = { createCustomer, getCustomers, updateCustomer };