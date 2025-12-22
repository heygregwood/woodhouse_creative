#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Update Ron's
cur.execute("""
    UPDATE dealers SET 
      creatomate_logo = ?,
      display_name = COALESCE(display_name, ?),
      logo_source = 'manual',
      updated_at = CURRENT_TIMESTAMP
    WHERE dealer_no = ?
""", ('https://drive.google.com/file/d/1A-J07vDDLeleYEshHz25thNapHcVOqvd/view?usp=drive_link', "Ron's Heating and Cooling", '10122026'))

# Update Eco
cur.execute("""
    UPDATE dealers SET 
      creatomate_logo = ?,
      logo_source = 'manual',
      updated_at = CURRENT_TIMESTAMP
    WHERE dealer_no = ?
""", ('https://drive.google.com/file/d/1n5WdH9P-gqHLxldJABeoicUBVDzmxnCW/view?usp=drive_link', 'TEMP-002'))

conn.commit()

# Verify
cur.execute("SELECT dealer_no, display_name, creatomate_logo FROM dealers WHERE dealer_no IN ('10122026', 'TEMP-002')")
for row in cur.fetchall():
    print(f"{row[0]} | {row[1]} | {row[2]}")

conn.close()
print("\nDone!")
