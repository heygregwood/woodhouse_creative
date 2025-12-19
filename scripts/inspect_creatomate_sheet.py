#!/usr/bin/env python3
"""Inspect the Creatomate validation sheet."""

import pandas as pd
from pathlib import Path

CREATOMATE_FILE = Path("/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Creative Automation/Import Creatomate Data Validated.xlsx")

# Get sheet names
xl = pd.ExcelFile(CREATOMATE_FILE, engine='openpyxl')
print("Sheet names:")
for sheet in xl.sheet_names:
    print(f"  - {sheet}")

print("\n" + "="*80)

# Read each sheet and show structure
for sheet in xl.sheet_names:
    print(f"\n### {sheet} ###")
    df = pd.read_excel(CREATOMATE_FILE, sheet_name=sheet, engine='openpyxl')
    print(f"Rows: {len(df)}, Columns: {len(df.columns)}")
    print(f"Columns: {list(df.columns)}")
    
    # Show first few rows
    print("\nFirst 5 rows:")
    print(df.head().to_string())
    print("\n" + "-"*80)
