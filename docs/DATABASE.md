# Woodhouse Creative - Database Documentation

**Last Updated:** December 18, 2025  
**Database:** `~/woodhouse_creative/data/sqlite/creative.db`

---

## Overview

This database supports Woodhouse Agency's Allied Air Turnkey Social Media program. It consolidates dealer data from multiple sources to enable automated video creation via Creatomate.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Dealer Number** | 8-digit ID assigned by Allied Air (e.g., `10231005`). Primary key across all systems. |
| **FULL vs CONTENT** | FULL = we post for them (124 dealers). CONTENT = we create, they post (209 dealers). |
| **Creatomate Fields** | Validated data specifically for video reels: `display_name`, `creatomate_phone`, `creatomate_website`, `creatomate_logo` |
| **Ready for Automate** | Logo resized/rebuilt AND all Creatomate fields validated. 95/124 currently ready. |

---

## Data Sources (Priority Order)

1. **Creatomate Validated Excel** - `Import Creatomate Data Validated.xlsx`  
   ✓ Manually validated phone, name, website, logo  
   ✓ **This is the source of truth for automation fields**

2. **Allied Air API** - Via Excel sync (`Dealers - Current.xlsm`)  
   Contact info, addresses, program status, tier

3. **Sprout Social Export** - `Profiles_*.csv`  
   Facebook Page IDs for 113 dealers we have admin access to

4. **Facebook Pages Scraper** - Apify results  
   Business phone, email, address from public FB pages

5. **Google Maps Validation** - Places API  
   Phone and website validation

6. **Website Crawl** - Contact page scraping  
   Phone, email, social links from dealer websites

---

## Tables

### `dealers` - Primary Dealer Table

```sql
CREATE TABLE dealers (
    dealer_no TEXT PRIMARY KEY,           -- Allied Air 8-digit ID
    dealer_name TEXT NOT NULL,            -- From Allied API (often ALL CAPS)
    display_name TEXT,                    -- Clean name for reels (proper case, "and" not "&")
    distributor_name TEXT,
    
    -- Program status
    program_status TEXT,                  -- 'FULL' or 'CONTENT'
    source TEXT,                          -- Where dealer originated
    first_post_date TEXT,                 -- When we started posting
    date_added TEXT,
    
    -- Contact info (from Allied API / Excel)
    contact_name TEXT,
    contact_first_name TEXT,              -- Derived from contact_name
    contact_email TEXT,
    contact_phone TEXT,
    contact_admin_email TEXT,
    
    -- Turnkey program info (from Allied)
    turnkey_phone TEXT,
    turnkey_url TEXT,
    turnkey_email TEXT,
    
    -- Location
    address TEXT,
    city TEXT,
    state TEXT,
    region TEXT,                          -- 'NORTH', 'SOUTH', 'CANADA'
    dealer_address TEXT,                  -- From Excel
    dealer_city TEXT,
    dealer_state TEXT,
    dealer_web_address TEXT,
    
    -- Brands
    armstrong_air INTEGER,                -- 1 = carries Armstrong Air
    airease INTEGER,                      -- 1 = carries AirEase
    tier TEXT,                            -- 'PROARM', 'CTEAM', etc.
    
    -- CREATOMATE FIELDS (validated for automation)
    creatomate_phone TEXT,                -- Formatted phone for reels (e.g., "719-599-5447")
    creatomate_website TEXT,              -- Validated website domain
    creatomate_logo TEXT,                 -- Google Drive URL to logo file
    
    -- Validation tracking
    phone_source TEXT,                    -- Where validated phone came from
    qa_confirmed TEXT,                    -- First QA pass complete
    ready_for_automate TEXT,              -- 'yes' = logo resized + all fields validated
    
    -- Social
    facebook_page_id TEXT,                -- FB numeric page ID (for posting API)
    sprout_profile TEXT,                  -- Sprout Social profile name
    has_sprout INTEGER DEFAULT 0,         -- In Sprout (we have message access)
    has_sprout_excel INTEGER,             -- From Excel Sprout column
    has_fb_admin_access INTEGER DEFAULT 0,
    
    -- Allied API fields
    allied_status TEXT,
    registration_date TEXT,
    renew_date TEXT,
    note TEXT,
    bad_email INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TEXT,
    updated_at TEXT,
    last_api_sync TEXT
);
```

#### Key Field Explanations

| Field | Purpose | Example |
|-------|---------|---------|
| `dealer_name` | Raw name from Allied API | "ADVANTAGE HEATING & COOLING" |
| `display_name` | Clean name for videos | "Advantage Heating and Cooling" |
| `creatomate_phone` | Formatted for video overlay | "269-966-9595" |
| `creatomate_website` | Domain only, validated | "hotairnow.com" |
| `creatomate_logo` | Google Drive share link | "https://drive.google.com/file/d/..." |
| `ready_for_automate` | All fields validated | "yes" or NULL |

---

### `dealer_contacts` - Multi-Source Contact Tracking

Tracks ALL contact info found from every source. One dealer can have many phone numbers, emails, etc.

```sql
CREATE TABLE dealer_contacts (
    id INTEGER PRIMARY KEY,
    dealer_no TEXT REFERENCES dealers(dealer_no),
    
    contact_type TEXT,        -- 'phone', 'email', 'website', 'social'
    contact_subtype TEXT,     -- 'business_line', 'turnkey', 'facebook', etc.
    value TEXT NOT NULL,
    
    source TEXT,              -- 'allied_api', 'google_maps', 'website_crawl', etc.
    source_date TEXT,
    confidence TEXT,          -- 'high', 'medium', 'low'
    
    is_validated INTEGER,
    use_for_creatomate INTEGER,  -- This is THE one to use for posts
    
    UNIQUE(dealer_no, contact_type, value)
);
```

#### Contact Type + Subtype Examples

| Type | Subtype | Source | Example |
|------|---------|--------|---------|
| phone | turnkey | excel_source | 5742774240 |
| phone | contact | excel_source | 5742774240 |
| phone | business_line | google_maps | 5742774240 |
| phone | facebook | manual_lookup | 5742774240 |
| email | turnkey | excel_source | info@alltempsouthbend.com |
| email | contact | excel_source | owner@alltempsouthbend.com |
| email | facebook | facebook | info@alltempsouthbend.com |
| website | main | website_crawl | alltempsouthbend.com |
| social | facebook | manual_lookup | https://facebook.com/alltempsouthbend |
| social | instagram | website_crawl | https://instagram.com/alltempsouthbend |

---

## Current Data Status (124 FULL Dealers)

| Data Point | Count | % | Notes |
|------------|-------|---|-------|
| Phone | 124/124 | 100% | All have creatomate_phone |
| Name | 123/124 | 99% | 1 missing display_name |
| Website | 121/124 | 98% | 3 no website |
| Logo | 122/124 | 98% | 2 need logos |
| Facebook ID | 124/124 | 100% | All have FB page ID |
| **Ready for Automation** | **95/124** | **77%** | Logo resized + QA |

---

## Import Scripts

| Script | Purpose | Source File |
|--------|---------|-------------|
| `import_excel_full.py` | Import all 28 columns from Excel SOT | Dealers - Current.xlsm |
| `import_sprout.py` | Import Facebook Page IDs from Sprout | Profiles_*.csv |
| `import_facebook_results.py` | Import Apify FB scraper data | dataset_facebook-pages-scraper_*.json |
| `import_logos.py` | Import logo URLs from Creatomate Excel | Import Creatomate Data Validated.xlsx |
| `import_creatomate_validated.py` | Import all validated Creatomate fields | Import Creatomate Data Validated.xlsx |
| `import_missing_fb.py` | Manual FB page lookups | Hardcoded in script |
| `crawl_websites.py` | Scrape dealer websites for contacts | Dealer websites |

---

## Common Queries

### Dealers ready for automation
```sql
SELECT dealer_no, display_name, creatomate_phone, creatomate_website 
FROM dealers 
WHERE program_status = 'FULL' 
  AND ready_for_automate = 'yes';
```

### Dealers NOT ready (need work)
```sql
SELECT dealer_no, display_name,
       CASE WHEN creatomate_logo IS NULL THEN 'logo' ELSE '' END as missing
FROM dealers 
WHERE program_status = 'FULL'
  AND (ready_for_automate IS NULL OR ready_for_automate != 'yes');
```

### All contacts for a dealer
```sql
SELECT contact_type, contact_subtype, value, source, confidence
FROM dealer_contacts 
WHERE dealer_no = '8816'
ORDER BY contact_type, source;
```

### Summary by source
```sql
SELECT source, contact_type, COUNT(*) as count
FROM dealer_contacts 
GROUP BY source, contact_type
ORDER BY source, contact_type;
```

---

## Field Priority Logic

When multiple values exist, use this priority:

### Phone Number Priority
1. `creatomate_phone` (from Creatomate Validated Excel) ← **USE THIS**
2. `turnkey_phone` (from Allied Excel)
3. `contact_phone` (from Allied Excel)
4. `dealer_contacts` where source = 'facebook' AND confidence = 'high'
5. `dealer_contacts` where source = 'google_maps'

### Website Priority
1. `creatomate_website` (validated) ← **USE THIS**
2. `turnkey_url`
3. `dealer_web_address`
4. `dealer_contacts` where contact_type = 'website'

### Name Priority
1. `display_name` (clean, proper case) ← **USE THIS**
2. `dealer_name` (from Allied, often ALL CAPS)

---

## Why Multiple Sources?

Allied Air provides basic contact info, but it's often:
- ALL CAPS names
- Cell phone instead of business line
- Missing website
- Wrong/outdated info

We validate and enhance via:
1. **Google Maps** - Current business phone/website
2. **Website Crawl** - Contact page details
3. **Facebook** - Public business info
4. **Sprout Social** - FB Page IDs for posting
5. **Manual Lookup** - For edge cases

The `dealer_contacts` table preserves ALL sources so we can:
- Audit where data came from
- Re-validate if needed
- Handle conflicts intelligently

---

## Related Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant context |
| `docs/WORKFLOW_CURRENT.md` | 9-step manual workflow |
| `docs/DATA_ARCHITECTURE.md` | Architecture overview |
| `docs/DEALER_NAMES.md` | Name formatting rules |
