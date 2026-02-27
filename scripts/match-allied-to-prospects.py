#!/usr/bin/env python3
"""
Match pe_allied_dealers against pe_prospects.

Two-tier matching:
  Tier 1 (high confidence): phone exact, email exact, domain exact
  Tier 2 (fuzzy, sample for review): normalized name + city + state

Reads exported JSON files, outputs CSVs for review.

Usage:
    cd ~/woodhouse_creative
    python3 scripts/match-allied-to-prospects.py
"""

import json
import csv
import re
import sys
from collections import defaultdict
from urllib.parse import urlparse

PROSPECTS_FILE = "/tmp/pe-prospects-matching.json"
ALLIED_FILE = "/tmp/pe-allied-matching.json"

OUT_SUMMARY = "/tmp/allied-match-summary.txt"
OUT_HIGH_CONFIDENCE = "/tmp/allied-matches-high-confidence.csv"
OUT_FUZZY_SAMPLE = "/tmp/allied-matches-fuzzy-sample.csv"
OUT_AMBIGUOUS = "/tmp/allied-matches-ambiguous.csv"


# ── Normalization ──────────────────────────────────────────────

def normalize_phone(raw):
    """Strip to digits. Return 10-digit string or None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    # Strip leading 1 (country code) if 11 digits
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return digits
    return None


def extract_domain(raw):
    """Extract root domain from URL or domain string. Returns lowercase or None."""
    if not raw:
        return None
    s = str(raw).strip().lower()
    # If it doesn't have a scheme, add one for urlparse
    if not s.startswith("http"):
        s = "http://" + s
    try:
        parsed = urlparse(s)
        host = parsed.hostname or ""
    except Exception:
        return None
    # Strip www.
    if host.startswith("www."):
        host = host[4:]
    # Must have at least one dot
    if "." not in host or len(host) < 4:
        return None
    return host


def normalize_state(raw):
    """Normalize state: strip 'US-' prefix, uppercase."""
    if not raw:
        return None
    s = str(raw).strip().upper()
    # Allied API uses ISO codes like "US-IL"
    if s.startswith("US-"):
        s = s[3:]
    if len(s) == 2:
        return s
    return s  # Return as-is for Canadian provinces etc.


SUFFIX_PATTERN = re.compile(
    r"\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|"
    r"enterprises|enterprise|services|service|heating|cooling|"
    r"air conditioning|a/?c|hvac|plumbing|mechanical|"
    r"and|&)\b\.?",
    re.IGNORECASE,
)

def normalize_name(raw):
    """Normalize business name for matching."""
    if not raw:
        return None
    s = str(raw).lower().strip()
    # Remove common suffixes and HVAC-specific words
    s = SUFFIX_PATTERN.sub(" ", s)
    # Remove punctuation
    s = re.sub(r"[^\w\s]", "", s)
    # Collapse whitespace
    s = " ".join(s.split())
    if not s:
        return None
    return s


# ── Index Building ─────────────────────────────────────────────

def build_prospect_indexes(prospects):
    """Build lookup indexes from prospects for fast matching."""
    phone_index = defaultdict(list)    # phone → [prospect]
    email_index = defaultdict(list)    # email → [prospect]
    domain_index = defaultdict(list)   # domain → [prospect]
    name_city_state_index = defaultdict(list)  # (name, city, state) → [prospect]

    skipped_allied = 0

    for p in prospects:
        # Skip already-linked prospects
        if p.get("is_allied"):
            skipped_allied += 1
            continue

        pid = p["id"]
        title = p.get("title", "")

        # Phone index: primary + all phones
        all_phones = set()
        pp = normalize_phone(p.get("primary_phone"))
        if pp:
            all_phones.add(pp)
        for ph in (p.get("phones") or []):
            np = normalize_phone(ph)
            if np:
                all_phones.add(np)
        for ph in all_phones:
            phone_index[ph].append(p)

        # Email index: primary + all emails
        all_emails = set()
        pe = (p.get("primary_email") or "").strip().lower()
        if pe:
            all_emails.add(pe)
        for em in (p.get("emails") or []):
            ne = str(em).strip().lower()
            if ne:
                all_emails.add(ne)
        for em in all_emails:
            email_index[em].append(p)

        # Domain index
        dom = extract_domain(p.get("domain") or p.get("website"))
        if dom:
            domain_index[dom].append(p)

        # Name + city + state index
        nn = normalize_name(title)
        nc = (p.get("city") or "").strip().lower()
        ns = normalize_state(p.get("state"))
        if nn and nc and ns:
            name_city_state_index[(nn, nc, ns)].append(p)

    return phone_index, email_index, domain_index, name_city_state_index, skipped_allied


# ── Matching ───────────────────────────────────────────────────

def run_matching(allied, phone_idx, email_idx, domain_idx, ncs_idx):
    """Match each Allied dealer against prospect indexes."""
    high_confidence = []
    fuzzy_matches = []
    ambiguous = []
    stats = defaultdict(int)
    already_matched_prospects = set()  # prevent one prospect matching multiple dealers

    for dealer in allied:
        dno = dealer["dealer_no"]
        dname = dealer.get("dealer_name") or ""
        segment = dealer.get("allied_segment") or ""

        matched = False

        # ── Tier 1: Phone ──
        dp = normalize_phone(dealer.get("contact_phone"))
        if dp and dp in phone_idx:
            candidates = [c for c in phone_idx[dp] if c["id"] not in already_matched_prospects]
            if len(candidates) == 1:
                p = candidates[0]
                high_confidence.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "prospect_id": p["id"],
                    "prospect_title": p.get("title", ""),
                    "match_reason": "phone_exact",
                    "matched_value": dp,
                })
                already_matched_prospects.add(p["id"])
                stats["phone_exact"] += 1
                matched = True
            elif len(candidates) > 1:
                ambiguous.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "match_reason": "phone_exact",
                    "matched_value": dp,
                    "candidate_count": len(candidates),
                    "candidate_titles": "; ".join(c.get("title", "") for c in candidates[:5]),
                })
                stats["phone_ambiguous"] += 1
                matched = True  # Don't try lower-confidence methods

        if matched:
            continue

        # ── Tier 1: Email ──
        de = (dealer.get("contact_email") or "").strip().lower()
        if de and de in email_idx:
            candidates = [c for c in email_idx[de] if c["id"] not in already_matched_prospects]
            if len(candidates) == 1:
                p = candidates[0]
                high_confidence.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "prospect_id": p["id"],
                    "prospect_title": p.get("title", ""),
                    "match_reason": "email_exact",
                    "matched_value": de,
                })
                already_matched_prospects.add(p["id"])
                stats["email_exact"] += 1
                matched = True
            elif len(candidates) > 1:
                ambiguous.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "match_reason": "email_exact",
                    "matched_value": de,
                    "candidate_count": len(candidates),
                    "candidate_titles": "; ".join(c.get("title", "") for c in candidates[:5]),
                })
                stats["email_ambiguous"] += 1
                matched = True

        if matched:
            continue

        # ── Tier 1: Domain ──
        dd = extract_domain(dealer.get("dealer_website"))
        if dd and dd in domain_idx:
            candidates = [c for c in domain_idx[dd] if c["id"] not in already_matched_prospects]
            if len(candidates) == 1:
                p = candidates[0]
                high_confidence.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "prospect_id": p["id"],
                    "prospect_title": p.get("title", ""),
                    "match_reason": "domain_exact",
                    "matched_value": dd,
                })
                already_matched_prospects.add(p["id"])
                stats["domain_exact"] += 1
                matched = True
            elif len(candidates) > 1:
                ambiguous.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "match_reason": "domain_exact",
                    "matched_value": dd,
                    "candidate_count": len(candidates),
                    "candidate_titles": "; ".join(c.get("title", "") for c in candidates[:5]),
                })
                stats["domain_ambiguous"] += 1
                matched = True

        if matched:
            continue

        # ── Tier 2: Name + City + State ──
        dn = normalize_name(dname)
        dc = (dealer.get("city") or "").strip().lower()
        ds = normalize_state(dealer.get("state"))
        if dn and dc and ds and (dn, dc, ds) in ncs_idx:
            candidates = [c for c in ncs_idx[(dn, dc, ds)] if c["id"] not in already_matched_prospects]
            if len(candidates) == 1:
                p = candidates[0]
                fuzzy_matches.append({
                    "dealer_no": dno,
                    "dealer_name": dname,
                    "allied_segment": segment,
                    "prospect_id": p["id"],
                    "prospect_title": p.get("title", ""),
                    "match_reason": "name_city_state",
                    "matched_value": f"{dn} | {dc} | {ds}",
                    "name_allied_norm": dn,
                    "name_prospect_norm": normalize_name(p.get("title")),
                    "city": dc,
                    "state": ds,
                })
                # Don't add to already_matched_prospects — fuzzy not yet approved
                stats["name_city_state"] += 1
                matched = True
            elif len(candidates) > 1:
                stats["name_city_state_ambiguous"] += 1

        if not matched:
            stats["unmatched"] += 1

    return high_confidence, fuzzy_matches, ambiguous, dict(stats)


# ── Output ─────────────────────────────────────────────────────

def write_csv(path, rows, fieldnames):
    """Write rows to CSV."""
    if not rows:
        print(f"  (no rows to write for {path})")
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written {len(rows):,} rows → {path}")


def main():
    # Load data
    print("[match] Loading prospects...")
    with open(PROSPECTS_FILE, "r") as f:
        prospects = json.load(f)
    print(f"  Loaded {len(prospects):,} prospects")

    print("[match] Loading allied dealers...")
    with open(ALLIED_FILE, "r") as f:
        allied = json.load(f)
    print(f"  Loaded {len(allied):,} dealers")

    # Build indexes
    print("\n[match] Building prospect indexes...")
    phone_idx, email_idx, domain_idx, ncs_idx, skipped = build_prospect_indexes(prospects)
    print(f"  Phone index:  {len(phone_idx):,} unique phones")
    print(f"  Email index:  {len(email_idx):,} unique emails")
    print(f"  Domain index: {len(domain_idx):,} unique domains")
    print(f"  Name+City+State index: {len(ncs_idx):,} unique combos")
    print(f"  Skipped (already allied): {skipped:,}")

    # Allied data quality
    a_phone = sum(1 for d in allied if normalize_phone(d.get("contact_phone")))
    a_email = sum(1 for d in allied if (d.get("contact_email") or "").strip())
    a_domain = sum(1 for d in allied if extract_domain(d.get("dealer_website")))
    a_name = sum(1 for d in allied if normalize_name(d.get("dealer_name")))
    print(f"\n  Allied data quality:")
    print(f"    With valid phone:  {a_phone:,} / {len(allied):,}")
    print(f"    With email:        {a_email:,} / {len(allied):,}")
    print(f"    With domain:       {a_domain:,} / {len(allied):,}")
    print(f"    With name:         {a_name:,} / {len(allied):,}")

    # Run matching
    print("\n[match] Running matching cascade...")
    high_conf, fuzzy, ambig, stats = run_matching(allied, phone_idx, email_idx, domain_idx, ncs_idx)

    # Summary
    summary_lines = [
        "=" * 60,
        "ALLIED → PROSPECT MATCHING RESULTS",
        "=" * 60,
        "",
        f"Allied dealers:        {len(allied):,}",
        f"Prospects (available): {len(prospects) - skipped:,} (of {len(prospects):,} total, {skipped:,} already linked)",
        "",
        "TIER 1 — HIGH CONFIDENCE",
        f"  Phone exact:         {stats.get('phone_exact', 0):,}",
        f"  Email exact:         {stats.get('email_exact', 0):,}",
        f"  Domain exact:        {stats.get('domain_exact', 0):,}",
        f"  ─────────────────────────",
        f"  Total high-conf:     {len(high_conf):,}",
        "",
        "TIER 2 — FUZZY (sample for review)",
        f"  Name+City+State:     {stats.get('name_city_state', 0):,}",
        "",
        "AMBIGUOUS (one dealer → multiple prospects)",
        f"  Phone ambiguous:     {stats.get('phone_ambiguous', 0):,}",
        f"  Email ambiguous:     {stats.get('email_ambiguous', 0):,}",
        f"  Domain ambiguous:    {stats.get('domain_ambiguous', 0):,}",
        f"  Name ambiguous:      {stats.get('name_city_state_ambiguous', 0):,}",
        f"  Total ambiguous:     {len(ambig):,}",
        "",
        f"UNMATCHED:             {stats.get('unmatched', 0):,}",
        "",
        "HIGH-CONFIDENCE BY SEGMENT:",
    ]

    # Break down high-confidence by allied_segment
    seg_counts = defaultdict(int)
    for m in high_conf:
        seg_counts[m["allied_segment"]] += 1
    for seg, count in sorted(seg_counts.items(), key=lambda x: -x[1]):
        suppress = " [SUPPRESS]" if seg == "current_turnkey" else ""
        summary_lines.append(f"  {seg}: {count:,}{suppress}")

    summary_text = "\n".join(summary_lines)
    print(f"\n{summary_text}")

    with open(OUT_SUMMARY, "w") as f:
        f.write(summary_text + "\n")
    print(f"\n  Summary → {OUT_SUMMARY}")

    # Write CSVs
    print("\n[match] Writing CSVs...")

    hc_fields = ["dealer_no", "dealer_name", "allied_segment", "prospect_id",
                  "prospect_title", "match_reason", "matched_value"]
    write_csv(OUT_HIGH_CONFIDENCE, high_conf, hc_fields)

    fuzzy_fields = hc_fields + ["name_allied_norm", "name_prospect_norm", "city", "state"]
    # Only output first 100 as sample
    fuzzy_sample = fuzzy[:100]
    write_csv(OUT_FUZZY_SAMPLE, fuzzy_sample, fuzzy_fields)
    if len(fuzzy) > 100:
        print(f"  (showing 100 of {len(fuzzy):,} total fuzzy matches)")

    ambig_fields = ["dealer_no", "dealer_name", "allied_segment", "match_reason",
                    "matched_value", "candidate_count", "candidate_titles"]
    write_csv(OUT_AMBIGUOUS, ambig, ambig_fields)

    print("\n[match] Done.")


if __name__ == "__main__":
    main()
