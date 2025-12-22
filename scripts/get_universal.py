#!/usr/bin/env python3
import sqlite3
conn = sqlite3.connect('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')
cur = conn.cursor()
cur.execute("SELECT display_name, creatomate_logo FROM dealers WHERE display_name LIKE '%Universal%'")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]}")
conn.close()
