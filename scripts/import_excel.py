#!/usr/bin/env python3
"""
Import Allied Air dealer data from Excel to SQLite.
Creates the database schema and imports data from:
1. Turnkey Social Media - Dealers - Current.xlsm (Woodhouse Data tab)
2. Turnkey SM - FOR POSTING - BY REGION.xlsx (scheduling data)
"""

import sqlite3
import pandas as pd
from pathlib import Path
from datetime import datetime
import re
import json

# Paths
EXCEL_DIR = Path("/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database")
DEALERS_FILE = EXCEL_DIR / "Turnkey Social Media - Dealers - Current.xlsm"
SCHEDULE_FILE = EXCEL_DIR / "Turnkey SM  -  FOR POSTING - BY REGION.xlsx"
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

def create_database():
    """Create SQLite database with schema."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Drop existing tables for clean import
    cursor.executescript("""
        DROP TABLE IF EXISTS post_schedule;
        DROP TABLE IF EXISTS posts;
        DROP TABLE IF EXISTS removed_dealers;
        DROP TABLE IF EXISTS api_sync_log;
        DROP TABLE IF EXISTS dealers;
    """)
    
    # Create dealers table
    cursor.execute("""
        CREATE TABLE dealers (
            dealer_no TEXT PRIMARY KEY,
            dealer_name TEXT NOT NULL,
            distributor_name TEXT,
            
            -- Program status
            program_status TEXT CHECK(program_status IN ('FULL', 'CONTENT')),
            source TEXT,
            first_post_date TEXT,
            date_added TEXT,
            
            -- Contact info
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
            region TEXT CHECK(region IN ('NORTH', 'SOUTH', 'CANADA', NULL)),
            
            -- Brands
            has_armstrong_air INTEGER DEFAULT 0,
            has_airease INTEGER DEFAULT 0,
            tier TEXT,
            
            -- Validation status
            is_name_validated INTEGER DEFAULT 0,
            is_phone_validated INTEGER DEFAULT 0,
            is_website_validated INTEGER DEFAULT 0,
            is_logo_validated INTEGER DEFAULT 0,
            
            -- Logo
            logo_url TEXT,
            logo_source TEXT,
            
            -- Social
            sprout_profile TEXT,
            facebook_page_id TEXT,
            has_fb_admin_access INTEGER DEFAULT 0,
            
            -- Allied API fields
            allied_status TEXT,
            registration_date TEXT,
            renew_date TEXT,
            notes TEXT,
            bad_email INTEGER DEFAULT 0,
            
            -- Timestamps
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_api_sync TEXT
        )
    """)
    
    # Create removed_dealers table
    cursor.execute("""
        CREATE TABLE removed_dealers (
            dealer_no TEXT PRIMARY KEY,
            dealer_name TEXT,
            distributor_name TEXT,
            program_status TEXT,
            first_post_date TEXT,
            removed_date TEXT,
            removal_reason TEXT,
            original_data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create posts table
    cursor.execute("""
        CREATE TABLE posts (
            post_id INTEGER PRIMARY KEY,
            post_number INTEGER NOT NULL,
            base_copy TEXT,
            notes TEXT,
            screenshot_path TEXT,
            cta_type TEXT,
            scheduled_date TEXT,
            region TEXT CHECK(region IN ('NORTH', 'SOUTH', 'CANADA', 'ALL')),
            template_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create post_schedule table
    cursor.execute("""
        CREATE TABLE post_schedule (
            id INTEGER PRIMARY KEY,
            post_id INTEGER REFERENCES posts(post_id),
            dealer_no TEXT REFERENCES dealers(dealer_no),
            scheduled_date TEXT,
            posted_date TEXT,
            status TEXT CHECK(status IN ('SCHEDULED', 'POSTED', 'SKIPPED')),
            generated_copy TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create api_sync_log table
    cursor.execute("""
        CREATE TABLE api_sync_log (
            id INTEGER PRIMARY KEY,
            sync_type TEXT,
            started_at TEXT,
            completed_at TEXT,
            dealers_added INTEGER DEFAULT 0,
            dealers_removed INTEGER DEFAULT 0,
            dealers_updated INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indexes
    cursor.executescript("""
        CREATE INDEX idx_dealers_program_status ON dealers(program_status);
        CREATE INDEX idx_dealers_region ON dealers(region);
        CREATE INDEX idx_dealers_distributor ON dealers(distributor_name);
        CREATE INDEX idx_post_schedule_dealer ON post_schedule(dealer_no);
        CREATE INDEX idx_post_schedule_date ON post_schedule(scheduled_date);
    """)
    
    conn.commit()
    return conn

# Track dummy dealer numbers for standardization
_dummy_counter = 0

def clean_dealer_no(value):
    """Clean dealer number to string format.
    
    Handles:
    - Normal integers: 10231005 -> "10231005"
    - Floats: 10231005.0 -> "10231005"
    - Scientific notation (dummy numbers): 1e-07 -> "TEMP-001"
    - Very small decimals: 0.0000001 -> "TEMP-001"
    """
    global _dummy_counter
    
    if pd.isna(value):
        return None
    
    # Check for scientific notation or very small numbers (dummy dealer numbers)
    if isinstance(value, float):
        if value < 1 or 'e' in str(value).lower():
            _dummy_counter += 1
            return f"TEMP-{_dummy_counter:03d}"
    
    # Convert to string
    s = str(value)
    
    # Handle scientific notation in string form
    if 'e' in s.lower():
        _dummy_counter += 1
        return f"TEMP-{_dummy_counter:03d}"
    
    # Handle regular floats (remove decimal)
    if '.' in s:
        s = s.split('.')[0]
    
    return s.strip() if s else None

def clean_date(value):
    """Convert date to ISO format string."""
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d')
    if isinstance(value, str):
        return value
    return str(value)

def clean_bool(value):
    """Convert to boolean integer (0 or 1)."""
    if pd.isna(value):
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    s = str(value).lower().strip()
    return 1 if s in ('yes', 'y', 'true', '1', 'x') else 0

def normalize_program_status(value):
    """Normalize program status to FULL or CONTENT."""
    if pd.isna(value):
        return 'CONTENT'
    s = str(value).upper().strip()
    if s in ('FULL',):
        return 'FULL'
    # NEW, CONTENT, or anything else defaults to CONTENT
    return 'CONTENT'

def import_dealers(conn):
    """Import dealers from Excel Woodhouse Data tab."""
    print(f"Reading {DEALERS_FILE}...")
    
    df = pd.read_excel(DEALERS_FILE, sheet_name='Woodhouse Data', engine='openpyxl')
    
    print(f"Found {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    # Map Excel columns to database columns
    # Based on earlier inspection, columns are:
    # Program Status, First Post Date, Source, Dealer No, Date Added, Distributor Branch Name,
    # Dealer Name, Status, Armstrong Air, AirEase, Tier, TurnkeyPhone, TurnkeyURL, TurnkeyEmail,
    # Contact Name, Contact Email Address, Contact Phone, Contact Admin Email Address,
    # Dealer Address, Dealer City, Dealer State, Dealer Web Address, Registration Date,
    # Renew Date, NOTE, Sprout, Bad Email, Contact First Name
    
    cursor = conn.cursor()
    imported = 0
    skipped = 0
    
    for idx, row in df.iterrows():
        dealer_no = clean_dealer_no(row.get('Dealer No'))
        
        if not dealer_no:
            print(f"  Row {idx}: Skipping - no dealer number")
            skipped += 1
            continue
        
        dealer_name = str(row.get('Dealer Name', '')).strip() if pd.notna(row.get('Dealer Name')) else None
        
        if not dealer_name:
            print(f"  Row {idx}: Skipping dealer {dealer_no} - no name")
            skipped += 1
            continue
        
        try:
            cursor.execute("""
                INSERT INTO dealers (
                    dealer_no, dealer_name, distributor_name,
                    program_status, source, first_post_date, date_added,
                    contact_name, contact_first_name, contact_email, contact_phone, contact_admin_email,
                    turnkey_phone, turnkey_url, turnkey_email, website,
                    address, city, state,
                    has_armstrong_air, has_airease, tier,
                    sprout_profile, allied_status, registration_date, renew_date, notes, bad_email
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                dealer_no,
                dealer_name,
                str(row.get('Distributor Branch Name', '')).strip() if pd.notna(row.get('Distributor Branch Name')) else None,
                normalize_program_status(row.get('Program Status')),
                str(row.get('Source', '')).strip() if pd.notna(row.get('Source')) else None,
                clean_date(row.get('First Post Date')),
                clean_date(row.get('Date Added')),
                str(row.get('Contact Name', '')).strip() if pd.notna(row.get('Contact Name')) else None,
                str(row.get('Contact First Name', '')).strip() if pd.notna(row.get('Contact First Name')) else None,
                str(row.get('Contact Email Address', '')).strip() if pd.notna(row.get('Contact Email Address')) else None,
                str(row.get('Contact Phone', '')).strip() if pd.notna(row.get('Contact Phone')) else None,
                str(row.get('Contact Admin Email Address', '')).strip() if pd.notna(row.get('Contact Admin Email Address')) else None,
                str(row.get('TurnkeyPhone', '')).strip() if pd.notna(row.get('TurnkeyPhone')) else None,
                str(row.get('TurnkeyURL', '')).strip() if pd.notna(row.get('TurnkeyURL')) else None,
                str(row.get('TurnkeyEmail', '')).strip() if pd.notna(row.get('TurnkeyEmail')) else None,
                str(row.get('Dealer Web Address', '')).strip() if pd.notna(row.get('Dealer Web Address')) else None,
                str(row.get('Dealer Address', '')).strip() if pd.notna(row.get('Dealer Address')) else None,
                str(row.get('Dealer City', '')).strip() if pd.notna(row.get('Dealer City')) else None,
                str(row.get('Dealer State', '')).strip() if pd.notna(row.get('Dealer State')) else None,
                clean_bool(row.get('Armstrong Air')),
                clean_bool(row.get('AirEase')),
                str(row.get('Tier', '')).strip() if pd.notna(row.get('Tier')) else None,
                str(row.get('Sprout', '')).strip() if pd.notna(row.get('Sprout')) else None,
                str(row.get('Status', '')).strip() if pd.notna(row.get('Status')) else None,
                clean_date(row.get('Registration Date')),
                clean_date(row.get('Renew Date')),
                str(row.get('NOTE', '')).strip() if pd.notna(row.get('NOTE')) else None,
                clean_bool(row.get('Bad Email'))
            ))
            imported += 1
        except Exception as e:
            print(f"  Row {idx}: Error importing {dealer_no} - {e}")
            skipped += 1
    
    conn.commit()
    print(f"\nImported {imported} dealers, skipped {skipped}")
    return imported

def import_removed_dealers(conn):
    """Import removed dealers from Excel."""
    print(f"\nReading removed dealers...")
    
    try:
        df = pd.read_excel(DEALERS_FILE, sheet_name='Removed Dealers', engine='openpyxl')
        print(f"Found {len(df)} removed dealers")
    except Exception as e:
        print(f"Could not read Removed Dealers tab: {e}")
        return 0
    
    cursor = conn.cursor()
    imported = 0
    
    for idx, row in df.iterrows():
        dealer_no = clean_dealer_no(row.get('Dealer No'))
        if not dealer_no:
            continue
        
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO removed_dealers (
                    dealer_no, dealer_name, distributor_name, program_status,
                    original_data
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                dealer_no,
                str(row.get('Dealer Name', '')).strip() if pd.notna(row.get('Dealer Name')) else None,
                str(row.get('Distributor Branch Name', '')).strip() if pd.notna(row.get('Distributor Branch Name')) else None,
                str(row.get('Program Status', '')).strip() if pd.notna(row.get('Program Status')) else None,
                json.dumps({k: str(v) if pd.notna(v) else None for k, v in row.items()})
            ))
            imported += 1
        except Exception as e:
            print(f"  Error importing removed dealer {dealer_no}: {e}")
    
    conn.commit()
    print(f"Imported {imported} removed dealers")
    return imported

def assign_regions(conn):
    """Assign regions based on scheduling file column presence."""
    print(f"\nAssigning regions from scheduling file...")
    
    cursor = conn.cursor()
    
    # Read each regional tab and extract dealer numbers from columns
    regions = {
        'Custom North': 'NORTH',
        'South': 'SOUTH', 
        'Canada': 'CANADA'
    }
    
    for tab_name, region_code in regions.items():
        try:
            df = pd.read_excel(SCHEDULE_FILE, sheet_name=tab_name, engine='openpyxl', header=None, nrows=1)
            # Dealer numbers are in the header row, starting around column G
            dealer_nos = []
            for col in df.columns[6:]:  # Skip first 6 columns (A-F are post data)
                val = df.iloc[0, col]
                dealer_no = clean_dealer_no(val)
                if dealer_no and dealer_no.isdigit() and len(dealer_no) >= 6:
                    dealer_nos.append(dealer_no)
            
            if dealer_nos:
                placeholders = ','.join(['?' for _ in dealer_nos])
                cursor.execute(f"""
                    UPDATE dealers SET region = ? WHERE dealer_no IN ({placeholders})
                """, [region_code] + dealer_nos)
                updated = cursor.rowcount
                print(f"  {tab_name}: Found {len(dealer_nos)} dealers, updated {updated} in database")
        except Exception as e:
            print(f"  Could not read {tab_name}: {e}")
    
    conn.commit()

def print_summary(conn):
    """Print database summary."""
    cursor = conn.cursor()
    
    print("\n" + "="*50)
    print("DATABASE SUMMARY")
    print("="*50)
    
    cursor.execute("SELECT COUNT(*) FROM dealers")
    total = cursor.fetchone()[0]
    print(f"\nTotal dealers: {total}")
    
    cursor.execute("SELECT program_status, COUNT(*) FROM dealers GROUP BY program_status")
    print("\nBy Program Status:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    cursor.execute("SELECT region, COUNT(*) FROM dealers GROUP BY region")
    print("\nBy Region:")
    for row in cursor.fetchall():
        region = row[0] if row[0] else 'UNASSIGNED'
        print(f"  {region}: {row[1]}")
    
    cursor.execute("SELECT distributor_name, COUNT(*) FROM dealers GROUP BY distributor_name ORDER BY COUNT(*) DESC LIMIT 10")
    print("\nTop 10 Distributors:")
    for row in cursor.fetchall():
        dist = row[0] if row[0] else 'UNKNOWN'
        print(f"  {dist}: {row[1]}")
    
    cursor.execute("SELECT COUNT(*) FROM removed_dealers")
    removed = cursor.fetchone()[0]
    print(f"\nRemoved dealers (historical): {removed}")
    
    # Validation status
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN turnkey_phone IS NOT NULL AND turnkey_phone != '' THEN 1 ELSE 0 END) as has_phone,
            SUM(CASE WHEN turnkey_url IS NOT NULL AND turnkey_url != '' THEN 1 ELSE 0 END) as has_url,
            SUM(CASE WHEN website IS NOT NULL AND website != '' THEN 1 ELSE 0 END) as has_website
        FROM dealers
    """)
    row = cursor.fetchone()
    print(f"\nData Quality:")
    print(f"  Has turnkey phone: {row[0]}/{total}")
    print(f"  Has turnkey URL: {row[1]}/{total}")
    print(f"  Has website: {row[2]}/{total}")
    
    print(f"\nDatabase saved to: {DB_PATH}")

def main():
    print("="*50)
    print("WOODHOUSE CREATIVE - EXCEL TO SQLITE IMPORT")
    print("="*50)
    print(f"\nTimestamp: {datetime.now().isoformat()}")
    
    # Create database
    print("\nCreating database schema...")
    conn = create_database()
    
    # Import dealers
    import_dealers(conn)
    
    # Import removed dealers
    import_removed_dealers(conn)
    
    # Assign regions from scheduling file
    assign_regions(conn)
    
    # Print summary
    print_summary(conn)
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
