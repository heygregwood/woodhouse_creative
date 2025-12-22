#!/usr/bin/env python3
"""Save the 5 logos we found to Google Drive"""
import sqlite3
import requests
import os
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

load_dotenv('/home/heygregwood/woodhouse_creative/.env.local')

DB_PATH = '/home/heygregwood/woodhouse_creative/data/sqlite/creative.db'
SERVICE_ACCOUNT_EMAIL = os.getenv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
PRIVATE_KEY = os.getenv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '').replace('\\n', '\n')
ROOT_FOLDER_ID = os.getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID')

logos_to_save = [
    {
        'dealer_no': None,  # Will look up
        'display_name': 'Carstens Plumbing and Heating',
        'url': 'https://storage.googleapis.com/go-boost-partners-public/media_items/7107-good%20logo.jpg',
        'source': 'website'
    },
    {
        'dealer_no': None,
        'display_name': 'ComfortPro Solutions',
        'url': 'https://www.mycomfortpro.com/wp-content/uploads/2022/04/mycomfortpro-logo.png',
        'source': 'website'
    },
    {
        'dealer_no': None,
        'display_name': 'KTS Heating and Air and Refrigeration',
        'url': 'https://img77.uenicdn.com/image/upload/v1734371426/business/22bc476cb5fe471f8411ae9f32d59d9e.jpg',
        'source': 'website'
    },
    {
        'dealer_no': None,
        'display_name': 'Kerr County AC and Heating Services',
        'url': 'https://kerrcountyac.com/wp-content/uploads/FB-OG-2025_kerrhvac.jpg',
        'source': 'website'
    },
    {
        'dealer_no': None,
        'display_name': 'Total Comfort Air Solutions',
        'url': 'https://static.wixstatic.com/media/55d55c_b326ead7c27243e0ba2d288f05076272~mv2.jpg/v1/fit/w_2500,h_1330,al_c/55d55c_b326ead7c27243e0ba2d288f05076272~mv2.jpg',
        'source': 'website'
    },
]

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
    """Get the Logos folder ID"""
    root_id = ROOT_FOLDER_ID.strip('"')
    
    # Find Creative Automation folder
    query = f"name='Creative Automation' and '{root_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = drive.files().list(q=query, fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    files = results.get('files', [])
    if not files:
        raise Exception(f"Creative Automation folder not found in {root_id}")
    ca_folder = files[0]['id']
    
    # Find Logos folder
    query = f"name='Logos' and '{ca_folder}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = drive.files().list(q=query, fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    files = results.get('files', [])
    if not files:
        raise Exception(f"Logos folder not found in Creative Automation")
    return files[0]['id']

def upload_logo(drive, folder_id, image_data, filename):
    """Upload logo and return Drive URL"""
    # Check if exists
    safe_name = filename.replace("'", "\\'")
    query = f"name='{safe_name}' and '{folder_id}' in parents and trashed=false"
    results = drive.files().list(q=query, fields='files(id)', supportsAllDrives=True).execute()
    existing = results.get('files', [])
    
    media = MediaInMemoryUpload(image_data, mimetype='image/png')
    
    if existing:
        file_id = existing[0]['id']
        drive.files().update(fileId=file_id, media_body=media, supportsAllDrives=True).execute()
    else:
        file_metadata = {'name': filename, 'parents': [folder_id]}
        file = drive.files().create(body=file_metadata, media_body=media, fields='id', supportsAllDrives=True).execute()
        file_id = file['id']
    
    return f"https://drive.google.com/file/d/{file_id}/view?usp=drive_link"

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Look up dealer_no for each
    for logo in logos_to_save:
        cur.execute("SELECT dealer_no FROM dealers WHERE display_name = ?", (logo['display_name'],))
        row = cur.fetchone()
        if row:
            logo['dealer_no'] = row[0]
        else:
            print(f"⚠️ Could not find dealer: {logo['display_name']}")
    
    print("Connecting to Google Drive...")
    drive = get_drive_service()
    folder_id = get_logos_folder_id(drive)
    print(f"Logos folder ID: {folder_id}\n")
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    for logo in logos_to_save:
        if not logo['dealer_no']:
            continue
            
        print(f"Processing {logo['display_name']}...")
        
        try:
            # Download image
            resp = requests.get(logo['url'], headers=headers, timeout=30)
            if resp.status_code != 200:
                print(f"  ❌ Failed to download: HTTP {resp.status_code}")
                continue
            
            # Convert to PNG
            img = Image.open(BytesIO(resp.content))
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
            
            png_buffer = BytesIO()
            img.save(png_buffer, format='PNG')
            png_data = png_buffer.getvalue()
            
            # Upload to Drive
            filename = f"{logo['display_name']}.png"
            drive_url = upload_logo(drive, folder_id, png_data, filename)
            print(f"  ✅ Uploaded: {drive_url}")
            
            # Update database
            cur.execute("""
                UPDATE dealers 
                SET creatomate_logo = ?, logo_source = ?, logo_needs_design = 0, updated_at = CURRENT_TIMESTAMP
                WHERE dealer_no = ?
            """, (drive_url, logo['source'], logo['dealer_no']))
            print(f"  ✅ Database updated")
            
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        print()
    
    conn.commit()
    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()
