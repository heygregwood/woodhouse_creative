import sqlite3
import time
from pathlib import Path
from scripts.email.send_email import send_email, load_template, render_template

db_path = Path('data/sqlite/creative.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get all CONTENT and FULL dealers with emails
cursor.execute('''
    SELECT dealer_no, contact_first_name, contact_email, program_status
    FROM dealers 
    WHERE program_status IN ('CONTENT', 'FULL') 
    AND contact_email IS NOT NULL 
    AND contact_email != ''
    ORDER BY program_status, dealer_no
''')

dealers = cursor.fetchall()
conn.close()

# Load template once
template = load_template('holiday')

sent = 0
failed = 0
failed_list = []

print(f"Sending holiday email to {len(dealers)} dealers...")
print("-" * 50)

for dealer in dealers:
    first_name = dealer['contact_first_name'] or 'there'
    email = dealer['contact_email']
    
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
        failed_list.append({'dealer_no': dealer['dealer_no'], 'email': email, 'error': result.get('error')})
    
    # Progress every 25
    if sent % 25 == 0:
        print(f"Progress: {sent}/{len(dealers)} sent...")
    
    # Small delay to avoid rate limits
    time.sleep(0.1)

print("-" * 50)
print(f"COMPLETE: {sent} sent, {failed} failed")

if failed_list:
    print("\nFailed emails:")
    for f in failed_list:
        print(f"  {f['dealer_no']}: {f['email']} - {f['error']}")
