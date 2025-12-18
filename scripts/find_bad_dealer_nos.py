#!/usr/bin/env python3
"""Find the rows with problematic dealer numbers in Excel."""

import pandas as pd
from pathlib import Path

EXCEL_DIR = Path("/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database")
DEALERS_FILE = EXCEL_DIR / "Turnkey Social Media - Dealers - Current.xlsm"

df = pd.read_excel(DEALERS_FILE, sheet_name='Woodhouse Data', engine='openpyxl')

print("Looking for problematic dealer numbers...")
print(f"Total rows: {len(df)}")

for idx, row in df.iterrows():
    dealer_no = row.get('Dealer No')
    dealer_name = row.get('Dealer Name')
    
    # Check for scientific notation or very small numbers
    if pd.notna(dealer_no):
        val_str = str(dealer_no)
        if 'e' in val_str.lower() or (isinstance(dealer_no, float) and dealer_no < 1):
            print(f"\nRow {idx + 2} (Excel row number):")  # +2 for 1-based + header
            print(f"  Dealer No (raw): {dealer_no}")
            print(f"  Dealer No (str): {val_str}")
            print(f"  Dealer Name: {dealer_name}")
            print(f"  Source: {row.get('Source')}")
