#!/usr/bin/env python3
"""Upload logos for Ron's and Eco Systems to Google Drive and update database"""
import sqlite3
import os
import sys
from pathlib import Path

# Add the app directory to path for imports
sys.path.insert(0, '/home/heygregwood/woodhouse_creative')

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import json

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
LOGOS_FOLDER_ID = None  # Will get from ensureFolderPath

# Load env
from dotenv import load_dotenv
load_dotenv('/home/heygregwood/woodhouse_creative/.env.local')

SERVICE_ACCOUNT_EMAIL = os.getenv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
PRIVATE_KEY = os.getenv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '').replace('\\n', '\n')
ROOT_FOLDER_ID = os.getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID')

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

def ensure_folder_path(drive, path):
    """Navigate/create folder hierarchy and return final folder ID"""
    parts = path.split('/')
    current_folder_id = ROOT_FOLDER_ID
    
    for part in parts:
        # Check if folder exists
        query = f"name='{part}' and '{current_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = drive.files().list(q=query, fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        files = results.get('files', [])
        
        if files:
            current_folder_id = files[0]['id']
        else:
            # Create folder
            file_metadata = {
                'name': part,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [current_folder_id]
            }
            folder = drive.files().create(body=file_metadata, fields='id', supportsAllDrives=True).execute()
            current_folder_id = folder['id']
    
    return current_folder_id

def upload_logo(drive, folder_id, file_path, filename):
    """Upload logo file and return shareable link"""
    # Check if file exists
    query = f"name='{filename}' and '{folder_id}' in parents and trashed=false"
    results = drive.files().list(q=query, fields='files(id)', supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    existing = results.get('files', [])
    
    media = MediaFileUpload(file_path, mimetype='image/png')
    
    if existing:
        # Update existing
        file_id = existing[0]['id']
        drive.files().update(fileId=file_id, media_body=media, supportsAllDrives=True).execute()
    else:
        # Create new
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        file = drive.files().create(body=file_metadata, media_body=media, fields='id', supportsAllDrives=True).execute()
        file_id = file['id']
    
    return f"https://drive.google.com/file/d/{file_id}/view?usp=drive_link"

def main():
    logos = [
        {
            'dealer_no': '10122026',
            'display_name': "Ron's Heating and Cooling",
            'file_path': "/mnt/c/Users/GregWood/Downloads/rons heating and cooling.jpg"
        },
        {
            'dealer_no': 'TEMP-002', 
            'display_name': 'Eco Systems Heating and Air',
            'file_path': "/mnt/c/Users/GregWood/Downloads/eco systems heating and air.jpg"
        }
    ]
    
    print("Connecting to Google Drive...")
    drive = get_drive_service()
    
    print("Ensuring folder path exists...")
    folder_id = ensure_folder_path(drive, 'Creative Automation/Logos')
    print(f"Logos folder ID: {folder_id}")
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    for logo in logos:
        print(f"\nProcessing {logo['display_name']}...")
        
        if not os.path.exists(logo['file_path']):
            print(f"  ERROR: File not found: {logo['file_path']}")
            continue
        
        filename = f"{logo['display_name']}.png"
        print(f"  Uploading as: {filename}")
        
        drive_url = upload_logo(drive, folder_id, logo['file_path'], filename)
        print(f"  Drive URL: {drive_url}")
        
        # Update database
        cur.execute("""
            UPDATE dealers 
            SET creatomate_logo = ?, display_name = COALESCE(display_name, ?), logo_source = 'manual', updated_at = CURRENT_TIMESTAMP
            WHERE dealer_no = ?
        """, (drive_url, logo['display_name'], logo['dealer_no']))
        print(f"  Database updated!")
    
    conn.commit()
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
