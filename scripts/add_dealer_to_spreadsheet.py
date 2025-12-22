#!/usr/bin/env python3
"""
Add a new FULL dealer to the scheduling spreadsheet.

This script adds a new column for a dealer who was just promoted to FULL status.
It inserts the dealer at the end of the existing dealer columns and populates
their metadata from the database.

Usage:
    python3 scripts/add_dealer_to_spreadsheet.py 10122026
    python3 scripts/add_dealer_to_spreadsheet.py 10122026 --dry-run
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# Google Sheets settings
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY'

# Row indices (1-based for clarity in output)
ROW_DEALER_NO = 1      # Row 1: Dealer numbers
ROW_EMAIL_STATUS = 2   # Row 2: Schedule Email Status
ROW_LAST_POST = 3      # Row 3: Last Post Date
ROW_WHO_POSTED = 4     # Row 4: Who Posted
ROW_FIRST_NAME = 5     # Row 5: First Name
ROW_EMAIL = 6          # Row 6: Email
ROW_REGION = 7         # Row 7: Region
ROW_WEBSITE = 8        # Row 8: Website
ROW_PHONE = 9          # Row 9: Phone
ROW_DISTRIBUTOR = 10   # Row 10: Distributor/Dealer Name
ROW_DISPLAY_NAME = 11  # Row 11: Display name
ROW_POST_HEADER = 12   # Row 12: Post header row
ROW_POSTS_START = 13   # Row 13+: Post rows with base copy in column C

# Column indices (0-based)
COL_DEALERS_START = 6  # Column G - where dealer columns start
COL_BASE_COPY = 2      # Column C - base post copy with {number} placeholder


def get_sheets_service():
    """Get authenticated Google Sheets service."""
    service_account_email = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if not service_account_email or not private_key:
        raise ValueError("Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")

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


def get_dealer_from_db(dealer_no: str) -> dict:
    """Get dealer data from SQLite database."""
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
            distributor_name,
            contact_first_name,
            contact_name,
            contact_email,
            region,
            program_status
        FROM dealers
        WHERE dealer_no = ?
    """, (dealer_no,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    # For first_name: use contact_first_name if available, otherwise extract from contact_name
    first_name = row['contact_first_name'] or ''
    if not first_name and row['contact_name']:
        # Extract first name from full contact name (e.g., "Greg Wood" -> "Greg")
        first_name = row['contact_name'].split()[0] if row['contact_name'] else ''

    return {
        'dealer_no': row['dealer_no'],
        'display_name': row['display_name'] or '',
        'phone': row['creatomate_phone'] or '',
        'website': row['creatomate_website'] or '',
        'dealer_name': row['dealer_name'] or '',
        'distributor_name': row['distributor_name'] or '',
        'first_name': first_name,
        'email': row['contact_email'] or '',
        'region': row['region'] or '',
        'program_status': row['program_status'],
    }


def col_to_letter(col_idx: int) -> str:
    """Convert 0-based column index to letter(s)."""
    if col_idx < 26:
        return chr(65 + col_idx)
    else:
        return chr(64 + col_idx // 26) + chr(65 + col_idx % 26)


def find_dealer_column(rows: list, dealer_no: str) -> int:
    """Find column index for a dealer, or -1 if not found."""
    if not rows or len(rows) == 0:
        return -1

    dealer_row = rows[0]  # Row 1 has dealer numbers

    for col_idx in range(COL_DEALERS_START, len(dealer_row)):
        cell_value = str(dealer_row[col_idx]).strip()

        # Handle float formatting
        try:
            if '.' in cell_value or 'E' in cell_value.upper():
                cell_value = str(int(float(cell_value)))
        except:
            pass

        if cell_value == dealer_no:
            return col_idx

    return -1


def find_next_empty_column(rows: list) -> int:
    """Find the next empty column after all existing dealers."""
    if not rows or len(rows) == 0:
        return COL_DEALERS_START

    dealer_row = rows[0]  # Row 1 has dealer numbers

    # Find the last non-empty column
    last_col = COL_DEALERS_START - 1
    for col_idx in range(COL_DEALERS_START, len(dealer_row)):
        cell_value = str(dealer_row[col_idx]).strip()
        if cell_value and cell_value != "Dealer Number":
            last_col = col_idx

    return last_col + 1


def add_dealer_to_spreadsheet(dealer_no: str, dry_run: bool = False) -> dict:
    """Add a dealer to the scheduling spreadsheet."""
    result = {
        'success': False,
        'dealer_no': dealer_no,
        'message': '',
        'column': None,
    }

    # Get dealer from database
    dealer = get_dealer_from_db(dealer_no)
    if not dealer:
        result['message'] = f"Dealer {dealer_no} not found in database"
        return result

    if dealer['program_status'] != 'FULL':
        result['message'] = f"Dealer {dealer_no} is not FULL status (status: {dealer['program_status']})"
        return result

    print(f"Adding dealer {dealer_no} ({dealer['display_name']}) to spreadsheet...")

    # Get spreadsheet data
    # Read a wide range to ensure we capture all existing dealer columns
    # Column KU = 307 columns which gives room for 300+ dealers
    # Read up to row 1000 to capture all post rows (row 13+ have base post copy)
    service = get_sheets_service()
    sheet_result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Sheet1!A1:KU1000"
    ).execute()

    rows = sheet_result.get('values', [])

    # Check if dealer already exists
    existing_col = find_dealer_column(rows, dealer_no)
    if existing_col >= 0:
        col_letter = col_to_letter(existing_col)
        result['message'] = f"Dealer {dealer_no} already exists in column {col_letter}"
        result['column'] = col_letter
        result['success'] = True
        print(f"  Dealer already exists in column {col_letter}")
        return result

    # Find next empty column
    new_col = find_next_empty_column(rows)
    col_letter = col_to_letter(new_col)

    print(f"  Will add to column {col_letter} (index {new_col})")

    # Prepare updates - Row mapping:
    # Row 1: Dealer Number
    # Row 2: Schedule Email Status (empty)
    # Row 3: Last Post Date (empty)
    # Row 4: Who Posted (empty)
    # Row 5: First Name
    # Row 6: Email
    # Row 7: Region
    # Row 8: Website
    # Row 9: Phone
    # Row 10: Distributor Name (from Allied Excel "Distributor Branch Name")
    # Row 11: Dealer Name (from Allied Excel "Dealer Name")
    updates = [
        {'range': f"Sheet1!{col_letter}1", 'values': [[dealer_no]]},
        {'range': f"Sheet1!{col_letter}2", 'values': [['Pending']]},  # Email Status - Pending
        {'range': f"Sheet1!{col_letter}3", 'values': [['']]},  # Last Post Date - empty
        {'range': f"Sheet1!{col_letter}4", 'values': [['']]},  # Who Posted - empty
        {'range': f"Sheet1!{col_letter}5", 'values': [[dealer['first_name']]]},
        {'range': f"Sheet1!{col_letter}6", 'values': [[dealer['email']]]},
        {'range': f"Sheet1!{col_letter}7", 'values': [[dealer['region']]]},
        {'range': f"Sheet1!{col_letter}8", 'values': [[dealer['website']]]},
        {'range': f"Sheet1!{col_letter}9", 'values': [[dealer['phone']]]},
        {'range': f"Sheet1!{col_letter}10", 'values': [[dealer['distributor_name']]]},
        {'range': f"Sheet1!{col_letter}11", 'values': [[dealer['dealer_name']]]},
    ]

    # Populate personalized post copy for all post rows
    # Row 13+ have base copy in column C with {number} placeholder
    post_copy_count = 0
    for row_idx in range(ROW_POSTS_START - 1, len(rows)):  # row_idx is 0-based
        row = rows[row_idx]
        # Check if this row has base copy in column C
        if len(row) > COL_BASE_COPY:
            base_copy = row[COL_BASE_COPY]
            if base_copy and '{number}' in base_copy:
                # Replace {number} with dealer's phone
                personalized_copy = base_copy.replace('{number}', dealer['phone'])
                row_num = row_idx + 1  # Convert to 1-based row number
                updates.append({
                    'range': f"Sheet1!{col_letter}{row_num}",
                    'values': [[personalized_copy]]
                })
                post_copy_count += 1

    print(f"  Will populate {post_copy_count} post copy rows")

    if dry_run:
        print(f"\n  [DRY RUN] Would write to column {col_letter}:")
        for u in updates[:11]:  # Show dealer metadata
            print(f"    {u['range']}: {u['values'][0][0]}")
        if post_copy_count > 0:
            print(f"    ... plus {post_copy_count} post copy rows (row 13+)")
        result['success'] = True
        result['column'] = col_letter
        result['message'] = f"[DRY RUN] Would add to column {col_letter}"
        return result

    # Write to spreadsheet
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={
            'valueInputOption': 'RAW',
            'data': updates
        }
    ).execute()

    result['success'] = True
    result['column'] = col_letter
    result['message'] = f"Added dealer to column {col_letter}"
    print(f"  ✅ Added dealer to column {col_letter}")

    return result


def main():
    parser = argparse.ArgumentParser(description="Add a dealer to the scheduling spreadsheet")
    parser.add_argument("dealer_no", help="Dealer number to add")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    result = add_dealer_to_spreadsheet(args.dealer_no, args.dry_run)

    if result['success']:
        print(f"\n✅ {result['message']}")
        sys.exit(0)
    else:
        print(f"\n❌ {result['message']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
