#!/usr/bin/env python3
import sqlite3
conn = sqlite3.connect('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL' AND creatomate_logo LIKE '%drive.google.com%'")
print(f"FULL dealers with Drive logos: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL' AND logo_source = 'manual'")
print(f"FULL dealers with logo_source='manual': {cur.fetchone()[0]}")
conn.close()
