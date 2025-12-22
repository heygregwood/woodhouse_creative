#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("""
    SELECT display_name
    FROM dealers 
    WHERE program_status = 'FULL'
    ORDER BY display_name
""")

for row in cur.fetchall():
    print(row[0] or '[No Name]')

conn.close()
