#!/usr/bin/env python3
import sqlite3
import csv

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
OUTPUT_PATH = '/home/heygregwood/woodhouse_creative/data/full_dealers_for_creatomate.csv'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("""
    SELECT display_name, creatomate_phone, creatomate_website, creatomate_logo
    FROM dealers 
    WHERE program_status = 'FULL'
    ORDER BY display_name
""")

rows = cur.fetchall()

with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Business Name', 'Phone', 'Website', 'Logo URL'])
    for row in rows:
        writer.writerow(row)

print(f"Exported {len(rows)} dealers to {OUTPUT_PATH}")
conn.close()
