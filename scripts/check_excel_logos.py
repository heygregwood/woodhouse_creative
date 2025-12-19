#!/usr/bin/env python3
"""Check Excel for logo-related columns."""
import pandas as pd
from pathlib import Path

EXCEL_PATH = Path('/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm')

df = pd.read_excel(EXCEL_PATH, sheet_name='Woodhouse Data')
print("All columns:")
for col in df.columns:
    print(f"  - {col}")

# Check for any logo-related columns
logo_cols = [c for c in df.columns if 'logo' in c.lower()]
print(f"\nLogo columns: {logo_cols}")
