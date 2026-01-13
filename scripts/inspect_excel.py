import os
import pandas as pd

WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')
file1 = f"/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm"

print("WOODHOUSE DATA - Full Column List:")
print("="*60)
df = pd.read_excel(file1, sheet_name="Woodhouse Data")
for i, col in enumerate(df.columns):
    print(f"{i+1}. {col}")

print(f"\nTotal rows: {len(df)}")
print(f"\nProgram Status values:")
print(df["Program Status"].value_counts())

print("\n\nSample data (first 3 rows, key columns):")
key_cols = ["Program Status", "Dealer No", "Dealer Name", "Distributor Branch Name", "First Post Date"]
print(df[key_cols].head(3).to_string())
