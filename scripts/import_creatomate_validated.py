#!/usr/bin/env python3
"""
Import validated Creatomate fields - these are the FINAL fields for creative automation.
These override the source of truth because they've been manually validated.

Fields:
- Phone Source: where the validated phone came from
- Facebook Page ID: manually looked up
- QA Confirmed: first data quality check
- Creatomate Company Phone: formatted for reels (with spaces/dashes)
- Creatomate Company Name: validated name from website (not ALL CAPS)
- Creatomate Web Address: validated website
- Creatomate Logo: Google Drive URL
- Ready for automate: logo resized + all fields validated
"""
import os
import pandas as pd
import sqlite3
import re
from pathlib import Path
from datetime import datetime

WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')
EXCEL_PATH = Path(f'/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Creative Automation/Import Creatomate Data Validated.xlsx')
DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')

def clean_str(val):
    """Clean string value."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s if s else None

def main():
    print("=" * 70)
    print("IMPORT CREATOMATE VALIDATED FIELDS")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Load Excel
    df = pd.read_excel(EXCEL_PATH, sheet_name='Data')
    print(f"Loaded {len(df)} rows from Creatomate Excel")
    print(f"\nRelevant columns:")
    for col in df.columns:
        if any(x in col.lower() for x in ['creatomate', 'phone source', 'facebook', 'qa', 'ready', 'contact']):
            print(f"  - {col}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Add new columns if needed
    new_columns = [
        ('phone_source', 'TEXT'),
        ('qa_confirmed', 'TEXT'),
        ('ready_for_automate', 'TEXT'),
    ]
    
    for col_name, col_type in new_columns:
        try:
            cursor.execute(f"ALTER TABLE dealers ADD COLUMN {col_name} {col_type}")
            print(f"Added column: {col_name}")
        except:
            pass
    
    conn.commit()
    
    stats = {'updated': 0, 'not_found': 0}
    
    print(f"\n{'=' * 70}")
    print("IMPORTING VALIDATED DATA")
    print("=" * 70)
    
    for _, row in df.iterrows():
        dealer_no = str(int(row['Dealer No'])) if pd.notna(row['Dealer No']) else None
        if not dealer_no:
            continue
        
        # Check if dealer exists
        cursor.execute("SELECT dealer_no, display_name FROM dealers WHERE dealer_no = ?", (dealer_no,))
        result = cursor.fetchone()
        if not result:
            stats['not_found'] += 1
            continue
        
        # Get values from Excel
        phone_source = clean_str(row.get('Phone Source'))
        fb_page_id = row.get('Facebook Page ID')
        if pd.notna(fb_page_id):
            fb_page_id = str(int(fb_page_id)) if isinstance(fb_page_id, float) else str(fb_page_id)
        else:
            fb_page_id = None
        qa_confirmed = clean_str(row.get('QA Confirmed'))
        creatomate_phone = clean_str(row.get('Creatomate Company Phone'))
        creatomate_name = clean_str(row.get('Creatomate  Company Name'))  # Note: two spaces in column name
        creatomate_website = clean_str(row.get('Creatomate Web Address'))
        creatomate_logo = clean_str(row.get('Creatomate Logo'))
        ready_for_automate = clean_str(row.get('Ready for automate'))
        
        # Derive contact_first_name from Contact Name if not already set
        contact_name = clean_str(row.get('Contact Name'))
        contact_first = clean_str(row.get('Contact First Name'))
        if not contact_first and contact_name:
            contact_first = contact_name.split()[0] if contact_name else None
        
        # Update dealer record - ONLY update if we have a value (don't overwrite with NULL)
        updates = []
        params = []
        
        if phone_source:
            updates.append("phone_source = ?")
            params.append(phone_source)
        
        if fb_page_id:
            updates.append("facebook_page_id = ?")
            params.append(fb_page_id)
        
        if qa_confirmed:
            updates.append("qa_confirmed = ?")
            params.append(qa_confirmed)
        
        if creatomate_phone:
            updates.append("creatomate_phone = ?")
            params.append(creatomate_phone)
        
        if creatomate_name:
            updates.append("display_name = ?")
            params.append(creatomate_name)
        
        if creatomate_website:
            updates.append("creatomate_website = ?")
            params.append(creatomate_website)
        
        if creatomate_logo:
            updates.append("creatomate_logo = ?")
            params.append(creatomate_logo)
        
        if ready_for_automate:
            updates.append("ready_for_automate = ?")
            params.append(ready_for_automate)
        
        if contact_first:
            updates.append("contact_first_name = ?")
            params.append(contact_first)
        
        if updates:
            params.append(dealer_no)
            sql = f"UPDATE dealers SET {', '.join(updates)} WHERE dealer_no = ?"
            cursor.execute(sql, params)
            stats['updated'] += 1
            
            name = creatomate_name or result[1] or 'Unknown'
            ready = '✓' if ready_for_automate and ready_for_automate.lower() == 'yes' else ' '
            print(f"[{ready}] {name[:45]}")
    
    conn.commit()
    
    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"Updated: {stats['updated']}")
    print(f"Not found in DB: {stats['not_found']}")
    
    # Check ready for automate status
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN ready_for_automate = 'yes' THEN 1 ELSE 0 END) as ready,
            SUM(CASE WHEN ready_for_automate IS NULL OR ready_for_automate != 'yes' THEN 1 ELSE 0 END) as not_ready,
            COUNT(*) as total
        FROM dealers WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"\nReady for Automation:")
    print(f"  Ready:     {row[0]}/{row[2]}")
    print(f"  Not Ready: {row[1]}/{row[2]}")
    
    # Final data completeness
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN creatomate_phone IS NOT NULL AND creatomate_phone != '' THEN 1 ELSE 0 END) as has_phone,
            SUM(CASE WHEN display_name IS NOT NULL AND display_name != '' THEN 1 ELSE 0 END) as has_name,
            SUM(CASE WHEN creatomate_website IS NOT NULL AND creatomate_website != '' THEN 1 ELSE 0 END) as has_website,
            SUM(CASE WHEN creatomate_logo IS NOT NULL AND creatomate_logo != '' THEN 1 ELSE 0 END) as has_logo,
            SUM(CASE WHEN facebook_page_id IS NOT NULL AND facebook_page_id != '' THEN 1 ELSE 0 END) as has_fb,
            COUNT(*) as total
        FROM dealers WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"\nData Completeness (FULL dealers):")
    print(f"  Phone:       {row[0]}/{row[5]}")
    print(f"  Name:        {row[1]}/{row[5]}")
    print(f"  Website:     {row[2]}/{row[5]}")
    print(f"  Logo:        {row[3]}/{row[5]}")
    print(f"  Facebook ID: {row[4]}/{row[5]}")
    
    # List dealers NOT ready for automate
    cursor.execute("""
        SELECT dealer_no, display_name, 
               CASE WHEN creatomate_phone IS NULL OR creatomate_phone = '' THEN 'phone' ELSE '' END,
               CASE WHEN display_name IS NULL OR display_name = '' THEN 'name' ELSE '' END,
               CASE WHEN creatomate_logo IS NULL OR creatomate_logo = '' THEN 'logo' ELSE '' END
        FROM dealers 
        WHERE program_status = 'FULL'
          AND (ready_for_automate IS NULL OR ready_for_automate != 'yes')
        ORDER BY display_name
    """)
    not_ready = cursor.fetchall()
    if not_ready:
        print(f"\n{len(not_ready)} dealers NOT ready for automation:")
        for d in not_ready[:20]:
            missing = ' '.join([x for x in [d[2], d[3], d[4]] if x]).strip()
            name = d[1] or f"[{d[0]}]"
            print(f"  {name[:40]:<40} missing: {missing or 'needs QA'}")
        if len(not_ready) > 20:
            print(f"  ... and {len(not_ready) - 20} more")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
