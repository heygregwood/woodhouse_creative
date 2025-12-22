#!/usr/bin/env python3
import sqlite3

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Update Eco Systems
cur.execute("""
    UPDATE dealers 
    SET creatomate_phone = '435-227-6046', updated_at = CURRENT_TIMESTAMP
    WHERE display_name = 'Eco Systems Heating and Air'
""")
print(f"Eco Systems Heating and Air: updated phone to 435-227-6046 ({cur.rowcount} row)")

# Update Ron's
cur.execute("""
    UPDATE dealers 
    SET creatomate_phone = '740-922-5252', updated_at = CURRENT_TIMESTAMP
    WHERE display_name = "Ron's Heating and Cooling"
""")
print(f"Ron's Heating and Cooling: updated phone to 740-922-5252 ({cur.rowcount} row)")

conn.commit()
conn.close()
print("\nDone. All 124 FULL dealers ready for creative automation.")
