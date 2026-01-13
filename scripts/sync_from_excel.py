#!/usr/bin/env python3
"""
LOCAL CLI FALLBACK - Sync dealers from Excel to SQLite database.

NOTE: This script syncs to LOCAL SQLite database only.
PRIMARY IMPLEMENTATION: Use the admin dashboard instead:
  - Dashboard: /admin → "Sync from Excel" section
  - API: GET/POST /api/admin/sync-excel (syncs to Firestore via Microsoft Graph API)

This script is kept for local CLI operations and syncs to SQLite (not Firestore).

Usage:
    python3 scripts/sync_from_excel.py              # Dry run - show changes only
    python3 scripts/sync_from_excel.py --apply      # Apply changes to database
    python3 scripts/sync_from_excel.py --verbose    # Show all dealers, not just changes
"""

import argparse
import os
import sqlite3
from datetime import datetime
from pathlib import Path

import pandas as pd

# Paths
# Get Windows username from environment variable (set in .env.local)
# Laptop: gregw | Desktop: GregWood
WINDOWS_USERNAME = os.getenv('WINDOWS_USERNAME', 'GregWood')  # Default to GregWood for backwards compatibility
EXCEL_PATH = f"/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm"
DB_PATH = Path(__file__).parent.parent / "data" / "sqlite" / "creative.db"
SHEET_NAME = "Woodhouse Data"

# Column mapping: Excel column -> SQLite column
COLUMN_MAP = {
    "Dealer No": "dealer_no",
    "Dealer Name": "dealer_name",
    "Program Status": "program_status",
    "Source": "source",
    "First Post Date": "first_post_date",
    "Date Added": "date_added",
    "Distributor Branch Name": "distributor_name",
    "Status": "allied_status",
    "Armstrong Air": "armstrong_air",
    "AirEase": "airease",
    "Tier": "tier",
    "TurnkeyPhone": "turnkey_phone",
    "TurnkeyURL": "turnkey_url",
    "TurnkeyEmail": "turnkey_email",
    "Contact Name": "contact_name",
    "Contact First Name": "contact_first_name",
    "Contact Email Address": "contact_email",
    "Contact Phone": "contact_phone",
    "Contact Admin Email Address": "contact_admin_email",
    "Dealer Address": "dealer_address",
    "Dealer City": "dealer_city",
    "Dealer State": "dealer_state",
    "Dealer Web Address": "dealer_web_address",
    "Registration Date": "registration_date",
    "Renew Date": "renew_date",
    "NOTE": "note",
    "Sprout": "has_sprout_excel",
    "Bad Email": "bad_email",
}

# Fields to track for changes (subset of important fields)
TRACKED_FIELDS = [
    "program_status",
    "dealer_name",
    "contact_name",
    "contact_email",
    "turnkey_phone",
    "dealer_web_address",
    "allied_status",
]


def read_excel() -> pd.DataFrame:
    """Read the Woodhouse Data tab from Excel."""
    print(f"Reading Excel: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)

    # Rename columns to match SQLite
    df = df.rename(columns=COLUMN_MAP)

    # Convert dealer_no to string (it's the primary key)
    # Handle floats by converting to int first (removes .0), then to string
    def clean_dealer_no(val):
        if pd.isna(val):
            return None
        if isinstance(val, float):
            return str(int(val))
        return str(val).strip()

    df["dealer_no"] = df["dealer_no"].apply(clean_dealer_no)

    # Convert boolean columns
    df["armstrong_air"] = df["armstrong_air"].apply(lambda x: 1 if x == True or x == "TRUE" else 0)
    df["airease"] = df["airease"].apply(lambda x: 1 if x == True or x == "TRUE" else 0)
    df["has_sprout_excel"] = df["has_sprout_excel"].apply(lambda x: 1 if x == "YES" else 0)
    df["bad_email"] = df["bad_email"].apply(lambda x: 1 if pd.notna(x) and x else 0)

    # Treat NEW as CONTENT (NEW is just a temporary status in Excel)
    df["program_status"] = df["program_status"].apply(lambda x: "CONTENT" if x == "NEW" else x)

    # Convert dates to string format
    for col in ["first_post_date", "date_added"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")

    # Clean up NaN values
    df = df.where(pd.notna(df), None)

    print(f"  Found {len(df)} dealers in Excel")
    print(f"  Program status: FULL={len(df[df['program_status']=='FULL'])}, CONTENT={len(df[df['program_status']=='CONTENT'])}")

    return df


def read_database() -> dict:
    """Read all dealers from SQLite database."""
    print(f"\nReading database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM dealers")
    rows = cursor.fetchall()

    # Convert to dict keyed by dealer_no
    dealers = {row["dealer_no"]: dict(row) for row in rows}

    conn.close()

    print(f"  Found {len(dealers)} dealers in database")

    # Count by program status
    full_count = sum(1 for d in dealers.values() if d.get("program_status") == "FULL")
    content_count = sum(1 for d in dealers.values() if d.get("program_status") == "CONTENT")
    print(f"  Program status: FULL={full_count}, CONTENT={content_count}")

    return dealers


def compare_dealers(excel_df: pd.DataFrame, db_dealers: dict) -> dict:
    """Compare Excel data to database and identify changes."""
    changes = {
        "new": [],      # In Excel but not in DB
        "removed": [],  # In DB but not in Excel (Allied dealers only)
        "updated": [],  # In both but with changes
        "unchanged": [],
    }

    excel_dealer_nos = set(excel_df["dealer_no"].tolist())
    db_dealer_nos = set(db_dealers.keys())

    # Find new dealers (in Excel but not in DB)
    new_dealer_nos = excel_dealer_nos - db_dealer_nos
    for dealer_no in new_dealer_nos:
        row = excel_df[excel_df["dealer_no"] == dealer_no].iloc[0]
        changes["new"].append({
            "dealer_no": dealer_no,
            "dealer_name": row.get("dealer_name"),
            "program_status": row.get("program_status"),
            "data": row.to_dict(),
        })

    # Find removed dealers (in DB but not in Excel)
    # Only consider Allied dealers (those with source = "Allied Dealer Program")
    for dealer_no in db_dealer_nos - excel_dealer_nos:
        dealer = db_dealers[dealer_no]
        if dealer.get("source") == "Allied Dealer Program":
            changes["removed"].append({
                "dealer_no": dealer_no,
                "dealer_name": dealer.get("dealer_name"),
                "program_status": dealer.get("program_status"),
            })

    # Find updated dealers (in both but with changes)
    for dealer_no in excel_dealer_nos & db_dealer_nos:
        row = excel_df[excel_df["dealer_no"] == dealer_no].iloc[0]
        db_dealer = db_dealers[dealer_no]

        field_changes = []
        for field in TRACKED_FIELDS:
            excel_val = row.get(field)
            db_val = db_dealer.get(field)

            # Normalize for comparison
            if pd.isna(excel_val):
                excel_val = None
            if excel_val is not None:
                excel_val = str(excel_val).strip() if excel_val else None
            if db_val is not None:
                db_val = str(db_val).strip() if db_val else None

            if excel_val != db_val:
                field_changes.append({
                    "field": field,
                    "old": db_val,
                    "new": excel_val,
                })

        if field_changes:
            changes["updated"].append({
                "dealer_no": dealer_no,
                "dealer_name": row.get("dealer_name"),
                "program_status": row.get("program_status"),
                "changes": field_changes,
                "data": row.to_dict(),
            })
        else:
            changes["unchanged"].append(dealer_no)

    return changes


def apply_changes(changes: dict, excel_df: pd.DataFrame):
    """Apply changes to the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    # Insert new dealers
    for dealer in changes["new"]:
        data = dealer["data"]

        # Build insert statement with available columns
        columns = ["dealer_no", "dealer_name", "program_status", "source",
                   "first_post_date", "date_added", "distributor_name",
                   "allied_status", "armstrong_air", "airease", "tier",
                   "turnkey_phone", "turnkey_url", "turnkey_email",
                   "contact_name", "contact_first_name", "contact_email",
                   "contact_phone", "contact_admin_email",
                   "dealer_address", "dealer_city", "dealer_state",
                   "dealer_web_address", "registration_date", "renew_date",
                   "note", "has_sprout_excel", "bad_email",
                   "created_at", "updated_at"]

        values = [data.get(col) for col in columns[:-2]]  # Exclude timestamps
        values.extend([now, now])  # Add timestamps

        placeholders = ", ".join(["?" for _ in columns])
        col_names = ", ".join(columns)

        cursor.execute(f"INSERT INTO dealers ({col_names}) VALUES ({placeholders})", values)
        print(f"  ✅ Inserted: {dealer['dealer_no']} - {dealer['dealer_name']}")

    # Update existing dealers
    for dealer in changes["updated"]:
        data = dealer["data"]
        dealer_no = dealer["dealer_no"]

        # Check if this is a CONTENT → FULL promotion
        is_promotion_to_full = False
        for change in dealer["changes"]:
            if change["field"] == "program_status" and change["new"] == "FULL":
                if change["old"] in ("CONTENT", "NEW", None):
                    is_promotion_to_full = True
                    break

        # Update all mapped fields from Excel
        update_fields = []
        update_values = []

        for excel_col, db_col in COLUMN_MAP.items():
            if db_col in data:
                update_fields.append(f"{db_col} = ?")
                update_values.append(data.get(db_col))

        # If promoted to FULL, set review_status to pending_review
        if is_promotion_to_full:
            update_fields.append("review_status = ?")
            update_values.append("pending_review")

        update_fields.append("updated_at = ?")
        update_values.append(now)
        update_values.append(dealer_no)

        sql = f"UPDATE dealers SET {', '.join(update_fields)} WHERE dealer_no = ?"
        cursor.execute(sql, update_values)

        # Show what changed
        change_summary = ", ".join([f"{c['field']}: {c['old']} → {c['new']}" for c in dealer["changes"]])
        status_note = " [PENDING REVIEW]" if is_promotion_to_full else ""
        print(f"  ✏️  Updated: {dealer_no} - {change_summary}{status_note}")

    # Mark removed dealers (don't delete, just flag)
    for dealer in changes["removed"]:
        cursor.execute(
            "UPDATE dealers SET allied_status = 'REMOVED', updated_at = ? WHERE dealer_no = ?",
            [now, dealer["dealer_no"]]
        )
        print(f"  ❌ Marked removed: {dealer['dealer_no']} - {dealer['dealer_name']}")

    conn.commit()
    conn.close()


def print_summary(changes: dict):
    """Print a summary of changes."""
    print("\n" + "=" * 60)
    print("SYNC SUMMARY")
    print("=" * 60)

    if changes["new"]:
        print(f"\n🆕 NEW DEALERS ({len(changes['new'])}):")
        for d in changes["new"]:
            print(f"   {d['dealer_no']} - {d['dealer_name']} ({d['program_status']})")

    if changes["removed"]:
        print(f"\n❌ REMOVED DEALERS ({len(changes['removed'])}):")
        for d in changes["removed"]:
            print(f"   {d['dealer_no']} - {d['dealer_name']} ({d['program_status']})")

    if changes["updated"]:
        print(f"\n✏️  UPDATED DEALERS ({len(changes['updated'])}):")
        for d in changes["updated"]:
            print(f"   {d['dealer_no']} - {d['dealer_name']}")
            for c in d["changes"]:
                print(f"      {c['field']}: '{c['old']}' → '{c['new']}'")

    print(f"\n📊 TOTALS:")
    print(f"   New:       {len(changes['new'])}")
    print(f"   Removed:   {len(changes['removed'])}")
    print(f"   Updated:   {len(changes['updated'])}")
    print(f"   Unchanged: {len(changes['unchanged'])}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Sync dealers from Excel to SQLite")
    parser.add_argument("--apply", action="store_true", help="Apply changes to database")
    parser.add_argument("--verbose", action="store_true", help="Show all details")
    args = parser.parse_args()

    # Read data
    excel_df = read_excel()
    db_dealers = read_database()

    # Compare
    changes = compare_dealers(excel_df, db_dealers)

    # Print summary
    print_summary(changes)

    # Apply if requested
    if args.apply:
        if changes["new"] or changes["updated"] or changes["removed"]:
            print("Applying changes...")
            apply_changes(changes, excel_df)
            print("\n✅ Changes applied successfully!")
        else:
            print("No changes to apply.")
    else:
        if changes["new"] or changes["updated"] or changes["removed"]:
            print("⚠️  DRY RUN - No changes applied. Use --apply to apply changes.")
        else:
            print("✅ Database is in sync with Excel.")


if __name__ == "__main__":
    main()
