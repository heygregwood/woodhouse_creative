#!/usr/bin/env python3
"""
Import the 11 missing Facebook pages with all their data.
"""
import sqlite3
from datetime import datetime

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

# Data from Greg's Facebook lookups
fb_data = [
    {
        'dealer_no': '101332',
        'name': 'A and Z Mechanical',
        'facebook_page_id': '1547594915453749',
        'facebook_url': 'https://www.facebook.com/aandzmechanical',
        'phone': '7195994447',
        'email': 'office@aandzmechanicalinc.com',
        'address': '143 Winters Dr, Colorado Springs, CO, United States, Colorado',
        'website': 'aandzmechanical.com'
    },
    {
        'dealer_no': '108224',
        'name': 'AccuMax Heating and Cooling',
        'facebook_page_id': '157254804332810',
        'facebook_url': 'https://www.facebook.com/profile.php?id=100046589481676',
        'phone': '6308001598',
        'email': 'accumaxinc@gmail.com',
        'address': '1260 Sheffer Rd, Aurora, IL, United States, Illinois',
        'website': 'accumaxinc.com'
    },
    {
        'dealer_no': '10214007',
        'name': 'Arctic Air',
        'facebook_page_id': '101137072844541',
        'facebook_url': 'https://www.facebook.com/profile.php?id=100088206464471',
        'phone': '4092995584',
        'email': 'office@arctictexas.com',
        'address': None,
        'website': 'ArcticTexas.com'
    },
    {
        'dealer_no': '10136007',
        'name': 'Bilco',
        'facebook_page_id': '288740884576690',
        'facebook_url': 'https://www.facebook.com/BilcoAirConditioningHeatingInc',
        'phone': '9366466691',
        'email': 'bilcoac@aol.com',
        'address': '2106 FM 356 N, Onalaska, TX, United States, Texas',
        'website': 'bilcoair.com'
    },
    {
        'dealer_no': '10177001',
        'name': 'C&G Mechanical',
        'facebook_page_id': '111084251757530',
        'facebook_url': 'https://www.facebook.com/profile.php?id=100085874931428',
        'phone': '3468574139',
        'email': 'cainasfrancisco@cgm-hvac.com',
        'address': 'Rosenberg, TX, United States, Texas',
        'website': 'cgm-hvac.com'
    },
    {
        'dealer_no': '10371040',
        'name': 'Everest Air Heating and Cooling',
        'facebook_page_id': '321304671833236',
        'facebook_url': 'https://www.facebook.com/everestairheatingandcooling',
        'phone': '8652334332',
        'email': 'contact@myeverestair.com',
        'address': '261 Hannum St, Alcoa, TN, United States, Tennessee',
        'website': 'myeverestair.com'
    },
    {
        'dealer_no': '10127012',
        'name': 'Fondas Plumbing and Heating',
        'facebook_page_id': '186302014856047',
        'facebook_url': 'https://www.facebook.com/fondasplumb',
        'phone': None,
        'email': 'service@fondasplumbing.com',
        'address': None,
        'website': 'fondasplumbing.ca'
    },
    {
        'dealer_no': '10330030',
        'name': 'INTEGRITY AC',
        'facebook_page_id': '115470398175871',
        'facebook_url': 'https://www.facebook.com/profile.php?id=100091520116192',
        'phone': '4092424441',
        'email': 'micahr@integrityacllc.net',
        'address': None,
        'website': 'integrityacllc.net'
    },
    {
        'dealer_no': '109277',
        'name': 'Lakefront Heating and Air',
        'facebook_page_id': '103121531406727',
        'facebook_url': 'https://www.facebook.com/LakefrontHVAC',
        'phone': '2185622043',
        'email': 'dan@lakefronthvac.com',
        'address': 'Brainerd, MN',
        'website': 'lakefronthvac.com'
    },
    {
        'dealer_no': '103952',
        'name': 'Majeski Plumbing & Heating',
        'facebook_page_id': '1436297883362717',
        'facebook_url': 'https://www.facebook.com/profile.php?id=100057332926524',
        'phone': '6514373823',
        'email': 'majeskiplumbing@hotmail.com',
        'address': '875 Spiral Blvd, Hastings, MN, United States, Minnesota',
        'website': 'majeskiplumbinginc.com'
    },
    {
        'dealer_no': '10289053',
        'name': 'Total Comfort Air',
        'facebook_page_id': '119512437910742',
        'facebook_url': 'https://www.facebook.com/totalcomfortbcs',
        'phone': '9793217181',
        'email': 'steven@totalcomfortbcs.com',
        'address': '12986 Tonkaway Lake Rd, Suite 933, College Station, TX, United States, Texas',
        'website': 'totalcomfortbcs.com'
    },
]

def main():
    print("=" * 70)
    print("IMPORTING 11 MISSING FACEBOOK PAGES")
    print("=" * 70)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    
    for dealer in fb_data:
        dealer_no = dealer['dealer_no']
        print(f"\n{dealer['name']}...")
        
        # Update dealers table
        cursor.execute("""
            UPDATE dealers SET
                facebook_page_id = ?,
                has_sprout = 0
            WHERE dealer_no = ?
        """, (dealer['facebook_page_id'], dealer_no))
        print(f"  ✓ Facebook Page ID: {dealer['facebook_page_id']}")
        
        # Add Facebook URL to contacts
        cursor.execute("""
            INSERT OR IGNORE INTO dealer_contacts
            (dealer_no, contact_type, contact_subtype, value, source, source_date, confidence)
            VALUES (?, 'social', 'facebook', ?, 'manual_lookup', ?, 'high')
        """, (dealer_no, dealer['facebook_url'], today))
        
        # Add phone to contacts if present
        if dealer['phone']:
            cursor.execute("""
                INSERT OR IGNORE INTO dealer_contacts
                (dealer_no, contact_type, contact_subtype, value, source, source_date, confidence)
                VALUES (?, 'phone', 'facebook', ?, 'manual_lookup', ?, 'high')
            """, (dealer_no, dealer['phone'], today))
            print(f"  ✓ Phone: {dealer['phone']}")
        
        # Add email to contacts if present
        if dealer['email']:
            cursor.execute("""
                INSERT OR IGNORE INTO dealer_contacts
                (dealer_no, contact_type, contact_subtype, value, source, source_date, confidence)
                VALUES (?, 'email', 'facebook', ?, 'manual_lookup', ?, 'high')
            """, (dealer_no, dealer['email'].lower(), today))
            print(f"  ✓ Email: {dealer['email']}")
        
        # Update website if missing
        if dealer['website']:
            cursor.execute("""
                UPDATE dealers SET creatomate_website = ?
                WHERE dealer_no = ? AND (creatomate_website IS NULL OR creatomate_website = '')
            """, (dealer['website'], dealer_no))
    
    conn.commit()
    
    # Final count
    print("\n" + "=" * 70)
    print("FINAL STATUS")
    print("=" * 70)
    
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN facebook_page_id IS NOT NULL AND facebook_page_id != '' THEN 1 ELSE 0 END) as has_fb,
            SUM(CASE WHEN creatomate_phone IS NOT NULL AND creatomate_phone != '' THEN 1 ELSE 0 END) as has_phone,
            SUM(CASE WHEN creatomate_website IS NOT NULL AND creatomate_website != '' THEN 1 ELSE 0 END) as has_website,
            COUNT(*) as total
        FROM dealers WHERE program_status = 'FULL'
    """)
    row = cursor.fetchone()
    print(f"Facebook Page ID: {row[0]}/{row[3]}")
    print(f"Phone:            {row[1]}/{row[3]}")
    print(f"Website:          {row[2]}/{row[3]}")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
