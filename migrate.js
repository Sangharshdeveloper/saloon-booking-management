// migrate.js - One-click automatic migration script
// Run with: node migrate.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================
// DATABASE CONFIGURATION
// ============================================
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'salon_booking_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456'
};

const pool = new Pool(dbConfig);

// ============================================
// HELPER FUNCTIONS
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}▶${colors.reset} ${msg}`)
};

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function checkDatabaseConnection() {
  log.step('Checking database connection...');
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    log.success('Database connected successfully!');
    client.release();
    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    client.release();
    return false;
  }
}

async function checkCurrentStructure() {
  log.step('Checking current database structure...');
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'vendors', 'admin_users')
    `);
    
    const tables = result.rows.map(r => r.table_name);
    
    log.info(`Found tables: ${tables.join(', ')}`);
    
    // Count records
    const counts = {};
    for (const table of tables) {
      const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = countResult.rows[0].count;
      log.info(`  - ${table}: ${counts[table]} records`);
    }
    
    client.release();
    return { tables, counts };
  } catch (error) {
    log.error(`Failed to check structure: ${error.message}`);
    client.release();
    throw error;
  }
}

async function createBackup() {
  log.step('Creating backup tables...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create backup tables
    await client.query('CREATE TABLE IF NOT EXISTS users_backup AS TABLE users');
    await client.query('CREATE TABLE IF NOT EXISTS vendors_backup AS TABLE vendors');
    await client.query('CREATE TABLE IF NOT EXISTS admin_users_backup AS TABLE admin_users');
    
    await client.query('COMMIT');
    log.success('Backup tables created successfully!');
    client.release();
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    log.error(`Backup failed: ${error.message}`);
    client.release();
    return false;
  }
}

async function runMigrationScript() {
  log.step('Running migration script...');
  const client = await pool.connect();
  
  try {
    // Read migration script
    const scriptPath = path.join(__dirname, 'migration.sql');
    
    if (!fs.existsSync(scriptPath)) {
      log.error('Migration script not found at: ' + scriptPath);
      log.warning('Please ensure migration_script.sql is in the same directory');
      
      // Offer to use the smart migration script
      log.info('');
      log.info('TIP: Use the "smart_migration.sql" script instead');
      log.info('It handles existing tables and indexes automatically');
      
      return false;
    }
    
    const migrationSQL = fs.readFileSync(scriptPath, 'utf8');
    
    log.info('Executing migration (this may take 1-2 minutes)...');
    
    // Execute migration with better error handling
    try {
      await client.query(migrationSQL);
      log.success('Migration executed successfully!');
      client.release();
      return true;
    } catch (execError) {
      // Check if error is about already existing items
      if (execError.message.includes('already exists') || 
          execError.message.includes('already completed')) {
        log.warning('Migration appears to be already completed!');
        log.info('Checking current structure...');
        
        // Verify structure
        const checkResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name IN ('user_type', 'role')
        `);
        
        if (checkResult.rows.length >= 2) {
          log.success('Verified: New structure already exists');
          log.info('No migration needed!');
          client.release();
          return true;
        }
      }
      
      throw execError;
    }
    
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    
    // Provide helpful error messages
    if (error.message.includes('already exists')) {
      log.info('');
      log.warning('Some database objects already exist.');
      log.info('This usually means:');
      log.info('  1. Migration was partially completed');
      log.info('  2. Or migration was already done');
      log.info('');
      log.info('Solutions:');
      log.info('  1. Use smart_migration.sql (handles existing objects)');
      log.info('  2. Or manually check if migration completed');
      log.info('  3. Or contact database administrator');
    } else if (error.message.includes('permission denied')) {
      log.info('');
      log.error('Permission error - you need database admin rights');
      log.info('Try running as postgres superuser');
    } else {
      log.info('Full error:', error);
    }
    
    client.release();
    return false;
  }
}

async function verifyMigration() {
  log.step('Verifying migration...');
  const client = await pool.connect();
  
  try {
    // Check users table
    const usersResult = await client.query(`
      SELECT user_type, COUNT(*) as count 
      FROM users 
      GROUP BY user_type
    `);
    
    log.success('Users table structure:');
    console.table(usersResult.rows);
    
    // Check vendor_shops table
    const shopsResult = await client.query(`
      SELECT COUNT(*) as total_shops FROM vendor_shops
    `);
    
    log.success(`Total vendor shops: ${shopsResult.rows[0].total_shops}`);
    
    // Check relationships
    const relationshipResult = await client.query(`
      SELECT 
        u.user_id,
        u.name,
        u.user_type,
        vs.shop_name,
        vs.verification_status
      FROM users u
      LEFT JOIN vendor_shops vs ON u.user_id = vs.user_id
      WHERE u.user_type = 'vendor'
      LIMIT 3
    `);
    
    log.success('Sample vendor relationships:');
    console.table(relationshipResult.rows);
    
    // Check for orphaned records
    const orphanedResult = await client.query(`
      SELECT COUNT(*) as orphaned
      FROM bookings 
      WHERE vendor_id NOT IN (SELECT user_id FROM users WHERE user_type = 'vendor')
    `);
    
    if (orphanedResult.rows[0].orphaned > 0) {
      log.warning(`Found ${orphanedResult.rows[0].orphaned} orphaned booking records`);
    } else {
      log.success('No orphaned records found!');
    }
    
    client.release();
    return true;
  } catch (error) {
    log.error(`Verification failed: ${error.message}`);
    client.release();
    return false;
  }
}

async function rollback() {
  log.step('Rolling back migration...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Drop new tables
    await client.query('DROP TABLE IF EXISTS public.users CASCADE');
    await client.query('DROP TABLE IF EXISTS public.vendor_shops CASCADE');
    
    // Restore from backup
    await client.query('ALTER TABLE users_backup RENAME TO users');
    await client.query('ALTER TABLE vendors_backup RENAME TO vendors');
    await client.query('ALTER TABLE admin_users_backup RENAME TO admin_users');
    
    await client.query('COMMIT');
    log.success('Rollback completed successfully!');
    client.release();
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    log.error(`Rollback failed: ${error.message}`);
    client.release();
    return false;
  }
}

// ============================================
// MAIN MIGRATION PROCESS
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  DATABASE MIGRATION - UNIFIED USERS TABLE');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Step 1: Check connection
    const connected = await checkDatabaseConnection();
    if (!connected) {
      log.error('Cannot proceed without database connection');
      process.exit(1);
    }
    
    console.log('');
    
    // Step 2: Check current structure
    const { tables, counts } = await checkCurrentStructure();
    
    console.log('');
    
    // Step 3: Confirm migration
    log.warning('This will modify your database structure!');
    log.info('Current data will be migrated to new structure');
    log.info('Backup tables will be created automatically');
    
    const answer = await question('\nDo you want to proceed? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      log.info('Migration cancelled by user');
      rl.close();
      await pool.end();
      process.exit(0);
    }
    
    console.log('');
    
    // Step 4: Create backup
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
      log.error('Failed to create backup. Aborting migration.');
      rl.close();
      await pool.end();
      process.exit(1);
    }
    
    console.log('');
    
    // Step 5: Run migration
    const migrationSuccess = await runMigrationScript();
    if (!migrationSuccess) {
      log.error('Migration failed!');
      const rollbackAnswer = await question('\nDo you want to rollback? (yes/no): ');
      
      if (rollbackAnswer.toLowerCase() === 'yes') {
        await rollback();
      }
      
      rl.close();
      await pool.end();
      process.exit(1);
    }
    
    console.log('');
    
    // Step 6: Verify migration
    const verifySuccess = await verifyMigration();
    
    console.log('\n' + '='.repeat(60));
    if (verifySuccess) {
      log.success('MIGRATION COMPLETED SUCCESSFULLY! 🎉');
      log.info('Your database is now using unified users table');
      log.info('Backup tables are available for 30 days');
    } else {
      log.warning('Migration completed but verification had issues');
      log.info('Please check the database manually');
    }
    console.log('='.repeat(60) + '\n');
    
    // Cleanup
    rl.close();
    await pool.end();
    
  } catch (error) {
    log.error('Unexpected error during migration:');
    console.error(error);
    rl.close();
    await pool.end();
    process.exit(1);
  }
}

// ============================================
// EXECUTE
// ============================================

// Handle CTRL+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\nMigration interrupted by user');
  rl.close();
  await pool.end();
  process.exit(0);
});

// Run migration
main();