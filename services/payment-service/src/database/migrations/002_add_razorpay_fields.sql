-- Add RazorPay specific columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank VARCHAR(100),
ADD COLUMN IF NOT EXISTS wallet VARCHAR(100),
ADD COLUMN IF NOT EXISTS vpa VARCHAR(100),
ADD COLUMN IF NOT EXISTS card_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS card_network VARCHAR(50),
ADD COLUMN IF NOT EXISTS card_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS international BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact VARCHAR(20),
ADD COLUMN IF NOT EXISTS fee BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS error_description TEXT,
ADD COLUMN IF NOT EXISTS error_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS error_step VARCHAR(50),
ADD COLUMN IF NOT EXISTS error_reason VARCHAR(100);

-- Create index for RazorPay order ID
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments(gateway_order_id);

-- Create index for RazorPay customer ID
CREATE INDEX IF NOT EXISTS idx_payments_gateway_customer_id ON payments(gateway_customer_id);

-- Add refund-specific columns
ALTER TABLE refunds 
ADD COLUMN IF NOT EXISTS gateway_refund_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS speed_processed VARCHAR(50),
ADD COLUMN IF NOT EXISTS speed_requested VARCHAR(50);

-- Create RazorPay orders table (optional, for better tracking)
CREATE TABLE IF NOT EXISTS razorpay_orders (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    receipt VARCHAR(255),
    status VARCHAR(20) DEFAULT 'created',
    attempts INT DEFAULT 0,
    notes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for order lookup
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_order_id ON razorpay_orders(order_id);