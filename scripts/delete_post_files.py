#!/usr/bin/env python3
"""
Delete post files from Google Drive dealer folders.

Usage:
    python3 scripts/delete_post_files.py 666
    python3 scripts/delete_post_files.py 666 --dry-run
"""

import os
import sys
import argparse
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Load environment variables
GOOGLE_SERVICE_ACCOUNT_EMAIL = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '').replace('\\n', '\n')
GOOGLE_DRIVE_ROOT_FOLDER_ID = os.environ.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')

# Dealers folder ID - this is where all dealer subfolders are
DEALERS_FOLDER_ID = '1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv'


def get_drive_service():
    """Initialize Google Drive API service."""
    if not GOOGLE_SERVICE_ACCOUNT_EMAIL or not GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
        raise ValueError("Missing Google service account credentials in environment")

    credentials = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "client_email": GOOGLE_SERVICE_ACCOUNT_EMAIL,
            "private_key": GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=['https://www.googleapis.com/auth/drive']
    )

    return build('drive', 'v3', credentials=credentials)


def find_post_files(service, post_number: int):
    """Find all files matching 'Post {post_number}_*' in dealer folders."""

    # Search for files starting with "Post {post_number}_" across all dealer folders
    # Using fullText search to find files by name pattern
    query = f"name contains 'Post {post_number}_' and mimeType='video/mp4' and trashed=false"

    files = []
    page_token = None

    while True:
        response = service.files().list(
            q=query,
            spaces='drive',
            fields='nextPageToken, files(id, name, parents, driveId)',
            pageToken=page_token,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora='allDrives',
            pageSize=100
        ).execute()

        files.extend(response.get('files', []))
        page_token = response.get('nextPageToken')

        if not page_token:
            break

    # Filter to only files that exactly start with "Post {post_number}_"
    # (the contains query might return partial matches)
    exact_matches = [f for f in files if f['name'].startswith(f'Post {post_number}_')]

    return exact_matches


def get_parent_folder_name(service, file_info):
    """Get the name of the parent folder for a file."""
    if 'parents' in file_info and file_info['parents']:
        parent_id = file_info['parents'][0]
        try:
            parent = service.files().get(
                fileId=parent_id,
                fields='name',
                supportsAllDrives=True
            ).execute()
            return parent.get('name', 'Unknown')
        except Exception:
            return 'Unknown'
    return 'Unknown'


def delete_files(service, files, dry_run=False):
    """Delete the specified files."""
    deleted = 0
    errors = 0

    for file_info in files:
        file_id = file_info['id']
        file_name = file_info['name']
        drive_id = file_info.get('driveId')
        parent_name = get_parent_folder_name(service, file_info)

        if dry_run:
            print(f"[DRY RUN] Would delete: {parent_name}/{file_name} (driveId: {drive_id})")
            deleted += 1
        else:
            try:
                # For Shared Drives, we need to specify the driveId
                if drive_id:
                    service.files().delete(
                        fileId=file_id,
                        supportsAllDrives=True,
                    ).execute()
                else:
                    service.files().delete(
                        fileId=file_id,
                        supportsAllDrives=True
                    ).execute()
                print(f"✓ Deleted: {parent_name}/{file_name}")
                deleted += 1
            except Exception as e:
                print(f"✗ Error deleting {parent_name}/{file_name}: {e}")
                errors += 1

    return deleted, errors


def main():
    parser = argparse.ArgumentParser(description='Delete post files from Google Drive dealer folders')
    parser.add_argument('post_number', type=int, help='Post number to delete (e.g., 666)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without actually deleting')
    parser.add_argument('--check-permissions', action='store_true', help='Check file permissions before attempting delete')

    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"Delete Post {args.post_number} Files from Dealer Folders")
    print(f"{'='*60}\n")

    if args.dry_run:
        print("🔍 DRY RUN MODE - No files will be deleted\n")

    # Initialize Drive service
    print("Connecting to Google Drive...")
    service = get_drive_service()

    # Find matching files
    print(f"Searching for 'Post {args.post_number}_*' files...")
    files = find_post_files(service, args.post_number)

    if not files:
        print(f"\n✓ No files found matching 'Post {args.post_number}_*'")
        return

    print(f"\nFound {len(files)} files to delete:\n")

    if args.check_permissions:
        print("Checking file permissions...\n")
        for f in files[:3]:  # Check first 3 files
            try:
                perms = service.permissions().list(
                    fileId=f['id'],
                    supportsAllDrives=True
                ).execute()
                print(f"  {f['name']}: {len(perms.get('permissions', []))} permissions")
                for p in perms.get('permissions', []):
                    print(f"    - {p.get('role')} for {p.get('emailAddress', p.get('type'))}")
            except Exception as e:
                print(f"  {f['name']}: Error getting permissions: {e}")
        print()

    # Delete files
    deleted, errors = delete_files(service, files, dry_run=args.dry_run)

    # Summary
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Files found: {len(files)}")
    if args.dry_run:
        print(f"  Would delete: {deleted}")
    else:
        print(f"  Deleted: {deleted}")
        print(f"  Errors: {errors}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
