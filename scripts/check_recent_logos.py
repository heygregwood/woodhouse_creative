#!/usr/bin/env python3
import sqlite3
from datetime import datetime, timedelta

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Check for recently updated logos (within last hour)
print("=== Recently Updated Logos (last 2 hours) ===")
cur.execute("""
    SELECT dealer_no, display_name, logo_source, updated_at 
    FROM dealers 
    WHERE updated_at > datetime('now', '-2 hours')
    ORDER BY updated_at DESC
""")
for row in cur.fetchall():
    print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]}")

print("\n=== Logo Sources Breakdown ===")
cur.execute("""
    SELECT logo_source, COUNT(*) as cnt 
    FROM dealers 
    WHERE program_status = 'FULL'
    GROUP BY logo_source
""")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]}")

conn.close()
