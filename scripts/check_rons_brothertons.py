#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Check Ron's and Brothertons
cur.execute("""
    SELECT dealer_no, display_name, creatomate_logo, logo_needs_design
    FROM dealers 
    WHERE display_name LIKE '%Ron%' OR display_name LIKE '%Brotherton%'
""")
for row in cur.fetchall():
    print(f"{row[1]}: logo={row[2][:50] if row[2] else 'None'}... needs_design={row[3]}")

conn.close()
