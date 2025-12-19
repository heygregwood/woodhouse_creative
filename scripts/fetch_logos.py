#!/usr/bin/env python3
"""
Fetch logo options from Brandfetch for dealers who need logos.
Replicates the woodhouse_social onboarding logic.

Usage:
  python3 scripts/fetch_logos.py              # All dealers missing logos
  python3 scripts/fetch_logos.py --dealer 101332  # Specific dealer
  python3 scripts/fetch_logos.py --not-ready  # All dealers not ready for automation
"""
import sqlite3
import requests
import argparse
import os
from pathlib import Path
from datetime import datetime
from PIL import Image
from io import BytesIO

DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')

# Get from environment or .env.local
BRANDFETCH_CLIENT_ID = os.environ.get('BRANDFETCH_CLIENT_ID')

# Fallback image dimensions to filter out
BRANDFETCH_FALLBACKS = [
    (820, 877),  # Default fallback
    (820, 220),  # Wide fallback
]

MIN_DIMENSION = 50   # Minimum for either width or height
MIN_AREA = 10000     # Minimum total area (e.g., 100x100)


def load_env():
    """Load environment variables from .env.local"""
    global BRANDFETCH_CLIENT_ID
    env_path = Path('/home/heygregwood/woodhouse_social/.env.local')
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith('BRANDFETCH_CLIENT_ID='):
                    BRANDFETCH_CLIENT_ID = line.split('=', 1)[1].strip().strip('"\'')
                    break


def clean_domain(url):
    """Extract clean domain from URL."""
    if not url:
        return None
    domain = url.lower()
    domain = domain.replace('https://', '').replace('http://', '')
    domain = domain.replace('www.', '')
    domain = domain.split('/')[0]
    return domain


def fetch_image_info(url):
    """Fetch image and return dimensions, or None if failed/filtered."""
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        img = Image.open(BytesIO(response.content))
        width, height = img.size
        
        # Filter: too small
        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            return None
        
        # Filter: area too small
        if width * height < MIN_AREA:
            return None
        
        # Filter: Brandfetch fallbacks
        if (width, height) in BRANDFETCH_FALLBACKS:
            return None
        
        return {
            'url': url,
            'width': width,
            'height': height,
            'format': img.format,
            'mode': img.mode,
        }
    except Exception as e:
        return None


def get_logo_options(domain):
    """Get logo options for a domain from Brandfetch."""
    if not BRANDFETCH_CLIENT_ID:
        print("ERROR: BRANDFETCH_CLIENT_ID not set")
        return []
    
    urls = [
        f"https://cdn.brandfetch.io/{domain}?c={BRANDFETCH_CLIENT_ID}",
        f"https://cdn.brandfetch.io/{domain}/icon?c={BRANDFETCH_CLIENT_ID}",
        f"https://cdn.brandfetch.io/{domain}/logo?c={BRANDFETCH_CLIENT_ID}",
        f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
    ]
    
    results = []
    seen_dimensions = set()
    
    for url in urls:
        info = fetch_image_info(url)
        if info:
            # Dedupe by dimensions
            key = (info['width'], info['height'])
            if key not in seen_dimensions:
                seen_dimensions.add(key)
                results.append(info)
    
    return results


def get_dealers_needing_logos(cursor, dealer_no=None, not_ready=False):
    """Get dealers who need logo work."""
    if dealer_no:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_website, creatomate_logo, ready_for_automate
            FROM dealers 
            WHERE dealer_no = ? AND program_status = 'FULL'
        """, (dealer_no,))
    elif not_ready:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_website, creatomate_logo, ready_for_automate
            FROM dealers 
            WHERE program_status = 'FULL'
              AND (ready_for_automate IS NULL OR ready_for_automate != 'yes')
            ORDER BY display_name
        """)
    else:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_website, creatomate_logo, ready_for_automate
            FROM dealers 
            WHERE program_status = 'FULL'
              AND (creatomate_logo IS NULL OR creatomate_logo = '')
            ORDER BY display_name
        """)
    
    return cursor.fetchall()


def main():
    parser = argparse.ArgumentParser(description='Fetch logo options from Brandfetch')
    parser.add_argument('--dealer', help='Specific dealer number')
    parser.add_argument('--not-ready', action='store_true', help='All dealers not ready for automation')
    args = parser.parse_args()
    
    load_env()
    
    if not BRANDFETCH_CLIENT_ID:
        print("ERROR: BRANDFETCH_CLIENT_ID not found in environment or .env.local")
        return
    
    print("=" * 80)
    print("LOGO OPTIONS FROM BRANDFETCH")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    dealers = get_dealers_needing_logos(cursor, args.dealer, args.not_ready)
    print(f"Found {len(dealers)} dealers to check\n")
    
    for dealer in dealers:
        dealer_no, name, website, current_logo, ready = dealer
        name = name or f"[{dealer_no}]"
        
        print(f"\n{'=' * 60}")
        print(f"DEALER: {name}")
        print(f"Dealer No: {dealer_no}")
        print(f"Website: {website or 'N/A'}")
        print(f"Current Logo: {'Yes' if current_logo else 'No'}")
        print(f"Ready for Automation: {ready or 'No'}")
        
        if not website:
            print("⚠️  No website - cannot fetch logo from Brandfetch")
            continue
        
        domain = clean_domain(website)
        print(f"Domain: {domain}")
        print("-" * 40)
        
        logos = get_logo_options(domain)
        
        if not logos:
            print("❌ No suitable logos found")
        else:
            print(f"✓ Found {len(logos)} logo option(s):\n")
            for i, logo in enumerate(logos, 1):
                print(f"  [{i}] {logo['width']}x{logo['height']} ({logo['format']})")
                print(f"      {logo['url'][:80]}...")
    
    conn.close()
    print(f"\n{'=' * 80}")
    print("Done!")


if __name__ == "__main__":
    main()
