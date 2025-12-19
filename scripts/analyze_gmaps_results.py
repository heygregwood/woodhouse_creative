#!/usr/bin/env python3
"""Analyze Google Maps Scraper results."""

import json
import pandas as pd
from pathlib import Path

RESULTS_FILE = Path("/mnt/c/Users/GregWood/Downloads/dataset_crawler-google-places_2025-12-19_02-07-03-923.json")
MAPPING_FILE = Path(__file__).parent.parent / "data" / "apify" / "dealer_search_mapping.json"

# Load results
with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
    results = json.load(f)

print(f"Total results: {len(results)}")

# Analyze what we got
has_website = sum(1 for r in results if r.get('website'))
has_phone = sum(1 for r in results if r.get('phone'))
has_address = sum(1 for r in results if r.get('address'))

print(f"\n### Data Quality ###")
print(f"Has website: {has_website}/{len(results)}")
print(f"Has phone: {has_phone}/{len(results)}")
print(f"Has address: {has_address}/{len(results)}")

# Show sample results
print(f"\n### Sample Results (first 5) ###")
for i, r in enumerate(results[:5]):
    print(f"\n{i+1}. {r.get('title', 'NO TITLE')}")
    print(f"   Search: {r.get('searchString', 'N/A')}")
    print(f"   Website: {r.get('website', 'NONE')}")
    print(f"   Phone: {r.get('phone', 'NONE')}")
    print(f"   Address: {r.get('address', 'NONE')}")
    print(f"   City: {r.get('city', 'N/A')}, State: {r.get('state', 'N/A')}")

# Show results WITHOUT website (these need alternative approach)
print(f"\n### Results WITHOUT Website ###")
no_website = [r for r in results if not r.get('website')]
print(f"Count: {len(no_website)}")
for r in no_website[:10]:
    print(f"  - {r.get('title', 'NO TITLE')} | {r.get('searchString', '')[:50]}...")

# Check for potential mismatches (search string vs result title)
print(f"\n### Potential Mismatches (review needed) ###")
mismatches = []
for r in results:
    search = r.get('searchString', '').lower()
    title = r.get('title', '').lower()
    # Simple check - if first word of search doesn't appear in title
    first_word = search.split()[0] if search else ''
    if first_word and len(first_word) > 3 and first_word not in title:
        mismatches.append({
            'search': r.get('searchString'),
            'found': r.get('title'),
            'website': r.get('website')
        })

print(f"Count: {len(mismatches)}")
for m in mismatches[:10]:
    print(f"  Search: {m['search'][:50]}...")
    print(f"  Found:  {m['found']}")
    print(f"  Website: {m['website']}")
    print()
