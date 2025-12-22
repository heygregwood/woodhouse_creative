#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Clear needs_design for Ron's and Brothertons since they have logos
cur.execute("""
    UPDATE dealers 
    SET logo_needs_design = 0 
    WHERE (display_name LIKE '%Ron%Heating%' OR display_name LIKE '%Brotherton%')
    AND creatomate_logo IS NOT NULL
""")

print(f"Updated {cur.rowcount} dealers")

conn.commit()
conn.close()
