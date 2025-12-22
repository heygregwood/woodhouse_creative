#!/usr/bin/env python3
"""
Check which FULL dealers have folders in Google Drive and optionally create missing ones.

Usage:
    python3 scripts/check_dealer_folders.py              # Check only - list missing folders
    python3 scripts/check_dealer_folders.py --create     # Create missing folders
"""

import argparse
import os
import sqlite3
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# Google Drive settings
SCOPES = ['https://www.googleapis.com/auth/drive']
DEALERS_FOLDER_ID = '1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv'  # Creative Automation/Dealers


def get_drive_service():
    """Get authenticated Google Drive service."""
    # Load credentials from environment
    service_account_email = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if not service_account_email or not private_key:
        raise ValueError(
            "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
        )

    # Handle escaped newlines
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

    return build('drive', 'v3', credentials=credentials)


def normalize_name(name: str) -> str:
    """Normalize folder name for comparison (handle underscores, special chars, etc.)."""
    import re
    # Replace underscores with special chars they might represent
    # Also strip whitespace and lowercase for comparison
    normalized = name.strip().lower()
    # Replace common substitutions
    normalized = normalized.replace('_', "'")  # Brian_s -> Brian's
    normalized = re.sub(r'\s+', ' ', normalized)  # Multiple spaces to single
    return normalized


def get_existing_folders(service) -> dict:
    """Get all existing dealer folders from Google Drive."""
    print(f"Fetching existing folders from Google Drive...")

    folders = {}
    folders_normalized = {}  # For fuzzy matching
    page_token = None

    while True:
        query = f"'{DEALERS_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

        response = service.files().list(
            q=query,
            spaces='drive',
            fields='nextPageToken, files(id, name)',
            pageToken=page_token,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            pageSize=100
        ).execute()

        for file in response.get('files', []):
            folders[file['name']] = file['id']
            # Also store normalized version for fuzzy matching
            normalized = normalize_name(file['name'])
            folders_normalized[normalized] = file['id']

        page_token = response.get('nextPageToken')
        if not page_token:
            break

    print(f"  Found {len(folders)} existing dealer folders")
    return folders, folders_normalized


def get_full_dealers() -> list:
    """Get all FULL dealers from SQLite database."""
    print(f"\nReading FULL dealers from database...")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT dealer_no, display_name, dealer_name
        FROM dealers
        WHERE program_status = 'FULL'
        ORDER BY display_name
    """)

    dealers = []
    for row in cursor.fetchall():
        # Use display_name if available, otherwise dealer_name
        name = row['display_name'] or row['dealer_name']
        dealers.append({
            'dealer_no': row['dealer_no'],
            'name': name,
        })

    conn.close()

    print(f"  Found {len(dealers)} FULL dealers")
    return dealers


def create_folder(service, folder_name: str) -> str:
    """Create a folder in Google Drive."""
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [DEALERS_FOLDER_ID]
    }

    file = service.files().create(
        body=file_metadata,
        fields='id',
        supportsAllDrives=True
    ).execute()

    return file.get('id')


def main():
    parser = argparse.ArgumentParser(description="Check/create dealer folders in Google Drive")
    parser.add_argument("--create", action="store_true", help="Create missing folders")
    args = parser.parse_args()

    # Get Google Drive service
    service = get_drive_service()

    # Get existing folders
    existing_folders, existing_normalized = get_existing_folders(service)

    # Get FULL dealers
    dealers = get_full_dealers()

    # Compare
    missing = []
    found = []
    matched_different_name = []  # Found but with different naming

    for dealer in dealers:
        folder_name = dealer['name']
        normalized_name = normalize_name(folder_name)

        if folder_name in existing_folders:
            # Exact match
            found.append(dealer)
        elif normalized_name in existing_normalized:
            # Fuzzy match (different capitalization, underscores, etc.)
            matched_different_name.append({
                **dealer,
                'drive_name': [k for k, v in existing_folders.items() if normalize_name(k) == normalized_name][0]
            })
            found.append(dealer)
        else:
            missing.append(dealer)

    # Report
    print("\n" + "=" * 60)
    print("FOLDER CHECK SUMMARY")
    print("=" * 60)

    print(f"\n✅ FOUND ({len(found)} dealers have folders)")

    if matched_different_name:
        print(f"\n⚠️  NAME MISMATCHES ({len(matched_different_name)} - folder exists but name differs):")
        for d in matched_different_name:
            print(f"   DB: {d['name']}")
            print(f"   Drive: {d['drive_name']}")
            print()

    print(f"\n❌ MISSING ({len(missing)} dealers need folders):")
    for d in missing:
        print(f"   {d['dealer_no']} - {d['name']}")

    # Create if requested
    if args.create and missing:
        print(f"\nCreating {len(missing)} folders...")
        created = 0
        for dealer in missing:
            try:
                folder_id = create_folder(service, dealer['name'])
                print(f"  ✅ Created: {dealer['name']} ({folder_id})")
                created += 1
            except Exception as e:
                print(f"  ❌ Failed: {dealer['name']} - {e}")

        print(f"\n✅ Created {created}/{len(missing)} folders")
    elif missing and not args.create:
        print(f"\n⚠️  Run with --create to create missing folders")
    else:
        print(f"\n✅ All FULL dealers have folders!")


if __name__ == "__main__":
    main()
