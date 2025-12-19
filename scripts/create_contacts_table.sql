-- Create dealer_contacts table for multi-source contact tracking
-- Run this against creative.db

-- Create the new contacts table
CREATE TABLE IF NOT EXISTS dealer_contacts (
    id INTEGER PRIMARY KEY,
    dealer_no TEXT REFERENCES dealers(dealer_no),
    
    -- The data
    contact_type TEXT CHECK(contact_type IN ('phone', 'email', 'website', 'social')),
    contact_subtype TEXT,  -- 'business_line', 'cell', 'fax', 'main', 'support', 'facebook', 'instagram', etc.
    value TEXT NOT NULL,
    
    -- Source tracking
    source TEXT CHECK(source IN ('allied_api', 'google_maps', 'website_crawl', 'facebook', 'brandfetch', 'manual')),
    source_date TEXT,
    source_detail TEXT,  -- e.g., 'TurnkeyPhone field', 'Google Maps listing', etc.
    confidence TEXT CHECK(confidence IN ('high', 'medium', 'low')),
    
    -- Validation
    is_validated INTEGER DEFAULT 0,
    validated_by TEXT,  -- 'manual', 'crawl_match', 'google_match'
    validated_date TEXT,
    
    -- Usage flags
    use_for_creatomate INTEGER DEFAULT 0,  -- This is THE one to use for posts
    use_for_contact INTEGER DEFAULT 0,     -- OK to contact dealer at this
    
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent exact duplicates
    UNIQUE(dealer_no, contact_type, value)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_dealer ON dealer_contacts(dealer_no);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON dealer_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_creatomate ON dealer_contacts(use_for_creatomate);

-- Add creatomate fields to dealers table if not exist
ALTER TABLE dealers ADD COLUMN creatomate_phone TEXT;
ALTER TABLE dealers ADD COLUMN creatomate_website TEXT;
ALTER TABLE dealers ADD COLUMN creatomate_logo TEXT;

-- Verify
SELECT 'dealer_contacts table created' as status;
SELECT COUNT(*) as existing_contacts FROM dealer_contacts;
