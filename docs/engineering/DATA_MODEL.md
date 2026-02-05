# Data Model Reference

**Last Updated:** January 13, 2026
**Status:** Current - Firestore is source of truth
**Database:** Firebase Firestore (`woodhouse-creative-db`)

---

## Overview

Woodhouse Creative uses Firebase Firestore as the primary database for dealer management and render job tracking. SQLite exists locally for batch renders and as a fallback reference.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Dealer Number** | 8-digit ID assigned by Allied Air (e.g., `10231005`). Primary key across all systems. |
| **FULL vs CONTENT** | FULL = we post for them. CONTENT = we create, they post. |
| **Creatomate Fields** | Validated data for video renders: `display_name`, `creatomate_phone`, `creatomate_website`, `creatomate_logo` |
| **Ready for Automate** | All Creatomate fields validated. Set to `"yes"` when ready. |
| **Region** | Geographic region: `NORTH`, `SOUTH`, or `CANADA`. Used for scheduling and content. |

---

## Firestore Collections

### 1. `dealers` Collection

**Document ID:** `dealer_no` (e.g., "10251015")
**Module:** [lib/firestore-dealers.ts](../../lib/firestore-dealers.ts)

```typescript
interface FirestoreDealer {
  // Primary key
  dealer_no: string;           // Allied Air 8-digit ID

  // Core info
  dealer_name: string;         // From Allied API (often ALL CAPS)
  display_name?: string;       // Clean name for videos (proper case)
  program_status: string;      // 'FULL' | 'CONTENT' | 'NEW'
  source: string;              // 'API' | 'MANUAL'

  // Contact info
  contact_name?: string;
  contact_first_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_admin_email?: string;

  // Dates
  first_post_date?: string;
  date_added?: string;
  registration_date?: string;
  renew_date?: string;

  // Location
  dealer_address?: string;
  dealer_city?: string;
  dealer_state?: string;
  dealer_web_address?: string;
  region?: string;             // 'NORTH' | 'SOUTH' | 'CANADA'

  // Distributor
  distributor_name?: string;

  // Status
  allied_status?: string;      // 'active' | 'REMOVED'

  // Brands
  armstrong_air: number;       // 1 = carries Armstrong Air
  airease: number;             // 1 = carries AirEase
  tier?: string;               // 'PROARM', 'CTEAM', etc.

  // Creatomate validated fields
  creatomate_phone?: string;   // Formatted: "269-966-9595"
  creatomate_website?: string; // Domain only: "hotairnow.com"
  creatomate_logo?: string;    // Google Drive URL

  // Turnkey fields (from Allied)
  turnkey_phone?: string;
  turnkey_url?: string;
  turnkey_email?: string;

  // Flags
  has_sprout_excel: number;
  bad_email: number;
  ready_for_automate?: string; // 'yes' when all fields validated
  logo_needs_design?: number;  // 1 if logo needs design work
  logo_source?: string;        // 'brandfetch', 'website', 'manual'
  scheduling_cleanup_done?: boolean; // true when removed FULL dealer's spreadsheet column has been deleted
  review_status?: string;      // 'pending_review' | null

  // Facebook
  facebook_page_id?: string;

  // Email tracking
  welcome_email_sent?: string;        // ISO timestamp
  fb_admin_accepted_email_sent?: string;
  first_post_email_sent?: string;
  last_post_email_sent?: string;

  // Notes
  note?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### 2. `renderQueue` Collection

**Document ID:** Auto-generated
**Module:** [lib/renderQueue.ts](../../lib/renderQueue.ts)

```typescript
interface RenderQueueJob {
  id: string;
  batchId: string;
  businessId: string;          // dealer_no
  businessName: string;        // display_name
  postNumber: number;
  templateId: string;

  // Status tracking
  status: 'pending' | 'processing' | 'completed' | 'failed';
  renderId?: string;           // Creatomate render ID
  renderUrl?: string;          // Creatomate video URL

  // Google Drive output
  driveFileId?: string;
  driveUrl?: string;
  drivePath?: string;

  // Timestamps
  createdAt: Timestamp;
  processingStartedAt?: Timestamp;
  completedAt?: Timestamp;

  // Error handling
  retryCount: number;
  lastError?: string;

  // Metadata
  metadata?: {
    creditsUsed?: number;
    fileSize?: number;
    renderTime?: number;
  };
}
```

### 3. `renderBatches` Collection

**Document ID:** Auto-generated
**Module:** [lib/renderQueue.ts](../../lib/renderQueue.ts)

```typescript
interface RenderBatch {
  postNumber: number;
  templateId: string;

  // Job counts
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingJobs: number;
  processingJobs: number;

  // Status
  status: 'queued' | 'processing' | 'completed' | 'failed';

  // Timestamps
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Metadata
  createdBy: string;
  baseVideoUrl?: string;
  totalCreditsUsed: number;
  totalFileSize: number;
  averageRenderTime: number;
}
```

---

## Querying Firestore

**IMPORTANT:** Use `npx tsx` with library imports, NOT standalone scripts.

```bash
# Set environment
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Count dealers by status
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const all = await getDealers();
const full = all.filter(d => d.program_status === 'FULL').length;
const content = all.filter(d => d.program_status === 'CONTENT').length;
console.log('Total:', all.length, '- FULL:', full, '- CONTENT:', content);
"

# Get a specific dealer
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
const d = await getDealer('10251015');
console.log(d?.display_name, d?.program_status, d?.ready_for_automate);
"

# List dealers pending review
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const pending = await getDealers({ review_status: 'pending_review' });
pending.forEach(d => console.log(d.dealer_no, d.dealer_name));
"
```

---

## SQLite Reference (Local Only)

**Location:** `~/woodhouse_creative/data/sqlite/creative.db`
**Status:** Read-only reference, Python scripts use for batch renders

### Main Table: `dealers`

```sql
CREATE TABLE dealers (
    dealer_no TEXT PRIMARY KEY,
    dealer_name TEXT NOT NULL,
    display_name TEXT,
    program_status TEXT,
    -- ... (same fields as Firestore)
);
```

### Query SQLite

```bash
sqlite3 ~/woodhouse_creative/data/sqlite/creative.db "SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL';"
```

---

## Data Sources (Priority Order)

1. **Firestore** - Source of truth for all operations
2. **Allied Air Excel** - `Turnkey Social Media - Dealers - Current.xlsm` (syncs to Firestore)
3. **Creatomate Validated Excel** - Historical validation data
4. **Sprout Social Export** - Facebook Page IDs
5. **Website/Google Maps** - Phone and website validation

---

## Field Priority Logic

### Phone Number
1. `creatomate_phone` (validated) - **USE THIS**
2. `turnkey_phone` (from Allied)
3. `contact_phone`

### Website
1. `creatomate_website` (validated) - **USE THIS**
2. `turnkey_url`
3. `dealer_web_address`

### Name
1. `display_name` (clean, proper case) - **USE THIS**
2. `dealer_name` (from Allied, often ALL CAPS)

---

## Dealer Lifecycle

```
NEW SIGNUP → CONTENT (default)
                ↓
    [Facebook admin invitation accepted]
                ↓
    FULL (pending_review)
                ↓
    [Admin approves: validates name, phone, website, logo]
                ↓
    FULL (ready_for_automate = 'yes')
                ↓
    [If dealer opts out or is removed]
                ↓
    allied_status = 'REMOVED'
```

---

## Google Drive Resources

| Resource | File ID | Purpose |
|----------|---------|---------|
| Scheduling Spreadsheet | `1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY` | Dealer columns, post rows |
| Posts Excel (No Images) | `1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE` | Post archive |
| Dealers Folder | `1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv` | Individual dealer folders |
| Logos Staging | `1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex` | Logo staging folder |

---

## Related Documentation

| File | Purpose |
|------|---------|
| [EXCEL_SYNC_REFERENCE.md](EXCEL_SYNC_REFERENCE.md) | Excel column mapping |
| [TYPESCRIPT_MODULES.md](TYPESCRIPT_MODULES.md) | lib/*.ts documentation |
| [API_REFERENCE.md](API_REFERENCE.md) | API endpoints |
