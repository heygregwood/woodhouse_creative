#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

print("=== Dealers Needing Logo Design (logo_needs_design = 1) ===\n")
cur.execute("""
    SELECT dealer_no, display_name, creatomate_website
    FROM dealers 
    WHERE logo_needs_design = 1
    ORDER BY display_name
""")

count = 0
for row in cur.fetchall():
    count += 1
    print(f"{count}. {row[1]}")
    print(f"   Website: {row[2]}")
    print()

print(f"Total: {count} dealers need logo design")

conn.close()
