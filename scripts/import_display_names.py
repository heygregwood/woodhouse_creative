#!/usr/bin/env python3
"""Extract display_name (Company Name) from scheduling spreadsheet and update SQLite."""

import os
import pandas as pd
import sqlite3
from pathlib import Path

WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')
EXCEL_DIR = Path(f"/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database")
SCHEDULE_FILE = EXCEL_DIR / "Turnkey SM  -  FOR POSTING - BY REGION.xlsx"
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

def clean_dealer_no(value):
    """Clean dealer number to string."""
    if pd.isna(value):
        return None
    s = str(value)
    if '.' in s:
        s = s.split('.')[0]
    return s.strip() if s else None

def extract_display_names():
    """Extract dealer_no -> display_name mapping from all regional tabs."""
    
    tabs = ['Custom North', 'South', 'Canada']
    mappings = {}
    
    for tab in tabs:
        print(f"\nProcessing {tab}...")
        try:
            df = pd.read_excel(SCHEDULE_FILE, sheet_name=tab, engine='openpyxl', header=None)
            
            # Row 0 has dealer numbers starting at column H (index 7) or I (index 8)
            # Row 10 has company names
            # Find which row has "Dealer Number" label and "Company Name" label
            
            dealer_no_row = None
            company_name_row = None
            
            for row_idx in range(min(15, len(df))):
                cell_val = df.iloc[row_idx, 5] if len(df.columns) > 5 else None  # Column F
                if pd.notna(cell_val):
                    if 'dealer' in str(cell_val).lower() and 'number' in str(cell_val).lower():
                        dealer_no_row = row_idx
                    elif 'company' in str(cell_val).lower() and 'name' in str(cell_val).lower():
                        company_name_row = row_idx
            
            if dealer_no_row is None or company_name_row is None:
                print(f"  Could not find header rows (dealer_no_row={dealer_no_row}, company_name_row={company_name_row})")
                continue
            
            print(f"  Dealer Number row: {dealer_no_row}, Company Name row: {company_name_row}")
            
            # Extract dealer numbers and company names from columns G onwards
            # Skip column F (labels) and G (reference/test)
            start_col = 8  # Column I (0-indexed)
            
            found = 0
            for col_idx in range(start_col, len(df.columns)):
                dealer_no = clean_dealer_no(df.iloc[dealer_no_row, col_idx])
                company_name = df.iloc[company_name_row, col_idx]
                
                if dealer_no and pd.notna(company_name):
                    company_name = str(company_name).strip()
                    if company_name and company_name.lower() != 'nan':
                        mappings[dealer_no] = company_name
                        found += 1
            
            print(f"  Found {found} dealer/company name pairs")
            
        except Exception as e:
            print(f"  Error reading {tab}: {e}")
    
    return mappings

def update_database(mappings):
    """Update display_name in SQLite database."""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updated = 0
    not_found = []
    
    for dealer_no, display_name in mappings.items():
        cursor.execute("""
            UPDATE dealers 
            SET display_name = ?
            WHERE dealer_no = ?
        """, (display_name, dealer_no))
        
        if cursor.rowcount > 0:
            updated += 1
        else:
            not_found.append(dealer_no)
    
    conn.commit()
    
    print(f"\nUpdated {updated} dealers with display_name")
    if not_found:
        print(f"Dealer numbers not found in database: {not_found[:10]}{'...' if len(not_found) > 10 else ''}")
    
    # Show summary
    cursor.execute("""
        SELECT 
            program_status,
            SUM(CASE WHEN display_name IS NOT NULL THEN 1 ELSE 0 END) as has_display_name,
            SUM(CASE WHEN display_name IS NULL THEN 1 ELSE 0 END) as needs_display_name
        FROM dealers
        GROUP BY program_status
    """)
    
    print("\nDisplay name status by program:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} have display_name, {row[2]} need it")
    
    conn.close()

def main():
    print("="*60)
    print("EXTRACT DISPLAY NAMES FROM SCHEDULING SPREADSHEET")
    print("="*60)
    
    mappings = extract_display_names()
    print(f"\nTotal mappings found: {len(mappings)}")
    
    # Show sample
    print("\nSample mappings:")
    for i, (dealer_no, name) in enumerate(list(mappings.items())[:5]):
        print(f"  {dealer_no} -> {name}")
    
    update_database(mappings)
    print("\nDone!")

if __name__ == "__main__":
    main()
