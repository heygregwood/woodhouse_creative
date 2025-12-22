import sqlite3
import time
from pathlib import Path
from scripts.email.send_email import send_email, load_template, render_template

# Read remaining dealer numbers from file
with open('holiday_remaining.txt', 'r') as f:
    failed_dealers = [line.strip() for line in f if line.strip() and not line.startswith('#')]

db_path = Path('data/sqlite/creative.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

template = load_template('holiday')

sent = 0
failed = 0
failed_list = []

print(f"Sending to {len(failed_dealers)} remaining dealers...")
print("-" * 50)

for dealer_no in failed_dealers:
    cursor.execute('''
        SELECT dealer_no, contact_first_name, contact_email
        FROM dealers 
        WHERE dealer_no = ?
    ''', (dealer_no,))
    
    row = cursor.fetchone()
    if not row or not row['contact_email']:
        continue
    
    first_name = row['contact_first_name'] or 'there'
    email = row['contact_email']
    
    html = render_template(template, {'first_name': first_name})
    
    result = send_email(
        to_email=email,
        subject='Thanks for a great year',
        html_body=html,
        from_name='Greg Wood',
        from_email='greg@woodhouseagency.com'
    )
    
    if result.get('success'):
        sent += 1
    else:
        failed += 1
        failed_list.append({'dealer_no': dealer_no, 'email': email, 'error': result.get('error')})
    
    if sent % 25 == 0 and sent > 0:
        print(f"Progress: {sent}/{len(failed_dealers)} sent...")
    
    time.sleep(0.6)

conn.close()

print("-" * 50)
print(f"COMPLETE: {sent} sent, {failed} failed")

if failed_list:
    print("\nFailed:")
    for f in failed_list:
        print(f"  {f['dealer_no']}: {f['email']} - {f['error']}")
