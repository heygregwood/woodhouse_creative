# Prospect Dealers Data Collection

**Last Updated:** February 27, 2026
**Collection:** `prospect_dealers` in Firestore (`woodhouse-creative-db`)
**Purpose:** Woodhouse Social prospecting -- score and prioritize former Allied Air dealers for outreach
**Document ID:** `dealer_no` (e.g., `"10231005"`)

---

## What This Is (Business Context)

This Firestore collection combines data from multiple sources to answer one question: **which former Allied Air dealers are the best prospects for Woodhouse Social?**

Every removed dealer who participated in the Allied Air Turnkey Social Media program is in here. Current dealers are included too (flagged as off-limits) so the data is complete if they become targetable later.

### The Data Sources

| Source | What It Tells Us | Records |
|--------|-----------------|---------|
| Exploration Excel | Who the dealer is, what program they were in, when they joined/left | ~670 unique dealers |
| Sprout Post Performance (7 CSVs) | How many posts, engagement rates, when posting stopped | 38,507 posts across 188 matched dealers |
| Sprout Facebook Pages | Follower count, follower growth, page actions (calls/directions) | 192 matched dealers |
| Sprout Profile Performance | Private messages received/sent (lead proxy) | 192 matched dealers |
| Apify Facebook Scrape | Recent posting activity for dealers without Sprout access | 18 matched + 17 confirmed dark |
| Allied Air OData API | Street address, postal code, brands, website | 672 matched (33,867 total in API) |

### Experience Levels

Every dealer is classified into one of five experience levels based on what they actually experienced with the Woodhouse service:

| Level | Description | Targetable | What They Know |
|-------|-------------|-----------|----------------|
| A | **Fully Managed** -- had admin access, posts, and Sprout monitoring | 85 | Know exactly what managed social media looks like |
| B | **Managed, No Sprout** -- had admin and posts but no Sprout monitoring | 12 | Saw posts going out, maybe didn't get reports |
| C | **FB Admin, No Posts** -- gave admin access but was never activated | 2 | Trusted Woodhouse enough to give access |
| D | **Had Posts, No Current Admin** -- posts existed but admin was removed | 32 | Experienced the service, admin removed on exit |
| E | **Content Only** -- never gave admin, never had posts scheduled | 288 | Knew the program existed, may have downloaded content |

### Page Status (Weather Metaphor)

Based on recent posting activity, each dealer's Facebook page is classified:

| Status | Posts/Month | Meaning |
|--------|------------|---------|
| **dark** | 0 | Dead page. No one's home. |
| **grey** | 1-3 | Barely alive. Sporadic self-posts. |
| **cloudy** | 4-7 | Some effort but inconsistent. ~1-2x/week. |
| **sunny** | 8-20 | Healthy cadence. Every 1-3 days. The sweet spot. |
| **tornado** | 20+ | Over-posting. FB algorithm penalizes reach. |

Page status is computed from the last 3 months of available data (from Sprout or Apify).

### Prospect Scoring

Each dealer gets a composite score (0-10 scale) based on:

| Signal | Points | Why |
|--------|--------|-----|
| Had posts (ever) | +2 | They experienced the service |
| Posting duration > 1 year | +1 | Deep relationship |
| Were FULL status | +1 | Trusted Woodhouse with admin |
| PRO tier ($4,500/yr) | +1 | Higher marketing investment |
| Has website on file | +0.5 | More established business |
| Enrollment > 2 years | +0.5 | Long-term participant |
| Followers > 250 | +0.5 | Established audience |
| Received PMs > 25 | +0.5 | Facebook generated leads for them |
| Page actions > 0 | +0.5 | Bottom-funnel activity (calls, directions) |
| Page is dark or grey | +1 | Strongest pitch opportunity |
| Follower growth > 0 | +0.5 | Service was building their audience |
| Engagement rate > 10% | +1 | Content was performing well |
| **Opt-out** | **-99** | **Hard stop. Do not contact.** |

**Prospect tiers:**
- **hot** (7+): Experienced the service, page going dark, strong engagement history
- **warm** (4-6.5): Had some experience or strong program signals
- **cold** (0-3.5): Content-only or minimal engagement history

### MSA Constraint

Cannot reference "Turnkey Social Media" in Woodhouse Social outreach. The message references "a done-for-you social media service" and lets the dealer make the connection.

---

## Field Reference (Technical)

### Identity (from Excel -- every dealer has these)

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `dealer_no` | string | `"10231005"` | Document ID. 8-digit Allied Air ID. |
| `dealer_name` | string | `"AIR SYSTEMS RGV"` | Original Allied name from Excel. |
| `city` | string | `"McAllen"` | Dealer city. |
| `state` | string | `"TX"` | Dealer state. |
| `distributor` | string | `"Johnson Supply"` | Distributor Branch Name from Excel. |

### Program History (from Excel)

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `program_status` | string | `"FULL"` | `FULL` (managed posting) or `CONTENT` (download only). |
| `tier` | string | `"PROARM"` | Program tier: PROARM, PROAIR, CTEAM, PREMR, ARM. |
| `tier_investment` | string | `"high"` | `high` ($4,500/yr for PRO tiers), `standard` ($2,500/yr), `legacy` (ARM). |
| `registration_date` | string\|null | `"1994-07-27"` | Allied Air registration date. |
| `removed_date` | string\|null | `"2025-01-30"` | Date removed from program. Null = current dealer. |
| `first_post_date` | string\|null | `"2021-09-10"` | First Woodhouse post. Proves past admin access. |

### Contact (from Excel)

| Field | Type | Description |
|-------|------|-------------|
| `contact_name` | string\|null | Full contact name. |
| `contact_first_name` | string\|null | First name (for personalization). |
| `contact_email` | string\|null | Contact email address (from "Contact Email Address" column). |
| `contact_admin_email` | string\|null | Admin email address (from "Contact Admin Email Address" column). Often same as contact_email. |
| `turnkey_email` | string\|null | Turnkey program email (from "TurnkeyEmail" column). May differ from contact_email. |
| `contact_phone` | string\|null | Contact phone number. |

### Web Presence (from Excel + Apify)

| Field | Type | Description |
|-------|------|-------------|
| `dealer_web_address` | string\|null | Business website from Excel (backfilled from API if null). |
| `facebook_page_name` | string\|null | Facebook Page Name from Excel. Key for matching to Sprout data. |
| `facebook_page_url` | string\|null | Cleaned Facebook URL (from TurnkeyURL field or Apify). |

### Allied Air API Fields (from OData API pull, Feb 23 2026)

| Field | Type | Description |
|-------|------|-------------|
| `api_street` | string\|null | Street address from Allied Air API. 672 of 676 have this. |
| `api_postal_code` | string\|null | ZIP/postal code from Allied Air API. |
| `api_brands` | string\|null | Pipe-delimited brand codes (e.g., "ARM\|AIR\|CON\|COM"). ARM=Armstrong, AIR=AirEase, CON=Concord, COM=ComfortMaker, DUC=Ducane. |
| `api_dealer_website` | string\|null | Website from Allied API (for reference; `dealer_web_address` is primary). |

### Derived Signals (computed at load time)

| Field | Type | Logic |
|-------|------|-------|
| `ever_had_fb_admin` | boolean | `fb_admin_access == 'Y'` OR `first_post_date` exists. |
| `experience_level` | string | A through E. See Experience Levels table above. |
| `targetable` | boolean | Has `removed_date` AND not opt-out. |
| `is_opt_out` | boolean | NOTE column contains "OPT". |
| `enrollment_days` | number\|null | `removed_date - registration_date` in days. |
| `posting_days` | number\|null | `removed_date - first_post_date` in days. |

### Sprout: Posting (from Post Performance CSVs)

| Field | Type | Description |
|-------|------|-------------|
| `sprout_total_posts` | number\|null | Total unique posts in Sprout data. |
| `sprout_last_post_date` | string\|null | Date of most recent post in Sprout. |

### Sprout: Engagement (from Post Performance CSVs)

| Field | Type | Description |
|-------|------|-------------|
| `sprout_avg_impressions` | number\|null | Average impressions per post. |
| `sprout_avg_engagements` | number\|null | Average engagements per post. |
| `sprout_engagement_rate` | number\|null | Engagement rate as percentage (e.g., 12.73). |
| `sprout_total_engagements` | number\|null | Lifetime total engagements across all posts. |

### Sprout: Page Metrics (from Facebook Pages report)

| Field | Type | Description |
|-------|------|-------------|
| `sprout_followers` | number\|null | Latest follower count. Sprout caps at 999. |
| `sprout_follower_growth` | number\|null | Net follower growth over entire period. |
| `sprout_page_actions` | number\|null | Total page actions (calls, directions, website clicks). |
| `sprout_total_reach` | number\|null | Lifetime total reach. |

### Sprout: Messages (from Profile Performance report)

| Field | Type | Description |
|-------|------|-------------|
| `sprout_received_pms` | number\|null | Total private messages received. Lead proxy. |
| `sprout_sent_pms` | number\|null | Total private messages sent by Woodhouse. |

### Page Status (from Sprout + Apify)

| Field | Type | Description |
|-------|------|-------------|
| `page_status` | string\|null | `dark` / `grey` / `cloudy` / `sunny` / `tornado`. Based on last 3 months. |
| `page_status_source` | string\|null | `sprout` / `apify` -- which data source determined status. |
| `last_post_date` | string\|null | Most recent post we can see (from any source). |
| `avg_posts_last_3mo` | number\|null | Average posts/month over the last 3 months of data. |

### Apify (future -- Facebook page scrape)

| Field | Type | Description |
|-------|------|-------------|
| `apify_last_post_date` | string\|null | Last post date from Apify scrape. |
| `apify_scrape_date` | string\|null | When the Apify scrape was run. |

### Scoring (computed from all signals)

| Field | Type | Description |
|-------|------|-------------|
| `prospect_score` | number | Composite score, 0-10 scale. |
| `prospect_tier` | string | `hot` (7+) / `warm` (4-6.5) / `cold` (0-3.5). |

### Meta

| Field | Type | Description |
|-------|------|-------------|
| `data_sources` | string[] | Which sources contributed data. e.g., `["excel", "sprout_posts", "sprout_pages", "sprout_profile"]`. |
| `created_at` | timestamp | When the document was first created. |
| `updated_at` | timestamp | When the document was last modified. |

---

## Data Pipeline

### Loading

```bash
# Step 1: Process all sources into a single JSON
cd ~/woodhouse_creative
set -a && source .env.local && set +a
python3 scripts/build-prospect-data.py

# Step 2: Load JSON into Firestore
npx tsx scripts/load-prospect-dealers.ts

# Step 3 (future): Merge Apify results
npx tsx scripts/load-prospect-dealers.ts --apify /path/to/apify-results.csv
```

### Source File Locations

| Source | Path |
|--------|------|
| Exploration Excel | `OneDrive/.../ALL AAE DEALER DATA 02-26-2026...xlsx` |
| Post Performance (7 CSVs) | `Downloads/Post Performance (Turnkey & Dist - All) *.csv` |
| Facebook Pages | `Downloads/Facebook Pages (Turnkey & Dist - All) *.csv` |
| Profile Performance | `Downloads/Profile Performance (Turnkey & Dist - All) *.csv` |

### Matching Key

Sprout data matches to dealers via **Facebook Page Name** (Excel) = **Profile** (Sprout Post Performance) = **Facebook Page** (Sprout Facebook Pages/Profile Performance). 188 of 219 Sprout profiles match after normalizing curly quotes and whitespace. 31 remain unmatched.

### Reloading

The loading script is idempotent -- running it again overwrites existing documents. Safe to re-run after adding new data sources (like Apify results).

---

## Querying

```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# All hot prospects
npx tsx -e "
import { db } from './lib/firebase';
const snap = await db.collection('prospect_dealers')
  .where('prospect_tier', '==', 'hot')
  .where('targetable', '==', true)
  .get();
console.log('Hot prospects:', snap.size);
snap.forEach(d => {
  const data = d.data();
  console.log(d.id, data.dealer_name, data.prospect_score, data.page_status);
});
"

# Dark pages with high engagement
npx tsx -e "
import { db } from './lib/firebase';
const snap = await db.collection('prospect_dealers')
  .where('page_status', '==', 'dark')
  .where('targetable', '==', true)
  .get();
snap.forEach(d => {
  const data = d.data();
  console.log(d.id, data.dealer_name, data.sprout_engagement_rate, data.sprout_followers);
});
"
```

---

## Relationship to pe_allied_dealers and pe_prospects (woodhouse_social)

The `prospect_dealers` scoring data from this collection was merged into the `pe_allied_dealers` collection in woodhouse_social's default Firestore database on Feb 27, 2026. Of the 676 prospect_dealers, 672 matched to API records and had their scoring fields (prospect_score, prospect_tier, experience_level, page_status, sprout metrics) copied to pe_allied_dealers.

`pe_allied_dealers` is the unified Allied Air dealer collection (33,867 records from API ground truth). `prospect_dealers` remains as a read-only working dataset in woodhouse-creative-db for analysis scripts.

### Matching Pipeline (Feb 27, 2026)

After rebuilding pe_allied_dealers, we matched the 33,867 Allied dealers against the 145K pe_prospects using phone, email, and domain matching. Found 4,712 new high-confidence matches (total Allied-linked prospects: 8,764). Both collections were then enriched bidirectionally:

- **pe_prospects** got Allied API contacts added to emails[] and phones[] arrays (7,140 emails, 2,294 phones)
- **pe_allied_dealers** got a `prospect_contacts` object with Google Maps contacts (emails, phones, domain, website)
- 291 current_turnkey prospects were suppressed with `outreach_status='allied_dealer'` and `email_opted_out=true`

Scripts (all in woodhouse_creative):
- `scripts/export-for-matching.ts` — Export both collections to JSON
- `scripts/match-allied-to-prospects.py` — Cascade matching (phone → email → domain → fuzzy name)
- `scripts/apply-allied-matches.ts` — Apply approved matches to pe_prospects
- `scripts/enrich-allied-prospect-matches.ts` — Bidirectional enrichment + suppression
