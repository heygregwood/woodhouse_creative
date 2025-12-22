#!/usr/bin/env python3
"""List all logos in Google Drive and compare to database"""
import sqlite3
import os
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build

load_dotenv('/home/heygregwood/woodhouse_creative/.env.local')

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
SERVICE_ACCOUNT_EMAIL = os.getenv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
PRIVATE_KEY = os.getenv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '').replace('\\n', '\n')
ROOT_FOLDER_ID = os.getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID', '').strip('"')

def get_drive_service():
    credentials = service_account.Credentials.from_service_account_info(
        {
            'type': 'service_account',
            'client_email': SERVICE_ACCOUNT_EMAIL,
            'private_key': PRIVATE_KEY,
            'token_uri': 'https://oauth2.googleapis.com/token',
        },
        scopes=['https://www.googleapis.com/auth/drive']
    )
    return build('drive', 'v3', credentials=credentials)

def get_logos_folder_id(drive):
    # Find Creative Automation folder
    query = f"name='Creative Automation' and '{ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = drive.files().list(q=query, fields='files(id)', supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    ca_folder = results.get('files', [])[0]['id']
    
    # Find Logos folder
    query = f"name='Logos' and '{ca_folder}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = drive.files().list(q=query, fields='files(id)', supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    return results.get('files', [])[0]['id']

def main():
    print("Connecting to Google Drive...")
    drive = get_drive_service()
    folder_id = get_logos_folder_id(drive)
    
    # List all files in Logos folder
    print(f"\n=== Files in Google Drive Logos folder ===")
    query = f"'{folder_id}' in parents and trashed=false"
    results = drive.files().list(
        q=query, 
        fields='files(id, name, webViewLink)',
        supportsAllDrives=True, 
        includeItemsFromAllDrives=True,
        pageSize=200
    ).execute()
    
    drive_files = results.get('files', [])
    print(f"Found {len(drive_files)} files in Drive\n")
    
    drive_names = set()
    for f in drive_files:
        name = f['name'].replace('.png', '').replace('.jpg', '').replace('.webp', '')
        drive_names.add(name.lower())
        print(f"  {f['name']}")
    
    # Check database
    print(f"\n=== Database comparison ===")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT dealer_no, display_name, creatomate_logo 
        FROM dealers 
        WHERE program_status = 'FULL'
        ORDER BY display_name
    """)
    
    has_logo_in_db = 0
    has_logo_in_drive = 0
    missing_from_drive = []
    
    for row in cur.fetchall():
        dealer_no, display_name, logo_url = row
        
        if logo_url and 'drive.google.com' in str(logo_url):
            has_logo_in_db += 1
        
        if display_name and display_name.lower() in drive_names:
            has_logo_in_drive += 1
        elif display_name:
            missing_from_drive.append(display_name)
    
    print(f"Dealers with Drive logo URL in DB: {has_logo_in_db}")
    print(f"Dealers with matching file in Drive: {has_logo_in_drive}")
    print(f"Dealers missing from Drive: {len(missing_from_drive)}")
    
    if missing_from_drive:
        print(f"\n=== Missing from Drive ({len(missing_from_drive)}) ===")
        for name in missing_from_drive[:20]:
            print(f"  {name}")
        if len(missing_from_drive) > 20:
            print(f"  ... and {len(missing_from_drive) - 20} more")
    
    conn.close()

if __name__ == "__main__":
    main()
