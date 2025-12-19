#!/usr/bin/env python3
"""
Import Sprout Social profiles to update dealers with Facebook data.
Adds:
- facebook_page_id (Native Id from Sprout)
- sprout_profile (Sprout Id)
- has_sprout = 1 for matched dealers

Matching logic: fuzzy match on company name
"""
import csv
import sqlite3
import re
from pathlib import Path
from datetime import datetime

DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')
CSV_PATH = Path('/mnt/c/Users/GregWood/Downloads/Profiles_2025-12-19.csv')

def normalize_name(name):
    """Normalize company name for matching."""
    if not name:
        return ''
    name = name.lower()
    # Remove common suffixes
    name = re.sub(r'\b(llc|inc|ltd|co|corp|services?|hvac|heating|cooling|air|conditioning|plumbing|mechanical)\b', '', name)
    # Remove punctuation and extra spaces
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def get_key_words(name):
    """Extract key identifying words from name."""
    normalized = normalize_name(name)
    words = normalized.split()
    # Return first 2 significant words (skip very short ones)
    return [w for w in words if len(w) > 2][:2]

def main():
    print("=" * 70)
    print("IMPORT SPROUT SOCIAL PROFILES")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Load Sprout profiles
    profiles = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Type'] == 'facebook':
                # Clean up Native Id (remove leading ')
                native_id = row['Native Id'].lstrip("'")
                profiles.append({
                    'sprout_id': row['Sprout Id'],
                    'name': row['Name'],
                    'handle': row['Handle'],
                    'native_id': native_id,
                    'link': row['Link'],
                    'groups': row['Groups'],
                })
    
    print(f"Loaded {len(profiles)} Facebook profiles from Sprout\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Add has_sprout column if not exists
    try:
        cursor.execute("ALTER TABLE dealers ADD COLUMN has_sprout INTEGER DEFAULT 0")
        conn.commit()
        print("Added has_sprout column")
    except:
        pass  # Column already exists
    
    # Get all FULL dealers
    cursor.execute("""
        SELECT dealer_no, dealer_name, display_name 
        FROM dealers 
        WHERE program_status = 'FULL'
    """)
    dealers = cursor.fetchall()
    print(f"Found {len(dealers)} FULL dealers\n")
    
    # Build lookup by normalized name parts
    dealer_lookup = {}
    for dealer_no, dealer_name, display_name in dealers:
        name = display_name or dealer_name
        key_words = get_key_words(name)
        if key_words:
            key = ' '.join(key_words)
            dealer_lookup[key] = (dealer_no, name)
        # Also add just first word for single-word matches
        if key_words:
            dealer_lookup[key_words[0]] = (dealer_no, name)
    
    # Match profiles to dealers
    matched = 0
    unmatched = []
    
    for profile in profiles:
        sprout_name = profile['name']
        key_words = get_key_words(sprout_name)
        
        dealer_match = None
        
        # Try full key first
        if key_words:
            full_key = ' '.join(key_words)
            if full_key in dealer_lookup:
                dealer_match = dealer_lookup[full_key]
            # Try first word only
            elif key_words[0] in dealer_lookup:
                dealer_match = dealer_lookup[key_words[0]]
        
        if dealer_match:
            dealer_no, dealer_name = dealer_match
            
            # Update dealer record
            cursor.execute("""
                UPDATE dealers 
                SET facebook_page_id = ?,
                    sprout_profile = ?,
                    has_sprout = 1
                WHERE dealer_no = ?
            """, (profile['native_id'], profile['sprout_id'], dealer_no))
            
            # Also add to dealer_contacts
            cursor.execute("""
                INSERT OR IGNORE INTO dealer_contacts
                (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                VALUES (?, 'social', 'facebook', ?, 'sprout_social', ?, ?, 'high')
            """, (dealer_no, profile['link'], datetime.now().strftime('%Y-%m-%d'), f"Sprout ID: {profile['sprout_id']}"))
            
            matched += 1
            print(f"✓ {sprout_name[:40]:40} → {dealer_name[:30]}")
        else:
            unmatched.append(profile)
    
    conn.commit()
    
    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"Matched: {matched}/{len(profiles)}")
    print(f"Unmatched: {len(unmatched)}")
    
    if unmatched:
        print(f"\nUnmatched profiles (need manual review):")
        for p in unmatched[:20]:
            print(f"  - {p['name']}")
    
    # Check results
    cursor.execute("SELECT COUNT(*) FROM dealers WHERE has_sprout = 1")
    print(f"\nDealers with Sprout profiles: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT COUNT(*) FROM dealers WHERE facebook_page_id IS NOT NULL AND facebook_page_id != ''")
    print(f"Dealers with Facebook Page ID: {cursor.fetchone()[0]}")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
