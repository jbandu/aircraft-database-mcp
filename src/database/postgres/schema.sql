-- =============================================================================
-- AIRCRAFT DATABASE - PostgreSQL Schema
-- =============================================================================
-- Version: 1.0.0
-- Purpose: Canonical source of truth for airline fleet data
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- =============================================================================
-- AIRLINES TABLE
-- =============================================================================

CREATE TABLE airlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iata_code VARCHAR(2) UNIQUE,
    icao_code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    callsign VARCHAR(100),
    country VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
    founded_year INTEGER,
    headquarters VARCHAR(255),
    website VARCHAR(500),
    alliance VARCHAR(50), -- oneworld, Star Alliance, SkyTeam, etc.
    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    scrape_frequency_hours INTEGER DEFAULT 24,
    data_quality_score DECIMAL(3, 2) DEFAULT 0.0, -- 0.0 to 1.0
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_airlines_iata ON airlines(iata_code);
CREATE INDEX idx_airlines_icao ON airlines(icao_code);
CREATE INDEX idx_airlines_active ON airlines(is_active);
CREATE INDEX idx_airlines_country ON airlines(country);
CREATE INDEX idx_airlines_name_trgm ON airlines USING gin(name gin_trgm_ops);

-- =============================================================================
-- AIRCRAFT TYPES TABLE
-- =============================================================================

CREATE TABLE aircraft_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iata_code VARCHAR(3),
    icao_code VARCHAR(4) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    variant VARCHAR(100),
    family VARCHAR(100), -- e.g., "737 Family", "A320 Family"
    type_category VARCHAR(50), -- narrowbody, widebody, regional, cargo, etc.
    engine_type VARCHAR(50), -- jet, turboprop, piston
    engine_count INTEGER,
    typical_cruise_speed INTEGER, -- knots
    max_range INTEGER, -- nautical miles
    max_altitude INTEGER, -- feet
    length_meters DECIMAL(6, 2),
    wingspan_meters DECIMAL(6, 2),
    height_meters DECIMAL(6, 2),
    max_takeoff_weight_kg INTEGER,
    fuel_capacity_liters INTEGER,
    production_start_year INTEGER,
    production_end_year INTEGER,
    is_in_production BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(manufacturer, model, variant)
);

CREATE INDEX idx_aircraft_types_iata ON aircraft_types(iata_code);
CREATE INDEX idx_aircraft_types_icao ON aircraft_types(icao_code);
CREATE INDEX idx_aircraft_types_manufacturer ON aircraft_types(manufacturer);
CREATE INDEX idx_aircraft_types_family ON aircraft_types(family);
CREATE INDEX idx_aircraft_types_category ON aircraft_types(type_category);

-- =============================================================================
-- AIRCRAFT TABLE (Individual Aircraft)
-- =============================================================================

CREATE TABLE aircraft (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration VARCHAR(10) NOT NULL UNIQUE,
    manufacturer_serial_number VARCHAR(50),
    aircraft_type_id UUID NOT NULL REFERENCES aircraft_types(id),
    current_airline_id UUID REFERENCES airlines(id),
    previous_registrations TEXT[], -- Array of previous registrations
    manufacture_date DATE,
    delivery_date DATE,
    first_flight_date DATE,
    age_years DECIMAL(4, 1) GENERATED ALWAYS AS (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, manufacture_date))
    ) STORED,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, stored, retired, on_order, in_production
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),
    engines TEXT[], -- Array of engine types
    test_registration VARCHAR(10), -- Used during testing phase
    rollout_date DATE,
    last_seen_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_aircraft_registration ON aircraft(registration);
CREATE INDEX idx_aircraft_serial ON aircraft(manufacturer_serial_number);
CREATE INDEX idx_aircraft_type ON aircraft(aircraft_type_id);
CREATE INDEX idx_aircraft_airline ON aircraft(current_airline_id);
CREATE INDEX idx_aircraft_status ON aircraft(status);
CREATE INDEX idx_aircraft_age ON aircraft(age_years);
CREATE INDEX idx_aircraft_manufacture_date ON aircraft(manufacture_date);

-- =============================================================================
-- AIRCRAFT CONFIGURATIONS TABLE
-- =============================================================================

CREATE TABLE aircraft_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT true,

    -- Seating Configuration
    total_seats INTEGER,
    class_first INTEGER DEFAULT 0,
    class_business INTEGER DEFAULT 0,
    class_premium_economy INTEGER DEFAULT 0,
    class_economy INTEGER DEFAULT 0,

    -- Cabin Features
    has_wifi BOOLEAN DEFAULT false,
    has_power_outlets BOOLEAN DEFAULT false,
    has_entertainment BOOLEAN DEFAULT false,
    has_lie_flat_seats BOOLEAN DEFAULT false,

    -- Cargo Capacity
    cargo_capacity_cubic_meters DECIMAL(8, 2),

    layout_code VARCHAR(50), -- e.g., "3-3", "2-4-2"
    configuration_name VARCHAR(100), -- e.g., "Domestic", "International Long-Haul"

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_aircraft_configs_aircraft ON aircraft_configurations(aircraft_id);
CREATE INDEX idx_aircraft_configs_current ON aircraft_configurations(is_current);
CREATE INDEX idx_aircraft_configs_dates ON aircraft_configurations(effective_date, end_date);

-- =============================================================================
-- AIRCRAFT OPERATORS HISTORY TABLE
-- =============================================================================

CREATE TABLE aircraft_operators_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    airline_id UUID NOT NULL REFERENCES airlines(id),
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    operator_type VARCHAR(50), -- owner, lessee, operator
    lease_type VARCHAR(50), -- dry, wet, operating, finance
    registration_during_operation VARCHAR(10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operators_history_aircraft ON aircraft_operators_history(aircraft_id);
CREATE INDEX idx_operators_history_airline ON aircraft_operators_history(airline_id);
CREATE INDEX idx_operators_history_current ON aircraft_operators_history(is_current);
CREATE INDEX idx_operators_history_dates ON aircraft_operators_history(start_date, end_date);

-- =============================================================================
-- SCRAPING JOBS TABLE
-- =============================================================================

CREATE TABLE scraping_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    airline_id UUID REFERENCES airlines(id),
    job_type VARCHAR(50) NOT NULL, -- fleet_discovery, aircraft_details, validation
    status VARCHAR(50) NOT NULL, -- pending, running, completed, failed
    priority VARCHAR(20) DEFAULT 'normal', -- high, normal, low
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER
    ) STORED,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    llm_provider VARCHAR(50), -- ollama, claude
    llm_model VARCHAR(100),
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_scraping_jobs_airline ON scraping_jobs(airline_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_type ON scraping_jobs(job_type);
CREATE INDEX idx_scraping_jobs_created ON scraping_jobs(created_at DESC);

-- =============================================================================
-- DATA SOURCES TABLE (Track where data came from)
-- =============================================================================

CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type VARCHAR(50) NOT NULL, -- website, api, manual, import
    source_name VARCHAR(255) NOT NULL,
    source_url VARCHAR(1000),
    reliability_score DECIMAL(3, 2) DEFAULT 0.5, -- 0.0 to 1.0
    last_accessed_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    scraping_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_data_sources_type ON data_sources(source_type);
CREATE INDEX idx_data_sources_active ON data_sources(is_active);

-- =============================================================================
-- AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    changed_by VARCHAR(100), -- system, user_id, scraper_job_id
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    change_reason VARCHAR(500)
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Current Fleet View (Active aircraft with current configurations)
CREATE VIEW current_fleet AS
SELECT
    a.id as aircraft_id,
    a.registration,
    a.manufacturer_serial_number,
    a.status,
    a.age_years,
    at.manufacturer,
    at.model,
    at.variant,
    at.type_category,
    al.iata_code as airline_iata,
    al.icao_code as airline_icao,
    al.name as airline_name,
    ac.total_seats,
    ac.class_first,
    ac.class_business,
    ac.class_premium_economy,
    ac.class_economy,
    ac.configuration_name,
    a.updated_at
FROM aircraft a
JOIN aircraft_types at ON a.aircraft_type_id = at.id
LEFT JOIN airlines al ON a.current_airline_id = al.id
LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
WHERE a.status = 'active';

-- Fleet Statistics by Airline
CREATE VIEW fleet_statistics_by_airline AS
SELECT
    al.id as airline_id,
    al.iata_code,
    al.icao_code,
    al.name,
    COUNT(a.id) as total_aircraft,
    COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_aircraft,
    COUNT(CASE WHEN a.status = 'stored' THEN 1 END) as stored_aircraft,
    COUNT(CASE WHEN a.status = 'on_order' THEN 1 END) as on_order,
    ROUND(AVG(a.age_years), 1) as average_age_years,
    MIN(a.manufacture_date) as oldest_aircraft_date,
    MAX(a.manufacture_date) as newest_aircraft_date,
    SUM(ac.total_seats) as total_seats_capacity
FROM airlines al
LEFT JOIN aircraft a ON al.id = a.current_airline_id
LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
GROUP BY al.id, al.iata_code, al.icao_code, al.name;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_airlines_updated_at BEFORE UPDATE ON airlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_types_updated_at BEFORE UPDATE ON aircraft_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_updated_at BEFORE UPDATE ON aircraft
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_configs_updated_at BEFORE UPDATE ON aircraft_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE airlines IS 'Master list of airlines worldwide';
COMMENT ON TABLE aircraft_types IS 'Aircraft type definitions (models, variants)';
COMMENT ON TABLE aircraft IS 'Individual aircraft registrations and details';
COMMENT ON TABLE aircraft_configurations IS 'Seating and cabin configurations over time';
COMMENT ON TABLE aircraft_operators_history IS 'Historical ownership and operation records';
COMMENT ON TABLE scraping_jobs IS 'Web scraping job execution history';
COMMENT ON TABLE data_sources IS 'External data sources and their reliability';
COMMENT ON TABLE audit_log IS 'Audit trail for all data modifications';
