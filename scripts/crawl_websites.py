#!/usr/bin/env python3
"""
Website crawler for Allied dealer validation.
Adapted from prospect_engine/scripts/enrich/crawl_enhanced.py

Crawls dealer websites to extract:
- Phone numbers (validate against existing)
- Email addresses
- Social media links (Facebook, Instagram, etc.)
- OEM brands carried
- Website builder detection

Results are saved to dealer_contacts table with source='website_crawl'
"""

import requests
from bs4 import BeautifulSoup
import re
import json
import time
import sqlite3
from pathlib import Path
from datetime import datetime

# Try to import playwright for JS-heavy sites
try:
    from playwright.sync_api import sync_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    print("Note: Playwright not installed. Some JS-heavy sites may not crawl fully.")
    print("Install with: pip install playwright && playwright install chromium")

DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# OEM brands to look for (Allied Air brands first)
OEM_BRANDS = [
    # Allied Air brands (priority)
    'Armstrong', 'AirEase', 'Concord', 'Ducane',
    # Other major brands
    'Trane', 'American Standard', 'Carrier', 'Bryant', 'Amana', 'Lennox',
    'Maytag', 'Rheem', 'Ruud', 'York', 'Luxaire', 'Ameristar', 'Daikin',
    'Goodman', 'Frigidaire', 'Heil', 'Tempstar', 'Comfortmaker', 'Coleman', 
    'Payne', 'Mitsubishi', 'Fujitsu', 'LG', 'Samsung', 'Bosch', 'Navien', 
    'Rinnai', 'Aprilaire', 'Honeywell', 'Ecobee', 'Nest', 'Generac', 'Kohler'
]

# Website builders
WEBSITE_BUILDERS = {
    'wordpress': ['wp-content', 'wp-includes', 'wp-json', '/wp-admin'],
    'wix': ['wix.com', 'wixsite.com', '_wix', 'wix-warmup'],
    'squarespace': ['squarespace.com', 'sqsp.net', 'squarespace-cdn'],
    'weebly': ['weebly.com', 'weeblycloud.com'],
    'godaddy': ['godaddy.com', 'secureserver.net', 'godaddy-website'],
    'duda': ['duda.co', 'dudaone.com', 'multiscreensite.com'],
    'webflow': ['webflow.com', 'webflow.io'],
    'scorpion': ['scorpion.co', 'scorpionplatform', 'scorpioncontent'],
    'kukui': ['kukui.com', 'kukui-platform'],
    'blue_corona': ['bluecorona.com', 'blue-corona'],
    'contractor_commerce': ['contractorcommerce.com'],
    'housecall_pro': ['housecallpro.com'],
    'service_titan': ['servicetitan.com'],
    'ryno': ['rfrk.io', 'rynostrategic'],
}

# Pages to crawl
PAGES_TO_CRAWL = [
    '',  # homepage
    '/contact', '/contact-us', '/contact.html',
    '/about', '/about-us', '/about.html',
]

def normalize_phone(phone):
    """Normalize phone to 10 digits."""
    if not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def extract_phones(text):
    """Extract and normalize phone numbers."""
    patterns = [r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}']
    phones = []
    for p in patterns:
        phones.extend(re.findall(p, text))
    normalized = []
    for ph in phones:
        digits = normalize_phone(ph)
        if digits:
            normalized.append(digits)
    return list(set(normalized))

def extract_emails(text):
    """Extract email addresses, filtering out image files and junk."""
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = [e.lower() for e in re.findall(pattern, text) 
              if not any(e.lower().endswith(ext) for ext in ['.png', '.jpg', '.gif', '.svg', '.jpeg'])]
    # Filter common fake/placeholder emails
    emails = [e for e in emails if not any(x in e for x in 
              ['example.com', 'yoursite', 'domain.com', 'email.com', 'sentry.io', 'wixpress', 'placeholder'])]
    return list(set(emails))

def extract_social(soup):
    """Extract social media URLs from links."""
    social = {}
    for a in soup.find_all('a', href=True):
        href = a['href']
        href_lower = href.lower()
        
        # Skip share buttons
        if any(x in href_lower for x in ['sharer', 'share?', 'intent/tweet', 'share.php']):
            continue
            
        if 'facebook.com' in href_lower and 'facebook' not in social:
            social['facebook'] = href
        elif 'instagram.com' in href_lower and 'instagram' not in social:
            social['instagram'] = href
        elif ('twitter.com' in href_lower or 'x.com/' in href_lower) and 'twitter' not in social:
            social['twitter'] = href
        elif 'linkedin.com' in href_lower and 'linkedin' not in social:
            social['linkedin'] = href
        elif 'youtube.com' in href_lower and 'youtube' not in social:
            social['youtube'] = href
        elif 'nextdoor.com' in href_lower and 'nextdoor' not in social:
            social['nextdoor'] = href
        elif 'yelp.com/biz' in href_lower and 'yelp' not in social:
            social['yelp'] = href
        elif 'tiktok.com' in href_lower and 'tiktok' not in social:
            social['tiktok'] = href
            
    return social

def detect_builder(html):
    """Detect website builder from HTML signatures."""
    html_lower = html.lower()
    for builder, signatures in WEBSITE_BUILDERS.items():
        for sig in signatures:
            if sig.lower() in html_lower:
                return builder
    return 'custom'

def find_brands(text):
    """Find OEM brands mentioned in text."""
    found = []
    text_lower = text.lower()
    for brand in OEM_BRANDS:
        if re.search(r'\b' + re.escape(brand.lower()) + r'\b', text_lower):
            found.append(brand)
    return list(set(found))

def fetch_page_simple(url, timeout=15):
    """Fetch page using simple requests."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        if resp.status_code == 403:
            return None, None  # Blocked
        resp.raise_for_status()
        return resp.text, resp.url
    except Exception as e:
        return None, None

def fetch_page_playwright(url, timeout=20000):
    """Fetch page using Playwright (handles JS-rendered sites)."""
    if not HAS_PLAYWRIGHT:
        return None, None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=timeout, wait_until='networkidle')
            html = page.content()
            final_url = page.url
            browser.close()
            return html, final_url
    except:
        return None, None

def crawl_site(domain, use_playwright_fallback=True):
    """Crawl a site and extract contact data."""
    if not domain or any(x in domain for x in ['facebook.com', 'google.com', 'yelp.com']):
        return {'domain': domain, 'status': 'skipped', 'error': 'invalid domain'}
    
    # Clean domain
    domain = domain.strip().lower()
    if domain.startswith('http'):
        domain = domain.split('//')[1].split('/')[0]
    domain = domain.replace('www.', '')
    
    base_urls_to_try = [
        f'https://{domain}',
        f'https://www.{domain}',
        f'http://{domain}',
    ]
    
    all_text = ""
    all_html = ""
    pages_crawled = []
    final_base_url = None
    
    # Try to find working base URL
    for base_url in base_urls_to_try:
        html, final_url = fetch_page_simple(base_url)
        if html:
            final_base_url = base_url
            break
    
    if not final_base_url:
        if use_playwright_fallback and HAS_PLAYWRIGHT:
            for base_url in base_urls_to_try[:1]:
                html, final_url = fetch_page_playwright(base_url)
                if html:
                    final_base_url = base_url
                    break
        
        if not final_base_url:
            return {'domain': domain, 'status': 'error', 'error': 'Could not connect'}
    
    # Crawl multiple pages
    for page_path in PAGES_TO_CRAWL:
        url = final_base_url + page_path
        html, _ = fetch_page_simple(url, timeout=10)
        
        if html and len(html) > 500:
            soup = BeautifulSoup(html, 'html.parser')
            text = soup.get_text(separator=' ', strip=True)
            
            if len(text) > 100:
                all_text += " " + text
                all_html += " " + html
                pages_crawled.append(page_path or '/')
        
        time.sleep(0.3)  # Be polite
    
    # Playwright fallback for thin content
    if len(all_text) < 500 and use_playwright_fallback and HAS_PLAYWRIGHT:
        html, _ = fetch_page_playwright(final_base_url)
        if html:
            soup = BeautifulSoup(html, 'html.parser')
            text = soup.get_text(separator=' ', strip=True)
            if len(text) > len(all_text):
                all_text = text
                all_html = html
                pages_crawled = ['/ (playwright)']
    
    combined_soup = BeautifulSoup(all_html, 'html.parser') if all_html else None
    
    return {
        'domain': domain,
        'status': 'ok',
        'pages_crawled': pages_crawled,
        'brands': find_brands(all_text),
        'phones': extract_phones(all_text)[:5],
        'emails': extract_emails(all_text)[:5],
        'social': extract_social(combined_soup) if combined_soup else {},
        'builder': detect_builder(all_html),
        'content_length': len(all_text)
    }

def get_dealers_to_crawl(conn):
    """Get FULL dealers with websites that haven't been crawled yet."""
    cursor = conn.cursor()
    
    # Get dealers with creatomate_website set
    cursor.execute("""
        SELECT d.dealer_no, d.display_name, d.dealer_name, d.creatomate_website, d.creatomate_phone
        FROM dealers d
        WHERE d.program_status = 'FULL'
          AND d.creatomate_website IS NOT NULL
          AND d.creatomate_website != ''
        ORDER BY d.dealer_name
    """)
    
    return cursor.fetchall()

def save_crawl_results(conn, dealer_no, result):
    """Save crawl results to dealer_contacts table."""
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    inserted = 0
    
    # Save phones
    for phone in result.get('phones', []):
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO dealer_contacts 
                (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                VALUES (?, 'phone', 'website', ?, 'website_crawl', ?, ?, 'high')
            """, (dealer_no, phone, today, f"Found on {result['domain']}"))
            inserted += cursor.rowcount
        except: pass
    
    # Save emails
    for email in result.get('emails', []):
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO dealer_contacts 
                (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                VALUES (?, 'email', 'website', ?, 'website_crawl', ?, ?, 'high')
            """, (dealer_no, email, today, f"Found on {result['domain']}"))
            inserted += cursor.rowcount
        except: pass
    
    # Save social links
    for platform, url in result.get('social', {}).items():
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO dealer_contacts 
                (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
                VALUES (?, 'social', ?, ?, 'website_crawl', ?, ?, 'high')
            """, (dealer_no, platform, url, today, f"Found on {result['domain']}"))
            inserted += cursor.rowcount
        except: pass
    
    conn.commit()
    return inserted

def validate_phones(conn, dealer_no, crawl_phones, existing_phone):
    """Check if crawled phones match existing phone."""
    if not existing_phone or not crawl_phones:
        return None
    
    existing_normalized = normalize_phone(existing_phone)
    if not existing_normalized:
        return None
    
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    
    for phone in crawl_phones:
        if phone == existing_normalized:
            # Match found - validate the existing phone
            cursor.execute("""
                UPDATE dealer_contacts 
                SET is_validated = 1, validated_by = 'crawl_match', validated_date = ?
                WHERE dealer_no = ? AND contact_type = 'phone' AND value = ?
            """, (today, dealer_no, phone))
            conn.commit()
            return 'match'
    
    return 'no_match'

def main():
    print("="*70)
    print("WEBSITE CRAWLER FOR ALLIED DEALER VALIDATION")
    print("="*70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Playwright available: {HAS_PLAYWRIGHT}\n")
    
    conn = sqlite3.connect(DB_PATH)
    
    # Get dealers to crawl
    dealers = get_dealers_to_crawl(conn)
    print(f"Found {len(dealers)} dealers with websites to crawl\n")
    
    results_summary = {
        'crawled': 0,
        'failed': 0,
        'phones_found': 0,
        'emails_found': 0,
        'social_found': 0,
        'phone_matches': 0
    }
    
    for i, (dealer_no, display_name, dealer_name, website, existing_phone) in enumerate(dealers):
        name = display_name or dealer_name
        print(f"[{i+1}/{len(dealers)}] {name[:40]:40} | {website[:30]:30}", end=' ', flush=True)
        
        result = crawl_site(website, use_playwright_fallback=HAS_PLAYWRIGHT)
        
        if result['status'] == 'ok':
            # Save results
            inserted = save_crawl_results(conn, dealer_no, result)
            
            # Check phone validation
            phone_status = validate_phones(conn, dealer_no, result['phones'], existing_phone)
            if phone_status == 'match':
                results_summary['phone_matches'] += 1
            
            results_summary['crawled'] += 1
            results_summary['phones_found'] += len(result['phones'])
            results_summary['emails_found'] += len(result['emails'])
            results_summary['social_found'] += len(result['social'])
            
            phones = len(result['phones'])
            emails = len(result['emails'])
            social = len(result['social'])
            match_indicator = '✓' if phone_status == 'match' else ''
            print(f"OK - {phones}ph {emails}em {social}soc {match_indicator}", flush=True)
        else:
            results_summary['failed'] += 1
            print(f"FAIL - {result.get('error', 'unknown')}", flush=True)
        
        time.sleep(0.5)  # Rate limiting
    
    # Print summary
    print("\n" + "="*70)
    print("CRAWL SUMMARY")
    print("="*70)
    print(f"Crawled successfully: {results_summary['crawled']}/{len(dealers)}")
    print(f"Failed: {results_summary['failed']}")
    print(f"Phones found: {results_summary['phones_found']}")
    print(f"Emails found: {results_summary['emails_found']}")
    print(f"Social links found: {results_summary['social_found']}")
    print(f"Phone matches (validated): {results_summary['phone_matches']}")
    
    # Final stats from database
    cursor = conn.cursor()
    cursor.execute("""
        SELECT contact_type, COUNT(*) 
        FROM dealer_contacts 
        WHERE source = 'website_crawl'
        GROUP BY contact_type
    """)
    print("\nNew contacts added from crawl:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
