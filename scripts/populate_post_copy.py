#!/usr/bin/env python3
"""
Populate personalized post copy for all dealers in the scheduling spreadsheet.

Reads base copy from column C for a given post row, replaces variables with
dealer-specific values, and writes to each dealer's column.

Variables supported:
  {phone} - Dealer's phone number (from row 9)
  {website} - Dealer's website (from row 8)
  {name} - Dealer's display name (from row 11)

Usage:
    python3 scripts/populate_post_copy.py --post 666
    python3 scripts/populate_post_copy.py --post 666 --dry-run
"""

import argparse
import os
import sqlite3
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

# Google Sheets settings
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY'

# Row indices (0-based)
ROW_DEALER_NO = 0      # Row 1: Dealer numbers
ROW_PHONE = 8          # Row 9: Phone
ROW_WEBSITE = 7        # Row 8: Website
ROW_NAME = 10          # Row 11: Display name
ROW_POST_HEADER = 11   # Row 12: Post header (Post #, Notes, Base Copy, etc.)

# Column indices (0-based)
COL_POST_NUM = 0       # Column A: Post number
COL_BASE_COPY = 2      # Column C: Base copy
COL_DEALERS_START = 5  # Column F: First dealer column


def get_sheets_service():
    """Get authenticated Google Sheets service."""
    service_account_email = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if not service_account_email or not private_key:
        raise ValueError("Missing Google credentials")

    private_key = private_key.replace('\\n', '\n')

    credentials = service_account.Credentials.from_service_account_info(
        {
            'type': 'service_account',
            'client_email': service_account_email,
            'private_key': private_key,
            'token_uri': 'https://oauth2.googleapis.com/token',
        },
        scopes=SCOPES
    )
    return build('sheets', 'v4', credentials=credentials)


def get_cell_value(rows, row_idx, col_idx):
    """Safely get cell value from rows data."""
    if row_idx >= len(rows):
        return ""
    row = rows[row_idx]
    if col_idx >= len(row):
        return ""
    return str(row[col_idx]).strip()


def main():
    parser = argparse.ArgumentParser(description="Populate personalized post copy")
    parser.add_argument("--post", type=int, required=True, help="Post number (e.g., 666)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    print("=" * 60)
    print(f"POPULATE POST COPY - Post {args.post}")
    print("=" * 60)

    service = get_sheets_service()

    # Read all data from sheet
    print("\nReading spreadsheet...")
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Sheet1!A1:ZZ200"  # Wide range to capture all dealers
    ).execute()

    rows = result.get('values', [])
    print(f"  Found {len(rows)} rows, {max(len(r) for r in rows)} columns")

    # Find the post row
    post_row_idx = None
    for i, row in enumerate(rows):
        if i > ROW_POST_HEADER and len(row) > COL_POST_NUM:
            try:
                if int(row[COL_POST_NUM]) == args.post:
                    post_row_idx = i
                    break
            except (ValueError, TypeError):
                continue

    if post_row_idx is None:
        print(f"\n❌ Post {args.post} not found in spreadsheet")
        return

    print(f"  Post {args.post} found at row {post_row_idx + 1}")

    # Get base copy
    base_copy = get_cell_value(rows, post_row_idx, COL_BASE_COPY)
    if not base_copy:
        print(f"\n❌ No base copy found in column C for post {args.post}")
        return

    print(f"\n📝 Base copy: {base_copy}")

    # Get dealer columns
    dealer_row = rows[ROW_DEALER_NO] if len(rows) > ROW_DEALER_NO else []
    num_dealers = len(dealer_row) - COL_DEALERS_START

    print(f"\n👥 Processing {num_dealers} dealer columns...")

    # Build updates
    updates = []
    for col_idx in range(COL_DEALERS_START, len(dealer_row)):
        dealer_no = get_cell_value(rows, ROW_DEALER_NO, col_idx)
        phone = get_cell_value(rows, ROW_PHONE, col_idx)
        website = get_cell_value(rows, ROW_WEBSITE, col_idx)
        name = get_cell_value(rows, ROW_NAME, col_idx)

        if not dealer_no or dealer_no == "Dealer Number":
            continue

        # Replace variables
        personalized = base_copy
        personalized = personalized.replace("{phone}", phone)
        personalized = personalized.replace("{number}", phone)  # Alias for {phone}
        personalized = personalized.replace("{website}", website)
        personalized = personalized.replace("{name}", name)

        # Convert column index to letter(s)
        if col_idx < 26:
            col_letter = chr(65 + col_idx)
        else:
            col_letter = chr(64 + col_idx // 26) + chr(65 + col_idx % 26)

        cell_ref = f"Sheet1!{col_letter}{post_row_idx + 1}"

        updates.append({
            'dealer_no': dealer_no,
            'name': name,
            'cell': cell_ref,
            'value': personalized,
        })

    print(f"\n✅ Prepared {len(updates)} updates")

    if args.dry_run:
        print("\n[DRY RUN] Would write:")
        for u in updates[:5]:  # Show first 5
            print(f"  {u['name']}: {u['value'][:60]}...")
        if len(updates) > 5:
            print(f"  ... and {len(updates) - 5} more")
        return

    # Write updates to sheet
    print("\n📤 Writing to spreadsheet...")

    # Batch update
    data = [
        {
            'range': u['cell'],
            'values': [[u['value']]]
        }
        for u in updates
    ]

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={
            'valueInputOption': 'RAW',
            'data': data
        }
    ).execute()

    print(f"\n✅ Updated {len(updates)} cells!")

    # Show sample
    print("\nSample updates:")
    for u in updates[:3]:
        print(f"  {u['name']}: {u['value']}")


if __name__ == "__main__":
    main()
