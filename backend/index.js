// Vercel serverless entry point - Step by step loading
module.exports = async (req, res) => {
  try {
    // Step 1: Load dotenv
    require('dotenv').config();
    
    // Step 2: Load Express
    const express = require('express');
    const app = express();
    
    // Step 3: Basic middleware
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));
    
    // Step 4: Simple CORS middleware (without cors package)
    app.use((req, res, next) => {
      const allowedOrigins = [
        'https://adil-petrolium-4t91.vercel.app',
        'http://localhost:3000'
      ];
      
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Handle preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      next();
    });
    
    // Step 5: Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        ts: new Date().toISOString(),
        env: process.env.NODE_ENV,
      });
    });
    
    // Step 6: Try to load mongoose and connect
    const mongoose = require('mongoose');
    
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
    }
    
    // Step 7: Load other middleware
    const helmet = require('helmet');
    const mongoSanitize = require('express-mongo-sanitize');
    const cookieParser = require('cookie-parser');
    
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }));
    app.use(mongoSanitize({ replaceWith: '_' }));
    app.use(cookieParser());
    
    // Step 8: Load config and routes
    const config = require('./src/config');
    const requestLogger = require('./src/middleware/requestLogger');
    const { globalLimiter } = require('./src/middleware/rateLimiter');
    const routes = require('./src/routes');
    const errorHandler = require('./src/middleware/errorHandler');
    
    app.use(requestLogger);
    app.use(globalLimiter);
    
    // Step 9: API routes
    app.use(`/api/${config.apiVersion}`, routes);
    
    // Step 10: 404 and error handlers
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.url}`,
      });
    });
    
    app.use(errorHandler);
    
    // Handle the request
    return app(req, res);
    
  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
