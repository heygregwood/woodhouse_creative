#!/usr/bin/env python3
import requests
try:
    r = requests.get('https://247heatingandair.com', timeout=10)
    print(f"Status: {r.status_code}, Length: {len(r.text)}")
except Exception as e:
    print(f"Error: {e}")
