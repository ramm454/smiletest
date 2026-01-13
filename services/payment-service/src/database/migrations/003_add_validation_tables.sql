-- Add validation tables
CREATE TABLE IF NOT EXISTS payment_validations (
    id VARCHAR(36) PRIMARY KEY,
    service_type VARCHAR(50) NOT NULL,
    service_id VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    gateway VARCHAR(50),
    valid BOOLEAN NOT NULL DEFAULT false,
    validation_errors JSONB,
    warnings JSONB,
    details JSONB,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP NULL,
    payment_id VARCHAR(36) NULL,
    -- Indexes
    INDEX idx_payment_validations_service (service_type, service_id),
    INDEX idx_payment_validations_customer (customer_email),
    INDEX idx_payment_validations_expires (expires_at),
    INDEX idx_payment_validations_created (created_at)
);

-- Add validation reference to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS validation_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP NULL;

-- Create index for validation ID
CREATE INDEX IF NOT EXISTS idx_payments_validation_id ON payments(validation_id);

-- Add validation metrics table
CREATE TABLE IF NOT EXISTS validation_metrics (
    id VARCHAR(36) PRIMARY KEY,
    service_type VARCHAR(50) NOT NULL,
    validation_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    common_errors JSONB,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_type, date)
);

-- Create validation webhook logs table
CREATE TABLE IF NOT EXISTS validation_webhook_logs (
    id VARCHAR(36) PRIMARY KEY,
    validation_id VARCHAR(36) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    payload JSONB,
    response_status INT,
    response_body TEXT,
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    INDEX idx_validation_webhook_logs_validation (validation_id),
    INDEX idx_validation_webhook_logs_created (created_at)
);