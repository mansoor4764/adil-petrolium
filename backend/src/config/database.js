'use strict';
const mongoose = require('mongoose');
const config   = require('./index');
const logger   = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Connection pooling for better performance
      maxPoolSize: 10,
      minPoolSize: 2,
      // Faster connection establishment
      connectTimeoutMS: 10000,
      // Keep connections alive
      keepAlive: true,
      keepAliveInitialDelay: 300000,
    });
    logger.info({ uri: config.mongo.uri.replace(/:\/\/.*@/, '://***@') }, 'MongoDB connected');

    mongoose.connection.on('error', (err) =>
      logger.error({ err }, 'MongoDB connection error'));

    mongoose.connection.on('disconnected', () =>
      logger.warn('MongoDB disconnected'));
  } catch (err) {
    logger.fatal({ err }, 'MongoDB connection failed');
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB disconnected cleanly');
};

module.exports = { connectDB, disconnectDB };