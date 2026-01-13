-- GDPR Compliance Tables

-- Data Subject Requests
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id VARCHAR(36) PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL,
    data_subject_id VARCHAR(255),
    user_email VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    requested_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    verified_at TIMESTAMP NULL,
    verification_method VARCHAR(100),
    response_data BYTEA,
    notes TEXT,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dsr_user (user_id, user_email),
    INDEX idx_dsr_status (status),
    INDEX idx_dsr_type (request_type),
    INDEX idx_dsr_requested (requested_at)
);

-- Records of Processing Activities (ROPA)
CREATE TABLE IF NOT EXISTS ropa (
    id VARCHAR(36) PRIMARY KEY,
    process_name VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    lawful_basis VARCHAR(50) NOT NULL,
    data_categories JSONB,
    data_subject_categories JSONB,
    recipients JSONB,
    third_country_transfers JSONB,
    retention_period VARCHAR(100),
    security_measures JSONB,
    dipa_required BOOLEAN DEFAULT false,
    dipa_reference VARCHAR(255),
    controller VARCHAR(255),
    processor VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_review_date TIMESTAMP NULL,
    next_review_date TIMESTAMP NOT NULL,
    INDEX idx_ropa_process (process_name),
    INDEX idx_ropa_review (next_review_date)
);

-- Data Processing Agreements
CREATE TABLE IF NOT EXISTS data_processing_agreements (
    id VARCHAR(36) PRIMARY KEY,
    processor_name VARCHAR(255) NOT NULL,
    processor_email VARCHAR(255),
    service_provided TEXT,
    data_categories JSONB,
    purpose TEXT,
    subprocessors JSONB,
    sccs_in_place BOOLEAN DEFAULT false,
    signed_date TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    document_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dpa_processor (processor_name),
    INDEX idx_dpa_status (status),
    INDEX idx_dpa_validity (valid_until)
);

-- Consent Records
CREATE TABLE IF NOT EXISTS consents (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    consent_type VARCHAR(50) NOT NULL,
    consent_version VARCHAR(20) NOT NULL,
    purpose TEXT,
    lawful_basis VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    granted_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    consent_medium VARCHAR(50),
    proof_of_consent TEXT,
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_consents_user (user_id, user_email),
    INDEX idx_consents_type (consent_type),
    INDEX idx_consents_status (status),
    INDEX idx_consents_granted (granted_at)
);

-- Consent Templates
CREATE TABLE IF NOT EXISTS consent_templates (
    id VARCHAR(36) PRIMARY KEY,
    consent_type VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    required BOOLEAN DEFAULT false,
    default_status VARCHAR(20),
    lawful_basis VARCHAR(50),
    retention_period VARCHAR(100),
    third_parties JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,
    UNIQUE (consent_type, version)
);

-- Pseudonymized Data Mappings
CREATE TABLE IF NOT EXISTS pseudonymized_data (
    id VARCHAR(36) PRIMARY KEY,
    original_value TEXT,
    pseudonym VARCHAR(255) NOT NULL UNIQUE,
    hash VARCHAR(64) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    purpose VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    reidentification_key TEXT,
    INDEX idx_pseudonyms_pseudonym (pseudonym),
    INDEX idx_pseudonyms_hash (hash),
    INDEX idx_pseudonyms_expiry (expires_at)
);

-- Data Retention Policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id VARCHAR(36) PRIMARY KEY,
    data_type VARCHAR(100) NOT NULL,
    data_category VARCHAR(100),
    purpose TEXT,
    retention_period VARCHAR(100) NOT NULL,
    legal_basis VARCHAR(100),
    auto_delete BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_retention_data_type (data_type),
    INDEX idx_retention_category (data_category)
);

-- Data Breach Records
CREATE TABLE IF NOT EXISTS data_breaches (
    id VARCHAR(36) PRIMARY KEY,
    breach_type VARCHAR(50) NOT NULL,
    detection_date TIMESTAMP NOT NULL,
    breach_date TIMESTAMP NOT NULL,
    description TEXT NOT NULL,
    cause TEXT,
    data_categories JSONB,
    affected_individuals INT DEFAULT 0,
    risk_level VARCHAR(20),
    likelihood VARCHAR(20),
    severity VARCHAR(20),
    mitigation_actions JSONB,
    reported_to_sa BOOLEAN DEFAULT false,
    sa_ref_number VARCHAR(100),
    reported_to_individuals BOOLEAN DEFAULT false,
    notification_date TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'detected',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_breaches_detection (detection_date),
    INDEX idx_breaches_status (status),
    INDEX idx_breaches_risk (risk_level)
);

-- GDPR Audit Logs
CREATE TABLE IF NOT EXISTS gdpr_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    action VARCHAR(100) NOT NULL,
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    description TEXT,
    details BYTEA,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_action (action),
    INDEX idx_audit_user (user_id, user_email),
    INDEX idx_audit_resource (resource_type, resource_id)
);

-- Add GDPR columns to existing tables

-- Payments table GDPR columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gdpr_consent_id VARCHAR(36);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS data_protection_level VARCHAR(50) DEFAULT 'standard';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pseudonymized_data JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retention_expiry_date TIMESTAMP;

-- Customers table GDPR columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gdpr_consent_granted_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS data_anonymized BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP NULL;

-- Subscriptions table GDPR columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS consent_version VARCHAR(20);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lawful_basis VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS data_retention_acknowledged BOOLEAN DEFAULT false;

-- Create GDPR views for reporting
CREATE OR REPLACE VIEW gdpr_compliance_report AS
SELECT 
    'payments' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN gdpr_consent_id IS NOT NULL THEN 1 END) as consented_records,
    COUNT(CASE WHEN data_protection_level = 'enhanced' THEN 1 END) as enhanced_protection,
    COUNT(CASE WHEN pseudonymized_data IS NOT NULL THEN 1 END) as pseudonymized_records
FROM payments
UNION ALL
SELECT 
    'customers',
    COUNT(*),
    COUNT(CASE WHEN gdpr_consent_granted_at IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN data_anonymized = true THEN 1 END),
    0
FROM customers
UNION ALL
SELECT 
    'consents',
    COUNT(*),
    COUNT(CASE WHEN status = 'granted' THEN 1 END),
    0,
    0
FROM consents;

-- Create data subject request summary view
CREATE OR REPLACE VIEW data_subject_request_summary AS
SELECT 
    DATE(requested_at) as request_date,
    request_type,
    status,
    COUNT(*) as request_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - requested_at)) / 3600) as avg_hours_to_complete
FROM data_subject_requests
GROUP BY DATE(requested_at), request_type, status;