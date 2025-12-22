import sqlite3
from pathlib import Path

db_path = Path('data/sqlite/creative.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Count by status
cursor.execute('''
    SELECT program_status, COUNT(*) 
    FROM dealers 
    WHERE program_status IN ('CONTENT', 'FULL') 
    AND contact_email IS NOT NULL 
    AND contact_email != ''
    GROUP BY program_status
''')
print('Dealers with emails by status:')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]}')

# Total
cursor.execute('''
    SELECT COUNT(*) 
    FROM dealers 
    WHERE program_status IN ('CONTENT', 'FULL') 
    AND contact_email IS NOT NULL 
    AND contact_email != ''
''')
total = cursor.fetchone()[0]
print(f'\nTOTAL: {total}')

# Also show those without emails
cursor.execute('''
    SELECT COUNT(*) 
    FROM dealers 
    WHERE program_status IN ('CONTENT', 'FULL') 
    AND (contact_email IS NULL OR contact_email = '')
''')
no_email = cursor.fetchone()[0]
print(f'Missing emails: {no_email}')

conn.close()
