#!/usr/bin/env python3
"""Upload logos for Ron's and Eco Systems, then update database"""
import sqlite3
import os
from pathlib import Path

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

# Check current status
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("SELECT dealer_no, display_name, creatomate_website, creatomate_logo FROM dealers WHERE dealer_no IN ('10122026', 'TEMP-002')")
for row in cur.fetchall():
    print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]}")
conn.close()
