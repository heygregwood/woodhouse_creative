# Woodhouse Creative - Data Architecture (Working Draft)

**Status:** Working Draft  
**Created:** December 18, 2025  
**Last Updated:** December 18, 2025

---

## Overview

This document describes the data architecture for Woodhouse Creative, the internal automation tool for Woodhouse Agency's Allied Air Turnkey Social Media program. The goal is to consolidate Excel-based workflows into a SQLite database for faster querying, better data quality, and integration with existing automation tools.

---

## Source Files

### File 1: Dealers - Current.xlsm (Source of Truth)

**Location:** `C:\Users\GregWood\OneDrive - woodhouseagency.com\Woodhouse Business\Woodhouse_Agency\Clients\AAE\Turnkey Social Media\Dealer Database\Turnkey Social Media - Dealers - Current.xlsm`

**Purpose:** Master dealer database synchronized with Allied Air API

**Key Tabs:**

| Tab | Purpose |
|-----|---------|
| `Woodhouse Data` | **Primary source of truth** - 336 active dealers |
| `New Dealers` | Incoming dealers from Allied Air API (staging) |
| `Removed Dealers` | Historical record of dropped dealers |
| `Data From Allied Air API` | Raw API response data |
| `Activity Log` | Sync operation history |
| `Bad Emails` | Dealers with invalid email addresses |

**Woodhouse Data Columns (28 total):**
1. Program Status
2. First Post Date
3. Source
4. Dealer No (PRIMARY KEY - assigned by Allied Air)
5. Date Added
6. Distributor Branch Name
7. Dealer Name
8. Status
9. Armstrong Air (brand flag)
10. AirEase (brand flag)
11. Tier
12. TurnkeyPhone
13. TurnkeyURL
14. TurnkeyEmail
15. Contact Name
16. Contact Email Address
17. Contact Phone
18. Contact Admin Email Address
19. Dealer Address
20. Dealer City
21. Dealer State
22. Dealer Web Address
23. Registration Date
24. Renew Date
25. NOTE
26. Sprout (Sprout Social profile name)
27. Bad Email (flag)
28. Contact First Name

**Program Status Values:**
- `FULL` (124 dealers) - Full turnkey service. We have Facebook admin access and handle scheduling + posting.
- `CONTENT` (209 dealers) - Content only. We create content, they post it themselves. Default status for new dealers.
- `NEW` (3 dealers) - Recently joined, same as CONTENT. Just a visual reminder.

**Status Transition:**
```
NEW SIGNUP → CONTENT (default)
                ↓
    [Facebook admin invitation received]
                ↓
              FULL
```

**Source Field:**
- `API` - Imported from Allied Air API via Azure Function
- Manual entry - Dealer signed up via Woodhouse webform (may have dummy Dealer No until Allied assigns one)

**Azure Function Integration:**
- "Find New Dealers" button triggers API sync
- Pulls from Allied Air OData API
- Updates New Dealers and Removed Dealers tabs
- Net result: Woodhouse Data tab updated with additions/removals
- "Post Program Results" pushes changes back to Allied Air API

---

### File 2: FOR POSTING - BY REGION.xlsx (Scheduling Grid)

**Location:** `C:\Users\GregWood\OneDrive - woodhouseagency.com\Woodhouse Business\Woodhouse_Agency\Clients\AAE\Turnkey Social Media\Dealer Database\Turnkey SM  -  FOR POSTING - BY REGION.xlsx`

**Purpose:** Post scheduling and copy generation via Excel formulas

**Key Tabs:**

| Tab | Purpose |
|-----|---------|
| `Custom North` | Northern region dealers - cold weather content |
| `South` | Southern region dealers - warm weather content |
| `Canada` | Canadian dealers |
| `Removed` | Historical dealer numbers (for reference) |
| `For Mail Merge` | Email merge data (placeholder, not in use) |
| `Formulas Helper` | Formula reference for copy generation |

**Grid Structure:**
- **Rows 1-10:** Header data with CTA options and dealer info lookup
- **Columns A-E:** Post data (Post #, Notes, Base Copy, Screenshot, Date)
- **Column F:** Reference/test column for formula validation
- **Columns G+:** Dealer numbers across the top

**Dealer Data in Header (pulled via VLOOKUP from Dealers file):**
- Dealer Number
- Schedule Email Status
- First Name
- Email
- Region
- Last Post Date
- Who Posted
- Website
- Phone
- Distributor
- Company Name

**Post Copy Generation:**
- Base copy in Column C contains template text with CTAs
- Excel formulas dynamically insert dealer-specific data (name, phone, website)
- CTAs referenced from Columns A-B (CTA1-CTA8 options like "Call us", "Visit", "Learn more")

**Custom vs Non-Custom Dealers:**

| Type | Visual | Description |
|------|--------|-------------|
| Custom (green) | Personalized copy | Validated: name ✓, phone ✓, website ✓, logo ✓ |
| Non-Custom (tan) | Date only | Missing validation - needs data cleanup before customization |

**Regional Split (Geography-based):**
- `Custom North` / `North` - Cold weather regions (winter-focused content)
- `South` - Warm weather regions (different seasonal messaging)
- `Canada` - Canadian dealers (metric, Canadian holidays, etc.)

---

## Dealer Number (Primary Key)

**Format:** 8-digit number assigned by Allied Air (e.g., `10231005`)

**Important Notes:**
- Dealer Number is THE unique identifier across all systems
- Some manual webform signups have temporary/dummy numbers until Allied assigns official one
- Edge case: Dealer drops out and re-enrolls → Same name/address but NEW Dealer Number
- Historical Dealer Numbers in "Removed" tab must be preserved for:
  - Allied Air MSA compliance
  - Prospect Engine disposition rules
  - Reporting continuity

---

## Validation Checklist for Custom Posts

A dealer is "ready for customization" when all four items are validated:

| Item | Source | Validation |
|------|--------|------------|
| Company Name | Allied API / Manual | Clean, properly cased |
| Phone | Allied API / Google Maps | 10-digit, formatted |
| Website | Allied API / Crawl | Valid domain, resolves |
| Logo | Google Drive / Brandfetch | High quality, correct format |

**Existing Tools for Validation:**
- `prospect_engine` - Google Maps scraping, website crawling
- `woodhouse_social` - Brandfetch API for logo fetching
- Manual review for edge cases

---

## Allied Air API Integration

**Documentation:** See `/mnt/user-data/uploads/Rest_API_specification_Turnkey_Social_Media__1_.pdf`

**Authentication:** OAuth 2.0 client credentials flow

**Key Endpoints:**
- Full dealer feed
- Turnkey-enrolled dealers only (`turnkeySocialMediaOptIn eq 1`)
- Delta feed (changes since date)
- Single dealer lookup by Dealer Number

**Data Available from API:**
- dealerNo
- dealerName
- distributorName
- status
- turnkeySocialMediaOptIn
- turnkeySocialMediaOptInDate
- turnkeySocialMediaOptOutDate
- aaeDealerContacts (name, phone, email)
- aaeDealerBrands (ARM, AIR, CON, COM, DUC)
- aaeDealerLocations (address, city, state, region)

---

## Proposed SQLite Schema

### Database Location
`~/woodhouse_creative/data/sqlite/creative.db`

### Tables

#### 1. dealers (Primary dealer table)
```sql
CREATE TABLE dealers (
    dealer_no TEXT PRIMARY KEY,  -- Allied Air assigned, 8-digit
    dealer_name TEXT NOT NULL,   -- From Allied API (ALL CAPS, with &)
    display_name TEXT,           -- Clean name for posts/folders (proper case, no &)
    distributor_name TEXT,
    
    -- Program status
    program_status TEXT CHECK(program_status IN ('FULL', 'CONTENT')),
    source TEXT,  -- 'API' or 'MANUAL'
    first_post_date DATE,
    date_added DATE,
    
    -- Contact info (from Allied API)
    contact_name TEXT,
    contact_first_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    contact_admin_email TEXT,
    
    -- Public info (for posts)
    turnkey_phone TEXT,
    turnkey_url TEXT,
    turnkey_email TEXT,
    website TEXT,
    
    -- Location
    address TEXT,
    city TEXT,
    state TEXT,
    region TEXT CHECK(region IN ('NORTH', 'SOUTH', 'CANADA')),
    
    -- Brands
    has_armstrong_air INTEGER DEFAULT 0,
    has_airease INTEGER DEFAULT 0,
    tier TEXT,
    
    -- Validation status
    is_name_validated INTEGER DEFAULT 0,
    is_phone_validated INTEGER DEFAULT 0,
    is_website_validated INTEGER DEFAULT 0,
    is_logo_validated INTEGER DEFAULT 0,
    is_custom_ready INTEGER GENERATED ALWAYS AS (
        is_name_validated AND is_phone_validated AND 
        is_website_validated AND is_logo_validated
    ) STORED,
    
    -- Logo
    logo_url TEXT,  -- Google Drive or Brandfetch URL
    logo_source TEXT,  -- 'DRIVE', 'BRANDFETCH', 'MANUAL'
    
    -- Social
    sprout_profile TEXT,
    facebook_page_id TEXT,
    has_fb_admin_access INTEGER DEFAULT 0,
    
    -- Meta
    allied_status TEXT,  -- Status from Allied API
    registration_date DATE,
    renew_date DATE,
    notes TEXT,
    bad_email INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_api_sync DATETIME
);
```

#### 2. removed_dealers (Historical reference)
```sql
CREATE TABLE removed_dealers (
    dealer_no TEXT PRIMARY KEY,
    dealer_name TEXT,
    distributor_name TEXT,
    program_status TEXT,
    first_post_date DATE,
    removed_date DATE,
    removal_reason TEXT,  -- 'DROPPED', 'REMOVED_ADMIN', 'OPTED_OUT'
    
    -- Preserve all original data for MSA compliance
    original_data JSON,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. posts (Post schedule and content)
```sql
CREATE TABLE posts (
    post_id INTEGER PRIMARY KEY,
    post_number INTEGER NOT NULL,  -- e.g., 663, 665, 660
    
    -- Content
    base_copy TEXT,
    notes TEXT,
    screenshot_path TEXT,
    cta_type TEXT,  -- 'CALL', 'VISIT', 'LEARN_MORE', etc.
    
    -- Scheduling
    scheduled_date DATE,
    region TEXT CHECK(region IN ('NORTH', 'SOUTH', 'CANADA', 'ALL')),
    
    -- Creatomate
    template_id TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. post_schedule (Dealer-specific scheduling)
```sql
CREATE TABLE post_schedule (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(post_id),
    dealer_no TEXT REFERENCES dealers(dealer_no),
    
    -- Status
    scheduled_date DATE,
    posted_date DATE,
    status TEXT CHECK(status IN ('SCHEDULED', 'POSTED', 'SKIPPED')),
    
    -- Generated content
    generated_copy TEXT,  -- Dealer-specific copy with name/phone/website
    
    -- Tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. api_sync_log (Allied Air API sync history)
```sql
CREATE TABLE api_sync_log (
    id INTEGER PRIMARY KEY,
    sync_type TEXT,  -- 'FULL', 'DELTA', 'PUSH'
    started_at DATETIME,
    completed_at DATETIME,
    dealers_added INTEGER DEFAULT 0,
    dealers_removed INTEGER DEFAULT 0,
    dealers_updated INTEGER DEFAULT 0,
    error_message TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Integration with Other Repos

### prospect_engine
- `allied_dealers` table contains 7,105 Allied Air dealers
- `communication_segment` field tracks outreach status
- Must respect disposition rules from Allied Air MSA
- `removed_dealers` in woodhouse_creative should sync to update `was_turnkey_ever` flag

### woodhouse_social
- Firestore `businesses` collection has 28 dealers
- `renderQueue` and `renderBatches` for Creatomate automation
- Brandfetch API integration for logo fetching
- Can share dealer data for video rendering

### woodhouse_dealer_dashboard
- Static HTML reports for dealer performance
- Uses JSON data embedded in pages
- 110 dealers currently tracked
- Could pull from SQLite for future updates

---

## Next Steps

1. **Create SQLite database** with schema above
2. **Import Woodhouse Data** from Excel (336 dealers)
3. **Import scheduling data** from regional tabs
4. **Build validation pipeline:**
   - Google Maps lookup for phone validation
   - Website crawl for domain validation
   - Brandfetch for logo options
5. **Create views/queries** for common operations:
   - Dealers needing validation
   - Custom-ready dealers by region
   - Sync status with Allied API
6. **Build export scripts** for:
   - Creatomate CSV import
   - Mail merge data
   - Performance reporting

---

## File References

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant context for this repo |
| `docs/DATA_ARCHITECTURE.md` | This document |
| `docs/WORKFLOW_CURRENT.md` | Current manual workflow (9 steps) |
| `scripts/import_excel.py` | Excel to SQLite import script |
| `scripts/validate_dealers.py` | Dealer validation pipeline |
| `data/sqlite/creative.db` | SQLite database |

---

## Change Log

| Date | Change |
|------|--------|
| 2025-12-18 | Initial working draft created |
