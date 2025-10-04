// server.js
const app = require('./src/app');
const config = require('./src/config/env');
const { sequelize } = require('./src/models');

const PORT = config.PORT;

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');

    // Sync models (use { force: false } in production)
    if (config.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✓ Database models synchronized');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT} in ${config.NODE_ENV} mode`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('✗ Unable to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();