#!/usr/bin/env python3
"""Inspect the scheduling spreadsheet header structure."""

import pandas as pd
from pathlib import Path

EXCEL_DIR = Path("/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database")
SCHEDULE_FILE = EXCEL_DIR / "Turnkey SM  -  FOR POSTING - BY REGION.xlsx"

# Read Custom North tab - first 15 rows to see header structure
df = pd.read_excel(SCHEDULE_FILE, sheet_name='Custom North', engine='openpyxl', header=None, nrows=15)

print("Custom North - First 15 rows, columns F through L:")
print("="*80)

for row_idx in range(min(15, len(df))):
    print(f"\nRow {row_idx}:")
    for col_idx in range(5, min(12, len(df.columns))):  # Columns F through L (0-indexed: 5-11)
        val = df.iloc[row_idx, col_idx]
        if pd.notna(val):
            print(f"  Col {col_idx} ({chr(65+col_idx)}): {val}")
