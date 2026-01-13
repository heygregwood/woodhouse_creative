#!/usr/bin/env python3
"""
LOCAL CLI FALLBACK - Process dealers with "Done" status in spreadsheet.

NOTE: This script reads from LOCAL SQLite database.
PRIMARY IMPLEMENTATION: Use the admin dashboard instead:
  - Dashboard: /admin → "Process Scheduled Emails" section
  - API: GET/POST /api/admin/process-done

This script is kept for local CLI operations when Vercel is unavailable.

Usage:
    # Load env vars first
    set -a && source .env.local && set +a

    # Run the script
    python3 scripts/process_done_status.py

    # Dry run (no emails sent, no spreadsheet updates)
    python3 scripts/process_done_status.py --dry-run

For crontab (runs every hour):
    0 * * * * cd /home/heygregwood/woodhouse_creative && /bin/bash -c 'set -a && source .env.local && set +a && python3 scripts/process_done_status.py >> logs/process_done.log 2>&1'
"""

import argparse
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

# Add parent directory to path for email_sender import
sys.path.insert(0, str(Path(__file__).parent))
from email_sender.send_email import (
    send_first_post_scheduled_email,
    send_post_scheduled_email,
)

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# Google Sheets settings
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY'

# Row indices (1-based)
ROW_DEALER_NO = 1      # Row 1: Dealer numbers
ROW_EMAIL_STATUS = 2   # Row 2: Schedule Email Status

# Column where dealers start (0-based)
COL_DEALERS_START = 6  # Column G


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


def col_to_letter(col_idx: int) -> str:
    """Convert 0-based column index to letter(s)."""
    if col_idx < 26:
        return chr(65 + col_idx)
    else:
        return chr(64 + col_idx // 26) + chr(65 + col_idx % 26)


def get_dealer_email_history(dealer_no: str) -> dict:
    """Check if dealer has received emails before."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            dealer_no,
            first_post_email_sent,
            last_post_email_sent
        FROM dealers
        WHERE dealer_no = ?
    """, (dealer_no,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        'dealer_no': row['dealer_no'],
        'first_post_email_sent': row['first_post_email_sent'],
        'last_post_email_sent': row['last_post_email_sent'],
    }


def update_dealer_email_history(dealer_no: str, email_type: str):
    """Update dealer's email history in database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    if email_type == 'first_post':
        cursor.execute("""
            UPDATE dealers
            SET first_post_email_sent = ?, last_post_email_sent = ?, updated_at = ?
            WHERE dealer_no = ?
        """, (now, now, now, dealer_no))
    else:
        cursor.execute("""
            UPDATE dealers
            SET last_post_email_sent = ?, updated_at = ?
            WHERE dealer_no = ?
        """, (now, now, dealer_no))

    conn.commit()
    conn.close()


def process_done_status(dry_run: bool = False) -> dict:
    """Process all dealers with 'Done' status."""
    result = {
        'processed': [],
        'errors': [],
        'skipped': [],
    }

    print(f"\n{'=' * 60}")
    print(f"Processing Done Status - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}")

    # Get spreadsheet data
    service = get_sheets_service()
    sheet_result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Sheet1!A1:KU2"  # Just need rows 1-2
    ).execute()

    rows = sheet_result.get('values', [])

    if len(rows) < 2:
        print("No data found in spreadsheet")
        return result

    dealer_row = rows[0]  # Row 1: Dealer numbers
    status_row = rows[1]  # Row 2: Email status

    # Find all columns with "Done" status
    done_dealers = []
    for col_idx in range(COL_DEALERS_START, len(dealer_row)):
        # Get status (may not exist if row is shorter)
        status = status_row[col_idx].strip().lower() if col_idx < len(status_row) else ''

        if status == 'done':
            dealer_no = str(dealer_row[col_idx]).strip()

            # Handle float formatting from sheets
            try:
                if '.' in dealer_no or 'E' in dealer_no.upper():
                    dealer_no = str(int(float(dealer_no)))
            except:
                pass

            done_dealers.append({
                'dealer_no': dealer_no,
                'col_idx': col_idx,
                'col_letter': col_to_letter(col_idx),
            })

    print(f"\nFound {len(done_dealers)} dealer(s) with 'Done' status")

    if not done_dealers:
        print("Nothing to process")
        return result

    # Process each dealer
    updates = []
    for dealer in done_dealers:
        dealer_no = dealer['dealer_no']
        col_letter = dealer['col_letter']

        print(f"\n  Processing {dealer_no} (column {col_letter})...")

        # Check email history
        history = get_dealer_email_history(dealer_no)

        if not history:
            print(f"    Dealer not found in database, skipping")
            result['skipped'].append({
                'dealer_no': dealer_no,
                'reason': 'Not found in database',
            })
            continue

        # Determine email type
        if history['first_post_email_sent']:
            email_type = 'post_scheduled'
            email_func = send_post_scheduled_email
            print(f"    Will send: post_scheduled (has received first_post before)")
        else:
            email_type = 'first_post'
            email_func = send_first_post_scheduled_email
            print(f"    Will send: first_post (first time)")

        if dry_run:
            print(f"    [DRY RUN] Would send {email_type} email")
            print(f"    [DRY RUN] Would update {col_letter}2 to 'Email Sent'")
            result['processed'].append({
                'dealer_no': dealer_no,
                'email_type': email_type,
                'dry_run': True,
            })
            continue

        # Send email (with spreadsheet update disabled - we'll do it ourselves)
        try:
            email_result = email_func(dealer_no, update_spreadsheet=False)

            if email_result.get('success'):
                print(f"    Email sent successfully")

                # Update database
                update_dealer_email_history(dealer_no, email_type)

                # Queue spreadsheet update
                updates.append({
                    'range': f"Sheet1!{col_letter}2",
                    'values': [['Email Sent']]
                })

                result['processed'].append({
                    'dealer_no': dealer_no,
                    'email_type': email_type,
                    'success': True,
                })
            else:
                error = email_result.get('error', 'Unknown error')
                print(f"    Email failed: {error}")
                result['errors'].append({
                    'dealer_no': dealer_no,
                    'error': error,
                })
        except Exception as e:
            print(f"    Error: {str(e)}")
            result['errors'].append({
                'dealer_no': dealer_no,
                'error': str(e),
            })

    # Batch update spreadsheet
    if updates and not dry_run:
        print(f"\n  Updating {len(updates)} spreadsheet cell(s)...")
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                'valueInputOption': 'RAW',
                'data': updates
            }
        ).execute()
        print("  Spreadsheet updated")

    # Summary
    print(f"\n{'=' * 60}")
    print("Summary:")
    print(f"  Processed: {len(result['processed'])}")
    print(f"  Errors: {len(result['errors'])}")
    print(f"  Skipped: {len(result['skipped'])}")
    print(f"{'=' * 60}\n")

    return result


def main():
    parser = argparse.ArgumentParser(description="Process dealers with 'Done' status")
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending emails or updating spreadsheet")
    args = parser.parse_args()

    result = process_done_status(args.dry_run)

    if result['errors']:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
