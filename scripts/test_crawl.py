#!/usr/bin/env python3
"""Quick test of crawl function."""
import sys
sys.path.insert(0, '/home/heygregwood/woodhouse_creative/scripts')

from crawl_websites import crawl_site

print("Testing crawl...", flush=True)
result = crawl_site('hotairnow.com', use_playwright_fallback=False)
print(f"Result: {result}", flush=True)
