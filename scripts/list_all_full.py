#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("""
    SELECT dealer_no, display_name, creatomate_website, creatomate_logo
    FROM dealers 
    WHERE program_status = 'FULL'
    ORDER BY display_name
""")

print("=== ALL FULL DEALERS (124) ===\n")

count = 0
for row in cur.fetchall():
    count += 1
    dealer_no, display_name, website, logo = row
    has_logo = "✅" if logo and 'drive.google.com' in str(logo) else "❌"
    print(f"{count}. {display_name or '[No Name]'}")
    print(f"   Dealer#: {dealer_no} | Website: {website or 'None'} | Logo: {has_logo}")
    print()

print(f"Total: {count} dealers")

conn.close()
