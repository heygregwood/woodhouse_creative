# Woodhouse Creative Compliance

## Repository-Specific Implementation

**Repo:** `woodhouse_creative`  
**Purpose:** Content creation, video rendering, dealer branding  
**Allied Data Present:** Yes - dealer databases, logos, scheduling data

---

## Current State (Contract Active)

### Data Locations
```
woodhouse_creative/
├── data/
│   ├── sqlite/          ← Dealer databases (Allied data)
│   ├── logos/           ← Dealer logo files (Allied-related)
│   ├── *.csv            ← Dealer lists (Allied data)
│   └── apify/           ← Scrape results
├── templates/
│   └── emails/          ← May contain Allied branding
└── scripts/             ← Processing scripts
```

### What Stays Active During Contract

- Continue rendering content for active dealers
- Continue managing logos and branding
- Continue scheduling and posting
- No changes to current operations

---

## At Termination (February 2026)

### Step 1: Create Archive Structure
```
archive_allied/
├── data/
│   ├── sqlite/          ← Move dealer DBs here
│   ├── logos/           ← Move dealer logos here
│   └── exports/         ← Final CSV exports for records
├── templates/
│   └── allied_branded/  ← Any Allied-specific templates
└── termination_log.md   ← Audit trail
```

### Step 2: Archive Dealer Assets
- Move all dealer databases to archive
- Move all dealer logos to archive
- Move Allied-branded templates to archive
- Keep only generic/reusable templates in production

### Step 3: Clean Production
- Remove Allied dealer references from active scripts
- Update any hardcoded Allied paths
- Verify rendering system works without Allied data

### Step 4: Template Neutrality
- Review all templates for Allied branding
- Archive Allied-specific templates
- Ensure remaining templates are client-agnostic

---

## Logo/Asset Handling

### During Contract
- Logos are dealer property, you're authorized to use them
- Store and use as needed for content creation

### At Termination
- Archive all logos to cold storage
- Do not use Allied dealer logos for marketing
- Do not use logos to demonstrate "past work" publicly

### Post-Termination (If Dealer Signs Up Independently)
- Request fresh logo from dealer
- Don't retrieve from Allied archive
- Treat as new client relationship

---

## Prohibited Actions (Always)

| Action | Why |
|--------|-----|
| Using Allied dealer list for Woodhouse Social signups | Derived targeting |
| Showing Allied dealer content as portfolio samples | May imply ongoing relationship |
| Contacting Allied dealers using data from this repo | Allied-sourced outreach |
| Creating "former Allied dealer" marketing lists | Surviving flags |

---

## Allowed Actions

| Action | Why |
|--------|-----|
| Continuing operations during contract | Contract is active |
| Archiving data for business records | Records retention |
| Using generic templates for new clients | No Allied dependency |
| Responding to inbound from former dealers | They initiated |

---

## Scripts Requiring Review at Termination

Any script that:
- Reads from dealer databases
- Processes dealer lists
- References Allied-specific paths
- Exports dealer data

**Action:** Update or archive scripts that have Allied dependencies.

---

## Verification Checklist (At Termination)

- [ ] All dealer databases moved to archive
- [ ] All dealer logos moved to archive
- [ ] Allied-branded templates archived
- [ ] Production scripts work without Allied data
- [ ] No Allied paths hardcoded in active code
- [ ] Termination documented with timestamp
