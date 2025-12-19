#!/usr/bin/env python3
"""
Simple website crawler for Allied dealer validation.
Adapted from prospect_engine/scripts/enrich/crawl_pass1.py

Run in WSL terminal:
  cd ~/woodhouse_creative && python3 scripts/crawl_dealers.py 2>&1 | tee crawl_log.txt
"""
import requests
from bs4 import BeautifulSoup
import re
import time
import sqlite3
from datetime import datetime

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'

# Blocked domains (skip these)
BLOCKED_DOMAINS = {
    'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'youtube.com',
    'google.com', 'yelp.com', 'yellowpages.com', 'bbb.org', 'mapquest.com',
    'homeadvisor.com', 'angieslist.com', 'angi.com', 'thumbtack.com',
}

def normalize_phone(phone):
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    return digits if len(digits) == 10 else None

def extract_phones(text):
    phones = re.findall(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
    normalized = []
    for ph in phones:
        n = normalize_phone(ph)
        if n:
            normalized.append(n)
    return list(set(normalized))[:5]

def extract_emails(text):
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = [e.lower() for e in re.findall(pattern, text)]
    # Filter junk
    emails = [e for e in emails if not any(x in e for x in 
              ['.png', '.jpg', '.gif', '.svg', 'example.com', 'sentry.io', 'wixpress'])]
    return list(set(emails))[:5]

def extract_social(soup):
    social = {}
    for a in soup.find_all('a', href=True):
        href = a['href'].lower()
        if 'sharer' in href or 'share?' in href:
            continue
        if 'facebook.com' in href and 'facebook' not in social:
            social['facebook'] = a['href']
        elif 'instagram.com' in href and 'instagram' not in social:
            social['instagram'] = a['href']
        elif ('twitter.com' in href or 'x.com/' in href) and 'twitter' not in social:
            social['twitter'] = a['href']
        elif 'linkedin.com' in href and 'linkedin' not in social:
            social['linkedin'] = a['href']
        elif 'youtube.com' in href and 'youtube' not in social:
            social['youtube'] = a['href']
    return social

def fetch_page(url, timeout=8):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except:
        return None

def crawl_site(domain):
    """Crawl a single site, return extracted data."""
    if not domain:
        return None
    
    # Clean domain
    domain = domain.strip().lower()
    if domain.startswith('http'):
        domain = domain.split('//')[1].split('/')[0]
    domain = domain.replace('www.', '').rstrip('/')
    
    # Skip blocked
    if any(b in domain for b in BLOCKED_DOMAINS):
        return {'domain': domain, 'status': 'blocked'}
    
    # Try URLs
    for base in [f'https://{domain}', f'https://www.{domain}', f'http://{domain}']:
        html = fetch_page(base)
        if html and len(html) > 500:
            soup = BeautifulSoup(html, 'html.parser')
            text = soup.get_text(separator=' ', strip=True)
            
            return {
                'domain': domain,
                'status': 'ok',
                'phones': extract_phones(text),
                'emails': extract_emails(text),
                'social': extract_social(soup),
            }
    
    return {'domain': domain, 'status': 'error'}

def get_dealers_to_crawl(conn):
    """Get FULL dealers with websites."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT dealer_no, display_name, dealer_name, creatomate_website, creatomate_phone
        FROM dealers
        WHERE program_status = 'FULL'
          AND creatomate_website IS NOT NULL
          AND creatomate_website != ''
        ORDER BY dealer_name
    """)
    return cursor.fetchall()

def save_contact(conn, dealer_no, contact_type, subtype, value, source_detail):
    """Save a contact to dealer_contacts table."""
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO dealer_contacts 
            (dealer_no, contact_type, contact_subtype, value, source, source_date, source_detail, confidence)
            VALUES (?, ?, ?, ?, 'website_crawl', ?, ?, 'high')
        """, (dealer_no, contact_type, subtype, value, today, source_detail))
        return cursor.rowcount
    except:
        return 0

def main():
    print("=" * 70)
    print("ALLIED DEALER WEBSITE CRAWLER")
    print("=" * 70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    conn = sqlite3.connect(DB_PATH)
    dealers = get_dealers_to_crawl(conn)
    print(f"Found {len(dealers)} dealers with websites\n")
    
    stats = {'ok': 0, 'error': 0, 'blocked': 0, 'phones': 0, 'emails': 0, 'social': 0}
    
    for i, (dealer_no, display_name, dealer_name, website, existing_phone) in enumerate(dealers):
        name = (display_name or dealer_name or '')[:35]
        print(f"[{i+1:3}/{len(dealers)}] {name:35} | {website[:25]:25}", end=' ', flush=True)
        
        result = crawl_site(website)
        
        if not result:
            print("SKIP")
            continue
        
        if result['status'] == 'ok':
            stats['ok'] += 1
            
            # Save phones
            for phone in result.get('phones', []):
                if save_contact(conn, dealer_no, 'phone', 'website', phone, f"Crawled {result['domain']}"):
                    stats['phones'] += 1
            
            # Save emails
            for email in result.get('emails', []):
                if save_contact(conn, dealer_no, 'email', 'website', email, f"Crawled {result['domain']}"):
                    stats['emails'] += 1
            
            # Save social
            for platform, url in result.get('social', {}).items():
                if save_contact(conn, dealer_no, 'social', platform, url, f"Crawled {result['domain']}"):
                    stats['social'] += 1
            
            conn.commit()
            
            # Check if crawled phone matches existing
            match = ''
            if existing_phone and result.get('phones'):
                existing_norm = normalize_phone(existing_phone)
                if existing_norm in result['phones']:
                    match = ' ✓'
            
            p = len(result.get('phones', []))
            e = len(result.get('emails', []))
            s = len(result.get('social', {}))
            print(f"OK  {p}ph {e}em {s}soc{match}")
            
        elif result['status'] == 'blocked':
            stats['blocked'] += 1
            print("BLOCKED")
        else:
            stats['error'] += 1
            print("ERROR")
        
        time.sleep(1)  # Rate limit
    
    # Summary
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Successful:  {stats['ok']}")
    print(f"Errors:      {stats['error']}")
    print(f"Blocked:     {stats['blocked']}")
    print(f"New phones:  {stats['phones']}")
    print(f"New emails:  {stats['emails']}")
    print(f"New social:  {stats['social']}")
    print()
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    conn.close()

if __name__ == "__main__":
    main()
