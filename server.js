const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database
const sequelize = require('./config/database');

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourapp.com'] 
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Salon Booking API is running',
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

// Import routes (only if files exist)
let authRoutes, userRoutes, vendorRoutes, serviceRoutes, bookingRoutes, adminRoutes;

try {
  authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
} catch (error) {
  console.log('Auth routes not found, creating basic route...');
  app.use('/api/auth', (req, res) => {
    res.status(501).json({ message: 'Auth routes not implemented yet' });
  });
}

try {
  userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
} catch (error) {
  console.log('User routes not found, creating basic route...');
  app.use('/api/users', (req, res) => {
    res.status(501).json({ message: 'User routes not implemented yet' });
  });
}

try {
  vendorRoutes = require('./routes/vendors');
  app.use('/api/vendors', vendorRoutes);
} catch (error) {
  console.log('Vendor routes not found, creating basic route...');
  app.use('/api/vendors', (req, res) => {
    res.status(501).json({ message: 'Vendor routes not implemented yet' });
  });
}

try {
  serviceRoutes = require('./routes/services');
  app.use('/api/services', serviceRoutes);
} catch (error) {
  console.log('Service routes not found, creating basic route...');
  app.use('/api/services', (req, res) => {
    res.status(501).json({ message: 'Service routes not implemented yet' });
  });
}

try {
  bookingRoutes = require('./routes/bookings');
  app.use('/api/bookings', bookingRoutes);
} catch (error) {
  console.log('Booking routes not found, creating basic route...');
  app.use('/api/bookings', (req, res) => {
    res.status(501).json({ message: 'Booking routes not implemented yet' });
  });
}

try {
  adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
} catch (error) {
  console.log('Admin routes not found, creating basic route...');
  app.use('/api/admin', (req, res) => {
    res.status(501).json({ message: 'Admin routes not implemented yet' });
  });
}


// 404 handler - FIXED: Remove the '*' pattern
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  let error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Server Error'
  };

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    error.statusCode = 400;
    error.message = err.errors.map(error => error.message).join(', ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Token expired';
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📋 API Documentation: Save the HTML file and open in browser`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
  
  // Test database connection
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    console.error('Please check your database configuration in .env file');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;