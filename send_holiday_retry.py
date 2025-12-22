import sqlite3
import time
from pathlib import Path
from scripts.email.send_email import send_email, load_template, render_template

# Failed dealer numbers from first run
failed_dealers = [
    '10020109', '10020211', '10020364', '10020459', '10026103', '10034002', '10114005', '10117000',
    '10129024', '10129028', '10140005', '10145031', '10148009', '10148033', '10156018', '10168010',
    '10183015', '10188023', '10189013', '10197011', '10200010', '10200012', '10221000', '10223031',
    '10226008', '10227013', '10229003', '10229005', '10231005', '10231023', '10233009', '10235015',
    '10239039', '10245023', '10246057', '10251025', '10257032', '102809', '10283018', '10289051',
    '103010', '10306027', '10324020', '10324037', '10324039', '10326011', '10326017', '10326039',
    '10327051', '10327060', '10330000', '10330004', '10330024', '10330038', '10332005', '10343015',
    '10345002', '10346007', '10359033', '10361164', '10362029', '10376025', '103770', '10382017',
    '10386034', '10387022', '10393008', '10394010', '10397017', '10405013', '10405014', '104159',
    '10417002', '10422009', '10432018', '10434013', '10436058', '10439015', '10440001', '10444022',
    '10444023', '10444036', '10446016', '10446020', '10447605', '10451000', '10452088', '10453075',
    '10454136', '10455013', '10455197', '10474023', '10474033', '104747', '10483010', '10484011',
    '10484013', '10490025', '10493000', '10493002', '10511054', '105283', '105291', '106021',
    '106373', '107142', '107427', '107589', '108260', '108324', '108378', '109058', '109308',
    '1107', '4596', '7445', '100163', '10019203', '10019315', '10020374', '10020428', '10035003',
    '10038117', '10043082', '10047081', '10048050', '10096000', '10127005', '10127012', '10129025',
    '101332', '10136004', '10136007', '10144005', '10148007', '10159012', '10177000', '10177001',
    '10206000', '10216023', '10217022', '102238', '10229021', '10232027', '10238010', '10269000',
    '10273004', '10280015', '103189', '10321006', '10325016', '10330023', '10330030', '103495',
    '10362005', '10372033', '103801', '10391022', '10406011', '104098', '10435019', '10445046',
    '10454142', '10468000', '10503011', '105069', '105619', '105819', '106257', '106974', '106991',
    '107522', '107895', '107896', '107917', '108224', '108312', '108325', '109053', '109277',
    '11276', '1423', '1734', '8816', '975', 'TEMP-002'
]

db_path = Path('data/sqlite/creative.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Load template once
template = load_template('holiday')

sent = 0
failed = 0
failed_list = []

print(f"Retrying {len(failed_dealers)} failed emails with 0.6s delay...")
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
    
    # Progress every 25
    if sent % 25 == 0 and sent > 0:
        print(f"Progress: {sent}/{len(failed_dealers)} sent...")
    
    # 0.6 second delay = ~1.6 requests/second (under 2/sec limit)
    time.sleep(0.6)

conn.close()

print("-" * 50)
print(f"COMPLETE: {sent} sent, {failed} failed")

if failed_list:
    print("\nStill failed:")
    for f in failed_list:
        print(f"  {f['dealer_no']}: {f['email']} - {f['error']}")
