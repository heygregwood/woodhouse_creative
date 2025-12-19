#!/usr/bin/env python3
"""
1. List 11 dealers missing Facebook
2. Import ALL phone/email fields from Excel to dealer_contacts
"""
import pandas as pd
import sqlite3
import re
from pathlib import Path
from datetime import datetime

EXCEL_PATH = Path('/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm')
DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')

def normalize_phone(phone):
    """Normalize phone to 10 digits."""
    if pd.isna(phone) or not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def clean_email(email):
    """Clean and validate email."""
    if pd.isna(email) or not email:
        return None
    email = str(email).strip().lower()
    return email if '@' in email else None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. List dealers missing Facebook
    print("=" * 70)
    print("11 DEALERS MISSING FACEBOOK PAGE ID")
    print("=" * 70)
    cursor.execute("""
        SELECT dealer_no, display_name, dealer_city, dealer_state, dealer_web_address
        FROM dealers 
        WHERE program_status = 'FULL'
          AND (facebook_page_id IS NULL OR facebook_page_id = '')
        ORDER BY display_name
    """)
    missing_fb = cursor.fetchall()
    print(f"\n{'Dealer No':<12} {'Name':<35} {'City':<20} {'State':<8} Website")
    print("-" * 100)
    for d in missing_fb:
        print(f"{d[0]:<12} {(d[1] or '')[:34]:<35} {(d[2] or '')[:19]:<20} {(d[3] or ''):<8} {d[4] or 'N/A'}")
    
    # 2. Load Excel and import all contact fields
    print("\n" + "=" * 70)
    print("IMPORTING ALL CONTACT FIELDS TO dealer_contacts")
    print("=" * 70)
    
    df = pd.read_excel(EXCEL_PATH, sheet_name='Woodhouse Data')
    print(f"\nLoaded {len(df)} rows from Excel")
    
    # Show all phone/email columns
    contact_cols = [c for c in df.columns if any(x in c.lower() for x in ['phone', 'email'])]
    print(f"Contact columns found: {contact_cols}")
    
    today = datetime.now().strftime('%Y-%m-%d')
    stats = {'phones': 0, 'emails': 0, 'skipped': 0}
    
    for _, row in df.iterrows():
        dealer_no = str(int(row['Dealer No'])) if pd.notna(row['Dealer No']) else None
        if not dealer_no:
            continue
        
        # Check if FULL dealer
        cursor.execute("SELECT program_status FROM dealers WHERE dealer_no = ?", (dealer_no,))
        result = cursor.fetchone()
        if not result or result[0] != 'FULL':
            continue
        
        # Import all phone fields
        phone_fields = [
            ('TurnkeyPhone', 'turnkey_phone'),
            ('Contact Phone', 'contact_phone'),
        ]
        
        for excel_col, subtype in phone_fields:
            if excel_col in row:
                phone = normalize_phone(row[excel_col])
                if phone:
                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO dealer_contacts
                            (dealer_no, contact_type, contact_subtype, value, source, source_date, confidence)
                            VALUES (?, 'phone', ?, ?, 'excel_source', ?, 'high')
                        """, (dealer_no, subtype, phone, today))
                        if cursor.rowcount > 0:
                            stats['phones'] += 1
                    except Exception as e:
                        stats['skipped'] += 1
        
        # Import all email fields
        email_fields = [
            ('TurnkeyEmail', 'turnkey_email'),
            ('Contact Email Address', 'contact_email'),
            ('Contact Admin Email Address', 'contact_admin_email'),
        ]
        
        for excel_col, subtype in email_fields:
            if excel_col in row:
                email = clean_email(row[excel_col])
                if email:
                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO dealer_contacts
                            (dealer_no, contact_type, contact_subtype, value, source, source_date, confidence)
                            VALUES (?, 'email', ?, ?, 'excel_source', ?, 'high')
                        """, (dealer_no, subtype, email, today))
                        if cursor.rowcount > 0:
                            stats['emails'] += 1
                    except Exception as e:
                        stats['skipped'] += 1
    
    conn.commit()
    
    print(f"\nAdded to dealer_contacts:")
    print(f"  Phones: {stats['phones']}")
    print(f"  Emails: {stats['emails']}")
    print(f"  Skipped (duplicates): {stats['skipped']}")
    
    # Show contact counts
    cursor.execute("""
        SELECT contact_type, contact_subtype, COUNT(*) 
        FROM dealer_contacts 
        WHERE dealer_no IN (SELECT dealer_no FROM dealers WHERE program_status = 'FULL')
        GROUP BY contact_type, contact_subtype
        ORDER BY contact_type, contact_subtype
    """)
    print("\nContact records by type/subtype:")
    for row in cursor.fetchall():
        print(f"  {row[0]:10} {row[1]:20} {row[2]}")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
