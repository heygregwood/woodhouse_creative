#!/usr/bin/env python3
"""
Update dealer logos from Greg's Excel mapping.
Excel format: Column A = dealer name, Column B = logo filename with hyperlink to Google Drive
Matched by row - row 1 col A maps to row 1 col B.
"""
import sqlite3
import json
import openpyxl

EXCEL_PATH = '/home/heygregwood/woodhouse_creative/data/logo_mappings.xlsx'
DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
LOG_PATH = '/home/heygregwood/woodhouse_creative/logs/logo_update.log'

# Load Excel
wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb.active

# Extract mappings
mappings = []
for row in ws.iter_rows(min_row=1):
    excel_name = (row[0].value or "").strip()
    hyperlink = row[1].hyperlink.target if row[1].hyperlink else ""
    
    if excel_name and hyperlink:
        # Convert open?id= to standard format
        if 'open?id=' in hyperlink:
            file_id = hyperlink.split('open?id=')[1].split('&')[0]
            drive_url = f"https://drive.google.com/file/d/{file_id}/view?usp=drive_link"
        else:
            drive_url = hyperlink
        mappings.append({"excel_name": excel_name, "url": drive_url})

print(f"Loaded {len(mappings)} mappings from Excel")

# Load DB dealers
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("SELECT dealer_no, display_name FROM dealers WHERE program_status = 'FULL' ORDER BY display_name")
db_dealers = [(row[0], row[1]) for row in cur.fetchall()]
print(f"Found {len(db_dealers)} FULL dealers in database")

# Match by index (row order)
updated = 0
mismatches = []
log_lines = []

for i, (dealer_no, db_name) in enumerate(db_dealers):
    if i < len(mappings):
        excel_name = mappings[i]["excel_name"]
        drive_url = mappings[i]["url"]
        
        # Normalize for comparison
        def norm(s): return s.lower().replace(',', '').replace('.', '').replace('&', 'and').replace('  ', ' ').strip()
        
        if norm(excel_name) == norm(db_name):
            # Match - update DB
            cur.execute("""
                UPDATE dealers 
                SET creatomate_logo = ?, logo_source = 'manual', logo_needs_design = 0, updated_at = CURRENT_TIMESTAMP
                WHERE dealer_no = ?
            """, (drive_url, dealer_no))
            updated += 1
            log_lines.append(f"OK: {db_name}")
        else:
            mismatches.append({
                "row": i + 1,
                "db_name": db_name,
                "excel_name": excel_name
            })
            log_lines.append(f"MISMATCH row {i+1}: DB='{db_name}' vs Excel='{excel_name}'")

conn.commit()
conn.close()

# Write log
import os
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
with open(LOG_PATH, 'w') as f:
    f.write('\n'.join(log_lines))

# Output summary
print(f"\n=== RESULTS ===")
print(f"Updated: {updated}")
print(f"Mismatches: {len(mismatches)}")

if mismatches:
    print(f"\n=== MISMATCHES (rename these in Drive) ===")
    for m in mismatches:
        print(f"Row {m['row']}: DB='{m['db_name']}' | Excel='{m['excel_name']}'")
