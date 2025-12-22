#!/usr/bin/env python3
import sqlite3
DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("SELECT dealer_no, display_name, program_status FROM dealers WHERE display_name LIKE '%Winst%' OR display_name LIKE '%Winstead%'")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"{r[0]} | {r[1]} | {r[2]}")
else:
    print("No dealer found matching 'Winst' or 'Winstead'")
conn.close()
