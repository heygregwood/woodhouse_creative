#!/usr/bin/env python3
"""
Sync scheduling spreadsheet with SQLite database (source of truth).

Two functions:
1. Populate dealer metadata (rows 8-11) from database based on dealer_no match
2. Populate personalized post copy using database values (not spreadsheet values)

Usage:
    python3 scripts/sync_spreadsheet.py --sync-dealers          # Sync dealer metadata
    python3 scripts/sync_spreadsheet.py --post 666              # Populate post copy
    python3 scripts/sync_spreadsheet.py --sync-dealers --post 666  # Both
    python3 scripts/sync_spreadsheet.py --dry-run ...           # Preview only
"""

import argparse
import os
import sqlite3
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# Google Sheets settings
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY'

# Row indices (0-based) - these are the row numbers minus 1
ROW_DEALER_NO = 0      # Row 1: Dealer numbers
ROW_EMAIL_STATUS = 1   # Row 2: Schedule Email Status (Olivia)
ROW_LAST_POST = 2      # Row 3: Last Post Date (Olivia)
ROW_WHO_POSTED = 3     # Row 4: Who Posted (Olivia)
ROW_FIRST_NAME = 4     # Row 5: First Name
ROW_EMAIL = 5          # Row 6: Email
ROW_REGION = 6         # Row 7: Region
ROW_WEBSITE = 7        # Row 8: Website
ROW_PHONE = 8          # Row 9: Phone
ROW_DISTRIBUTOR = 9    # Row 10: Distributor/Dealer Name
ROW_DISPLAY_NAME = 10  # Row 11: Display name
ROW_POST_HEADER = 11   # Row 12: Post header row

# Column indices (0-based)
COL_POST_NUM = 0       # Column A: Post number
COL_BASE_COPY = 2      # Column C: Base copy
COL_DEALERS_START = 6  # Column G: First dealer column (F is label column)


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


def get_dealers_from_db() -> dict:
    """Get all FULL dealers from SQLite database, keyed by dealer_no."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            dealer_no,
            display_name,
            creatomate_phone,
            creatomate_website,
            dealer_name,
            contact_first_name,
            contact_email,
            region
        FROM dealers
        WHERE program_status = 'FULL'
    """)

    dealers = {}
    for row in cursor.fetchall():
        dealers[row['dealer_no']] = {
            'dealer_no': row['dealer_no'],
            'display_name': row['display_name'] or '',
            'phone': row['creatomate_phone'] or '',
            'website': row['creatomate_website'] or '',
            'dealer_name': row['dealer_name'] or '',
            'first_name': row['contact_first_name'] or '',
            'email': row['contact_email'] or '',
            'region': row['region'] or '',
        }

    conn.close()
    return dealers


def get_cell_value(rows, row_idx, col_idx):
    """Safely get cell value from rows data."""
    if row_idx >= len(rows):
        return ""
    row = rows[row_idx]
    if col_idx >= len(row):
        return ""
    return str(row[col_idx]).strip()


def col_to_letter(col_idx):
    """Convert 0-based column index to letter(s)."""
    if col_idx < 26:
        return chr(65 + col_idx)
    else:
        return chr(64 + col_idx // 26) + chr(65 + col_idx % 26)


def sync_dealer_metadata(service, rows, dealers_db, dry_run=False):
    """Sync dealer metadata rows (8-11) from database."""
    print("\n📊 SYNCING DEALER METADATA")
    print("=" * 50)

    updates = []
    dealer_row = rows[ROW_DEALER_NO] if len(rows) > ROW_DEALER_NO else []

    matched = 0
    not_found = 0

    for col_idx in range(COL_DEALERS_START, len(dealer_row)):
        dealer_no = get_cell_value(rows, ROW_DEALER_NO, col_idx)

        if not dealer_no or dealer_no == "Dealer Number":
            continue

        col_letter = col_to_letter(col_idx)

        # Clean dealer_no (handle float formatting like "0.0000001" for 99999001)
        original_dealer_no = dealer_no
        try:
            # Try to parse as float then int to handle scientific notation
            float_val = float(dealer_no)
            # Check if it's a very small number (scientific notation for large int)
            if float_val < 1 and float_val > 0:
                # This is like 0.0000001 which is 1e-7, but we want 99999001
                # The spreadsheet is showing 99999001 as 0.0000001 incorrectly
                # Try to match by display name instead
                display_name = get_cell_value(rows, ROW_DISPLAY_NAME, col_idx)
                found_by_name = False
                for d_no, d_data in dealers_db.items():
                    if d_data['display_name'].lower().strip() == display_name.lower().strip():
                        dealer_no = d_no
                        found_by_name = True
                        print(f"  ℹ️  Matched '{display_name}' to dealer {dealer_no} by name")
                        break
                if not found_by_name:
                    print(f"  ⚠️  Could not match dealer in col {col_letter} (value: {original_dealer_no})")
                    continue
            else:
                dealer_no = str(int(float_val))
        except:
            pass

        if dealer_no in dealers_db:
            dealer = dealers_db[dealer_no]
            matched += 1

            # Row 5: First Name
            updates.append({
                'range': f"Sheet1!{col_letter}5",
                'values': [[dealer['first_name']]]
            })

            # Row 6: Email
            updates.append({
                'range': f"Sheet1!{col_letter}6",
                'values': [[dealer['email']]]
            })

            # Row 7: Region
            updates.append({
                'range': f"Sheet1!{col_letter}7",
                'values': [[dealer['region']]]
            })

            # Row 8: Website
            updates.append({
                'range': f"Sheet1!{col_letter}8",
                'values': [[dealer['website']]]
            })

            # Row 9: Phone
            updates.append({
                'range': f"Sheet1!{col_letter}9",
                'values': [[dealer['phone']]]
            })

            # Row 10: Distributor (using dealer_name from Allied)
            updates.append({
                'range': f"Sheet1!{col_letter}10",
                'values': [[dealer['dealer_name']]]
            })

            # Row 11: Display Name
            updates.append({
                'range': f"Sheet1!{col_letter}11",
                'values': [[dealer['display_name']]]
            })

        else:
            not_found += 1
            print(f"  ⚠️  Dealer {dealer_no} (col {col_letter}) not found in database")

    print(f"\n  ✅ Matched: {matched} dealers")
    print(f"  ⚠️  Not found: {not_found} dealers")
    print(f"  📝 Updates prepared: {len(updates)} cells")

    if dry_run:
        print("\n  [DRY RUN] Would update rows 8-11 for all matched dealers")
        return 0

    if updates:
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                'valueInputOption': 'RAW',
                'data': updates
            }
        ).execute()
        print(f"\n  ✅ Updated {len(updates)} cells!")

    return len(updates)


def populate_post_copy(service, rows, dealers_db, post_number, dry_run=False):
    """Populate personalized post copy using database values."""
    print(f"\n📝 POPULATING POST {post_number} COPY")
    print("=" * 50)

    # Find the post row
    post_row_idx = None
    for i, row in enumerate(rows):
        if i > ROW_POST_HEADER and len(row) > COL_POST_NUM:
            try:
                if int(row[COL_POST_NUM]) == post_number:
                    post_row_idx = i
                    break
            except (ValueError, TypeError):
                continue

    if post_row_idx is None:
        print(f"  ❌ Post {post_number} not found in spreadsheet")
        return 0

    print(f"  Found post {post_number} at row {post_row_idx + 1}")

    # Get base copy
    base_copy = get_cell_value(rows, post_row_idx, COL_BASE_COPY)
    if not base_copy:
        print(f"  ❌ No base copy found in column C for post {post_number}")
        return 0

    print(f"  Base copy: {base_copy[:60]}...")

    updates = []
    dealer_row = rows[ROW_DEALER_NO] if len(rows) > ROW_DEALER_NO else []

    matched = 0
    not_found = 0

    for col_idx in range(COL_DEALERS_START, len(dealer_row)):
        dealer_no = get_cell_value(rows, ROW_DEALER_NO, col_idx)

        if not dealer_no or dealer_no == "Dealer Number":
            continue

        # Clean dealer_no
        try:
            if '.' in dealer_no or 'E' in dealer_no.upper():
                dealer_no = str(int(float(dealer_no)))
        except:
            pass

        col_letter = col_to_letter(col_idx)

        if dealer_no in dealers_db:
            dealer = dealers_db[dealer_no]
            matched += 1

            # Replace variables using DATABASE values (source of truth)
            personalized = base_copy
            personalized = personalized.replace("{phone}", dealer['phone'])
            personalized = personalized.replace("{number}", dealer['phone'])
            personalized = personalized.replace("{website}", dealer['website'])
            personalized = personalized.replace("{name}", dealer['display_name'])

            cell_ref = f"Sheet1!{col_letter}{post_row_idx + 1}"

            updates.append({
                'range': cell_ref,
                'values': [[personalized]]
            })

        else:
            not_found += 1

    print(f"\n  ✅ Matched: {matched} dealers")
    print(f"  ⚠️  Not found: {not_found} dealers")
    print(f"  📝 Updates prepared: {len(updates)} cells")

    if dry_run:
        print("\n  [DRY RUN] Sample updates:")
        for u in updates[:3]:
            print(f"    {u['range']}: {u['values'][0][0][:50]}...")
        return 0

    if updates:
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                'valueInputOption': 'RAW',
                'data': updates
            }
        ).execute()
        print(f"\n  ✅ Updated {len(updates)} cells!")

    return len(updates)


def main():
    parser = argparse.ArgumentParser(description="Sync scheduling spreadsheet with database")
    parser.add_argument("--sync-dealers", action="store_true", help="Sync dealer metadata (rows 8-11)")
    parser.add_argument("--post", type=int, help="Populate post copy for given post number")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    if not args.sync_dealers and not args.post:
        print("Usage: Specify --sync-dealers and/or --post NUMBER")
        return

    print("=" * 60)
    print("SYNC SPREADSHEET FROM DATABASE")
    print("=" * 60)

    # Get database data
    print("\n📁 Loading dealers from SQLite database...")
    dealers_db = get_dealers_from_db()
    print(f"  Found {len(dealers_db)} FULL dealers")

    # Get spreadsheet data
    print("\n📊 Reading spreadsheet...")
    service = get_sheets_service()

    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Sheet1!A1:EA200"  # Columns A to EA (131 columns), 200 rows
    ).execute()

    rows = result.get('values', [])
    print(f"  Found {len(rows)} rows, {max(len(r) for r in rows) if rows else 0} columns")

    total_updates = 0

    # Sync dealer metadata
    if args.sync_dealers:
        total_updates += sync_dealer_metadata(service, rows, dealers_db, args.dry_run)

    # Populate post copy
    if args.post:
        # Re-read if we just updated
        if args.sync_dealers and not args.dry_run:
            result = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range="Sheet1!A1:EA200"
            ).execute()
            rows = result.get('values', [])

        total_updates += populate_post_copy(service, rows, dealers_db, args.post, args.dry_run)

    print("\n" + "=" * 60)
    if args.dry_run:
        print("[DRY RUN] No changes made")
    else:
        print(f"✅ COMPLETE - {total_updates} total cell updates")
    print("=" * 60)


if __name__ == "__main__":
    main()
