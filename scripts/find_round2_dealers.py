#!/usr/bin/env python3
"""Find dealers that likely need Round 2 review - those with NULL logo_source 
(meaning they haven't been manually reviewed/updated recently)"""
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# The 7 new selected have logo_source set (brandfetch/website)
# The ones still needing review have logo_source = NULL or were set before today

print("=== Dealers with logo_source NULL (likely need Round 2 review) ===")
cur.execute("""
    SELECT dealer_no, display_name, creatomate_logo, logo_source
    FROM dealers 
    WHERE program_status = 'FULL' 
      AND creatomate_logo IS NOT NULL
      AND logo_source IS NULL
    ORDER BY display_name
""")
count = 0
for row in cur.fetchall():
    count += 1
    print(f"{count}. {row[1]} ({row[0]})")

print(f"\nTotal: {count} dealers")

conn.close()
