#!/usr/bin/env python3
"""Fetch logo options for the 14 dealers needing design"""
import requests
import os
from dotenv import load_dotenv

load_dotenv('/home/heygregwood/woodhouse_creative/.env.local')

BRANDFETCH_CLIENT_ID = os.getenv('BRANDFETCH_CLIENT_ID')

dealers = [
    ("Aquilla Air", "aquillaair.com"),
    ("Brothertons Heating & Air", "r.brotherton62@gmail.com"),
    ("Carstens Plumbing and Heating", "carstens.ruudpropartner.com"),
    ("Chase Heating and Cooling", "chasemechhvac.com"),
    ("ComfortPro Solutions", "mycomfortpro.com"),
    ("Frankum AC and Heating", "frankumac.com"),
    ("Ginsel Heating and Air", "ginselhvac.com"),
    ("Jeff's Heating and Cooling", "jeffsheatingandcooling.com"),
    ("KTS Heating and Air and Refrigeration", "houstonsac.com"),
    ("Kennedy's Heating and Air Conditioning", "kennedysheatingandair.net"),
    ("Kerr County AC and Heating Services", "kerrcountyac.com"),
    ("OTT Mechanical LLC", "ottmechanical.com"),
    ("Ron's Heating and Cooling", "ronsheatingandcooling.com"),
    ("Total Comfort Air Solutions", "totalcomfortbcs.com"),
]

print("Fetching logo options for 14 dealers...\n")

for name, website in dealers:
    print(f"=== {name} ===")
    print(f"Website: {website}")
    
    # Skip email addresses
    if '@' in website:
        print("❌ No website (email only)\n")
        continue
    
    # Clean domain
    domain = website.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
    
    # Try Brandfetch
    try:
        url = f"https://api.brandfetch.io/v2/brands/{domain}"
        headers = {"Authorization": f"Bearer {BRANDFETCH_CLIENT_ID}"}
        resp = requests.get(url, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            logos = data.get('logos', [])
            
            found_logos = []
            for logo in logos:
                for fmt in logo.get('formats', []):
                    src = fmt.get('src', '')
                    if src and 'brandfetch' not in src.lower():  # Skip Brandfetch fallbacks
                        found_logos.append({
                            'type': logo.get('type'),
                            'url': src,
                            'format': fmt.get('format'),
                            'width': fmt.get('width', 0),
                            'height': fmt.get('height', 0),
                        })
            
            if found_logos:
                print(f"✅ Brandfetch: {len(found_logos)} logos found")
                for l in found_logos[:3]:
                    print(f"   {l['type']} {l['width']}x{l['height']} {l['format']}: {l['url'][:80]}...")
            else:
                print("❌ Brandfetch: No usable logos")
        else:
            print(f"❌ Brandfetch: {resp.status_code}")
    except Exception as e:
        print(f"❌ Brandfetch error: {e}")
    
    # Try Google favicon
    favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=256"
    print(f"🔗 Favicon: {favicon_url}")
    
    print()
