-- ============================================
-- CLEAN MIGRATION SCRIPT
-- Unified Users Table Migration
-- Safe to run - handles existing objects
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Create backup tables
-- ============================================
CREATE TABLE IF NOT EXISTS users_backup AS TABLE users;
CREATE TABLE IF NOT EXISTS vendors_backup AS TABLE vendors;
CREATE TABLE IF NOT EXISTS admin_users_backup AS TABLE admin_users;

-- ============================================
-- STEP 2: Drop old constraints
-- ============================================
ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey CASCADE;
ALTER TABLE IF EXISTS vendor_services DROP CONSTRAINT IF EXISTS vendor_services_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS vendor_images DROP CONSTRAINT IF EXISTS vendor_images_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS vendor_holidays DROP CONSTRAINT IF EXISTS vendor_holidays_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS vendor_early_closures DROP CONSTRAINT IF EXISTS vendor_early_closures_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS verification_documents DROP CONSTRAINT IF EXISTS verification_documents_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS reviews DROP CONSTRAINT IF EXISTS reviews_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey CASCADE;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_vendor_id_fkey CASCADE;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey CASCADE;

-- ============================================
-- STEP 3: Drop old indexes
-- ============================================
DROP INDEX IF EXISTS idx_users_phone CASCADE;
DROP INDEX IF EXISTS idx_users_email CASCADE;
DROP INDEX IF EXISTS idx_users_user_type CASCADE;
DROP INDEX IF EXISTS idx_users_status CASCADE;
DROP INDEX IF EXISTS idx_users_created_at CASCADE;
DROP INDEX IF EXISTS idx_bookings_user CASCADE;
DROP INDEX IF EXISTS idx_bookings_vendor CASCADE;
DROP INDEX IF EXISTS idx_reviews_vendor CASCADE;
DROP INDEX IF EXISTS idx_vendor_services_vendor CASCADE;

-- ============================================
-- STEP 4: Rename old users table
-- ============================================
ALTER TABLE IF EXISTS users RENAME TO users_old;

-- ============================================
-- STEP 5: Create new users table
-- ============================================
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'customer',
    role VARCHAR(20) DEFAULT 'user',
    city VARCHAR(50),
    state VARCHAR(50),
    gender VARCHAR(10),
    profile_picture TEXT,
    status VARCHAR(20) DEFAULT 'active',
    is_verified BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    device_id VARCHAR(255),
    fcm_token TEXT,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT check_user_type CHECK (user_type IN ('customer', 'vendor', 'admin')),
    CONSTRAINT check_role CHECK (role IN ('user', 'admin', 'super_admin', 'manager')),
    CONSTRAINT check_status CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
);

-- ============================================
-- STEP 6: Create vendor_shops table
-- ============================================
DROP TABLE IF EXISTS vendor_shops CASCADE;

CREATE TABLE vendor_shops (
    shop_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    shop_name VARCHAR(100) NOT NULL,
    shop_address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    break_start_time TIME,
    break_end_time TIME,
    weekly_holiday VARCHAR(10),
    no_of_seats INTEGER NOT NULL DEFAULT 1,
    no_of_workers INTEGER NOT NULL DEFAULT 1,
    verification_status VARCHAR(20) DEFAULT 'pending',
    admin_comments TEXT,
    verified_at TIMESTAMP,
    verified_by INTEGER,
    business_license VARCHAR(100),
    tax_number VARCHAR(50),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    average_rating NUMERIC(3, 2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    total_revenue NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT check_verification_status CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT check_shop_status CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
);

-- ============================================
-- STEP 7: Migrate customers
-- ============================================
INSERT INTO users (
    name, phone_number, email, password_hash, city, state, gender,
    user_type, role, status, is_verified, created_at, updated_at, deleted_at
)
SELECT 
    name, phone_number, email, password_hash, city, state, gender,
    'customer', 'user', status, is_verified, created_at, updated_at, deleted_at
FROM users_old
ON CONFLICT (phone_number) DO NOTHING;

-- ============================================
-- STEP 8: Migrate vendors
-- ============================================
INSERT INTO users (
    name, phone_number, email, password_hash, city, state,
    user_type, role, status, is_verified, created_at, updated_at, deleted_at
)
SELECT 
    owner_name, phone_number, email, password_hash, city, state,
    'vendor', 'user', status, is_verified, created_at, updated_at, deleted_at
FROM vendors
ON CONFLICT (phone_number) DO NOTHING;

-- ============================================
-- STEP 9: Migrate admins
-- ============================================
INSERT INTO users (
    name, phone_number, email, password_hash,
    user_type, role, status, created_at, updated_at, deleted_at
)
SELECT 
    full_name, 
    COALESCE(username, 'admin_' || admin_id),
    email, 
    password_hash,
    'admin', 
    COALESCE(role, 'admin'), 
    status, 
    created_at, 
    updated_at, 
    deleted_at
FROM admin_users
ON CONFLICT (phone_number) DO NOTHING;

-- ============================================
-- STEP 10: Migrate vendor shops
-- ============================================
INSERT INTO vendor_shops (
    user_id, shop_name, shop_address, city, state,
    latitude, longitude, open_time, close_time,
    break_start_time, break_end_time, weekly_holiday,
    no_of_seats, no_of_workers, verification_status,
    admin_comments, status, created_at, updated_at, deleted_at
)
SELECT 
    u.user_id, v.shop_name, v.shop_address, v.city, v.state,
    v.latitude, v.longitude, v.open_time, v.close_time,
    v.break_start_time, v.break_end_time, v.weekly_holiday,
    v.no_of_seats, v.no_of_workers, v.verification_status,
    v.admin_comments, v.status, v.created_at, v.updated_at, v.deleted_at
FROM vendors v
INNER JOIN users u ON v.phone_number = u.phone_number
WHERE u.user_type = 'vendor'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 11: Update foreign keys
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_vendor_id INTEGER;

UPDATE users u
SET temp_vendor_id = v.vendor_id
FROM vendors v
WHERE u.phone_number = v.phone_number AND u.user_type = 'vendor';

UPDATE bookings b
SET vendor_id = u.user_id
FROM users u
WHERE b.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE vendor_services vs
SET vendor_id = u.user_id
FROM users u
WHERE vs.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE vendor_images vi
SET vendor_id = u.user_id
FROM users u
WHERE vi.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE vendor_holidays vh
SET vendor_id = u.user_id
FROM users u
WHERE vh.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE vendor_early_closures vec
SET vendor_id = u.user_id
FROM users u
WHERE vec.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE verification_documents vd
SET vendor_id = u.user_id
FROM users u
WHERE vd.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE reviews r
SET vendor_id = u.user_id
FROM users u
WHERE r.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

UPDATE notifications n
SET vendor_id = u.user_id
FROM users u
WHERE n.vendor_id = u.temp_vendor_id AND u.user_type = 'vendor';

ALTER TABLE users DROP COLUMN IF EXISTS temp_vendor_id;

-- ============================================
-- STEP 12: Create indexes
-- ============================================
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_vendor_shops_user_id ON vendor_shops(user_id);
CREATE INDEX idx_vendor_shops_city ON vendor_shops(city);
CREATE INDEX idx_vendor_shops_verification_status ON vendor_shops(verification_status);
CREATE INDEX idx_vendor_shops_status ON vendor_shops(status);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_vendor ON bookings(vendor_id);
CREATE INDEX idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX idx_vendor_services_vendor ON vendor_services(vendor_id);

-- ============================================
-- STEP 13: Add foreign key constraints
-- ============================================
ALTER TABLE vendor_shops
    ADD CONSTRAINT vendor_shops_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE bookings
    ADD CONSTRAINT bookings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE bookings
    ADD CONSTRAINT bookings_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE vendor_services
    ADD CONSTRAINT vendor_services_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE vendor_images
    ADD CONSTRAINT vendor_images_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE vendor_holidays
    ADD CONSTRAINT vendor_holidays_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE vendor_early_closures
    ADD CONSTRAINT vendor_early_closures_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE verification_documents
    ADD CONSTRAINT verification_documents_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE reviews
    ADD CONSTRAINT reviews_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE reviews
    ADD CONSTRAINT reviews_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE booking_services
    ADD CONSTRAINT booking_services_booking_id_fkey 
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE;

ALTER TABLE booking_services
    ADD CONSTRAINT booking_services_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES services_master(service_id) ON DELETE NO ACTION;

-- ============================================
-- STEP 14: Create triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_shops_updated_at ON vendor_shops;
CREATE TRIGGER update_vendor_shops_updated_at
    BEFORE UPDATE ON vendor_shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 15: Insert default admin
-- ============================================
INSERT INTO users (
    name, phone_number, email, password_hash, 
    user_type, role, status, is_verified
)
VALUES (
    'Super Admin',
    'admin',
    'admin@salonbooking.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gyXWuVWJzREm',
    'admin',
    'super_admin',
    'active',
    true
)
ON CONFLICT (phone_number) DO NOTHING;

COMMIT;

-- ============================================
-- Verification queries (run separately)
-- ============================================
-- SELECT user_type, COUNT(*) FROM users GROUP BY user_type;
-- SELECT COUNT(*) FROM vendor_shops;
-- SELECT u.user_id, u.name, u.user_type, vs.shop_name, vs.verification_status
-- FROM users u
-- LEFT JOIN vendor_shops vs ON u.user_id = vs.user_id
-- WHERE u.user_type = 'vendor'
-- LIMIT 5;