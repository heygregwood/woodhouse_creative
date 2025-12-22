#!/usr/bin/env python3
"""
Update dealer program status (CONTENT <-> FULL) based on Facebook admin access.

When a dealer grants FB admin access:
  - Updates SQLite: program_status = 'FULL'
  - Adds to scheduling spreadsheet
  - Creates Google Drive folder
  - Flags for logo upload (needs_logo = 1)

When a dealer removes FB admin access:
  - Updates SQLite: program_status = 'CONTENT'
  - Removes from scheduling spreadsheet

Usage:
    python3 scripts/update_dealer_status.py --promote "Frank Devos National Heating and Cooling"
    python3 scripts/update_dealer_status.py --demote "Owen AC Services, LLC"
    python3 scripts/update_dealer_status.py --promote --dealer-no 10122026
    python3 scripts/update_dealer_status.py --dry-run --promote "Test Dealer"
"""

import argparse
import os
import sqlite3
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

from google.oauth2 import service_account
from googleapiclient.discovery import build

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# Google API settings
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY'
DEALERS_FOLDER_ID = '1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv'  # Creative Automation/Dealers

# Spreadsheet row indices (0-based)
ROW_DEALER_NO = 0
ROW_EMAIL_STATUS = 1
COL_DEALERS_START = 6  # Column G


def get_google_credentials():
    """Get Google API credentials."""
    service_account_email = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if not service_account_email or not private_key:
        raise ValueError("Missing Google credentials")

    private_key = private_key.replace('\\n', '\n')

    return service_account.Credentials.from_service_account_info(
        {
            'type': 'service_account',
            'client_email': service_account_email,
            'private_key': private_key,
            'token_uri': 'https://oauth2.googleapis.com/token',
        },
        scopes=SCOPES
    )


def get_sheets_service():
    """Get authenticated Google Sheets service."""
    credentials = get_google_credentials()
    return build('sheets', 'v4', credentials=credentials)


def get_drive_service():
    """Get authenticated Google Drive service."""
    credentials = get_google_credentials()
    return build('drive', 'v3', credentials=credentials)


def find_dealer_by_name(name: str) -> dict:
    """Find dealer in database by display_name or dealer_name (fuzzy match)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Try exact match on display_name first
    cursor.execute("""
        SELECT * FROM dealers
        WHERE LOWER(display_name) = LOWER(?)
           OR LOWER(dealer_name) = LOWER(?)
    """, (name, name))

    row = cursor.fetchone()

    if not row:
        # Try partial match
        search_term = f"%{name}%"
        cursor.execute("""
            SELECT * FROM dealers
            WHERE LOWER(display_name) LIKE LOWER(?)
               OR LOWER(dealer_name) LIKE LOWER(?)
        """, (search_term, search_term))
        row = cursor.fetchone()

    conn.close()

    if row:
        return dict(row)
    return None


def find_dealer_by_no(dealer_no: str) -> dict:
    """Find dealer in database by dealer_no."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM dealers WHERE dealer_no = ?", (dealer_no,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None


def update_database_status(dealer_no: str, new_status: str, needs_logo: bool = False, dry_run: bool = False):
    """Update dealer's program_status in SQLite."""
    if dry_run:
        print(f"  [DRY RUN] Would update database: {dealer_no} -> {new_status}")
        if needs_logo:
            print(f"  [DRY RUN] Would set needs_logo = 1")
        return True

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if needs_logo:
        cursor.execute("""
            UPDATE dealers
            SET program_status = ?,
                needs_logo = 1,
                updated_at = ?
            WHERE dealer_no = ?
        """, (new_status, datetime.now().isoformat(), dealer_no))
    else:
        cursor.execute("""
            UPDATE dealers
            SET program_status = ?,
                updated_at = ?
            WHERE dealer_no = ?
        """, (new_status, datetime.now().isoformat(), dealer_no))

    conn.commit()
    conn.close()
    print(f"  ✅ Database updated: {dealer_no} -> {new_status}")
    if needs_logo:
        print(f"  ✅ Flagged for logo upload (needs_logo = 1)")
    return True


def add_to_spreadsheet(dealer: dict, dry_run: bool = False):
    """Add dealer column to scheduling spreadsheet."""
    if dry_run:
        print(f"  [DRY RUN] Would add to spreadsheet: {dealer['display_name']}")
        return True

    service = get_sheets_service()

    # Read current row 1 to find next available column
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='Sheet1!1:11'
    ).execute()

    rows = result.get('values', [])
    if not rows:
        print("  ❌ Spreadsheet is empty")
        return False

    # Find next column after existing dealers
    next_col = len(rows[0])

    # Convert to column letter
    if next_col < 26:
        col_letter = chr(65 + next_col)
    else:
        col_letter = chr(64 + next_col // 26) + chr(65 + next_col % 26)

    # Prepare data for new column (rows 1-11)
    new_column_data = [
        [dealer['dealer_no']],                              # Row 1: Dealer Number
        ['Pending'],                                        # Row 2: Schedule Email Status
        [''],                                               # Row 3: Last Post Date
        [''],                                               # Row 4: Who Posted
        [dealer.get('contact_first_name', '')],             # Row 5: First Name
        [dealer.get('contact_email', '')],                  # Row 6: Email
        [dealer.get('region', '')],                         # Row 7: Region
        [dealer.get('creatomate_website', '')],             # Row 8: Website
        [dealer.get('creatomate_phone', '')],               # Row 9: Phone
        [dealer.get('dealer_name', '')],                    # Row 10: Distributor
        [dealer.get('display_name', '')],                   # Row 11: Display Name
    ]

    # Write the new column
    for i, value in enumerate(new_column_data):
        cell_ref = f"Sheet1!{col_letter}{i + 1}"
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=cell_ref,
            valueInputOption='RAW',
            body={'values': [value]}
        ).execute()

    print(f"  ✅ Added to spreadsheet at column {col_letter}")
    return True


def remove_from_spreadsheet(dealer_no: str, dry_run: bool = False):
    """Remove dealer column from scheduling spreadsheet."""
    if dry_run:
        print(f"  [DRY RUN] Would remove from spreadsheet: {dealer_no}")
        return True

    service = get_sheets_service()

    # Read row 1 to find dealer column
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='Sheet1!1:1'
    ).execute()

    row1 = result.get('values', [[]])[0]

    # Find the column for this dealer
    col_idx = None
    for i in range(COL_DEALERS_START, len(row1)):
        cell_value = str(row1[i]).strip()
        try:
            if '.' in cell_value or 'E' in cell_value.upper():
                cell_value = str(int(float(cell_value)))
        except:
            pass

        if cell_value == dealer_no:
            col_idx = i
            break

    if col_idx is None:
        print(f"  ⚠️  Dealer {dealer_no} not found in spreadsheet")
        return False

    # Delete the column using batchUpdate
    # Note: Column indices are 0-based for the API
    request_body = {
        'requests': [{
            'deleteDimension': {
                'range': {
                    'sheetId': 0,  # First sheet
                    'dimension': 'COLUMNS',
                    'startIndex': col_idx,
                    'endIndex': col_idx + 1
                }
            }
        }]
    }

    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body=request_body
    ).execute()

    print(f"  ✅ Removed from spreadsheet (was column {col_idx + 1})")
    return True


def create_drive_folder(dealer_name: str, dry_run: bool = False) -> str:
    """Create a folder for the dealer in Google Drive."""
    if dry_run:
        print(f"  [DRY RUN] Would create Drive folder: {dealer_name}")
        return None

    service = get_drive_service()

    # Check if folder already exists
    escaped_name = dealer_name.replace("'", "\\'")
    query = f"name='{escaped_name}' and '{DEALERS_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

    response = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()

    files = response.get('files', [])

    if files:
        print(f"  ℹ️  Drive folder already exists: {dealer_name}")
        return files[0]['id']

    # Create new folder
    file_metadata = {
        'name': dealer_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [DEALERS_FOLDER_ID]
    }

    folder = service.files().create(
        body=file_metadata,
        fields='id',
        supportsAllDrives=True,
    ).execute()

    print(f"  ✅ Created Drive folder: {dealer_name}")
    return folder.get('id')


def promote_to_full(dealer: dict, dry_run: bool = False):
    """Promote dealer from CONTENT to FULL."""
    print(f"\n📈 PROMOTING TO FULL: {dealer['display_name']} ({dealer['dealer_no']})")
    print("=" * 50)

    if dealer.get('program_status') == 'FULL':
        print(f"  ⚠️  Dealer is already FULL status")
        return

    # 1. Update database
    update_database_status(dealer['dealer_no'], 'FULL', needs_logo=True, dry_run=dry_run)

    # 2. Create Drive folder
    create_drive_folder(dealer['display_name'], dry_run=dry_run)

    # 3. Add to spreadsheet
    add_to_spreadsheet(dealer, dry_run=dry_run)

    print("\n✅ Promotion complete!")
    if not dry_run:
        print("   Next steps:")
        print("   1. Upload logo to the dealer's Drive folder")
        print("   2. Update creatomate_logo in database")
        print("   3. Send fb_admin_accepted email manually")


def demote_to_content(dealer: dict, dry_run: bool = False):
    """Demote dealer from FULL to CONTENT."""
    print(f"\n📉 DEMOTING TO CONTENT: {dealer['display_name']} ({dealer['dealer_no']})")
    print("=" * 50)

    if dealer.get('program_status') == 'CONTENT':
        print(f"  ⚠️  Dealer is already CONTENT status")
        return

    # 1. Update database
    update_database_status(dealer['dealer_no'], 'CONTENT', dry_run=dry_run)

    # 2. Remove from spreadsheet
    remove_from_spreadsheet(dealer['dealer_no'], dry_run=dry_run)

    # Note: We don't delete the Drive folder (may have historical content)

    print("\n✅ Demotion complete!")


def main():
    parser = argparse.ArgumentParser(description="Update dealer program status")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--promote", metavar="NAME", nargs='?', const=True,
                       help="Promote dealer to FULL (provide name or use --dealer-no)")
    group.add_argument("--demote", metavar="NAME", nargs='?', const=True,
                       help="Demote dealer to CONTENT (provide name or use --dealer-no)")

    parser.add_argument("--dealer-no", type=str, help="Dealer number (alternative to name)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without making them")

    args = parser.parse_args()

    # Find dealer
    dealer = None

    if args.dealer_no:
        dealer = find_dealer_by_no(args.dealer_no)
        if not dealer:
            print(f"❌ Dealer not found with number: {args.dealer_no}")
            return
    else:
        name = args.promote if args.promote and args.promote is not True else args.demote
        if not name or name is True:
            print("❌ Please provide dealer name or --dealer-no")
            return

        dealer = find_dealer_by_name(name)
        if not dealer:
            print(f"❌ Dealer not found with name: {name}")
            print("   Try using --dealer-no instead, or check the spelling")
            return

    # Perform action
    if args.promote:
        promote_to_full(dealer, dry_run=args.dry_run)
    else:
        demote_to_content(dealer, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
