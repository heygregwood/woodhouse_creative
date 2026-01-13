#!/usr/bin/env python3
"""
Explore the source of truth Excel file structure.
"""
import os
import pandas as pd
from pathlib import Path

WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')
EXCEL_PATH = Path(f'/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm')

# Load all sheets
xl = pd.ExcelFile(EXCEL_PATH)
print("Sheets:", xl.sheet_names)

# Check the main sheet
for sheet in xl.sheet_names[:3]:
    print(f"\n{'='*60}")
    print(f"SHEET: {sheet}")
    print("="*60)
    df = pd.read_excel(xl, sheet_name=sheet)
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"\nFirst 3 rows:")
    print(df.head(3).to_string())
