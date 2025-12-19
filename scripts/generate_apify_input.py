#!/usr/bin/env python3
"""Generate Apify Google Maps Scraper input for dealers needing websites."""

import pandas as pd
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "apify"

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    
    # Get FULL dealers missing website
    query = """
        SELECT 
            dealer_no,
            dealer_name,
            display_name,
            city,
            state,
            turnkey_phone,
            distributor_name
        FROM dealers
        WHERE program_status = 'FULL'
          AND (website IS NULL OR website = '')
          AND (turnkey_url IS NULL OR turnkey_url = '')
        ORDER BY dealer_name
    """
    
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    print(f"Found {len(df)} dealers needing website lookup")
    
    # Build search queries using display_name (clean name) if available, else dealer_name
    search_queries = []
    dealer_mapping = []  # To map results back
    
    for idx, row in df.iterrows():
        # Use display_name if available, otherwise dealer_name
        name = row['display_name'] if pd.notna(row['display_name']) and row['display_name'] else row['dealer_name']
        city = row['city'] if pd.notna(row['city']) else ''
        state = row['state'] if pd.notna(row['state']) else ''
        
        # Build search query - add HVAC to help find the right business
        if city and state:
            query = f"{name} HVAC {city} {state}"
        elif state:
            query = f"{name} HVAC {state}"
        else:
            query = f"{name} HVAC"
        
        search_queries.append(query)
        dealer_mapping.append({
            'dealer_no': row['dealer_no'],
            'dealer_name': row['dealer_name'],
            'display_name': row['display_name'],
            'search_query': query,
            'city': city,
            'state': state,
            'existing_phone': row['turnkey_phone']
        })
    
    # Apify Google Maps Scraper input format
    apify_input = {
        "searchStringsArray": search_queries,
        "maxCrawledPlacesPerSearch": 1,  # Just need top result
        "language": "en",
        "deeperCityScrape": False,
        "includeWebResults": False,
        "scrapeContacts": True,  # Get phone, website
        "scrapeImages": False,   # Don't need images
        "scrapeReviews": False,  # Don't need reviews for this
        "scrapeOpeningHours": False
    }
    
    # Save Apify input JSON
    apify_input_path = OUTPUT_DIR / "google_maps_input.json"
    with open(apify_input_path, 'w') as f:
        json.dump(apify_input, f, indent=2)
    print(f"\nApify input saved to: {apify_input_path}")
    
    # Save dealer mapping for matching results back
    mapping_path = OUTPUT_DIR / "dealer_search_mapping.json"
    with open(mapping_path, 'w') as f:
        json.dump(dealer_mapping, f, indent=2)
    print(f"Dealer mapping saved to: {mapping_path}")
    
    # Also save as CSV for easy viewing
    mapping_df = pd.DataFrame(dealer_mapping)
    csv_path = OUTPUT_DIR / "dealer_search_mapping.csv"
    mapping_df.to_csv(csv_path, index=False)
    print(f"Dealer mapping CSV saved to: {csv_path}")
    
    # Print sample queries
    print("\n### Sample Search Queries ###")
    for i, q in enumerate(search_queries[:10]):
        print(f"  {i+1}. {q}")
    
    if len(search_queries) > 10:
        print(f"  ... and {len(search_queries) - 10} more")
    
    print(f"\n### Apify Input Summary ###")
    print(f"Total searches: {len(search_queries)}")
    print(f"Max results per search: 1")
    print(f"Estimated total results: {len(search_queries)}")

if __name__ == "__main__":
    main()
