#!/usr/bin/env python3
"""Deep dive into Creatomate validation sheet - focus on validation columns."""

import pandas as pd
from pathlib import Path

CREATOMATE_FILE = Path("/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Creative Automation/Import Creatomate Data Validated.xlsx")

df = pd.read_excel(CREATOMATE_FILE, sheet_name='Data', engine='openpyxl')

print("="*80)
print("CREATOMATE VALIDATION SHEET ANALYSIS")
print("="*80)

print(f"\nTotal rows: {len(df)}")

# Key validation columns
validation_cols = [
    'Dealer No',
    'Dealer Name',           # From Allied API
    'SCH Dealer Name',       # From scheduling spreadsheet?
    'Creatomate  Company Name',  # Validated name for Creatomate
    'TurnkeyPhone',          # Original phone
    'Phone',                 # Validated phone?
    'Creatomate Company Phone',  # Final phone for Creatomate
    'Phone Source',          # Where phone came from
    'Dealer Web Address',    # Original website
    'Website',               # Validated website?
    'Creatomate Web Address',  # Final for Creatomate
    'Creatomate Logo',       # Google Drive link
    'Ready for automate',    # Ready flag
    'QA Confirmed',          # QA status
    'Customized Live',       # In production?
]

print("\n### VALIDATION COLUMNS ###")
for col in validation_cols:
    if col in df.columns:
        non_null = df[col].notna().sum()
        print(f"  {col}: {non_null}/{len(df)} populated")
    else:
        print(f"  {col}: NOT FOUND")

# Look at a few complete rows
print("\n### SAMPLE COMPLETE ROWS (with key validation fields) ###")
sample_cols = ['Dealer No', 'Dealer Name', 'Creatomate  Company Name', 'Creatomate Company Phone', 'Creatomate Web Address', 'Creatomate Logo', 'Ready for automate']
print(df[sample_cols].head(10).to_string())

# Check Ready for automate values
print("\n### 'Ready for automate' values ###")
print(df['Ready for automate'].value_counts(dropna=False))

# Check QA Confirmed values
print("\n### 'QA Confirmed' values ###")
print(df['QA Confirmed'].value_counts(dropna=False))

# Logo analysis
print("\n### Logo Links ###")
logo_col = 'Creatomate Logo'
has_logo = df[logo_col].notna() & (df[logo_col] != '')
print(f"Dealers with logo link: {has_logo.sum()}/{len(df)}")

# Show sample logo links
print("\nSample logo links:")
for idx, row in df[has_logo].head(3).iterrows():
    print(f"  {row['Dealer No']}: {row[logo_col][:80]}...")
