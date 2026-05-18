// Vercel serverless entry point
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const config = require('./src/config');
const requestLogger = require('./src/middleware/requestLogger');
const errorHandler = require('./src/middleware/errorHandler');
const { globalLimiter } = require('./src/middleware/rateLimiter');
const routes = require('./src/routes');

// Create Express app
const app = express();

// Database connection cache
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    console.log('=> Using cached database connection');
    return cachedDb;
  }

  console.log('=> Creating new database connection');
  
  try {
    const db = await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    
    cachedDb = db;
    console.log('=> Database connected successfully');
    return db;
  } catch (error) {
    console.error('=> Database connection error:', error.message);
    throw error;
  }
}

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// CORS - Allow your frontend
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

// Body Parsing
app.use(compression({
  filter: (req, res) => {
    const type = res.getHeader('Content-Type');
    if (typeof type === 'string' && type.toLowerCase().includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// NoSQL Injection Prevention
app.use(mongoSanitize({ replaceWith: '_' }));

// Request Logging + Rate Limiting
app.use(requestLogger);
app.use(globalLimiter);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use(`/api/${config.apiVersion}`, routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
  });
});

// Global Error Handler
app.use(errorHandler);

// Serverless Handler
module.exports = async (req, res) => {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Handle request with Express
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    });
  }
};

// Export app for testing
module.exports.app = app;
