"""
Build Prospect Dealers JSON from all data sources.

Reads:
  1. Exploration Excel (dealer identity + program history)
  2. Sprout Post Performance CSVs (posting + engagement)
  3. Sprout Facebook Pages CSV (followers, growth, page actions)
  4. Sprout Profile Performance CSV (private messages)

Outputs:
  /tmp/prospect-dealers.json — ready to load into Firestore

Usage:
  cd ~/woodhouse_creative
  python3 scripts/build-prospect-data.py
"""

import json
import os
import sys
import math
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import numpy as np

# ============================================================
# CONFIGURATION — Update these paths if source files change
# ============================================================

WINDOWS_USER = os.environ.get("WINDOWS_USERNAME", "GregWood")
DOWNLOADS = f"/mnt/c/Users/{WINDOWS_USER}/Downloads"
ONEDRIVE = f"/mnt/c/Users/{WINDOWS_USER}/OneDrive - woodhouseagency.com"

EXCEL_PATH = f"{ONEDRIVE}/Woodhouse Business/Business Development/ALL AAE DEALER DATA 02-26-2026 From Excel SOT Current and Past - Past as of API Active Date (1-5-2024 ).xlsx"

POST_PERFORMANCE_FILES = [
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2020 - December 31, 2021.csv",
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2021 - December 31, 2022.csv",
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2022 - December 31, 2023.csv",
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2023 - December 31, 2024.csv",
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2024 - December 31, 2025.csv",
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2025 - December 31, 2025.csv",
    f"{DOWNLOADS}/Post Performance (Turnkey & Dist - All) January 1, 2026 - February 25, 2026.csv",
]

FACEBOOK_PAGES_PATH = f"{DOWNLOADS}/Facebook Pages (Turnkey & Dist - All) January 1, 2020 - February 25, 2026.csv"

PROFILE_PERF_PATH = f"{DOWNLOADS}/Profile Performance (Turnkey & Dist - All) January 1, 2020 - February 19, 2026 (1).csv"

ALLIED_API_CSV = f"{ONEDRIVE}/Woodhouse Business/Woodhouse_Social/Prospecting/Allied Air Dealers All Data/analysis/allied-dealers-flat.csv"

OUTPUT_PATH = "/tmp/prospect-dealers.json"

REMOVED_COL = "Woodhouse Social Removed Date Allied Air DB (API Feed)"
REFERENCE_DATE = datetime(2026, 2, 26)

# ============================================================
# HELPERS
# ============================================================

def normalize_name(s):
    if pd.isna(s):
        return ""
    return (
        str(s)
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\t", " ")
        .strip()
    )


def safe_str(val):
    if pd.isna(val) or str(val).strip() in ("", "nan", "None", "NaT"):
        return None
    return str(val).strip()


def safe_float(val):
    if pd.isna(val):
        return None
    try:
        v = float(val)
        return None if math.isnan(v) else round(v, 2)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    if pd.isna(val):
        return None
    try:
        v = float(val)
        return None if math.isnan(v) else int(v)
    except (ValueError, TypeError):
        return None


def parse_date_str(val):
    """Try to parse various date formats to YYYY-MM-DD string."""
    if pd.isna(val) or str(val).strip() in ("", "nan", "None", "NaT"):
        return None
    s = str(val).strip()
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y"]:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def days_between(date_str_a, date_str_b):
    """Days between two YYYY-MM-DD strings. Returns None if either is None."""
    if not date_str_a or not date_str_b:
        return None
    try:
        a = datetime.strptime(date_str_a, "%Y-%m-%d")
        b = datetime.strptime(date_str_b, "%Y-%m-%d")
        return abs((b - a).days)
    except ValueError:
        return None


# ============================================================
# STEP 1: Read and process Exploration Excel
# ============================================================

def load_excel():
    print("[1/6] Loading Exploration Excel...")
    edf = pd.read_excel(EXCEL_PATH, dtype=str)
    print(f"  Raw rows: {len(edf)}")

    # Deduplicate by Dealer No (keep first occurrence)
    edf = edf.drop_duplicates(subset="Dealer No", keep="first")
    edf = edf[edf["Dealer No"].notna() & (edf["Dealer No"].astype(str) != "nan")]
    print(f"  After dedup: {len(edf)}")

    dealers = {}
    for _, row in edf.iterrows():
        dno = str(row["Dealer No"]).strip()
        if not dno:
            continue

        removed_date = parse_date_str(row.get(REMOVED_COL))
        registration_date = parse_date_str(row.get("Allied Air Registration Date"))
        first_post_date = parse_date_str(row.get("First Post Date"))
        fb_admin = str(row.get("Facebook Admin Access", "")).strip().upper() == "Y"
        sprout = str(row.get("Sprout", "")).strip().upper() == "Y"
        program_status = safe_str(row.get("Program Status")) or "CONTENT"
        note = safe_str(row.get("NOTE")) or ""
        is_opt_out = "OPT" in note.upper()
        has_posts = first_post_date is not None
        ever_had_admin = fb_admin or has_posts

        # Experience level
        if ever_had_admin and has_posts and sprout:
            experience = "A"
        elif ever_had_admin and has_posts and not sprout:
            experience = "B"
        elif fb_admin and not has_posts:
            experience = "C"
        elif has_posts and not fb_admin:
            experience = "D"
        else:
            experience = "E"

        # Tier investment
        tier = safe_str(row.get("Tier")) or ""
        if tier in ("PROARM", "PROAIR"):
            tier_investment = "high"
        elif tier in ("CTEAM", "PREMR"):
            tier_investment = "standard"
        elif tier == "ARM":
            tier_investment = "legacy"
        else:
            tier_investment = "unknown"

        # Facebook URL from TurnkeyURL (if it's a facebook link)
        turnkey_url = safe_str(row.get("TurnkeyURL"))
        fb_url = None
        if turnkey_url and "facebook" in turnkey_url.lower():
            fb_url = turnkey_url

        dealers[dno] = {
            "dealer_no": dno,
            "dealer_name": safe_str(row.get("Dealer Name")) or "",
            "city": safe_str(row.get("Dealer City")),
            "state": safe_str(row.get("Dealer State")),
            "distributor": safe_str(row.get("Distributor Branch Name")),
            "program_status": program_status,
            "tier": tier or None,
            "tier_investment": tier_investment,
            "registration_date": registration_date,
            "removed_date": removed_date,
            "first_post_date": first_post_date,
            "contact_name": safe_str(row.get("Contact Name")),
            "contact_first_name": safe_str(row.get("Contact First Name")),
            "contact_email": safe_str(row.get("Contact Email Address")),
            "contact_admin_email": safe_str(row.get("Contact Admin Email Address")),
            "turnkey_email": safe_str(row.get("TurnkeyEmail")),
            "contact_phone": safe_str(row.get("Contact Phone")),
            "dealer_web_address": safe_str(row.get("Dealer Web Address")),
            "facebook_page_name": normalize_name(row.get("Facebook Page Name")) or None,
            "facebook_page_url": fb_url,
            "ever_had_fb_admin": ever_had_admin,
            "experience_level": experience,
            "targetable": removed_date is not None and not is_opt_out,
            "is_opt_out": is_opt_out,
            "enrollment_days": days_between(registration_date, removed_date),
            "posting_days": days_between(first_post_date, removed_date),
            "data_sources": ["excel"],
        }

    print(f"  Dealers loaded: {len(dealers)}")
    return dealers


# ============================================================
# STEP 2: Process Sprout Post Performance CSVs
# ============================================================

def load_post_performance(dealers):
    print("[2/6] Loading Sprout Post Performance (7 CSVs)...")

    # Build reverse lookup: normalized FB page name -> dealer_no
    fb_to_dealer = {}
    for dno, d in dealers.items():
        if d["facebook_page_name"]:
            fb_to_dealer[d["facebook_page_name"]] = dno

    # Read and dedup all CSVs
    frames = []
    for f in POST_PERFORMANCE_FILES:
        if not Path(f).exists():
            print(f"  WARNING: Missing {Path(f).name}")
            continue
        tmp = pd.read_csv(f, dtype=str)
        frames.append(tmp)
        print(f"  {Path(f).name}: {len(tmp)} rows")

    if not frames:
        print("  No Post Performance files found. Skipping.")
        return dealers

    all_posts = pd.concat(frames, ignore_index=True)
    all_posts = all_posts.drop_duplicates(subset="Post ID", keep="first")
    print(f"  After dedup by Post ID: {len(all_posts)} unique posts")

    # Match profiles to dealers
    all_posts["_dealer_no"] = all_posts["Profile"].apply(
        lambda p: fb_to_dealer.get(normalize_name(p))
    )
    matched = all_posts[all_posts["_dealer_no"].notna()].copy()
    print(f"  Matched to dealers: {len(matched)} posts ({matched['_dealer_no'].nunique()} dealers)")

    # Convert numeric columns
    for col in ["Impressions", "Engagements", "Reactions", "Comments", "Shares", "Video Views"]:
        if col in matched.columns:
            matched[col] = pd.to_numeric(matched[col], errors="coerce")

    # Parse dates
    matched["_date"] = pd.to_datetime(matched["Date"], format="mixed", errors="coerce")

    # Compute per-dealer stats
    for dno, group in matched.groupby("_dealer_no"):
        if dno not in dealers:
            continue

        total_posts = len(group)
        avg_imp = safe_float(group["Impressions"].mean())
        avg_eng = safe_float(group["Engagements"].mean())
        total_eng = safe_int(group["Engagements"].sum())

        # Engagement rate: total engagements / total impressions * 100
        total_imp = group["Impressions"].sum()
        eng_rate = None
        if total_imp and total_imp > 0:
            eng_rate = round(float(group["Engagements"].sum()) / float(total_imp) * 100, 2)

        last_post = group["_date"].max()
        last_post_str = last_post.strftime("%Y-%m-%d") if pd.notna(last_post) else None

        # Page status: avg posts/month over last 3 months of data
        three_mo_ago = last_post - timedelta(days=90) if pd.notna(last_post) else None
        avg_last_3mo = None
        if three_mo_ago is not None:
            recent = group[group["_date"] >= three_mo_ago]
            months = max((last_post - three_mo_ago).days / 30.44, 1)
            avg_last_3mo = round(len(recent) / months, 1)

        dealers[dno].update({
            "sprout_total_posts": total_posts,
            "sprout_last_post_date": last_post_str,
            "sprout_avg_impressions": avg_imp,
            "sprout_avg_engagements": avg_eng,
            "sprout_engagement_rate": eng_rate,
            "sprout_total_engagements": total_eng,
        })

        # Store last 3mo avg for page status computation later
        dealers[dno]["_avg_posts_last_3mo_sprout"] = avg_last_3mo
        dealers[dno]["_last_post_sprout"] = last_post_str

        if "sprout_posts" not in dealers[dno]["data_sources"]:
            dealers[dno]["data_sources"].append("sprout_posts")

    return dealers


# ============================================================
# STEP 3: Process Sprout Facebook Pages CSV
# ============================================================

def load_facebook_pages(dealers):
    print("[3/6] Loading Sprout Facebook Pages...")

    if not Path(FACEBOOK_PAGES_PATH).exists():
        print(f"  WARNING: File not found. Skipping.")
        return dealers

    fb_to_dealer = {}
    for dno, d in dealers.items():
        if d["facebook_page_name"]:
            fb_to_dealer[d["facebook_page_name"]] = dno

    df = pd.read_csv(FACEBOOK_PAGES_PATH, dtype=str)
    print(f"  Rows: {len(df)}, Pages: {df['Facebook Page'].nunique()}")

    for col in ["Followers", "Net Follower Growth", "Page Actions", "Reach"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["_date"] = pd.to_datetime(df["Date"], format="%m-%d-%Y", errors="coerce")

    for page, group in df.groupby("Facebook Page"):
        dno = fb_to_dealer.get(normalize_name(page))
        if not dno or dno not in dealers:
            continue

        fol_data = group[group["Followers"].notna()].sort_values("_date")
        latest_fol = safe_int(fol_data["Followers"].iloc[-1]) if len(fol_data) > 0 else None

        nfg = safe_int(group["Net Follower Growth"].sum()) if group["Net Follower Growth"].notna().any() else None
        pa = safe_int(group["Page Actions"].sum())
        reach = safe_int(group["Reach"].sum())

        dealers[dno].update({
            "sprout_followers": latest_fol,
            "sprout_follower_growth": nfg,
            "sprout_page_actions": pa,
            "sprout_total_reach": reach,
        })

        if "sprout_pages" not in dealers[dno]["data_sources"]:
            dealers[dno]["data_sources"].append("sprout_pages")

    return dealers


# ============================================================
# STEP 4: Process Sprout Profile Performance CSV
# ============================================================

def load_profile_performance(dealers):
    print("[4/6] Loading Sprout Profile Performance...")

    if not Path(PROFILE_PERF_PATH).exists():
        print(f"  WARNING: File not found. Skipping.")
        return dealers

    fb_to_dealer = {}
    for dno, d in dealers.items():
        if d["facebook_page_name"]:
            fb_to_dealer[d["facebook_page_name"]] = dno

    df = pd.read_csv(PROFILE_PERF_PATH, dtype=str)
    print(f"  Rows: {len(df)}, Profiles: {df['Profile'].nunique()}")

    df["Received Private Messages (Facebook)"] = pd.to_numeric(
        df["Received Private Messages (Facebook)"], errors="coerce"
    )
    df["Sent Private Messages (Facebook)"] = pd.to_numeric(
        df["Sent Private Messages (Facebook)"], errors="coerce"
    )

    for profile, group in df.groupby("Profile"):
        dno = fb_to_dealer.get(normalize_name(profile))
        if not dno or dno not in dealers:
            continue

        recv = safe_int(group["Received Private Messages (Facebook)"].sum())
        sent = safe_int(group["Sent Private Messages (Facebook)"].sum())

        dealers[dno].update({
            "sprout_received_pms": recv,
            "sprout_sent_pms": sent,
        })

        if "sprout_profile" not in dealers[dno]["data_sources"]:
            dealers[dno]["data_sources"].append("sprout_profile")

    return dealers


# ============================================================
# STEP 5: Enrich from Allied Air API pull (street, zip, brands, website)
# ============================================================

def enrich_from_api(dealers):
    print("[5/6] Enriching from Allied Air API data...")

    if not Path(ALLIED_API_CSV).exists():
        print(f"  WARNING: API CSV not found. Skipping.")
        return dealers

    api = pd.read_csv(ALLIED_API_CSV, dtype=str)
    print(f"  API records: {len(api)}")

    matched = 0
    enriched = 0
    for _, row in api.iterrows():
        dno = str(row.get("dealer_no", "")).strip()
        if dno not in dealers:
            continue
        matched += 1

        d = dealers[dno]
        changed = False

        # Street address
        street = safe_str(row.get("street"))
        if street:
            d["api_street"] = street
            changed = True

        # Postal code
        postal = safe_str(row.get("postal_code"))
        if postal:
            d["api_postal_code"] = postal
            changed = True

        # Brands (pipe-delimited codes like ARM|AIR|CON|COM)
        brands = safe_str(row.get("brands"))
        if brands:
            d["api_brands"] = brands
            changed = True

        # Website — fill in if we don't already have one from Excel
        api_website = safe_str(row.get("dealer_website"))
        if api_website and not d.get("dealer_web_address"):
            d["dealer_web_address"] = api_website
            changed = True
        # Also store API website separately for reference
        if api_website:
            d["api_dealer_website"] = api_website

        if changed:
            enriched += 1
            if "allied_api" not in d["data_sources"]:
                d["data_sources"].append("allied_api")

    print(f"  Matched: {matched}, Enriched: {enriched}")

    # Count website gap fills
    api_filled_web = sum(
        1 for d in dealers.values()
        if d.get("api_dealer_website") and not d.get("dealer_web_address")
    )
    print(f"  Websites filled from API (was null in Excel): {api_filled_web}")

    return dealers


# ============================================================
# STEP 6: Compute page status + prospect score
# ============================================================

def compute_page_status(avg_posts_per_month):
    """Classify page health based on avg posts/month over last 3 months."""
    if avg_posts_per_month is None:
        return None
    if avg_posts_per_month == 0:
        return "dark"
    elif avg_posts_per_month <= 3:
        return "grey"
    elif avg_posts_per_month <= 7:
        return "cloudy"
    elif avg_posts_per_month <= 20:
        return "sunny"
    else:
        return "tornado"


def compute_scores(dealers):
    print("[6/6] Computing page status and prospect scores...")

    for dno, d in dealers.items():
        # --- Page status ---
        avg_3mo = d.pop("_avg_posts_last_3mo_sprout", None)
        last_post_sprout = d.pop("_last_post_sprout", None)

        # If we have Sprout data, check if the last post is old enough that
        # the page is effectively dark now (even if last 3mo of Sprout data had posts)
        if last_post_sprout:
            try:
                last_dt = datetime.strptime(last_post_sprout, "%Y-%m-%d")
                days_since = (REFERENCE_DATE - last_dt).days
                if days_since > 90:
                    # Last post was more than 3 months ago — override to dark
                    avg_3mo = 0
            except ValueError:
                pass

        page_status = compute_page_status(avg_3mo)
        page_source = "sprout" if avg_3mo is not None else None

        d["page_status"] = page_status
        d["page_status_source"] = page_source
        d["last_post_date"] = last_post_sprout or d.get("sprout_last_post_date")
        d["avg_posts_last_3mo"] = avg_3mo

        # Apify fields (null until Apify data loaded)
        d["apify_last_post_date"] = None
        d["apify_scrape_date"] = None

        # --- Prospect score ---
        score = 0.0

        # Had posts ever (+2)
        if d.get("first_post_date"):
            score += 2

        # Posting duration > 1 year (+1)
        if d.get("posting_days") and d["posting_days"] > 365:
            score += 1

        # Were FULL status (+1)
        if d.get("program_status") == "FULL":
            score += 1

        # PRO tier (+1)
        if d.get("tier_investment") == "high":
            score += 1

        # Has website (+0.5)
        if d.get("dealer_web_address"):
            score += 0.5

        # Enrollment > 2 years (+0.5)
        if d.get("enrollment_days") and d["enrollment_days"] > 730:
            score += 0.5

        # Followers > 250 (+0.5)
        if d.get("sprout_followers") and d["sprout_followers"] > 250:
            score += 0.5

        # Received PMs > 25 (+0.5)
        if d.get("sprout_received_pms") and d["sprout_received_pms"] > 25:
            score += 0.5

        # Page actions > 0 (+0.5)
        if d.get("sprout_page_actions") and d["sprout_page_actions"] > 0:
            score += 0.5

        # Page is dark or grey (+1)
        if page_status in ("dark", "grey"):
            score += 1

        # Follower growth > 0 (+0.5)
        if d.get("sprout_follower_growth") and d["sprout_follower_growth"] > 0:
            score += 0.5

        # Engagement rate > 10% (+1)
        if d.get("sprout_engagement_rate") and d["sprout_engagement_rate"] > 10:
            score += 1

        # Opt-out penalty
        if d.get("is_opt_out"):
            score = -99

        d["prospect_score"] = round(score, 1)

        # Tier
        if score >= 7:
            d["prospect_tier"] = "hot"
        elif score >= 4:
            d["prospect_tier"] = "warm"
        else:
            d["prospect_tier"] = "cold"

    return dealers


# ============================================================
# MAIN
# ============================================================

def main():
    print(f"Building prospect data — {REFERENCE_DATE.strftime('%Y-%m-%d')}")
    print(f"Output: {OUTPUT_PATH}\n")

    # Check source files exist
    if not Path(EXCEL_PATH).exists():
        print(f"ERROR: Excel not found at:\n  {EXCEL_PATH}")
        sys.exit(1)

    dealers = load_excel()
    dealers = load_post_performance(dealers)
    dealers = load_facebook_pages(dealers)
    dealers = load_profile_performance(dealers)
    dealers = enrich_from_api(dealers)
    dealers = compute_scores(dealers)

    # Convert to list for JSON
    output = list(dealers.values())

    # Summary stats
    targetable = [d for d in output if d["targetable"]]
    hot = [d for d in targetable if d["prospect_tier"] == "hot"]
    warm = [d for d in targetable if d["prospect_tier"] == "warm"]
    cold = [d for d in targetable if d["prospect_tier"] == "cold"]

    print(f"\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"Total dealers: {len(output)}")
    print(f"Targetable: {len(targetable)}")
    print(f"  Hot:  {len(hot)}")
    print(f"  Warm: {len(warm)}")
    print(f"  Cold: {len(cold)}")
    print(f"Off-limits: {len(output) - len(targetable)}")
    print(f"Opt-outs: {sum(1 for d in output if d['is_opt_out'])}")

    # Page status breakdown for targetable
    statuses = {}
    for d in targetable:
        s = d.get("page_status") or "unknown"
        statuses[s] = statuses.get(s, 0) + 1
    print(f"\nPage status (targetable):")
    for s in ["dark", "grey", "cloudy", "sunny", "tornado", "unknown"]:
        if s in statuses:
            print(f"  {s}: {statuses[s]}")

    # Write JSON
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nWrote {len(output)} dealers to {OUTPUT_PATH}")

    # Top 10 hot prospects
    hot_sorted = sorted(hot, key=lambda d: d["prospect_score"], reverse=True)
    if hot_sorted:
        print(f"\nTop 10 hot prospects:")
        for d in hot_sorted[:10]:
            print(f"  {d['dealer_no']} {d['dealer_name'][:35]:35s} score={d['prospect_score']:>4} | {d['page_status'] or '?':7s} | {d['experience_level']} | fol={d.get('sprout_followers') or '?'}")


if __name__ == "__main__":
    main()
