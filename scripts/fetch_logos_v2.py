#!/usr/bin/env python3
"""
Fetch logo options from multiple sources for dealers who need logos.
Sources: Brandfetch, Google Favicons, Website Scraping

Usage:
  python3 scripts/fetch_logos_v2.py              # All dealers not ready
  python3 scripts/fetch_logos_v2.py --dealer 101332  # Specific dealer
  python3 scripts/fetch_logos_v2.py --download   # Download best logos to folder
"""
import sqlite3
import requests
import argparse
import os
import re
from pathlib import Path
from datetime import datetime
from PIL import Image
from io import BytesIO
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

DB_PATH = Path('/home/heygregwood/woodhouse_creative/data/sqlite/creative.db')
OUTPUT_DIR = Path('/home/heygregwood/woodhouse_creative/data/logos')

BRANDFETCH_CLIENT_ID = os.environ.get('BRANDFETCH_CLIENT_ID')

# Fallback dimensions to filter out
BRANDFETCH_FALLBACKS = [(820, 877), (820, 220)]
MIN_DIMENSION = 80
MIN_AREA = 15000

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


def load_env():
    """Load environment variables from .env.local"""
    global BRANDFETCH_CLIENT_ID
    for env_path in [
        Path('/home/heygregwood/woodhouse_social/.env.local'),
        Path('/home/heygregwood/woodhouse_creative/.env.local'),
    ]:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.startswith('BRANDFETCH_CLIENT_ID='):
                        BRANDFETCH_CLIENT_ID = line.split('=', 1)[1].strip().strip('"\'')
                        return


def clean_domain(url):
    """Extract clean domain from URL."""
    if not url:
        return None
    domain = url.lower()
    domain = domain.replace('https://', '').replace('http://', '')
    domain = domain.replace('www.', '')
    domain = domain.split('/')[0]
    return domain


def fetch_image_info(url, source='unknown'):
    """Fetch image and return info, or None if failed/filtered."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return None
        
        img = Image.open(BytesIO(response.content))
        width, height = img.size
        
        # Filter small images
        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            return None
        if width * height < MIN_AREA:
            return None
        
        # Filter Brandfetch fallbacks
        if (width, height) in BRANDFETCH_FALLBACKS:
            return None
        
        return {
            'url': url,
            'width': width,
            'height': height,
            'format': img.format,
            'source': source,
            'data': response.content,
        }
    except:
        return None


def scrape_website_logos(domain):
    """Scrape website for logo images."""
    logos = []
    base_url = f"https://{domain}"
    
    try:
        response = requests.get(base_url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return logos
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find images with logo in class, id, alt, or src
        logo_patterns = ['logo', 'brand', 'header-img', 'site-logo']
        
        for img in soup.find_all('img'):
            src = img.get('src', '')
            alt = img.get('alt', '').lower()
            classes = ' '.join(img.get('class', [])).lower()
            img_id = (img.get('id') or '').lower()
            
            # Check if this looks like a logo
            is_logo = any(p in src.lower() or p in alt or p in classes or p in img_id 
                        for p in logo_patterns)
            
            if is_logo and src:
                full_url = urljoin(base_url, src)
                if not full_url.startswith('data:'):
                    logos.append(full_url)
        
        # Also check for og:image meta tag (often the logo)
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            logos.append(urljoin(base_url, og_image['content']))
        
        # Check link tags for apple-touch-icon (often high-res logo)
        for link in soup.find_all('link', rel=lambda x: x and 'icon' in ' '.join(x)):
            href = link.get('href')
            if href:
                logos.append(urljoin(base_url, href))
        
    except Exception as e:
        pass
    
    return list(set(logos))  # Dedupe


def get_logo_options(domain):
    """Get logo options from all sources."""
    results = []
    seen = set()
    
    if not domain or '@' in domain:  # Skip email addresses
        return results
    
    # 1. Try Brandfetch
    if BRANDFETCH_CLIENT_ID:
        bf_urls = [
            f"https://cdn.brandfetch.io/{domain}?c={BRANDFETCH_CLIENT_ID}",
            f"https://cdn.brandfetch.io/{domain}/icon?c={BRANDFETCH_CLIENT_ID}",
            f"https://cdn.brandfetch.io/{domain}/logo?c={BRANDFETCH_CLIENT_ID}",
        ]
        for url in bf_urls:
            info = fetch_image_info(url, 'brandfetch')
            if info:
                key = (info['width'], info['height'])
                if key not in seen:
                    seen.add(key)
                    results.append(info)
    
    # 2. Scrape website for logos
    scraped_urls = scrape_website_logos(domain)
    for url in scraped_urls[:10]:  # Limit to 10
        info = fetch_image_info(url, 'website')
        if info:
            key = (info['width'], info['height'])
            if key not in seen:
                seen.add(key)
                results.append(info)
    
    # 3. Google favicon (last resort, usually too small)
    favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=256"
    info = fetch_image_info(favicon_url, 'favicon')
    if info and info['width'] >= 128:
        key = (info['width'], info['height'])
        if key not in seen:
            seen.add(key)
            results.append(info)
    
    # Sort by size (largest first)
    results.sort(key=lambda x: x['width'] * x['height'], reverse=True)
    
    return results


def save_logo(logo_info, dealer_no, dealer_name):
    """Save logo to output directory."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Clean filename
    safe_name = re.sub(r'[^\w\s-]', '', dealer_name or dealer_no).strip()
    safe_name = re.sub(r'\s+', '_', safe_name)
    
    ext = (logo_info['format'] or 'png').lower()
    if ext == 'jpeg':
        ext = 'jpg'
    
    filename = f"{dealer_no}_{safe_name}.{ext}"
    filepath = OUTPUT_DIR / filename
    
    with open(filepath, 'wb') as f:
        f.write(logo_info['data'])
    
    return filepath


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dealer', help='Specific dealer number')
    parser.add_argument('--download', action='store_true', help='Download best logos')
    args = parser.parse_args()
    
    load_env()
    
    print("=" * 80)
    print("LOGO FINDER V2 - Brandfetch + Website Scraping")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Brandfetch API: {'✓ Configured' if BRANDFETCH_CLIENT_ID else '✗ Not configured'}\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if args.dealer:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_website, creatomate_logo, ready_for_automate
            FROM dealers WHERE dealer_no = ? AND program_status = 'FULL'
        """, (args.dealer,))
    else:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_website, creatomate_logo, ready_for_automate
            FROM dealers 
            WHERE program_status = 'FULL'
              AND (ready_for_automate IS NULL OR ready_for_automate != 'yes')
            ORDER BY display_name
        """)
    
    dealers = cursor.fetchall()
    print(f"Found {len(dealers)} dealers to check\n")
    
    summary = {'found': 0, 'not_found': 0, 'downloaded': 0}
    
    for dealer in dealers:
        dealer_no, name, website, current_logo, ready = dealer
        name = name or f"[{dealer_no}]"
        
        print(f"\n{'─' * 60}")
        print(f"📍 {name}")
        print(f"   Dealer: {dealer_no} | Website: {website or 'N/A'}")
        print(f"   Current Logo: {'Yes' if current_logo else 'No'} | Ready: {ready or 'No'}")
        
        if not website or '@' in website:
            print("   ⚠️  No valid website - skipping")
            summary['not_found'] += 1
            continue
        
        domain = clean_domain(website)
        logos = get_logo_options(domain)
        
        if not logos:
            print("   ❌ No suitable logos found")
            summary['not_found'] += 1
        else:
            print(f"   ✓ Found {len(logos)} logo option(s):")
            summary['found'] += 1
            
            for i, logo in enumerate(logos[:4], 1):
                size_label = f"{logo['width']}x{logo['height']}"
                print(f"      [{i}] {size_label:12} ({logo['source']:10}) {logo['format']}")
            
            if args.download and logos:
                best = logos[0]
                filepath = save_logo(best, dealer_no, name)
                print(f"   💾 Downloaded: {filepath.name}")
                summary['downloaded'] += 1
    
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print("=" * 80)
    print(f"Logos found:     {summary['found']}")
    print(f"No logos:        {summary['not_found']}")
    if args.download:
        print(f"Downloaded:      {summary['downloaded']}")
        print(f"Output folder:   {OUTPUT_DIR}")
    
    conn.close()


if __name__ == "__main__":
    main()
