#!/usr/bin/env python3
"""Scrape websites for logo images"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

dealers = [
    ("Aquilla Air", "https://aquillaair.com"),
    ("Carstens Plumbing and Heating", "https://carstens.ruudpropartner.com"),
    ("Chase Heating and Cooling", "https://chasemechhvac.com"),
    ("ComfortPro Solutions", "https://mycomfortpro.com"),
    ("Frankum AC and Heating", "https://frankumac.com"),
    ("Ginsel Heating and Air", "https://ginselhvac.com"),
    ("Jeff's Heating and Cooling", "https://jeffsheatingandcooling.com"),
    ("KTS Heating and Air and Refrigeration", "https://houstonsac.com"),
    ("Kennedy's Heating and Air Conditioning", "https://kennedysheatingandair.net"),
    ("Kerr County AC and Heating Services", "https://kerrcountyac.com"),
    ("OTT Mechanical LLC", "https://ottmechanical.com"),
    ("Ron's Heating and Cooling", "https://ronsheatingandcooling.com"),
    ("Total Comfort Air Solutions", "https://totalcomfortbcs.com"),
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

print("Scraping websites for logos...\n")

for name, url in dealers:
    print(f"=== {name} ===")
    print(f"URL: {url}")
    
    try:
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        if resp.status_code != 200:
            print(f"❌ HTTP {resp.status_code}\n")
            continue
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        logos_found = []
        
        # Check og:image
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            img_url = urljoin(url, og_image['content'])
            logos_found.append(('og:image', img_url))
        
        # Check link icons
        for link in soup.find_all('link', rel=re.compile(r'icon|apple-touch', re.I)):
            href = link.get('href')
            if href:
                img_url = urljoin(url, href)
                logos_found.append(('link icon', img_url))
        
        # Check img tags with logo in src/alt/class
        for img in soup.find_all('img'):
            src = img.get('src', '')
            alt = img.get('alt', '').lower()
            cls = ' '.join(img.get('class', [])).lower()
            
            if 'logo' in src.lower() or 'logo' in alt or 'logo' in cls:
                img_url = urljoin(url, src)
                logos_found.append(('img[logo]', img_url))
        
        # Check header images
        header = soup.find(['header', 'nav'])
        if header:
            for img in header.find_all('img')[:2]:
                src = img.get('src')
                if src:
                    img_url = urljoin(url, src)
                    logos_found.append(('header img', img_url))
        
        if logos_found:
            print(f"✅ Found {len(logos_found)} potential logos:")
            seen = set()
            for source, logo_url in logos_found[:5]:
                if logo_url not in seen:
                    seen.add(logo_url)
                    print(f"   [{source}] {logo_url}")
        else:
            print("❌ No logos found")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
