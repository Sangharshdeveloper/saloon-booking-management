// seed-data.js - Run this file to populate your database with dummy data
// Usage: node seed-data.js

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'salon_booking_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

const seedData = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database seeding...\n');
    
    await client.query('BEGIN');
    
    // Hash password once for all users
    const hashedPassword = await bcrypt.hash('password123', 10);
    console.log('✓ Password hashed');

    // 1. INSERT ADMIN USERS
    console.log('\n📝 Inserting admin users...');
    await client.query(`
      INSERT INTO users (name, phone_number, email, password_hash, user_type, city, state, gender, status, phone_verified, created_at, updated_at) 
      VALUES 
      ('Admin User', '+919999999999', 'admin@salon.com', $1, 'admin', 'Mumbai', 'Maharashtra', 'male', 'active', true, NOW(), NOW())
      ON CONFLICT (phone_number) DO NOTHING
    `, [hashedPassword]);
    console.log('✓ Admin users created');

    // 2. INSERT CUSTOMERS
    console.log('\n📝 Inserting customer users...');
    const customerNames = [
      ['Rahul Sharma', '+919876543210', 'rahul.sharma@example.com', 'Mumbai', 'Maharashtra', 'male'],
      ['Priya Patel', '+919876543211', 'priya.patel@example.com', 'Delhi', 'Delhi', 'female'],
      ['Amit Kumar', '+919876543212', 'amit.kumar@example.com', 'Bangalore', 'Karnataka', 'male'],
      ['Sneha Gupta', '+919876543213', 'sneha.gupta@example.com', 'Pune', 'Maharashtra', 'female'],
      ['Vikram Singh', '+919876543214', 'vikram.singh@example.com', 'Mumbai', 'Maharashtra', 'male'],
      ['Anjali Desai', '+919876543215', 'anjali.desai@example.com', 'Mumbai', 'Maharashtra', 'female'],
      ['Rajesh Verma', '+919876543216', 'rajesh.verma@example.com', 'Delhi', 'Delhi', 'male'],
      ['Neha Kapoor', '+919876543217', 'neha.kapoor@example.com', 'Bangalore', 'Karnataka', 'female'],
      ['Sanjay Mehta', '+919876543218', 'sanjay.mehta@example.com', 'Pune', 'Maharashtra', 'male'],
      ['Pooja Reddy', '+919876543219', 'pooja.reddy@example.com', 'Hyderabad', 'Telangana', 'female']
    ];

    for (const [name, phone, email, city, state, gender] of customerNames) {
      await client.query(`
        INSERT INTO users (name, phone_number, email, password_hash, user_type, city, state, gender, status, phone_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, 'active', true, NOW(), NOW())
        ON CONFLICT (phone_number) DO NOTHING
      `, [name, phone, email, hashedPassword, city, state, gender]);
    }
    console.log('✓ Customer users created');

    // 3. INSERT VENDORS
    console.log('\n📝 Inserting vendor users...');
    const vendorData = [
      ['Elite Salon Owner', '+919888888801', 'elite.salon@example.com', 'Mumbai', 'Maharashtra', 'male'],
      ['Beauty Paradise Owner', '+919888888802', 'beauty.paradise@example.com', 'Delhi', 'Delhi', 'female'],
      ['Glamour Studio Owner', '+919888888803', 'glamour.studio@example.com', 'Bangalore', 'Karnataka', 'female'],
      ['Style Hub Owner', '+919888888804', 'style.hub@example.com', 'Pune', 'Maharashtra', 'male'],
      ['Chic Salon Owner', '+919888888805', 'chic.salon@example.com', 'Mumbai', 'Maharashtra', 'female'],
      ['Pending Vendor', '+919888888806', 'pending@example.com', 'Delhi', 'Delhi', 'male']
    ];

    for (const [name, phone, email, city, state, gender] of vendorData) {
      await client.query(`
        INSERT INTO users (name, phone_number, email, password_hash, user_type, city, state, gender, status, phone_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'vendor', $5, $6, $7, 'active', true, NOW() - INTERVAL '30 days', NOW())
        ON CONFLICT (phone_number) DO NOTHING
      `, [name, phone, email, hashedPassword, city, state, gender]);
    }
    console.log('✓ Vendor users created');

    // 4. INSERT SERVICES MASTER
    console.log('\n📝 Inserting master services...');
    const services = [
      ['Basic Haircut', 'Standard haircut for men and women', 30, 'normal'],
      ['Premium Haircut', 'Premium haircut with styling', 45, 'normal'],
      ['Hair Coloring', 'Full hair coloring service', 90, 'normal'],
      ['Beard Trim', 'Professional beard trimming', 20, 'normal'],
      ['Facial', 'Relaxing facial treatment', 45, 'normal'],
      ['Hair Spa', 'Deep conditioning hair spa', 60, 'normal'],
      ['Manicure', 'Basic manicure service', 30, 'normal'],
      ['Pedicure', 'Basic pedicure service', 45, 'normal']
    ];

    for (const [name, desc, duration, type] of services) {
      await client.query(`
        INSERT INTO services_master (service_name, service_description, default_duration_minutes, service_type, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
        ON CONFLICT (service_name) DO NOTHING
      `, [name, desc, duration, type]);
    }
    console.log('✓ Master services created');

    // 5. INSERT VENDOR SHOPS
    console.log('\n📝 Inserting vendor shops...');
    const vendorShops = [
      { phone: '+919888888801', name: 'Elite Salon & Spa', address: 'Shop 101, Linking Road, Bandra', city: 'Mumbai', state: 'Maharashtra', status: 'approved' },
      { phone: '+919888888802', name: 'Beauty Paradise', address: 'CP Block, Connaught Place', city: 'Delhi', state: 'Delhi', status: 'approved' },
      { phone: '+919888888803', name: 'Glamour Studio', address: 'Indiranagar Main Road', city: 'Bangalore', state: 'Karnataka', status: 'approved' },
      { phone: '+919888888804', name: 'Style Hub', address: 'FC Road, Near University', city: 'Pune', state: 'Maharashtra', status: 'approved' },
      { phone: '+919888888805', name: 'Chic Salon', address: 'Andheri West, Near Station', city: 'Mumbai', state: 'Maharashtra', status: 'approved' },
      { phone: '+919888888806', name: 'Pending Salon', address: 'Rohini Sector 10', city: 'Delhi', state: 'Delhi', status: 'pending' }
    ];

    for (const shop of vendorShops) {
      const userResult = await client.query('SELECT user_id FROM users WHERE phone_number = $1', [shop.phone]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].user_id;
        await client.query(`
          INSERT INTO vendor_shops (
            user_id, shop_name, shop_address, city, state,
            latitude, longitude, open_time, close_time, weekly_holiday,
            no_of_seats, no_of_workers, business_license, tax_number,
            bank_account_number, bank_ifsc_code, verification_status,
            average_rating, total_reviews, total_bookings, total_revenue,
            status, verified_at, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 19.0760, 72.8777, '09:00:00', '21:00:00', 'monday',
            5, 3, 'BL123456', 'GST123456789', '1234567890', 'HDFC0001234',
            $6, 4.5, 10, 20, 50000, 'active',
            ${shop.status === 'approved' ? 'NOW()' : 'NULL'},
            NOW() - INTERVAL '30 days', NOW()
          ) ON CONFLICT (user_id) DO NOTHING
        `, [userId, shop.name, shop.address, shop.city, shop.state, shop.status]);
      }
    }
    console.log('✓ Vendor shops created');

    // 6. INSERT VENDOR SERVICES
    console.log('\n📝 Inserting vendor services...');
    const approvedVendors = await client.query(`
      SELECT vs.user_id 
      FROM vendor_shops vs 
      WHERE vs.verification_status = 'approved' AND vs.status = 'active'
    `);

    const allServices = await client.query(`
      SELECT service_id FROM services_master WHERE status = 'active'
    `);

    for (const vendor of approvedVendors.rows) {
      // Add 5 services per vendor
      for (let i = 0; i < Math.min(5, allServices.rows.length); i++) {
        const service = allServices.rows[i];
        const price = 300 + (i * 100);
        await client.query(`
          INSERT INTO vendor_services (vendor_id, service_id, price, is_available, status, created_at, updated_at)
          VALUES ($1, $2, $3, true, 'active', NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [vendor.user_id, service.service_id, price]);
      }
    }
    console.log('✓ Vendor services created');

    // 7. INSERT BOOKINGS
    console.log('\n📝 Inserting bookings...');
    const customers = await client.query(`
      SELECT user_id FROM users WHERE user_type = 'customer' AND status = 'active' LIMIT 5
    `);

    const vendors = await client.query(`
      SELECT user_id FROM vendor_shops WHERE verification_status = 'approved' AND status = 'active' LIMIT 3
    `);

    const statuses = ['pending', 'confirmed', 'completed', 'completed', 'completed'];
    const paymentStatuses = ['pending', 'completed', 'completed', 'completed', 'completed'];

    for (let i = 0; i < 20; i++) {
      const customer = customers.rows[i % customers.rows.length];
      const vendor = vendors.rows[i % vendors.rows.length];
      const status = statuses[i % statuses.length];
      const paymentStatus = paymentStatuses[i % paymentStatuses.length];
      
      await client.query(`
        INSERT INTO bookings (
          user_id, vendor_id, booking_date, total_amount,
          payment_method, payment_status, booking_status,
          status, created_at, updated_at
        ) VALUES (
          $1, $2, CURRENT_DATE - ($3 % 15), $4,
          'upi', $5, $6, 'active',
          NOW() - INTERVAL '${i} days', NOW()
        )
      `, [customer.user_id, vendor.user_id, i, 500 + (i * 100), paymentStatus, status]);
    }
    console.log('✓ Bookings created');

    // 8. INSERT REVIEWS
    console.log('\n📝 Inserting reviews...');
    const completedBookings = await client.query(`
      SELECT booking_id, user_id, vendor_id 
      FROM bookings 
      WHERE booking_status = 'completed' AND status = 'active'
      LIMIT 10
    `);

    const reviewTexts = [
      'Excellent service! Very professional staff.',
      'Great experience, will definitely come back.',
      'Amazing salon! Loved the ambience.',
      'Professional and courteous staff.',
      'Highly recommended!'
    ];

    for (const booking of completedBookings.rows) {
      const rating = 3 + Math.floor(Math.random() * 3);
      const reviewText = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
      
      await client.query(`
        INSERT INTO reviews (booking_id, user_id, vendor_id, rating, review_text, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
      `, [booking.booking_id, booking.user_id, booking.vendor_id, rating, reviewText]);
    }
    console.log('✓ Reviews created');

    // 9. UPDATE VENDOR STATISTICS
    console.log('\n📝 Updating vendor statistics...');
    await client.query(`
      UPDATE vendor_shops vs
      SET 
        total_bookings = (
          SELECT COUNT(*) 
          FROM bookings b 
          WHERE b.vendor_id = vs.user_id AND b.status = 'active'
        ),
        total_revenue = (
          SELECT COALESCE(SUM(total_amount), 0) 
          FROM bookings b 
          WHERE b.vendor_id = vs.user_id 
            AND b.booking_status = 'completed' 
            AND b.status = 'active'
        ),
        total_reviews = (
          SELECT COUNT(*) 
          FROM reviews r 
          WHERE r.vendor_id = vs.user_id AND r.status = 'active'
        ),
        average_rating = (
          SELECT COALESCE(AVG(rating), 0) 
          FROM reviews r 
          WHERE r.vendor_id = vs.user_id AND r.status = 'active'
        )
      WHERE vs.verification_status = 'approved'
    `);
    console.log('✓ Statistics updated');

    await client.query('COMMIT');

    // Display summary
    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE user_type = 'admin') as admins,
        (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as customers,
        (SELECT COUNT(*) FROM users WHERE user_type = 'vendor') as vendors,
        (SELECT COUNT(*) FROM vendor_shops) as shops,
        (SELECT COUNT(*) FROM services_master) as services,
        (SELECT COUNT(*) FROM bookings) as bookings,
        (SELECT COUNT(*) FROM reviews) as reviews
    `);
    
    const stats = summary.rows[0];
    console.log(`   • Admins: ${stats.admins}`);
    console.log(`   • Customers: ${stats.customers}`);
    console.log(`   • Vendors: ${stats.vendors}`);
    console.log(`   • Shops: ${stats.shops}`);
    console.log(`   • Services: ${stats.services}`);
    console.log(`   • Bookings: ${stats.bookings}`);
    console.log(`   • Reviews: ${stats.reviews}`);
    
    console.log('\n🔑 Login Credentials:');
    console.log('   Email: admin@salon.com');
    console.log('   Password: password123');
    console.log('\n   All users have password: password123\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run the seeding
seedData()
  .then(() => {
    console.log('✨ Seeding process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });