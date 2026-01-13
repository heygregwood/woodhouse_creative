#!/usr/bin/env python3
"""
Import ALL fields from the source of truth Excel into the dealers table.
This is the master data source - every field should be captured.
"""
import os
import pandas as pd
import sqlite3
import re
from pathlib import Path
from datetime import datetime

WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')
EXCEL_PATH = Path(f'/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm')
DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')

def normalize_phone(phone):
    """Normalize phone to 10 digits."""
    if pd.isna(phone) or not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def clean_str(val):
    """Clean string value."""
    if pd.isna(val):
        return None
    return str(val).strip() if val else None

def main():
    print("=" * 70)
    print("IMPORT SOURCE OF TRUTH EXCEL - ALL FIELDS")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Load Excel
    df = pd.read_excel(EXCEL_PATH, sheet_name='Woodhouse Data')
    print(f"Loaded {len(df)} rows from Woodhouse Data sheet")
    print(f"Columns: {list(df.columns)}\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Add new columns if they don't exist
    new_columns = [
        ('first_post_date', 'TEXT'),
        ('source', 'TEXT'),
        ('date_added', 'TEXT'),
        ('armstrong_air', 'INTEGER'),
        ('airease', 'INTEGER'),
        ('tier', 'TEXT'),
        ('turnkey_phone', 'TEXT'),
        ('turnkey_url', 'TEXT'),
        ('turnkey_email', 'TEXT'),
        ('contact_name', 'TEXT'),
        ('contact_email', 'TEXT'),
        ('contact_phone', 'TEXT'),
        ('contact_admin_email', 'TEXT'),
        ('dealer_address', 'TEXT'),
        ('dealer_city', 'TEXT'),
        ('dealer_state', 'TEXT'),
        ('dealer_web_address', 'TEXT'),
        ('registration_date', 'TEXT'),
        ('renew_date', 'TEXT'),
        ('note', 'TEXT'),
        ('has_sprout_excel', 'INTEGER'),
        ('bad_email', 'TEXT'),
        ('contact_first_name', 'TEXT'),
    ]
    
    for col_name, col_type in new_columns:
        try:
            cursor.execute(f"ALTER TABLE dealers ADD COLUMN {col_name} {col_type}")
            print(f"Added column: {col_name}")
        except:
            pass  # Column exists
    
    conn.commit()
    
    # Process each row
    stats = {'updated': 0, 'not_found': 0, 'phones_added': 0}
    
    for _, row in df.iterrows():
        dealer_no = str(int(row['Dealer No'])) if pd.notna(row['Dealer No']) else None
        if not dealer_no:
            continue
        
        # Check if dealer exists
        cursor.execute("SELECT dealer_no FROM dealers WHERE dealer_no = ?", (dealer_no,))
        if not cursor.fetchone():
            stats['not_found'] += 1
            continue
        
        # Update all fields
        cursor.execute("""
            UPDATE dealers SET
                first_post_date = ?,
                source = ?,
                date_added = ?,
                armstrong_air = ?,
                airease = ?,
                tier = ?,
                turnkey_phone = ?,
                turnkey_url = ?,
                turnkey_email = ?,
                contact_name = ?,
                contact_email = ?,
                contact_phone = ?,
                contact_admin_email = ?,
                dealer_address = ?,
                dealer_city = ?,
                dealer_state = ?,
                dealer_web_address = ?,
                registration_date = ?,
                renew_date = ?,
                note = ?,
                has_sprout_excel = ?,
                bad_email = ?,
                contact_first_name = ?
            WHERE dealer_no = ?
        """, (
            clean_str(row.get('First Post Date')),
            clean_str(row.get('Source')),
            clean_str(row.get('Date Added')),
            1 if row.get('Armstrong Air') == True else 0,
            1 if row.get('AirEase') == True else 0,
            clean_str(row.get('Tier')),
            clean_str(row.get('TurnkeyPhone')),
            clean_str(row.get('TurnkeyURL')),
            clean_str(row.get('TurnkeyEmail')),
            clean_str(row.get('Contact Name')),
            clean_str(row.get('Contact Email Address')),
            clean_str(row.get('Contact Phone')),
            clean_str(row.get('Contact Admin Email Address')),
            clean_str(row.get('Dealer Address')),
            clean_str(row.get('Dealer City')),
            clean_str(row.get('Dealer State')),
            clean_str(row.get('Dealer Web Address')),
            clean_str(row.get('Registration Date')),
            clean_str(row.get('Renew Date')),
            clean_str(row.get('NOTE')),
            1 if str(row.get('Sprout', '')).upper() == 'YES' else 0,
            clean_str(row.get('Bad Email')),
            clean_str(row.get('Contact First Name')),
            dealer_no
        ))
        stats['updated'] += 1
    
    conn.commit()
    print(f"\nUpdated {stats['updated']} dealers with Excel data")
    print(f"Not found in DB: {stats['not_found']}")
    
    # Now update creatomate_phone from Excel sources
    print("\n" + "=" * 70)
    print("UPDATING CREATOMATE PHONES FROM EXCEL")
    print("=" * 70)
    
    # Priority: TurnkeyPhone > Contact Phone
    cursor.execute("""
        UPDATE dealers
        SET creatomate_phone = turnkey_phone
        WHERE program_status = 'FULL'
          AND (creatomate_phone IS NULL OR creatomate_phone = '')
          AND turnkey_phone IS NOT NULL 
          AND turnkey_phone != ''
    """)
    from_turnkey = cursor.rowcount
    print(f"Set creatomate_phone from TurnkeyPhone: {from_turnkey}")
    
    cursor.execute("""
        UPDATE dealers
        SET creatomate_phone = contact_phone
        WHERE program_status = 'FULL'
          AND (creatomate_phone IS NULL OR creatomate_phone = '')
          AND contact_phone IS NOT NULL 
          AND contact_phone != ''
    """)
    from_contact = cursor.rowcount
    print(f"Set creatomate_phone from Contact Phone: {from_contact}")
    
    conn.commit()
    
    # Add phones to dealer_contacts table too
    print("\nAdding Excel phones to dealer_contacts...")
    today = datetime.now().strftime('%Y-%m-%d')
    
    cursor.execute("""
        SELECT dealer_no, turnkey_phone, contact_phone 
        FROM dealers 
        WHERE program_status = 'FULL'
    """)
    
    phones_added = 0
    for dealer_no, turnkey_phone, contact_phone in cursor.fetchall():
        for phone, subtype in [(turnkey_phone, 'turnkey'), (contact_phone, 'contact')]:
            normalized = normalize_phone(phone)
            if normalized:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, confidence)
                        VALUES (?, 'phone', ?, ?, 'excel_source', ?, 'high')
                    """, (dealer_no, subtype, normalized, today))
                    if cursor.rowcount > 0:
                        phones_added += 1
                except: pass
    
    conn.commit()
    print(f"Added {phones_added} phone records to dealer_contacts")
    
    # Final status
    print("\n" + "=" * 70)
    print("FINAL STATUS - FULL DEALERS")
    print("=" * 70)
    
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN creatomate_phone IS NOT NULL AND creatomate_phone != '' THEN 1 ELSE 0 END) as has_phone,
            SUM(CASE WHEN creatomate_website IS NOT NULL AND creatomate_website != '' THEN 1 ELSE 0 END) as has_website,
            SUM(CASE WHEN facebook_page_id IS NOT NULL AND facebook_page_id != '' THEN 1 ELSE 0 END) as has_fb,
            COUNT(*) as total
        FROM dealers WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"Has phone:    {row[0]}/{row[3]}")
    print(f"Has website:  {row[1]}/{row[3]}")
    print(f"Has Facebook: {row[2]}/{row[3]}")
    
    # Show any still missing phone
    cursor.execute("""
        SELECT dealer_no, display_name, turnkey_phone, contact_phone
        FROM dealers 
        WHERE program_status = 'FULL'
          AND (creatomate_phone IS NULL OR creatomate_phone = '')
        ORDER BY display_name
    """)
    missing = cursor.fetchall()
    if missing:
        print(f"\n{len(missing)} dealers STILL missing creatomate_phone:")
        for d in missing:
            print(f"  {d[0]}: {d[1]} (turnkey: {d[2]}, contact: {d[3]})")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
