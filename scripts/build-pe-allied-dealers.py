"""
Build pe_allied_dealers JSON from Allied Air API ground truth.

Merges 3 data sources:
  1. Allied Air API flat CSV (33,867 dealers — ground truth)
  2. prospect_dealers JSON (676 dealers — scoring enrichment)
  3. WC dealer numbers JSON (384 dealers — current turnkey suppression list)

Outputs:
  /tmp/pe-allied-dealers.json — ready to load into Firestore pe_allied_dealers collection

Usage:
  cd ~/woodhouse_creative
  python3 scripts/build-pe-allied-dealers.py
"""

import json
import os
import sys
import csv
from datetime import datetime
from pathlib import Path
from collections import Counter

# ============================================================
# CONFIGURATION
# ============================================================

WINDOWS_USER = os.environ.get("WINDOWS_USERNAME", "GregWood")
ONEDRIVE = f"/mnt/c/Users/{WINDOWS_USER}/OneDrive - woodhouseagency.com"

ALLIED_API_CSV = f"{ONEDRIVE}/Woodhouse Business/Woodhouse_Social/Prospecting/Allied Air Dealers All Data/analysis/allied-dealers-flat.csv"
PROSPECT_DEALERS_JSON = "/tmp/prospect-dealers.json"
WC_DEALER_NOS_JSON = "/tmp/wc-dealer-nos.json"

OUTPUT_PATH = "/tmp/pe-allied-dealers.json"

API_PULL_DATE = "2026-02-23"  # Date the API CSV was pulled

# ============================================================
# HELPERS
# ============================================================

def safe_str(val):
    """Return cleaned string or None for empty/NULL values."""
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "NULL", "null", "None", "none", "nan"):
        return None
    return s

def safe_bool(val):
    """Convert YES/NO/True/False to boolean."""
    if val is None:
        return False
    s = str(val).strip().upper()
    return s in ("YES", "TRUE", "1")

# ============================================================
# STEP 1/3: Load data sources
# ============================================================

def load_api_csv():
    """Load the Allied Air API flat CSV."""
    print(f"\n[Step 1/3] Loading Allied Air API CSV...")
    print(f"  Path: {ALLIED_API_CSV}")

    if not Path(ALLIED_API_CSV).exists():
        print(f"  ERROR: File not found: {ALLIED_API_CSV}")
        sys.exit(1)

    dealers = []
    with open(ALLIED_API_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dealer_no = safe_str(row.get("dealer_no"))
            if not dealer_no:
                continue

            dealers.append({
                "dealer_no": dealer_no,
                "dealer_name": safe_str(row.get("dealer_name")),
                "status": safe_str(row.get("status")),
                "street": safe_str(row.get("street")),
                "city": safe_str(row.get("town")),  # CSV uses "town"
                "state": safe_str(row.get("region")),  # CSV uses "region" (ISO code like US-IL)
                "postal_code": safe_str(row.get("postal_code")),
                "country": safe_str(row.get("country")),
                "contact_name": safe_str(row.get("contact_name")),
                "contact_email": safe_str(row.get("contact_email")),
                "contact_phone": safe_str(row.get("contact_phone")),
                "dealer_website": safe_str(row.get("dealer_website")),
                "facebook_url": safe_str(row.get("facebook")),
                "turnkey_opt_in": safe_bool(row.get("turnkey_opt_in")),
                "turnkey_opt_in_date": safe_str(row.get("opt_in_date")),
                "turnkey_opt_out_date": safe_str(row.get("opt_out_date")),
                "turnkey_email": safe_str(row.get("turnkey_email")),
                "turnkey_phone": safe_str(row.get("turnkey_phone")),
                "distributor_name": safe_str(row.get("distributor_name")),
                "distributor_po": safe_str(row.get("distributor_po")),
                "brands": safe_str(row.get("brands")),
            })

    print(f"  Loaded {len(dealers):,} dealers from API CSV")

    # Status breakdown
    status_counts = Counter(d["status"] for d in dealers)
    for status, count in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"    {status}: {count:,}")

    return dealers


def load_prospect_dealers():
    """Load prospect_dealers JSON for scoring enrichment."""
    print(f"\n  Loading prospect_dealers JSON...")
    print(f"  Path: {PROSPECT_DEALERS_JSON}")

    if not Path(PROSPECT_DEALERS_JSON).exists():
        print(f"  WARNING: File not found. Scoring enrichment will be skipped.")
        return {}

    with open(PROSPECT_DEALERS_JSON, "r") as f:
        dealers = json.load(f)

    # Index by dealer_no
    by_no = {}
    for d in dealers:
        dno = d.get("dealer_no")
        if dno:
            by_no[dno] = d

    print(f"  Loaded {len(by_no):,} prospect dealers for scoring enrichment")
    return by_no


def load_wc_dealer_nos():
    """Load WC dealer numbers for current_turnkey suppression."""
    print(f"\n  Loading WC dealer numbers...")
    print(f"  Path: {WC_DEALER_NOS_JSON}")

    if not Path(WC_DEALER_NOS_JSON).exists():
        print(f"  WARNING: File not found. current_turnkey segmentation will be skipped.")
        return set()

    with open(WC_DEALER_NOS_JSON, "r") as f:
        nos = json.load(f)

    wc_set = set(str(n) for n in nos)
    print(f"  Loaded {len(wc_set):,} WC dealer numbers (suppression list)")
    return wc_set

# ============================================================
# STEP 2/3: Merge and segment
# ============================================================

def merge_and_segment(api_dealers, prospect_data, wc_dealer_nos):
    """Merge API data with prospect scoring and compute segments."""
    print(f"\n[Step 2/3] Merging data sources and computing segments...")

    prospect_nos = set(prospect_data.keys())
    enriched_count = 0
    segment_counts = Counter()

    for dealer in api_dealers:
        dno = dealer["dealer_no"]
        status = dealer["status"]

        # --- Segmentation ---
        in_wc = dno in wc_dealer_nos
        in_prospect = dno in prospect_nos
        was_turnkey = in_wc or in_prospect

        if in_wc:
            segment = "current_turnkey"
        elif in_prospect and status == "A":
            segment = "past_turnkey_active"
        elif in_prospect:
            segment = "past_turnkey_inactive"
        elif status == "A":
            segment = "active_prospect"
        elif status == "D":
            segment = "deactivated"
        else:
            segment = "other"

        dealer["allied_segment"] = segment
        dealer["is_current_turnkey"] = in_wc
        dealer["was_turnkey_ever"] = was_turnkey
        dealer["is_active_dealer"] = status == "A"
        dealer["suppress_from_outreach"] = in_wc

        # --- Scoring enrichment (only for prospect_dealers matches) ---
        if in_prospect:
            pd = prospect_data[dno]
            dealer["prospect_score"] = pd.get("prospect_score")
            dealer["prospect_tier"] = pd.get("prospect_tier")
            dealer["experience_level"] = pd.get("experience_level")
            dealer["page_status"] = pd.get("page_status")
            dealer["ever_had_fb_admin"] = pd.get("ever_had_fb_admin", False)
            dealer["targetable"] = pd.get("targetable", False)
            dealer["sprout_engagement_rate"] = pd.get("engagement_rate")
            dealer["sprout_followers"] = pd.get("sprout_followers")
            dealer["sprout_total_posts"] = pd.get("sprout_total_posts")
            enriched_count += 1
        else:
            dealer["prospect_score"] = None
            dealer["prospect_tier"] = None
            dealer["experience_level"] = None
            dealer["page_status"] = None
            dealer["ever_had_fb_admin"] = False
            dealer["targetable"] = False
            dealer["sprout_engagement_rate"] = None
            dealer["sprout_followers"] = None
            dealer["sprout_total_posts"] = None

        # --- Metadata ---
        dealer["api_pull_date"] = API_PULL_DATE

        segment_counts[segment] += 1

    print(f"  Enriched {enriched_count:,} dealers with prospect scoring data")
    print(f"\n  Segment breakdown:")
    for seg, count in sorted(segment_counts.items(), key=lambda x: -x[1]):
        suppress = " [SUPPRESS]" if seg == "current_turnkey" else ""
        print(f"    {seg}: {count:,}{suppress}")

    return api_dealers

# ============================================================
# STEP 3/3: Output
# ============================================================

def write_output(dealers):
    """Write merged dealers to JSON."""
    print(f"\n[Step 3/3] Writing output...")

    with open(OUTPUT_PATH, "w") as f:
        json.dump(dealers, f, indent=2, default=str)

    size_mb = Path(OUTPUT_PATH).stat().st_size / (1024 * 1024)
    print(f"  Wrote {len(dealers):,} dealers to {OUTPUT_PATH} ({size_mb:.1f} MB)")

    # Summary stats
    has_email = sum(1 for d in dealers if d.get("contact_email"))
    has_phone = sum(1 for d in dealers if d.get("contact_phone"))
    has_website = sum(1 for d in dealers if d.get("dealer_website"))
    has_facebook = sum(1 for d in dealers if d.get("facebook_url"))
    has_scoring = sum(1 for d in dealers if d.get("prospect_score") is not None)
    suppressed = sum(1 for d in dealers if d.get("suppress_from_outreach"))

    print(f"\n  Contact coverage:")
    print(f"    Has email:    {has_email:,} ({100*has_email/len(dealers):.1f}%)")
    print(f"    Has phone:    {has_phone:,} ({100*has_phone/len(dealers):.1f}%)")
    print(f"    Has website:  {has_website:,} ({100*has_website/len(dealers):.1f}%)")
    print(f"    Has facebook: {has_facebook:,} ({100*has_facebook/len(dealers):.1f}%)")
    print(f"    Has scoring:  {has_scoring:,} ({100*has_scoring/len(dealers):.1f}%)")
    print(f"    Suppressed:   {suppressed:,} ({100*suppressed/len(dealers):.1f}%)")

# ============================================================
# MAIN
# ============================================================

def main():
    print("=" * 60)
    print("BUILD pe_allied_dealers")
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)

    # Load all data sources
    api_dealers = load_api_csv()
    prospect_data = load_prospect_dealers()
    wc_dealer_nos = load_wc_dealer_nos()

    # Merge and segment
    merged = merge_and_segment(api_dealers, prospect_data, wc_dealer_nos)

    # Write output
    write_output(merged)

    print(f"\n{'=' * 60}")
    print("DONE. Next step:")
    print("  npx tsx scripts/load-pe-allied-dealers.ts --dry-run")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
