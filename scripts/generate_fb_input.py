#!/usr/bin/env python3
"""Generate Apify Facebook Pages Scraper input for dealers without websites."""
import json
from pathlib import Path

# Dealers without websites
dealers = [
    {"dealer_no": "10206000", "display_name": "Bird Ventilation and Gasfitting LTD.", "city": "Vernon", "state": "British Columbia", "facebook_url": None},
    {"dealer_no": "10325016", "display_name": "Brotherton's Heating & Air", "city": "Lafollette", "state": "Tennessee", "facebook_url": "https://www.facebook.com/profile.php?id=100091624600819&mibextid=LQQJ4d"},
    {"dealer_no": "10177001", "display_name": "C&G Mechanical", "city": "Richmond", "state": "Texas", "facebook_url": None},
    {"dealer_no": "106944", "display_name": "Carstens Plumbing and Heating", "city": "IOWA FALLS", "state": "Iowa", "facebook_url": None},
    {"dealer_no": "10042030", "display_name": "Cortina Heating and Cooling", "city": "BERWYN", "state": "Illinois", "facebook_url": "https://www.facebook.com/HeatingandCoolingCortina"},
    {"dealer_no": "10076000", "display_name": "Delta Heating and Air", "city": "St Paul", "state": "Nebraska", "facebook_url": None},
    {"dealer_no": "106883", "display_name": "Derek Pike HVACR", "city": "MASON CITY", "state": "Iowa", "facebook_url": None},
    {"dealer_no": "10216023", "display_name": "Icon Heating and Cooling", "city": "West Chester", "state": "Ohio", "facebook_url": None},
    {"dealer_no": "103952", "display_name": "Majeski Plumbing & Heating", "city": "HASTINGS", "state": "Minnesota", "facebook_url": None},
    {"dealer_no": "108459", "display_name": "McCoy Boys HVAC", "city": "Thorton", "state": "Colorado", "facebook_url": None},
    {"dealer_no": "10391022", "display_name": "Prevent Services", "city": "Knoxville", "state": "Tennessee", "facebook_url": None},
    {"dealer_no": "103189", "display_name": "ROBERTSON'S HEATING", "city": "PLAQUEMINE", "state": "Louisiana", "facebook_url": None},
    {"dealer_no": "10321006", "display_name": "Titan Heating and Air", "city": "CHATTANOOGA", "state": "Tennessee", "facebook_url": None},
    {"dealer_no": "10141004", "display_name": "Whetzel's Heating and Air, LLC", "city": None, "state": None, "facebook_url": None},
]

# Build startUrls for dealers WITH known Facebook URLs
start_urls = []
for d in dealers:
    if d['facebook_url']:
        # Clean up URL
        url = d['facebook_url'].split('&mibextid')[0].split('?mibextid')[0]
        start_urls.append({
            "url": url,
            "userData": {
                "dealer_no": d['dealer_no'],
                "display_name": d['display_name']
            }
        })

# Apify Facebook Pages Scraper input
apify_input = {
    "startUrls": start_urls,
    "resultsLimit": 100,
}

print("=" * 60)
print("FACEBOOK PAGES SCRAPER INPUT")
print("=" * 60)
print(f"\nDealers with known Facebook URLs: {len(start_urls)}")
for s in start_urls:
    print(f"  - {s['userData']['display_name']}: {s['url']}")

print(f"\nDealers WITHOUT Facebook URLs (need manual search): {len([d for d in dealers if not d['facebook_url']])}")
for d in dealers:
    if not d['facebook_url']:
        search = f"{d['display_name']} HVAC {d['city']} {d['state']}" if d['city'] else d['display_name']
        print(f"  - {d['display_name']} → Search: {search}")

# Save input JSON
output_path = Path('/home/heygregwood/woodhouse_creative/data/apify/facebook_pages_input.json')
with open(output_path, 'w') as f:
    json.dump(apify_input, f, indent=2)

print(f"\n\nApify input saved to: {output_path}")
print("\nJSON for Apify Facebook Pages Scraper:")
print("-" * 60)
print(json.dumps(apify_input, indent=2))
