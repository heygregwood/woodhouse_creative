#!/usr/bin/env python3
import sqlite3
conn = sqlite3.connect('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')
cur = conn.cursor()
cur.execute("SELECT dealer_no, display_name, creatomate_logo FROM dealers WHERE program_status='FULL' AND (ready_for_automate IS NULL OR ready_for_automate != 'yes') ORDER BY display_name")
for row in cur.fetchall():
    print(f"{row[0]}|{row[1]}|{row[2]}")
conn.close()
