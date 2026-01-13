#!/usr/bin/env python3
"""
Import logos from Creatomate Excel file.
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
    
    # Load Excel
    xl = pd.ExcelFile(EXCEL_PATH)
    print(f"Sheets: {xl.sheet_names}")
    
    # Try first sheet
    df = pd.read_excel(xl, sheet_name=0)
    print(f"\nColumns: {list(df.columns)}")
    print(f"Rows: {len(df)}")
    print(f"\nFirst 5 rows:")
    print(df.head().to_string())
    
    # Check for logo column
    logo_cols = [c for c in df.columns if 'logo' in c.lower()]
    print(f"\nLogo columns found: {logo_cols}")

if __name__ == "__main__":
    main()
