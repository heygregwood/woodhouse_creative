#!/usr/bin/env python3
import sqlite3
DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("SELECT display_name, creatomate_logo FROM dealers WHERE display_name LIKE '%Brotherton%'")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]}")
conn.close()
