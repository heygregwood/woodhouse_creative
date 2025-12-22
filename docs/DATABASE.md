# Woodhouse Creative - Database Documentation

**Last Updated:** December 21, 2025
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
| **Ready for Automate** | Logo resized/rebuilt AND all Creatomate fields validated. **124/124 ready.** |
| **Region** | Geographic region: `NORTH`, `SOUTH`, or `CANADA`. Used for scheduling and reporting. |

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
| Display Name | 124/124 | 100% | All have display_name |
| Phone | 124/124 | 100% | All have creatomate_phone |
| Website | 121/124 | 98% | 3 no website (expected) |
| Logo | 124/124 | 100% | All have creatomate_logo |
| Facebook ID | 124/124 | 100% | All have FB page ID |
| Region | 124/124 | 100% | NORTH: 81, SOUTH: 39, CANADA: 4 |
| **Ready for Automation** | **124/124** | **100%** | All ready ✅ |

---

## Scripts

### Import Scripts

| Script | Purpose | Source File |
|--------|---------|-------------|
| `import_excel_full.py` | Import all 28 columns from Excel SOT | Dealers - Current.xlsm |
| `import_sprout.py` | Import Facebook Page IDs from Sprout | Profiles_*.csv |
| `import_facebook_results.py` | Import Apify FB scraper data | dataset_facebook-pages-scraper_*.json |
| `import_logos.py` | Import logo URLs from Creatomate Excel | Import Creatomate Data Validated.xlsx |
| `import_creatomate_validated.py` | Import all validated Creatomate fields | Import Creatomate Data Validated.xlsx |
| `import_missing_fb.py` | Manual FB page lookups | Hardcoded in script |
| `crawl_websites.py` | Scrape dealer websites for contacts | Dealer websites |

### Automation Scripts

| Script | Purpose | Notes |
|--------|---------|-------|
| `sync_spreadsheet.py` | Sync dealer data to Google Sheets | Syncs rows 5-11 from database |
| `batch_render.py` | Batch render videos via Creatomate | Uploads to Google Drive |
| `email_sender/send_email.py` | Send dealer emails via Resend | Auto-updates spreadsheet status |
| `update_dealer_status.py` | Promote/demote dealers | CONTENT <-> FULL status changes |
| `gmail_monitor.gs` | Apps Script for Gmail | Monitors FB admin emails |
| `export_full_dealers.py` | Export CSV for Creatomate | All 124 FULL dealers |

---

## Scheduling Spreadsheet Structure

The scheduling spreadsheet (`1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY`) is synced from the database.

### Row Structure

| Row | Field | Source | Notes |
|-----|-------|--------|-------|
| 1 | Dealer Number | Manual | Primary key for column matching |
| 2 | Schedule Email Status | Olivia | Dropdown: Pending, Done, Email Sent |
| 3 | Last Post Date | Olivia | When posts were last scheduled |
| 4 | Who Posted | Olivia | Who scheduled the posts |
| 5 | First Name | Database | `contact_first_name` |
| 6 | Email | Database | `contact_email` |
| 7 | Region | Database | NORTH, SOUTH, or CANADA |
| 8 | Website | Database | `creatomate_website` |
| 9 | Phone | Database | `creatomate_phone` |
| 10 | Distributor | Database | `dealer_name` from Allied |
| 11 | Display Name | Database | Clean name for posts |
| 12+ | Post Rows | Both | Post number, base copy, personalized copy per dealer |

### Sync Process

1. **Database → Spreadsheet**: `sync_spreadsheet.py --sync-dealers` updates rows 5-11
2. **Post Copy**: `sync_spreadsheet.py --post 666` replaces `{phone}`, `{website}`, `{name}` in base copy
3. **Email Status**: `send_email.py` auto-updates row 2 to "Email Sent" after sending

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

### Region breakdown
```sql
SELECT region, COUNT(*) as count
FROM dealers
WHERE program_status = 'FULL'
GROUP BY region;
-- Result: NORTH: 81, SOUTH: 39, CANADA: 4
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

## Google Drive Resources

All automation files in: `Shared drives/Woodhouse Social/Creative Automation/Scheduling Spreadsheet/`

| Resource | File ID | Purpose |
|----------|---------|---------|
| Scheduling Spreadsheet | `1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY` | Dealer columns, post rows, Olivia's workflow |
| Posts Excel (No Images) | `1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE` | Post archive - read/write by automation |
| Dealers Folder | `1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv` | Individual dealer folders (logos, videos) |

---

## Posts Excel Structure

The Posts Excel file contains all approved social media posts (656+ posts as of December 2025).

### Columns

| Column | Field | Description |
|--------|-------|-------------|
| A | Post # | Sequential post number (1-656+) |
| B | Season | Fall, Winter, Spring, Summer |
| C | Post Copy | Social media copy text with placeholders `{name}`, `{phone}`, `{website}` |
| D | Image | Image reference (manual updates only) |
| E | Subject Matter | Topic category (heating, cooling, maintenance, etc.) |
| F | Tag 1 | Primary content tag |
| G | Tag 2 | Secondary content tag |
| H | Tag 3 | Tertiary content tag |
| I | Notes | Creation date or notes |
| J | Comments | Additional comments |
| K | AAE APPROVED | Approval status from Allied Air |

### Usage

1. **Read posts by number**: Fetch row where Column A = post number
2. **Filter by season**: Query Column B for seasonal campaigns
3. **Find by subject**: Search Column E for topic-based selection
4. **Populate spreadsheet**: Replace placeholders in Column C with dealer data

---

## Related Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant context |
| `docs/WORKFLOW_CURRENT.md` | 9-step manual workflow |
| `docs/DATA_ARCHITECTURE.md` | Architecture overview |
| `docs/DEALER_NAMES.md` | Name formatting rules |
