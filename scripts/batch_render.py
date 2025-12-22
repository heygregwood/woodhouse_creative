#!/usr/bin/env python3
"""
Batch render videos for all FULL dealers using Creatomate API.

Reads dealer data from SQLite, triggers renders via Creatomate API,
polls for completion, and uploads finished videos to Google Drive.

Usage:
    python3 scripts/batch_render.py --post 700 --template abc123
    python3 scripts/batch_render.py --post 700 --template abc123 --dealer 10122026  # Single dealer test
    python3 scripts/batch_render.py --post 700 --template abc123 --dry-run  # Preview only
"""

import argparse
import os
import sqlite3
import time
import requests
from pathlib import Path
from datetime import datetime
from io import BytesIO

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Paths
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"

# Google Drive settings
DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive']
DEALERS_FOLDER_ID = '1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv'  # Creative Automation/Dealers

# Creatomate settings
CREATOMATE_API_BASE = 'https://api.creatomate.com/v1'

# Rate limiting
RENDER_DELAY_SECONDS = 0.35  # ~3 requests/second, well under 30 req/10s limit
POLL_INTERVAL_SECONDS = 10   # Check status every 10 seconds


def get_creatomate_api_key():
    """Get Creatomate API key from environment."""
    api_key = os.environ.get('CREATOMATE_API_KEY')
    if not api_key:
        raise ValueError("CREATOMATE_API_KEY environment variable not set")
    return api_key


def get_drive_service():
    """Get authenticated Google Drive service."""
    service_account_email = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if not service_account_email or not private_key:
        raise ValueError(
            "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
        )

    private_key = private_key.replace('\\n', '\n')

    credentials = service_account.Credentials.from_service_account_info(
        {
            'type': 'service_account',
            'client_email': service_account_email,
            'private_key': private_key,
            'token_uri': 'https://oauth2.googleapis.com/token',
        },
        scopes=DRIVE_SCOPES
    )

    return build('drive', 'v3', credentials=credentials)


def get_full_dealers(dealer_no: str = None) -> list:
    """Get FULL dealers from SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if dealer_no:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo
            FROM dealers
            WHERE dealer_no = ? AND program_status = 'FULL'
        """, (dealer_no,))
    else:
        cursor.execute("""
            SELECT dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo
            FROM dealers
            WHERE program_status = 'FULL'
            ORDER BY display_name
        """)

    dealers = []
    for row in cursor.fetchall():
        dealers.append({
            'dealer_no': row['dealer_no'],
            'display_name': row['display_name'],
            'phone': row['creatomate_phone'],
            'website': row['creatomate_website'],
            'logo_url': row['creatomate_logo'],
        })

    conn.close()
    return dealers


def trigger_render(api_key: str, template_id: str, dealer: dict) -> dict:
    """Trigger a render for a single dealer."""
    url = f"{CREATOMATE_API_BASE}/renders"

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }

    # Modifications match the Creatomate template fields
    modifications = {
        'Logo': dealer['logo_url'],
        'Public-Company-Name': dealer['display_name'],
        'Public-Company-Phone': dealer['phone'],
    }

    payload = {
        'template_id': template_id,
        'modifications': modifications,
    }

    response = requests.post(url, headers=headers, json=payload)

    # Creatomate returns 202 Accepted for async renders
    if response.status_code not in [200, 202]:
        raise Exception(f"Creatomate API error ({response.status_code}): {response.text}")

    data = response.json()

    # Creatomate returns an array with one item
    if not data or len(data) == 0:
        raise Exception("Creatomate API returned empty response")

    return {
        'render_id': data[0]['id'],
        'status': data[0]['status'],
    }


def get_render_status(api_key: str, render_id: str) -> dict:
    """Get the status of a render."""
    url = f"{CREATOMATE_API_BASE}/renders/{render_id}"

    headers = {
        'Authorization': f'Bearer {api_key}',
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Creatomate API error ({response.status_code}): {response.text}")

    data = response.json()

    return {
        'status': data.get('status'),
        'url': data.get('url'),
        'error': data.get('error_message'),
    }


def find_dealer_folder(drive_service, dealer_name: str) -> str:
    """Find the dealer's folder in Google Drive."""
    # Escape single quotes for the query
    escaped_name = dealer_name.replace("'", "\\'")

    query = f"name='{escaped_name}' and '{DEALERS_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

    response = drive_service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()

    files = response.get('files', [])

    if not files:
        raise Exception(f"Folder not found for dealer: {dealer_name}")

    return files[0]['id']


def upload_to_drive(drive_service, folder_id: str, file_name: str, video_bytes: bytes) -> str:
    """Upload video to Google Drive folder."""
    file_metadata = {
        'name': file_name,
        'parents': [folder_id],
    }

    media = MediaIoBaseUpload(
        BytesIO(video_bytes),
        mimetype='video/mp4',
        resumable=True
    )

    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, webViewLink',
        supportsAllDrives=True,
    ).execute()

    return file.get('webViewLink')


def download_video(url: str) -> bytes:
    """Download video from Creatomate CDN."""
    response = requests.get(url, timeout=120)

    if response.status_code != 200:
        raise Exception(f"Failed to download video: HTTP {response.status_code}")

    return response.content


def main():
    parser = argparse.ArgumentParser(description="Batch render videos for FULL dealers")
    parser.add_argument("--post", type=int, required=True, help="Post number (e.g., 700)")
    parser.add_argument("--template", type=str, required=True, help="Creatomate template ID")
    parser.add_argument("--dealer", type=str, help="Single dealer number to test")
    parser.add_argument("--skip", type=str, help="Comma-separated dealer numbers to skip")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, don't render")
    args = parser.parse_args()

    print("=" * 60)
    print(f"BATCH RENDER - Post {args.post}")
    print(f"Template: {args.template}")
    print("=" * 60)

    # Get dealers
    dealers = get_full_dealers(args.dealer)

    # Filter out skipped dealers
    if args.skip:
        skip_list = [s.strip() for s in args.skip.split(',')]
        original_count = len(dealers)
        dealers = [d for d in dealers if d['dealer_no'] not in skip_list]
        skipped = original_count - len(dealers)
        print(f"\nFound {original_count} dealer(s), skipping {skipped}")

    print(f"\nProcessing {len(dealers)} dealer(s)")

    if args.dry_run:
        print("\n[DRY RUN] Would render:")
        for d in dealers:
            print(f"  - {d['display_name']} ({d['dealer_no']})")
            print(f"    Phone: {d['phone']}")
            print(f"    Logo: {d['logo_url'][:50]}...")
        return

    # Validate all dealers have required fields
    invalid = []
    for d in dealers:
        if not d['display_name'] or not d['phone'] or not d['logo_url']:
            invalid.append(d)

    if invalid:
        print(f"\n❌ {len(invalid)} dealers missing required fields:")
        for d in invalid:
            print(f"  - {d['dealer_no']}: name={d['display_name']}, phone={d['phone']}, logo={bool(d['logo_url'])}")
        return

    # Get API key and Drive service
    api_key = get_creatomate_api_key()
    drive_service = get_drive_service()

    # Track renders
    renders = {}  # render_id -> dealer info
    completed = []
    failed = []

    # Phase 1: Trigger all renders
    print(f"\n📤 Triggering {len(dealers)} renders...")
    start_time = time.time()

    for i, dealer in enumerate(dealers):
        try:
            result = trigger_render(api_key, args.template, dealer)
            renders[result['render_id']] = {
                'dealer': dealer,
                'status': result['status'],
                'started_at': time.time(),
            }
            print(f"  [{i+1}/{len(dealers)}] ✓ {dealer['display_name']} (render_id: {result['render_id'][:8]}...)")

            # Rate limiting
            if i < len(dealers) - 1:
                time.sleep(RENDER_DELAY_SECONDS)

        except Exception as e:
            print(f"  [{i+1}/{len(dealers)}] ✗ {dealer['display_name']}: {e}")
            failed.append({
                'dealer': dealer,
                'error': str(e),
                'phase': 'trigger',
            })

    trigger_time = time.time() - start_time
    print(f"\n✓ Triggered {len(renders)} renders in {trigger_time:.1f}s")

    if not renders:
        print("No renders to process. Exiting.")
        return

    # Phase 2: Poll for completion
    print(f"\n⏳ Polling for completion (checking every {POLL_INTERVAL_SECONDS}s)...")
    poll_start = time.time()

    while renders:
        time.sleep(POLL_INTERVAL_SECONDS)

        elapsed = time.time() - poll_start
        print(f"\n  [{elapsed:.0f}s] Checking {len(renders)} pending renders...")

        completed_this_round = []

        for render_id, info in renders.items():
            try:
                status = get_render_status(api_key, render_id)

                if status['status'] == 'succeeded':
                    completed_this_round.append((render_id, status['url']))
                    print(f"    ✓ {info['dealer']['display_name']} - DONE")

                elif status['status'] == 'failed':
                    failed.append({
                        'dealer': info['dealer'],
                        'error': status.get('error', 'Unknown error'),
                        'phase': 'render',
                    })
                    completed_this_round.append((render_id, None))
                    print(f"    ✗ {info['dealer']['display_name']} - FAILED: {status.get('error')}")

                # Still pending/processing - continue waiting

            except Exception as e:
                print(f"    ? {info['dealer']['display_name']} - Error checking status: {e}")

        # Process completed renders
        for render_id, video_url in completed_this_round:
            info = renders.pop(render_id)

            if video_url:
                # Download and upload to Drive
                try:
                    dealer = info['dealer']
                    file_name = f"Post {args.post}_{dealer['display_name']}.mp4"

                    print(f"    📥 Downloading {dealer['display_name']}...")
                    video_bytes = download_video(video_url)

                    print(f"    📤 Uploading to Drive...")
                    folder_id = find_dealer_folder(drive_service, dealer['display_name'])
                    drive_url = upload_to_drive(drive_service, folder_id, file_name, video_bytes)

                    completed.append({
                        'dealer': dealer,
                        'drive_url': drive_url,
                        'render_time': time.time() - info['started_at'],
                    })
                    print(f"    ✅ {dealer['display_name']} uploaded!")

                except Exception as e:
                    failed.append({
                        'dealer': info['dealer'],
                        'error': str(e),
                        'phase': 'upload',
                    })
                    print(f"    ❌ {info['dealer']['display_name']} upload failed: {e}")

    # Summary
    total_time = time.time() - start_time
    print("\n" + "=" * 60)
    print("BATCH RENDER COMPLETE")
    print("=" * 60)
    print(f"\n✅ Completed: {len(completed)}/{len(dealers)}")
    print(f"❌ Failed: {len(failed)}/{len(dealers)}")
    print(f"⏱️  Total time: {total_time/60:.1f} minutes")

    if completed:
        avg_time = sum(c['render_time'] for c in completed) / len(completed)
        print(f"📊 Average render time: {avg_time:.1f}s")

    if failed:
        print("\n❌ FAILURES:")
        for f in failed:
            print(f"  - {f['dealer']['display_name']} ({f['phase']}): {f['error']}")

    # Write results to log file
    log_file = Path(__file__).parent.parent / "logs" / f"batch_render_{args.post}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    log_file.parent.mkdir(exist_ok=True)

    with open(log_file, 'w') as f:
        f.write(f"Batch Render Log - Post {args.post}\n")
        f.write(f"Template: {args.template}\n")
        f.write(f"Date: {datetime.now().isoformat()}\n")
        f.write(f"Total time: {total_time/60:.1f} minutes\n")
        f.write(f"\nCompleted ({len(completed)}):\n")
        for c in completed:
            f.write(f"  - {c['dealer']['display_name']}: {c['drive_url']}\n")
        f.write(f"\nFailed ({len(failed)}):\n")
        for fail in failed:
            f.write(f"  - {fail['dealer']['display_name']} ({fail['phase']}): {fail['error']}\n")

    print(f"\n📝 Log saved to: {log_file}")


if __name__ == "__main__":
    main()
