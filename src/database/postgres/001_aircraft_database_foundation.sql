-- =============================================================================
-- AIRCRAFT DATABASE - FOUNDATION MIGRATION
-- =============================================================================
-- Version: 001
-- Description: Complete database schema with comprehensive airline and fleet data
-- Date: 2025-11-27
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Advanced indexing

-- =============================================================================
-- TABLE 1: AIRLINES
-- =============================================================================

CREATE TABLE airlines (
    id SERIAL PRIMARY KEY,
    iata_code VARCHAR(3) UNIQUE,
    icao_code VARCHAR(4) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    alliance VARCHAR(50),  -- Star Alliance, oneworld, SkyTeam
    business_model VARCHAR(50),  -- full-service, low-cost, ultra-low-cost, cargo
    headquarters VARCHAR(255),
    website_url TEXT,
    fleet_size INTEGER DEFAULT 0,
    destinations INTEGER,
    founded_year INTEGER,
    logo_url TEXT,

    -- Scraping metadata
    last_scraped_at TIMESTAMPTZ,
    scrape_frequency INTERVAL DEFAULT '7 days',
    scrape_status VARCHAR(50),  -- pending, in_progress, completed, failed
    scrape_source_urls JSONB,  -- Array of URLs to scrape

    -- Data quality
    data_completeness_score DECIMAL(3,2),  -- 0.00 to 1.00
    data_quality_flags JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_iata_length CHECK (iata_code IS NULL OR LENGTH(iata_code) IN (2, 3)),
    CONSTRAINT check_completeness_score CHECK (data_completeness_score >= 0 AND data_completeness_score <= 1)
);

CREATE INDEX idx_airlines_iata ON airlines(iata_code);
CREATE INDEX idx_airlines_icao ON airlines(icao_code);
CREATE INDEX idx_airlines_country ON airlines(country);
CREATE INDEX idx_airlines_alliance ON airlines(alliance);
CREATE INDEX idx_airlines_name_trgm ON airlines USING gin(name gin_trgm_ops);
CREATE INDEX idx_airlines_scrape_status ON airlines(scrape_status);

COMMENT ON TABLE airlines IS 'Master list of airlines worldwide with metadata';
COMMENT ON COLUMN airlines.data_completeness_score IS 'Score from 0-1 indicating data quality';

-- =============================================================================
-- TABLE 2: AIRCRAFT_TYPES (Reference Data)
-- =============================================================================

CREATE TABLE aircraft_types (
    id SERIAL PRIMARY KEY,
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    series VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,  -- Boeing 737-800

    -- Performance Specs
    typical_range_km INTEGER,
    max_range_km INTEGER,
    cruising_speed_kmh INTEGER,
    max_speed_kmh INTEGER,
    service_ceiling_m INTEGER,

    -- Capacity
    typical_seat_config JSONB,  -- Common configurations
    max_seats INTEGER,
    min_seats INTEGER,
    cargo_capacity_kg DECIMAL(10,2),

    -- Dimensions
    length_m DECIMAL(5,2),
    wingspan_m DECIMAL(5,2),
    height_m DECIMAL(5,2),

    -- Weight
    max_takeoff_weight_kg DECIMAL(10,2),
    max_landing_weight_kg DECIMAL(10,2),
    empty_weight_kg DECIMAL(10,2),

    -- Fuel & Engines
    fuel_capacity_liters INTEGER,
    engine_type VARCHAR(255),
    engine_count INTEGER,
    typical_fuel_burn_liters_per_hour DECIMAL(8,2),

    -- Runway Requirements
    min_runway_length_m INTEGER,

    -- Operational Info
    first_flight_date DATE,
    production_start_date DATE,
    production_end_date DATE,
    total_produced INTEGER,
    units_in_service INTEGER,

    -- Certification
    etops_rating INTEGER,  -- ETOPS minutes rating
    noise_chapter VARCHAR(50),  -- Chapter 3, Chapter 4, etc.

    -- Economics
    typical_purchase_price_usd DECIMAL(15,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(manufacturer, model, series)
);

CREATE INDEX idx_aircraft_types_manufacturer ON aircraft_types(manufacturer);
CREATE INDEX idx_aircraft_types_model ON aircraft_types(model);
CREATE INDEX idx_aircraft_types_full_name ON aircraft_types(full_name);

COMMENT ON TABLE aircraft_types IS 'Reference table for aircraft type specifications';

-- =============================================================================
-- TABLE 3: AIRCRAFT (Individual Aircraft)
-- =============================================================================

CREATE TABLE aircraft (
    id SERIAL PRIMARY KEY,
    airline_id INTEGER REFERENCES airlines(id) ON DELETE CASCADE,
    aircraft_type_id INTEGER REFERENCES aircraft_types(id),

    -- Aircraft Identity
    registration VARCHAR(20) UNIQUE NOT NULL,  -- Tail number (e.g., N12345)
    aircraft_type VARCHAR(100) NOT NULL,  -- e.g., Boeing 737-800
    manufacturer VARCHAR(100),  -- Boeing, Airbus, Embraer, etc.
    model VARCHAR(100),  -- 737-800, A320neo, E175
    series VARCHAR(50),  -- -800, -900, neo, etc.

    -- Specifications
    msn VARCHAR(50),  -- Manufacturer Serial Number
    line_number INTEGER,  -- Production line number
    engines VARCHAR(255),  -- Engine type/model
    engine_count INTEGER,

    -- Operational Data
    status VARCHAR(50) NOT NULL,  -- active, stored, maintenance, retired
    in_service_date DATE,
    manufactured_date DATE,
    delivery_date DATE,
    retirement_date DATE,

    -- Configuration
    seat_configuration JSONB,  -- {"first": 12, "business": 36, "economy": 180}
    total_seats INTEGER,
    cargo_capacity_kg DECIMAL(10,2),
    max_range_km INTEGER,
    cruising_speed_kmh INTEGER,

    -- Ownership & Finance
    ownership_type VARCHAR(50),  -- owned, leased, wet-lease
    lessor VARCHAR(255),
    lease_return_date DATE,

    -- Operational Metrics
    total_flight_hours DECIMAL(10,2),
    total_cycles INTEGER,  -- Takeoff/landing cycles
    average_daily_utilization DECIMAL(4,2),  -- Hours per day
    home_base VARCHAR(10),  -- IATA airport code

    -- Maintenance
    next_maintenance_date DATE,
    maintenance_status VARCHAR(50),
    last_major_check VARCHAR(50),  -- A-check, C-check, D-check
    last_major_check_date DATE,

    -- Current Status
    current_location VARCHAR(10),  -- IATA airport code
    current_flight VARCHAR(20),  -- Flight number if airborne
    last_flight_date TIMESTAMPTZ,

    -- Scraping Metadata
    data_source VARCHAR(255),  -- URL or source identifier
    last_verified_at TIMESTAMPTZ,
    verification_method VARCHAR(100),  -- scrape, api, manual
    data_confidence DECIMAL(3,2),  -- 0.00 to 1.00

    -- Additional Info
    wifi_available BOOLEAN,
    entertainment_system VARCHAR(100),
    special_features JSONB,  -- winglets, ETOPS rating, etc.
    livery_description TEXT,
    registration_history JSONB,  -- Previous registrations

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_data_confidence CHECK (data_confidence >= 0 AND data_confidence <= 1)
);

CREATE INDEX idx_aircraft_airline ON aircraft(airline_id);
CREATE INDEX idx_aircraft_registration ON aircraft(registration);
CREATE INDEX idx_aircraft_type ON aircraft(aircraft_type);
CREATE INDEX idx_aircraft_type_id ON aircraft(aircraft_type_id);
CREATE INDEX idx_aircraft_status ON aircraft(status);
CREATE INDEX idx_aircraft_manufacturer ON aircraft(manufacturer);
CREATE INDEX idx_aircraft_model ON aircraft(model);
CREATE INDEX idx_aircraft_msn ON aircraft(msn);
CREATE INDEX idx_aircraft_manufactured_date ON aircraft(manufactured_date);

COMMENT ON TABLE aircraft IS 'Individual aircraft registrations and operational details';
COMMENT ON COLUMN aircraft.registration IS 'Unique tail number/registration of the aircraft';

-- =============================================================================
-- TABLE 4: FLEET_CHANGES
-- =============================================================================

CREATE TABLE fleet_changes (
    id SERIAL PRIMARY KEY,
    airline_id INTEGER REFERENCES airlines(id) ON DELETE CASCADE,
    aircraft_id INTEGER REFERENCES aircraft(id) ON DELETE SET NULL,

    change_type VARCHAR(50) NOT NULL,  -- addition, retirement, transfer, lease_start, lease_end
    change_date DATE NOT NULL,

    registration VARCHAR(20),
    aircraft_type VARCHAR(100),

    -- Context
    reason TEXT,  -- Fleet modernization, route expansion, etc.
    previous_airline_id INTEGER REFERENCES airlines(id),
    next_airline_id INTEGER REFERENCES airlines(id),

    -- Source
    source_url TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fleet_changes_airline ON fleet_changes(airline_id);
CREATE INDEX idx_fleet_changes_date ON fleet_changes(change_date);
CREATE INDEX idx_fleet_changes_type ON fleet_changes(change_type);
CREATE INDEX idx_fleet_changes_aircraft ON fleet_changes(aircraft_id);

COMMENT ON TABLE fleet_changes IS 'Historical tracking of fleet additions, retirements, and transfers';

-- =============================================================================
-- TABLE 5: SCRAPE_JOBS
-- =============================================================================

CREATE TABLE scrape_jobs (
    id SERIAL PRIMARY KEY,
    airline_id INTEGER REFERENCES airlines(id) ON DELETE CASCADE,

    job_type VARCHAR(50) NOT NULL,  -- full_fleet_update, aircraft_details, verification
    status VARCHAR(50) NOT NULL,  -- pending, running, completed, failed

    -- Execution
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Results
    aircraft_found INTEGER DEFAULT 0,
    aircraft_added INTEGER DEFAULT 0,
    aircraft_updated INTEGER DEFAULT 0,
    aircraft_removed INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,

    -- Details
    source_urls JSONB,
    llm_provider VARCHAR(50),  -- ollama, claude
    llm_model VARCHAR(100),
    scraping_agent_version VARCHAR(20),
    error_details JSONB,
    execution_log TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scrape_jobs_airline ON scrape_jobs(airline_id);
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_started ON scrape_jobs(started_at);
CREATE INDEX idx_scrape_jobs_type ON scrape_jobs(job_type);

COMMENT ON TABLE scrape_jobs IS 'Web scraping job execution history and results';

-- =============================================================================
-- TABLE 6: DATA_QUALITY_CHECKS
-- =============================================================================

CREATE TABLE data_quality_checks (
    id SERIAL PRIMARY KEY,

    entity_type VARCHAR(50) NOT NULL,  -- airline, aircraft
    entity_id INTEGER NOT NULL,

    check_type VARCHAR(100) NOT NULL,  -- completeness, consistency, accuracy, freshness
    check_name VARCHAR(255) NOT NULL,

    passed BOOLEAN NOT NULL,
    severity VARCHAR(50),  -- info, warning, error, critical

    expected_value TEXT,
    actual_value TEXT,
    issue_description TEXT,

    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quality_checks_entity ON data_quality_checks(entity_type, entity_id);
CREATE INDEX idx_quality_checks_type ON data_quality_checks(check_type);
CREATE INDEX idx_quality_checks_passed ON data_quality_checks(passed);
CREATE INDEX idx_quality_checks_severity ON data_quality_checks(severity);

COMMENT ON TABLE data_quality_checks IS 'Data quality validation results';

-- =============================================================================
-- TRIGGERS - Automatic Timestamp Updates
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_airlines_updated_at
    BEFORE UPDATE ON airlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_types_updated_at
    BEFORE UPDATE ON aircraft_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_updated_at
    BEFORE UPDATE ON aircraft
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Calculate fleet age for an airline
CREATE OR REPLACE FUNCTION calculate_fleet_age(p_airline_id INTEGER)
RETURNS TABLE (
    avg_age_years DECIMAL,
    oldest_aircraft_years DECIMAL,
    newest_aircraft_years DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, manufactured_date))), 1) as avg_age,
        MAX(EXTRACT(YEAR FROM AGE(CURRENT_DATE, manufactured_date))) as oldest,
        MIN(EXTRACT(YEAR FROM AGE(CURRENT_DATE, manufactured_date))) as newest
    FROM aircraft
    WHERE airline_id = p_airline_id
      AND manufactured_date IS NOT NULL
      AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Get fleet composition by type
CREATE OR REPLACE FUNCTION get_fleet_composition(p_airline_id INTEGER)
RETURNS TABLE (
    aircraft_type VARCHAR,
    count BIGINT,
    percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH fleet_counts AS (
        SELECT
            a.aircraft_type,
            COUNT(*) as type_count,
            SUM(COUNT(*)) OVER () as total_count
        FROM aircraft a
        WHERE a.airline_id = p_airline_id
          AND a.status = 'active'
        GROUP BY a.aircraft_type
    )
    SELECT
        fc.aircraft_type,
        fc.type_count,
        ROUND((fc.type_count::DECIMAL / fc.total_count) * 100, 2) as pct
    FROM fleet_counts fc
    ORDER BY fc.type_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculate utilization metrics
CREATE OR REPLACE FUNCTION calculate_utilization_stats(p_airline_id INTEGER)
RETURNS TABLE (
    total_aircraft INTEGER,
    avg_daily_utilization DECIMAL,
    total_fleet_hours DECIMAL,
    avg_cycles_per_aircraft DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER,
        ROUND(AVG(average_daily_utilization), 2),
        ROUND(SUM(total_flight_hours), 2),
        ROUND(AVG(total_cycles), 0)
    FROM aircraft
    WHERE airline_id = p_airline_id
      AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS - Common Queries
-- =============================================================================

-- Active Fleet View
CREATE VIEW active_fleet AS
SELECT
    ac.id,
    ac.registration,
    ac.aircraft_type,
    ac.manufacturer,
    ac.model,
    ac.status,
    ac.total_seats,
    ac.manufactured_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ac.manufactured_date))::INTEGER as age_years,
    al.iata_code as airline_iata,
    al.icao_code as airline_icao,
    al.name as airline_name,
    al.country,
    at.typical_range_km,
    at.cruising_speed_kmh
FROM aircraft ac
JOIN airlines al ON ac.airline_id = al.id
LEFT JOIN aircraft_types at ON ac.aircraft_type_id = at.id
WHERE ac.status = 'active';

COMMENT ON VIEW active_fleet IS 'All currently active aircraft with airline and type information';

-- Fleet by Type Summary
CREATE VIEW fleet_by_type AS
SELECT
    at.manufacturer,
    at.model,
    at.full_name,
    COUNT(ac.id) as total_aircraft,
    COUNT(CASE WHEN ac.status = 'active' THEN 1 END) as active_count,
    COUNT(DISTINCT ac.airline_id) as operators_count,
    ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, ac.manufactured_date))), 1) as avg_age_years
FROM aircraft_types at
LEFT JOIN aircraft ac ON at.id = ac.aircraft_type_id
GROUP BY at.id, at.manufacturer, at.model, at.full_name
ORDER BY total_aircraft DESC;

COMMENT ON VIEW fleet_by_type IS 'Aircraft type distribution across all airlines';

-- Airline Fleet Summary
CREATE VIEW airline_fleet_summary AS
SELECT
    al.id as airline_id,
    al.iata_code,
    al.icao_code,
    al.name,
    al.country,
    al.alliance,
    COUNT(ac.id) as total_aircraft,
    COUNT(CASE WHEN ac.status = 'active' THEN 1 END) as active_aircraft,
    COUNT(CASE WHEN ac.status = 'stored' THEN 1 END) as stored_aircraft,
    COUNT(CASE WHEN ac.status = 'retired' THEN 1 END) as retired_aircraft,
    COUNT(DISTINCT ac.aircraft_type) as unique_types,
    ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, ac.manufactured_date))), 1) as avg_fleet_age,
    SUM(ac.total_seats) as total_seat_capacity,
    al.last_scraped_at,
    al.data_completeness_score
FROM airlines al
LEFT JOIN aircraft ac ON al.id = ac.airline_id
GROUP BY al.id, al.iata_code, al.icao_code, al.name, al.country, al.alliance,
         al.last_scraped_at, al.data_completeness_score
ORDER BY total_aircraft DESC;

COMMENT ON VIEW airline_fleet_summary IS 'Comprehensive fleet statistics by airline';

-- Recent Fleet Changes
CREATE VIEW recent_fleet_changes AS
SELECT
    fc.change_date,
    fc.change_type,
    fc.registration,
    fc.aircraft_type,
    al.name as airline_name,
    al.iata_code,
    fc.reason,
    fc.verified
FROM fleet_changes fc
JOIN airlines al ON fc.airline_id = al.id
WHERE fc.change_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY fc.change_date DESC, fc.detected_at DESC;

COMMENT ON VIEW recent_fleet_changes IS 'Fleet changes in the last 90 days';

-- Scraping Status Dashboard
CREATE VIEW scraping_status_dashboard AS
SELECT
    al.iata_code,
    al.name as airline_name,
    al.scrape_status,
    al.last_scraped_at,
    EXTRACT(EPOCH FROM (NOW() - al.last_scraped_at)) / 3600 as hours_since_scrape,
    COUNT(sj.id) as total_jobs,
    COUNT(CASE WHEN sj.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN sj.status = 'failed' THEN 1 END) as failed_jobs,
    MAX(sj.completed_at) as last_successful_scrape
FROM airlines al
LEFT JOIN scrape_jobs sj ON al.id = sj.airline_id
GROUP BY al.id, al.iata_code, al.name, al.scrape_status, al.last_scraped_at
ORDER BY hours_since_scrape DESC NULLS FIRST;

COMMENT ON VIEW scraping_status_dashboard IS 'Overview of scraping status for all airlines';

-- =============================================================================
-- SEED DATA - Top 50 Commercial Aircraft Types
-- =============================================================================

INSERT INTO aircraft_types (manufacturer, model, series, full_name, typical_range_km, max_range_km, cruising_speed_kmh, max_seats, engine_count, typical_seat_config) VALUES
-- Boeing
('Boeing', '737', '-700', 'Boeing 737-700', 6370, 6370, 828, 149, 2, '{"business": 12, "economy": 112}'::jsonb),
('Boeing', '737', '-800', 'Boeing 737-800', 5436, 5436, 828, 189, 2, '{"business": 16, "economy": 150}'::jsonb),
('Boeing', '737', '-900', 'Boeing 737-900', 5044, 5044, 828, 220, 2, '{"business": 20, "economy": 158}'::jsonb),
('Boeing', '737', 'MAX 7', 'Boeing 737 MAX 7', 7130, 7130, 839, 172, 2, '{"business": 12, "economy": 138}'::jsonb),
('Boeing', '737', 'MAX 8', 'Boeing 737 MAX 8', 6570, 6570, 839, 210, 2, '{"business": 16, "economy": 162}'::jsonb),
('Boeing', '737', 'MAX 9', 'Boeing 737 MAX 9', 6570, 6570, 839, 220, 2, '{"business": 20, "economy": 178}'::jsonb),
('Boeing', '737', 'MAX 10', 'Boeing 737 MAX 10', 6110, 6110, 839, 230, 2, '{"business": 18, "economy": 190}'::jsonb),
('Boeing', '747', '-400', 'Boeing 747-400', 13450, 13450, 907, 524, 4, '{"first": 14, "business": 52, "premium_economy": 60, "economy": 244}'::jsonb),
('Boeing', '747', '-8', 'Boeing 747-8', 14816, 14816, 907, 605, 4, '{"first": 16, "business": 80, "premium_economy": 60, "economy": 300}'::jsonb),
('Boeing', '757', '-200', 'Boeing 757-200', 7222, 7222, 850, 239, 2, '{"business": 16, "economy": 184}'::jsonb),
('Boeing', '767', '-300', 'Boeing 767-300', 11065, 11065, 850, 351, 2, '{"business": 30, "premium_economy": 28, "economy": 185}'::jsonb),
('Boeing', '777', '-200', 'Boeing 777-200', 9700, 9700, 892, 400, 2, '{"business": 37, "premium_economy": 24, "economy": 216}'::jsonb),
('Boeing', '777', '-300', 'Boeing 777-300', 11121, 11121, 892, 550, 2, '{"business": 42, "premium_economy": 24, "economy": 310}'::jsonb),
('Boeing', '777', '-300ER', 'Boeing 777-300ER', 14490, 14490, 892, 550, 2, '{"first": 8, "business": 42, "premium_economy": 24, "economy": 310}'::jsonb),
('Boeing', '787', '-8', 'Boeing 787-8', 13620, 13620, 903, 296, 2, '{"business": 36, "premium_economy": 28, "economy": 166}'::jsonb),
('Boeing', '787', '-9', 'Boeing 787-9', 14140, 14140, 903, 336, 2, '{"business": 42, "premium_economy": 28, "economy": 192}'::jsonb),
('Boeing', '787', '-10', 'Boeing 787-10', 11910, 11910, 903, 406, 2, '{"business": 38, "premium_economy": 54, "economy": 198}'::jsonb),

-- Airbus
('Airbus', 'A220', '-100', 'Airbus A220-100', 6390, 6390, 828, 135, 2, '{"business": 12, "economy": 108}'::jsonb),
('Airbus', 'A220', '-300', 'Airbus A220-300', 6297, 6297, 828, 160, 2, '{"business": 12, "economy": 128}'::jsonb),
('Airbus', 'A319', '', 'Airbus A319', 6850, 6850, 828, 160, 2, '{"business": 12, "economy": 126}'::jsonb),
('Airbus', 'A320', '', 'Airbus A320', 6150, 6150, 828, 180, 2, '{"business": 12, "economy": 150}'::jsonb),
('Airbus', 'A320', 'neo', 'Airbus A320neo', 6500, 6500, 828, 195, 2, '{"business": 12, "economy": 165}'::jsonb),
('Airbus', 'A321', '', 'Airbus A321', 5950, 5950, 828, 220, 2, '{"business": 16, "economy": 185}'::jsonb),
('Airbus', 'A321', 'neo', 'Airbus A321neo', 7400, 7400, 828, 244, 2, '{"business": 16, "economy": 200}'::jsonb),
('Airbus', 'A321', 'XLR', 'Airbus A321 XLR', 8700, 8700, 828, 244, 2, '{"business": 16, "premium_economy": 20, "economy": 180}'::jsonb),
('Airbus', 'A330', '-200', 'Airbus A330-200', 13450, 13450, 871, 406, 2, '{"business": 36, "premium_economy": 28, "economy": 200}'::jsonb),
('Airbus', 'A330', '-300', 'Airbus A330-300', 11750, 11750, 871, 440, 2, '{"business": 42, "premium_economy": 28, "economy": 235}'::jsonb),
('Airbus', 'A330', '-900neo', 'Airbus A330-900neo', 13334, 13334, 871, 440, 2, '{"business": 42, "premium_economy": 28, "economy": 263}'::jsonb),
('Airbus', 'A350', '-900', 'Airbus A350-900', 15000, 15000, 903, 440, 2, '{"business": 48, "premium_economy": 21, "economy": 262}'::jsonb),
('Airbus', 'A350', '-1000', 'Airbus A350-1000', 16100, 16100, 903, 480, 2, '{"business": 46, "premium_economy": 24, "economy": 301}'::jsonb),
('Airbus', 'A380', '-800', 'Airbus A380-800', 15200, 15200, 903, 853, 4, '{"first": 14, "business": 76, "premium_economy": 44, "economy": 426}'::jsonb),

-- Embraer
('Embraer', 'E170', '', 'Embraer E170', 3889, 3889, 829, 78, 2, '{"economy": 78}'::jsonb),
('Embraer', 'E175', '', 'Embraer E175', 3704, 3704, 829, 88, 2, '{"first": 12, "economy": 64}'::jsonb),
('Embraer', 'E190', '', 'Embraer E190', 4537, 4537, 829, 114, 2, '{"first": 12, "economy": 90}'::jsonb),
('Embraer', 'E195', '', 'Embraer E195', 3428, 3428, 829, 124, 2, '{"business": 12, "economy": 100}'::jsonb),
('Embraer', 'E195-E2', '', 'Embraer E195-E2', 5278, 5278, 829, 146, 2, '{"business": 12, "economy": 120}'::jsonb),

-- Bombardier (now Airbus A220)
('Bombardier', 'CRJ-700', '', 'Bombardier CRJ-700', 3620, 3620, 786, 78, 2, '{"first": 12, "economy": 60}'::jsonb),
('Bombardier', 'CRJ-900', '', 'Bombardier CRJ-900', 2956, 2956, 786, 90, 2, '{"first": 12, "economy": 74}'::jsonb),
('Bombardier', 'CRJ-1000', '', 'Bombardier CRJ-1000', 2761, 2761, 786, 104, 2, '{"business": 12, "economy": 92}'::jsonb),

-- ATR (Regional Turboprops)
('ATR', 'ATR 42', '-600', 'ATR 42-600', 1528, 1528, 510, 50, 2, '{"economy": 48}'::jsonb),
('ATR', 'ATR 72', '-600', 'ATR 72-600', 1528, 1528, 510, 78, 2, '{"economy": 70}'::jsonb),

-- Comac (Chinese)
('COMAC', 'ARJ21', '', 'COMAC ARJ21', 3704, 3704, 828, 105, 2, '{"business": 5, "economy": 85}'::jsonb),
('COMAC', 'C919', '', 'COMAC C919', 5555, 5555, 828, 192, 2, '{"business": 8, "economy": 156}'::jsonb),

-- De Havilland Canada
('De Havilland Canada', 'Dash 8', 'Q400', 'De Havilland Canada Dash 8 Q400', 2522, 2522, 667, 90, 2, '{"economy": 78}'::jsonb),

-- Mitsubishi (now part of Bombardier program)
('Mitsubishi', 'CRJ-550', '', 'Mitsubishi CRJ-550', 2408, 2408, 786, 50, 2, '{"first": 10, "economy": 40}'::jsonb),

-- Sukhoi
('Sukhoi', 'Superjet 100', '', 'Sukhoi Superjet 100', 4578, 4578, 828, 108, 2, '{"business": 12, "economy": 85}'::jsonb),

-- Boeing (Cargo/Freighter variants)
('Boeing', '747', '-8F', 'Boeing 747-8F (Freighter)', 8130, 8130, 907, 0, 4, '{}'::jsonb),
('Boeing', '777', 'F', 'Boeing 777F (Freighter)', 9200, 9200, 892, 0, 2, '{}'::jsonb);

-- Update reference IDs in aircraft table (if needed)
UPDATE aircraft a
SET aircraft_type_id = at.id
FROM aircraft_types at
WHERE a.manufacturer = at.manufacturer
  AND a.model = at.model
  AND (a.series = at.series OR (a.series IS NULL AND at.series IS NULL))
  AND a.aircraft_type_id IS NULL;

-- =============================================================================
-- ROW LEVEL SECURITY (Optional - for Neon/Multi-tenant)
-- =============================================================================

-- Enable RLS on airlines table
-- ALTER TABLE airlines ENABLE ROW LEVEL SECURITY;

-- Example policy: Allow read access to all authenticated users
-- CREATE POLICY airlines_read_policy ON airlines
--     FOR SELECT
--     USING (true);

-- Example policy: Allow write access only to admin role
-- CREATE POLICY airlines_write_policy ON airlines
--     FOR ALL
--     USING (current_user = 'admin_role');

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Aircraft Database Foundation Migration Complete!';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Tables created: 6';
    RAISE NOTICE 'Views created: 5';
    RAISE NOTICE 'Functions created: 3';
    RAISE NOTICE 'Aircraft types seeded: 50';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run: npm run db:seed to populate airlines';
    RAISE NOTICE '2. Configure scraping sources in .env';
    RAISE NOTICE '3. Start MCP server: npm run dev:mcp';
    RAISE NOTICE '=================================================================';
END $$;
