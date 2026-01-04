#!/usr/bin/env python3
"""
Email sending module for Woodhouse Creative Automation
Uses Resend API to send dealer notification emails

Setup:
1. Create Resend account at resend.com
2. Verify woodhouseagency.com domain
3. Add RESEND_API_KEY to .env.local

Usage:
    from scripts.email.send_email import send_welcome_email, send_post_scheduled_email
    
    send_welcome_email(dealer_no="10122026")
"""

import os
import sys
import sqlite3
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Import blocked dealers config (handles both direct and module import)
try:
    from scripts.email_sender.blocked_dealers import is_dealer_blocked
except ImportError:
    from blocked_dealers import is_dealer_blocked

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(env_path)

# Constants
RESEND_API_KEY = os.getenv('RESEND_API_KEY')

# Google Sheets settings
SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY'
ROW_DEALER_NO = 0      # Row 1: Dealer numbers
ROW_EMAIL_STATUS = 1   # Row 2: Schedule Email Status
COL_DEALERS_START = 6  # Column G: First dealer column
RESEND_API_URL = 'https://api.resend.com/emails'
DB_PATH = Path(__file__).parent.parent.parent / 'data' / 'sqlite' / 'creative.db'
TEMPLATES_PATH = Path(__file__).parent.parent.parent / 'templates' / 'emails'

# Sender config
FROM_EMAIL = 'communitymanagers@woodhouseagency.com'
FROM_NAME = 'Woodhouse Social Community Managers'

# Brand-specific video links
BRAND_VIDEOS = {
    'armstrong_air': 'https://vimeo.com/910160703/51df1eb27d',
    'airease': 'https://vimeo.com/914492643'
}

# Attachments
FB_ADMIN_GUIDE_URL = 'https://drive.google.com/file/d/1MEe7lybJ6oghz5pJOZvUaXdSu4m279CI/view?usp=share_link'


def get_sheets_service():
    """Get authenticated Google Sheets service."""
    service_account_email = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if not service_account_email or not private_key:
        return None  # Skip if no credentials

    private_key = private_key.replace('\\n', '\n')

    credentials = service_account.Credentials.from_service_account_info(
        {
            'type': 'service_account',
            'client_email': service_account_email,
            'private_key': private_key,
            'token_uri': 'https://oauth2.googleapis.com/token',
        },
        scopes=SHEETS_SCOPES
    )
    return build('sheets', 'v4', credentials=credentials)


def update_email_status(dealer_no: str, status: str = 'Email Sent') -> bool:
    """Update the Schedule Email Status in the spreadsheet for a dealer.

    Args:
        dealer_no: Dealer number to update
        status: Status to set (default: 'Email Sent')

    Returns:
        True if updated, False otherwise
    """
    try:
        service = get_sheets_service()
        if not service:
            print("  ⚠️  No Google credentials - skipping spreadsheet update")
            return False

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
            # Handle float formatting issues
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

        # Convert to column letter
        if col_idx < 26:
            col_letter = chr(65 + col_idx)
        else:
            col_letter = chr(64 + col_idx // 26) + chr(65 + col_idx % 26)

        # Update row 2 (Email Status)
        cell_ref = f"Sheet1!{col_letter}2"
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=cell_ref,
            valueInputOption='RAW',
            body={'values': [[status]]}
        ).execute()

        print(f"  ✅ Updated spreadsheet: {col_letter}2 = '{status}'")
        return True

    except Exception as e:
        print(f"  ❌ Failed to update spreadsheet: {e}")
        return False


def get_dealer(dealer_no: str) -> Optional[Dict[str, Any]]:
    """Fetch dealer data from SQLite database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            dealer_no,
            display_name,
            contact_first_name,
            contact_email,
            distributor_name,
            program_status,
            armstrong_air,
            airease
        FROM dealers 
        WHERE dealer_no = ?
    """, (dealer_no,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_brand_info(dealer: Dict[str, Any]) -> Dict[str, str]:
    """Determine brand and video link from dealer data"""
    # Default to Armstrong Air if both or neither
    if dealer.get('airease') == 1 and dealer.get('armstrong_air') != 1:
        return {
            'brand': 'AirEase',
            'video_url': BRAND_VIDEOS['airease']
        }
    return {
        'brand': 'Armstrong Air',
        'video_url': BRAND_VIDEOS['armstrong_air']
    }


def load_template(template_name: str) -> str:
    """Load HTML template from templates/emails directory"""
    template_path = TEMPLATES_PATH / f'{template_name}.html'
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")
    return template_path.read_text()


def render_template(template: str, variables: Dict[str, str]) -> str:
    """Replace {{variable}} placeholders with actual values"""
    result = template
    for key, value in variables.items():
        placeholder = '{{' + key + '}}'
        result = result.replace(placeholder, str(value) if value else '')
    return result


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    reply_to: str = None,
    from_name: str = None,
    from_email: str = None
) -> Dict[str, Any]:
    """Send email via Resend API
    
    Args:
        to_email: Recipient email
        subject: Email subject
        html_body: HTML content
        reply_to: Reply-to address (defaults to from_email)
        from_name: Sender name (defaults to FROM_NAME constant)
        from_email: Sender email (defaults to FROM_EMAIL constant)
    """
    sender_name = from_name or FROM_NAME
    sender_email = from_email or FROM_EMAIL
    reply_address = reply_to or sender_email
    
    if not RESEND_API_KEY:
        # Dev mode - just log
        print(f"""
[DEV MODE - EMAIL NOT SENT]
To: {to_email}
Subject: {subject}
From: {sender_name} <{sender_email}>
---
{html_body[:500]}...
        """)
        return {'success': True, 'dev_mode': True}
    
    response = requests.post(
        RESEND_API_URL,
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'from': f'{sender_name} <{sender_email}>',
            'to': to_email,
            'subject': subject,
            'html': html_body,
            'reply_to': reply_address
        }
    )
    
    if response.ok:
        print(f"✅ Email sent to {to_email}: {subject}")
        return {'success': True, 'response': response.json()}
    else:
        print(f"❌ Email failed to {to_email}: {response.text}")
        return {'success': False, 'error': response.text}




# ============================================================================
# EMAIL FUNCTIONS
# ============================================================================

def send_welcome_email(dealer_no: str) -> Dict[str, Any]:
    """
    Send Welcome Email to new dealer
    Trigger: New dealer added to program (status = CONTENT or FULL)
    """
    # Check blocklist (test accounts, etc.)
    if is_dealer_blocked(dealer_no):
        print(f"⚠️  Dealer {dealer_no} is blocked - skipping email")
        return {'success': False, 'error': f'Dealer {dealer_no} is blocked from emails', 'blocked': True}

    dealer = get_dealer(dealer_no)
    if not dealer:
        return {'success': False, 'error': f'Dealer not found: {dealer_no}'}
    
    if not dealer.get('contact_email'):
        return {'success': False, 'error': f'No email for dealer: {dealer_no}'}
    
    brand_info = get_brand_info(dealer)
    
    variables = {
        'first_name': dealer.get('contact_first_name', 'there'),
        'business_name': dealer.get('display_name', ''),
        'distributor': dealer.get('distributor_name', 'your distributor'),
        'brand': brand_info['brand'],
        'video_url': brand_info['video_url'],
        'fb_admin_guide_url': FB_ADMIN_GUIDE_URL
    }
    
    template = load_template('welcome')
    html_body = render_template(template, variables)
    
    subject = f"Welcome to the {variables['distributor']} Turnkey Social Media Program"
    
    return send_email(
        to_email=dealer['contact_email'],
        subject=subject,
        html_body=html_body
    )


def send_fb_admin_accepted_email(dealer_no: str, update_spreadsheet: bool = True) -> Dict[str, Any]:
    """
    Send FB Admin Accepted Email
    Trigger: When we accept a dealer's Facebook admin invite (CONTENT -> FULL)

    Args:
        dealer_no: Dealer number
        update_spreadsheet: If True, update spreadsheet status to 'Email Sent'
    """
    # Check blocklist (test accounts, etc.)
    if is_dealer_blocked(dealer_no):
        print(f"⚠️  Dealer {dealer_no} is blocked - skipping email")
        return {'success': False, 'error': f'Dealer {dealer_no} is blocked from emails', 'blocked': True}

    dealer = get_dealer(dealer_no)
    if not dealer:
        return {'success': False, 'error': f'Dealer not found: {dealer_no}'}

    if not dealer.get('contact_email'):
        return {'success': False, 'error': f'No email for dealer: {dealer_no}'}

    variables = {
        'first_name': dealer.get('contact_first_name', 'there'),
    }

    template = load_template('fb_admin_accepted')
    html_body = render_template(template, variables)

    subject = "Welcome - We're Now Managing Your Facebook Page"

    result = send_email(
        to_email=dealer['contact_email'],
        subject=subject,
        html_body=html_body
    )

    # Update spreadsheet if email was sent successfully
    if result.get('success') and update_spreadsheet:
        update_email_status(dealer_no, 'Email Sent')

    return result


def send_first_post_scheduled_email(dealer_no: str, update_spreadsheet: bool = True) -> Dict[str, Any]:
    """
    Send First Post Scheduled Email
    Trigger: First time posts are scheduled for a FULL dealer

    Args:
        dealer_no: Dealer number
        update_spreadsheet: If True, update spreadsheet status to 'Email Sent'
    """
    # Check blocklist (test accounts, etc.)
    if is_dealer_blocked(dealer_no):
        print(f"⚠️  Dealer {dealer_no} is blocked - skipping email")
        return {'success': False, 'error': f'Dealer {dealer_no} is blocked from emails', 'blocked': True}

    dealer = get_dealer(dealer_no)
    if not dealer:
        return {'success': False, 'error': f'Dealer not found: {dealer_no}'}

    if not dealer.get('contact_email'):
        return {'success': False, 'error': f'No email for dealer: {dealer_no}'}

    variables = {
        'first_name': dealer.get('contact_first_name', 'there'),
        'business_name': dealer.get('display_name', '')
    }

    template = load_template('first_post_scheduled')
    html_body = render_template(template, variables)

    subject = "Your Social Media Posts Are Now Scheduled!"

    result = send_email(
        to_email=dealer['contact_email'],
        subject=subject,
        html_body=html_body
    )

    # Update spreadsheet if email was sent successfully
    if result.get('success') and update_spreadsheet:
        update_email_status(dealer_no, 'Email Sent')

    return result


def send_post_scheduled_email(dealer_no: str, update_spreadsheet: bool = True) -> Dict[str, Any]:
    """
    Send Post Scheduled Email (ongoing)
    Trigger: Each time new posts are scheduled for a FULL dealer

    Args:
        dealer_no: Dealer number
        update_spreadsheet: If True, update spreadsheet status to 'Email Sent'
    """
    # Check blocklist (test accounts, etc.)
    if is_dealer_blocked(dealer_no):
        print(f"⚠️  Dealer {dealer_no} is blocked - skipping email")
        return {'success': False, 'error': f'Dealer {dealer_no} is blocked from emails', 'blocked': True}

    dealer = get_dealer(dealer_no)
    if not dealer:
        return {'success': False, 'error': f'Dealer not found: {dealer_no}'}

    if not dealer.get('contact_email'):
        return {'success': False, 'error': f'No email for dealer: {dealer_no}'}

    variables = {
        'first_name': dealer.get('contact_first_name', 'there')
    }

    template = load_template('post_scheduled')
    html_body = render_template(template, variables)

    subject = "Your Latest Social Media Content Has Been Scheduled"

    result = send_email(
        to_email=dealer['contact_email'],
        subject=subject,
        html_body=html_body
    )

    # Update spreadsheet if email was sent successfully
    if result.get('success') and update_spreadsheet:
        update_email_status(dealer_no, 'Email Sent')

    return result


def send_content_ready_email(dealer_no: str, download_url: str) -> Dict[str, Any]:
    """
    Send Content Ready Email to CONTENT dealers
    Trigger: Monthly content package is ready for download

    Args:
        dealer_no: Dealer number
        download_url: Dropbox/Drive link to content package
    """
    # Check blocklist (test accounts, etc.)
    if is_dealer_blocked(dealer_no):
        print(f"⚠️  Dealer {dealer_no} is blocked - skipping email")
        return {'success': False, 'error': f'Dealer {dealer_no} is blocked from emails', 'blocked': True}

    dealer = get_dealer(dealer_no)
    if not dealer:
        return {'success': False, 'error': f'Dealer not found: {dealer_no}'}
    
    if not dealer.get('contact_email'):
        return {'success': False, 'error': f'No email for dealer: {dealer_no}'}
    
    brand_info = get_brand_info(dealer)
    
    variables = {
        'first_name': dealer.get('contact_first_name', 'there'),
        'business_name': dealer.get('display_name', ''),
        'distributor': dealer.get('distributor_name', 'your distributor'),
        'brand': brand_info['brand'],
        'video_url': brand_info['video_url'],
        'download_url': download_url,
        'fb_admin_guide_url': FB_ADMIN_GUIDE_URL
    }
    
    template = load_template('content_ready')
    html_body = render_template(template, variables)
    
    subject = f"{variables['distributor']} - {variables['brand']} Dealer Program - Social Media Content is Ready to Download."
    
    return send_email(
        to_email=dealer['contact_email'],
        subject=subject,
        html_body=html_body
    )


# ============================================================================
# CLI INTERFACE
# ============================================================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Send dealer emails')
    parser.add_argument('action', choices=['welcome', 'fb_admin_accepted', 'first_post', 'post_scheduled', 'content_ready'])
    parser.add_argument('dealer_no', help='Dealer number')
    parser.add_argument('--download-url', help='Download URL for content_ready email')
    parser.add_argument('--dry-run', action='store_true', help='Print email without sending')
    parser.add_argument('--no-spreadsheet', action='store_true', help='Skip spreadsheet status update')

    args = parser.parse_args()

    if args.dry_run:
        # Temporarily unset API key for dry run
        RESEND_API_KEY = None

    update_sheet = not args.no_spreadsheet and not args.dry_run

    if args.action == 'welcome':
        result = send_welcome_email(args.dealer_no)
    elif args.action == 'fb_admin_accepted':
        result = send_fb_admin_accepted_email(args.dealer_no, update_spreadsheet=update_sheet)
    elif args.action == 'first_post':
        result = send_first_post_scheduled_email(args.dealer_no, update_spreadsheet=update_sheet)
    elif args.action == 'post_scheduled':
        result = send_post_scheduled_email(args.dealer_no, update_spreadsheet=update_sheet)
    elif args.action == 'content_ready':
        if not args.download_url:
            print("Error: --download-url required for content_ready email")
            sys.exit(1)
        result = send_content_ready_email(args.dealer_no, args.download_url)

    print(result)
