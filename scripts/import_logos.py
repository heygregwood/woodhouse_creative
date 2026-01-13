#!/usr/bin/env python3
"""
Import logos from Creatomate Excel file into dealers table.
"""
import os
import pandas as pd
import sqlite3
from pathlib import Path
from datetime import datetime

WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')
EXCEL_PATH = Path(f'/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Creative Automation/Import Creatomate Data Validated.xlsx')
DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')

def main():
    print("=" * 70)
    print("IMPORT LOGOS FROM CREATOMATE EXCEL")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Load Excel
    df = pd.read_excel(EXCEL_PATH, sheet_name='Data')
    print(f"Loaded {len(df)} rows from Creatomate Excel\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    stats = {'updated': 0, 'no_logo': 0, 'not_found': 0}
    
    for _, row in df.iterrows():
        dealer_no = str(int(row['Dealer No'])) if pd.notna(row['Dealer No']) else None
        if not dealer_no:
            continue
        
        logo_url = row.get('Creatomate Logo')
        if pd.isna(logo_url) or not logo_url or str(logo_url).strip() == '':
            stats['no_logo'] += 1
            continue
        
        logo_url = str(logo_url).strip()
        
        # Check if dealer exists in our DB
        cursor.execute("SELECT dealer_no FROM dealers WHERE dealer_no = ?", (dealer_no,))
        if not cursor.fetchone():
            stats['not_found'] += 1
            continue
        
        # Update logo
        cursor.execute("""
            UPDATE dealers SET creatomate_logo = ?
            WHERE dealer_no = ?
        """, (logo_url, dealer_no))
        
        if cursor.rowcount > 0:
            stats['updated'] += 1
            dealer_name = row.get('Creatomate  Company Name') or row.get('Dealer Name') or 'Unknown'
            print(f"✓ {dealer_name[:40]}")
    
    conn.commit()
    
    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"Logos imported: {stats['updated']}")
    print(f"No logo in Excel: {stats['no_logo']}")
    print(f"Dealer not in DB: {stats['not_found']}")
    
    # Check final status
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN creatomate_logo IS NOT NULL AND creatomate_logo != '' THEN 1 ELSE 0 END) as has_logo,
            SUM(CASE WHEN creatomate_logo IS NULL OR creatomate_logo = '' THEN 1 ELSE 0 END) as needs_logo,
            COUNT(*) as total
        FROM dealers WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"\nFULL Dealers:")
    print(f"  Has logo:   {row[0]}/{row[2]}")
    print(f"  Needs logo: {row[1]}/{row[2]}")
    
    # List dealers still missing logos
    if row[1] > 0:
        print(f"\nDealers still missing logos:")
        cursor.execute("""
            SELECT dealer_no, display_name
            FROM dealers 
            WHERE program_status = 'FULL'
              AND (creatomate_logo IS NULL OR creatomate_logo = '')
            ORDER BY display_name
        """)
        for d in cursor.fetchall():
            print(f"  {d[0]}: {d[1]}")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
