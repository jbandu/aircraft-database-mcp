-- Migration: Create API Keys Table
-- Description: Secure API key management with hashed storage
-- Date: 2024-11-27

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name VARCHAR(255) NOT NULL,
    key_hash TEXT NOT NULL,  -- Hashed with bcrypt

    -- Metadata
    description TEXT,
    created_by VARCHAR(255),

    -- Permissions (JSON for flexibility)
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}'::jsonb,

    -- Rate limiting
    rate_limit_tier VARCHAR(50) DEFAULT 'standard', -- 'free', 'standard', 'premium'
    requests_per_hour INTEGER DEFAULT 1000,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by VARCHAR(255),
    revoked_reason TEXT,

    -- Constraints
    CONSTRAINT valid_rate_limit_tier CHECK (rate_limit_tier IN ('free', 'standard', 'premium', 'unlimited'))
);

-- Indexes
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who
    user_id VARCHAR(255),
    api_key_id UUID REFERENCES api_keys(id),
    ip_address INET,
    user_agent TEXT,

    -- What
    action VARCHAR(100) NOT NULL,  -- 'api_key.create', 'api_key.revoke', 'data.read', etc.
    resource_type VARCHAR(100),     -- 'airline', 'aircraft', 'api_key'
    resource_id VARCHAR(255),

    -- Details
    details JSONB,
    http_method VARCHAR(10),
    http_path TEXT,
    http_status INTEGER,

    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- When
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_api_key ON audit_log(api_key_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_ip ON audit_log(ip_address);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for api_keys updated_at
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to log API key usage
CREATE OR REPLACE FUNCTION log_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_used_at when key is used
    IF OLD.last_used_at IS DISTINCT FROM NEW.last_used_at THEN
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Insert default development API key
-- Key: dev_key_12345 (for local development only)
INSERT INTO api_keys (key_name, key_hash, description, permissions, rate_limit_tier, requests_per_hour)
VALUES (
    'Development Key',
    crypt('dev_key_12345', gen_salt('bf')),
    'Default API key for local development. CHANGE IN PRODUCTION!',
    '{"read": true, "write": true, "admin": false}'::jsonb,
    'unlimited',
    999999
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE api_keys IS 'Secure storage for API keys with bcrypt hashing';
COMMENT ON TABLE audit_log IS 'Audit trail for all sensitive operations';
COMMENT ON COLUMN api_keys.key_hash IS 'Bcrypt hash of the actual API key';
COMMENT ON COLUMN api_keys.permissions IS 'JSON object defining allowed operations';
COMMENT ON COLUMN audit_log.action IS 'Dot-notation action name (e.g., api_key.create)';
