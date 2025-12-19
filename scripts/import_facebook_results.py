#!/usr/bin/env python3
"""
Import Facebook Pages Scraper results into dealer_contacts.
Extracts phone, email, address, website from Facebook business pages.
"""
import json
import sqlite3
import re
from pathlib import Path
from datetime import datetime

DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')
FB_RESULTS = Path('/mnt/c/Users/GregWood/Downloads/dataset_facebook-pages-scraper_2025-12-19_02-44-52-711.json')

def normalize_phone(phone):
    """Normalize phone to 10 digits."""
    if not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def extract_page_id(url):
    """Extract Facebook page ID from URL."""
    if not url:
        return None
    # https://www.facebook.com/307847859422775
    match = re.search(r'facebook\.com/(\d+)', url)
    return match.group(1) if match else None

def main():
    print("=" * 70)
    print("IMPORT FACEBOOK PAGES SCRAPER RESULTS")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Load Facebook results
    with open(FB_RESULTS, 'r', encoding='utf-8') as f:
        fb_results = json.load(f)
    
    print(f"Loaded {len(fb_results)} Facebook page results\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Build lookup: facebook_page_id -> dealer_no
    cursor.execute("""
        SELECT dealer_no, facebook_page_id, display_name 
        FROM dealers 
        WHERE facebook_page_id IS NOT NULL AND facebook_page_id != ''
    """)
    page_to_dealer = {}
    for row in cursor.fetchall():
        page_to_dealer[row[1]] = (row[0], row[2])
    
    print(f"Found {len(page_to_dealer)} dealers with Facebook Page IDs\n")
    
    stats = {'matched': 0, 'phones': 0, 'emails': 0, 'unmatched': 0}
    
    for fb in fb_results:
        page_url = fb.get('pageUrl', '')
        page_id = extract_page_id(page_url)
        
        if not page_id or page_id not in page_to_dealer:
            stats['unmatched'] += 1
            continue
        
        dealer_no, dealer_name = page_to_dealer[page_id]
        stats['matched'] += 1
        
        fb_title = fb.get('title', '')[:40]
        dealer_display = (dealer_name or 'Unknown')[:30]
        print(f"✓ {fb_title:40} → {dealer_display}")
        
        # Import phone
        if fb.get('phone'):
            phone = normalize_phone(fb['phone'])
            if phone:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                        VALUES (?, 'phone', 'facebook', ?, 'facebook', ?, ?, 'high')
                    """, (dealer_no, phone, today, f"Facebook page: {fb_title}"))
                    if cursor.rowcount > 0:
                        stats['phones'] += 1
                except: pass
        
        # Import email
        if fb.get('email'):
            email = fb['email'].strip().lower()
            if '@' in email:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                        VALUES (?, 'email', 'facebook', ?, 'facebook', ?, ?, 'high')
                    """, (dealer_no, email, today, f"Facebook page: {fb_title}"))
                    if cursor.rowcount > 0:
                        stats['emails'] += 1
                except: pass
        
        # Update address if we don't have one
        if fb.get('address'):
            cursor.execute("""
                UPDATE dealers SET address = ? 
                WHERE dealer_no = ? AND (address IS NULL OR address = '')
            """, (fb['address'], dealer_no))
    
    conn.commit()
    
    # Now update creatomate_phone for dealers that need it
    print("\nUpdating creatomate_phone from Facebook data...")
    cursor.execute("""
        UPDATE dealers
        SET creatomate_phone = (
            SELECT value FROM dealer_contacts 
            WHERE dealer_contacts.dealer_no = dealers.dealer_no 
              AND contact_type = 'phone' 
              AND source = 'facebook'
            LIMIT 1
        )
        WHERE program_status = 'FULL'
          AND (creatomate_phone IS NULL OR creatomate_phone = '')
          AND dealer_no IN (
            SELECT dealer_no FROM dealer_contacts 
            WHERE contact_type = 'phone' AND source = 'facebook'
          )
    """)
    phones_updated = cursor.rowcount
    conn.commit()
    
    print(f"Updated {phones_updated} dealers with Facebook phone numbers")
    
    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"Matched to dealers: {stats['matched']}/{len(fb_results)}")
    print(f"Unmatched: {stats['unmatched']}")
    print(f"New phones added: {stats['phones']}")
    print(f"New emails added: {stats['emails']}")
    print(f"Creatomate phones updated: {phones_updated}")
    
    # Final status
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN creatomate_phone IS NOT NULL THEN 1 ELSE 0 END) as has_phone,
            SUM(CASE WHEN creatomate_website IS NOT NULL THEN 1 ELSE 0 END) as has_website,
            SUM(CASE WHEN facebook_page_id IS NOT NULL AND facebook_page_id != '' THEN 1 ELSE 0 END) as has_fb,
            COUNT(*) as total
        FROM dealers WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"\nFULL Dealer Status:")
    print(f"  Has phone:    {row[0]}/{row[3]}")
    print(f"  Has website:  {row[1]}/{row[3]}")
    print(f"  Has Facebook: {row[2]}/{row[3]}")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
