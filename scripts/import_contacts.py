#!/usr/bin/env python3
"""
Import contacts from multiple sources into dealer_contacts table.
1. Migrate existing Allied API data from dealers table
2. Import Google Maps results
3. Auto-validate when sources match
"""

import sqlite3
import json
import re
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"
GMAPS_RESULTS = Path("/mnt/c/Users/GregWood/Downloads/dataset_crawler-google-places_2025-12-19_02-07-03-923.json")
DEALER_MAPPING = Path(__file__).parent.parent / "data" / "apify" / "dealer_search_mapping.json"

def normalize_phone(phone):
    """Normalize phone to 10 digits."""
    if not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def normalize_website(url):
    """Normalize website URL."""
    if not url:
        return None
    url = str(url).strip().lower()
    # Remove protocol
    url = re.sub(r'^https?://', '', url)
    # Remove www.
    url = re.sub(r'^www\.', '', url)
    # Remove trailing slash
    url = url.rstrip('/')
    return url if url else None

def migrate_allied_data(conn):
    """Migrate existing phone/website data from dealers table to dealer_contacts."""
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Get all dealers with contact data
    cursor.execute("""
        SELECT dealer_no, turnkey_phone, contact_phone, turnkey_url, website, turnkey_email, contact_email
        FROM dealers
    """)
    
    inserted = 0
    for row in cursor.fetchall():
        dealer_no = row[0]
        
        # TurnkeyPhone (public business line)
        if row[1]:
            phone = normalize_phone(row[1])
            if phone:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                        VALUES (?, 'phone', 'turnkey', ?, 'allied_api', ?, 'TurnkeyPhone field', 'medium')
                    """, (dealer_no, phone, today))
                    inserted += cursor.rowcount
                except: pass
        
        # Contact Phone (might be cell)
        if row[2]:
            phone = normalize_phone(row[2])
            if phone:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                        VALUES (?, 'phone', 'contact', ?, 'allied_api', ?, 'Contact Phone field - may be cell', 'low')
                    """, (dealer_no, phone, today))
                    inserted += cursor.rowcount
                except: pass
        
        # TurnkeyURL
        if row[3]:
            url = normalize_website(row[3])
            if url and 'facebook' not in url:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                        VALUES (?, 'website', 'turnkey', ?, 'allied_api', ?, 'TurnkeyURL field', 'medium')
                    """, (dealer_no, url, today))
                    inserted += cursor.rowcount
                except: pass
        
        # Dealer Web Address
        if row[4]:
            url = normalize_website(row[4])
            if url and 'facebook' not in url:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                        VALUES (?, 'website', 'main', ?, 'allied_api', ?, 'Dealer Web Address field', 'medium')
                    """, (dealer_no, url, today))
                    inserted += cursor.rowcount
                except: pass
        
        # TurnkeyEmail
        if row[5]:
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO dealer_contacts 
                    (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                    VALUES (?, 'email', 'turnkey', ?, 'allied_api', ?, 'TurnkeyEmail field', 'medium')
                """, (dealer_no, str(row[5]).strip().lower(), today))
                inserted += cursor.rowcount
            except: pass
        
        # Contact Email
        if row[6]:
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO dealer_contacts 
                    (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                    VALUES (?, 'email', 'contact', ?, 'allied_api', ?, 'Contact Email Address field', 'medium')
                """, (dealer_no, str(row[6]).strip().lower(), today))
                inserted += cursor.rowcount
            except: pass
    
    conn.commit()
    print(f"Migrated Allied API data: {inserted} contact records")
    return inserted

def import_google_maps(conn):
    """Import Google Maps results into dealer_contacts."""
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Load Google Maps results
    with open(GMAPS_RESULTS, 'r', encoding='utf-8') as f:
        gmaps_results = json.load(f)
    
    # Load dealer mapping to match search queries back to dealer_no
    with open(DEALER_MAPPING, 'r') as f:
        dealer_mapping = json.load(f)
    
    # Create lookup by search query
    query_to_dealer = {d['search_query']: d for d in dealer_mapping}
    
    inserted = 0
    matched = 0
    mismatches = []
    
    for result in gmaps_results:
        search_query = result.get('searchString', '')
        
        # Find dealer by search query
        dealer_info = query_to_dealer.get(search_query)
        if not dealer_info:
            print(f"  WARNING: No dealer mapping for query: {search_query[:50]}...")
            continue
        
        dealer_no = dealer_info['dealer_no']
        dealer_name = dealer_info.get('display_name') or dealer_info.get('dealer_name', '')
        gmaps_title = result.get('title', '')
        
        # Check for mismatch (simple first-word check)
        first_word = dealer_name.split()[0].lower() if dealer_name else ''
        is_mismatch = first_word and len(first_word) > 3 and first_word not in gmaps_title.lower()
        
        if is_mismatch:
            mismatches.append({
                'dealer_no': dealer_no,
                'dealer_name': dealer_name,
                'gmaps_title': gmaps_title,
                'website': result.get('website'),
                'phone': result.get('phone')
            })
            confidence = 'low'
            notes = f'REVIEW: Google found "{gmaps_title}" - may be wrong business'
        else:
            matched += 1
            confidence = 'high'
            notes = f'Google Maps title: {gmaps_title}'
        
        # Import phone
        if result.get('phone'):
            phone = normalize_phone(result['phone'])
            if phone:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence, notes)
                        VALUES (?, 'phone', 'business_line', ?, 'google_maps', ?, 'Google Maps listing', ?, ?)
                    """, (dealer_no, phone, today, confidence, notes))
                    inserted += cursor.rowcount
                except: pass
        
        # Import website
        if result.get('website'):
            url = normalize_website(result['website'])
            # Skip Facebook URLs as "website"
            if url and 'facebook.com' not in url:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence, notes)
                        VALUES (?, 'website', 'main', ?, 'google_maps', ?, 'Google Maps listing', ?, ?)
                    """, (dealer_no, url, today, confidence, notes))
                    inserted += cursor.rowcount
                except: pass
            elif url and 'facebook.com' in url:
                # Save Facebook as social
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO dealer_contacts 
                        (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence, notes)
                        VALUES (?, 'social', 'facebook', ?, 'google_maps', ?, 'Google Maps listing (no website)', ?, ?)
                    """, (dealer_no, result['website'], today, confidence, notes))
                    inserted += cursor.rowcount
                except: pass
        
        # Import address if available
        if result.get('address'):
            try:
                cursor.execute("""
                    UPDATE dealers SET address = ? WHERE dealer_no = ? AND (address IS NULL OR address = '')
                """, (result['address'], dealer_no))
            except: pass
    
    conn.commit()
    
    print(f"Imported Google Maps: {inserted} contact records")
    print(f"  Matched: {matched}/{len(gmaps_results)}")
    print(f"  Mismatches to review: {len(mismatches)}")
    
    if mismatches:
        print("\n### MISMATCHES - NEED MANUAL REVIEW ###")
        for m in mismatches:
            print(f"  {m['dealer_no']}: {m['dealer_name']}")
            print(f"    Google found: {m['gmaps_title']}")
            print(f"    Website: {m['website']}")
            print()
    
    return inserted, mismatches

def auto_validate_matches(conn):
    """Auto-validate when Google Maps matches Allied API data."""
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Find phones that match between Allied and Google Maps
    cursor.execute("""
        UPDATE dealer_contacts 
        SET is_validated = 1, 
            validated_by = 'google_match', 
            validated_date = ?,
            use_for_creatomate = 1
        WHERE id IN (
            SELECT gm.id 
            FROM dealer_contacts gm
            JOIN dealer_contacts aa ON gm.dealer_no = aa.dealer_no 
                AND gm.contact_type = aa.contact_type 
                AND gm.value = aa.value
            WHERE gm.source = 'google_maps' 
              AND aa.source = 'allied_api'
              AND gm.confidence = 'high'
        )
    """, (today,))
    phone_matches = cursor.rowcount
    
    conn.commit()
    print(f"\nAuto-validated {phone_matches} contacts (Google matched Allied)")

def set_creatomate_defaults(conn):
    """Set use_for_creatomate=1 for high-confidence Google Maps data where no match exists."""
    cursor = conn.cursor()
    
    # For dealers without any validated phone, use high-confidence Google Maps phone
    cursor.execute("""
        UPDATE dealer_contacts
        SET use_for_creatomate = 1
        WHERE id IN (
            SELECT dc.id
            FROM dealer_contacts dc
            WHERE dc.contact_type = 'phone'
              AND dc.source = 'google_maps'
              AND dc.confidence = 'high'
              AND dc.dealer_no NOT IN (
                  SELECT dealer_no FROM dealer_contacts 
                  WHERE contact_type = 'phone' AND use_for_creatomate = 1
              )
        )
    """)
    phones_set = cursor.rowcount
    
    # Same for websites
    cursor.execute("""
        UPDATE dealer_contacts
        SET use_for_creatomate = 1
        WHERE id IN (
            SELECT dc.id
            FROM dealer_contacts dc
            WHERE dc.contact_type = 'website'
              AND dc.source = 'google_maps'
              AND dc.confidence = 'high'
              AND dc.dealer_no NOT IN (
                  SELECT dealer_no FROM dealer_contacts 
                  WHERE contact_type = 'website' AND use_for_creatomate = 1
              )
        )
    """)
    websites_set = cursor.rowcount
    
    conn.commit()
    print(f"Set Creatomate defaults: {phones_set} phones, {websites_set} websites")

def update_dealers_table(conn):
    """Populate creatomate_phone and creatomate_website in dealers table."""
    cursor = conn.cursor()
    
    # Update creatomate_phone from contacts marked use_for_creatomate
    cursor.execute("""
        UPDATE dealers
        SET creatomate_phone = (
            SELECT value FROM dealer_contacts 
            WHERE dealer_contacts.dealer_no = dealers.dealer_no 
              AND contact_type = 'phone' 
              AND use_for_creatomate = 1
            LIMIT 1
        )
        WHERE dealer_no IN (
            SELECT dealer_no FROM dealer_contacts 
            WHERE contact_type = 'phone' AND use_for_creatomate = 1
        )
    """)
    phones_updated = cursor.rowcount
    
    # Update creatomate_website
    cursor.execute("""
        UPDATE dealers
        SET creatomate_website = (
            SELECT value FROM dealer_contacts 
            WHERE dealer_contacts.dealer_no = dealers.dealer_no 
              AND contact_type = 'website' 
              AND use_for_creatomate = 1
            LIMIT 1
        )
        WHERE dealer_no IN (
            SELECT dealer_no FROM dealer_contacts 
            WHERE contact_type = 'website' AND use_for_creatomate = 1
        )
    """)
    websites_updated = cursor.rowcount
    
    conn.commit()
    print(f"Updated dealers table: {phones_updated} phones, {websites_updated} websites")

def print_summary(conn):
    """Print summary stats."""
    cursor = conn.cursor()
    
    print("\n" + "="*60)
    print("CONTACT DATA SUMMARY")
    print("="*60)
    
    cursor.execute("""
        SELECT contact_type, source, COUNT(*) 
        FROM dealer_contacts 
        GROUP BY contact_type, source
        ORDER BY contact_type, source
    """)
    print("\nContacts by type and source:")
    for row in cursor.fetchall():
        print(f"  {row[0]:10} | {row[1]:15} | {row[2]}")
    
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN creatomate_phone IS NOT NULL THEN 1 ELSE 0 END) as has_phone,
            SUM(CASE WHEN creatomate_website IS NOT NULL THEN 1 ELSE 0 END) as has_website,
            COUNT(*) as total
        FROM dealers
        WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"\nFULL dealers Creatomate ready:")
    print(f"  Has phone:   {row[0]}/{row[2]}")
    print(f"  Has website: {row[1]}/{row[2]}")
    
    cursor.execute("""
        SELECT COUNT(DISTINCT dealer_no) 
        FROM dealer_contacts 
        WHERE confidence = 'low'
    """)
    print(f"\nDealers needing review (low confidence): {cursor.fetchone()[0]}")

def main():
    print("="*60)
    print("IMPORT CONTACTS FROM MULTIPLE SOURCES")
    print("="*60)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    conn = sqlite3.connect(DB_PATH)
    
    # Step 1: Migrate Allied API data
    print("Step 1: Migrating Allied API data...")
    migrate_allied_data(conn)
    
    # Step 2: Import Google Maps
    print("\nStep 2: Importing Google Maps results...")
    import_google_maps(conn)
    
    # Step 3: Auto-validate matches
    print("\nStep 3: Auto-validating matches...")
    auto_validate_matches(conn)
    
    # Step 4: Set Creatomate defaults
    print("\nStep 4: Setting Creatomate defaults...")
    set_creatomate_defaults(conn)
    
    # Step 5: Update dealers table
    print("\nStep 5: Updating dealers table...")
    update_dealers_table(conn)
    
    # Summary
    print_summary(conn)
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
