#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Add column for tracking "needs design" status
try:
    cur.execute("ALTER TABLE dealers ADD COLUMN logo_needs_design INTEGER DEFAULT 0")
    print("Added logo_needs_design column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("Column already exists")
    else:
        raise

conn.commit()
conn.close()
print("Done!")
