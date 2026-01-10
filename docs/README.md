# Woodhouse Creative Documentation

**Last Updated:** January 9, 2026

This directory contains all documentation for the Woodhouse Creative automation system.

---

## Quick Links by Task

| Task | Document |
|------|----------|
| Understanding the codebase | [CLAUDE.md](../CLAUDE.md) |
| Database schema and fields | [DATABASE.md](DATABASE.md) |
| Data model overview | [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) |
| Current manual workflow | [WORKFLOW_CURRENT.md](WORKFLOW_CURRENT.md) |
| Automation roadmap | [END_TO_END_DOCUMENTATION_DRAFT.md](END_TO_END_DOCUMENTATION_DRAFT.md) |
| **Excel sync column mapping** | **[EXCEL_SYNC_REFERENCE.md](EXCEL_SYNC_REFERENCE.md)** ⚠️ Critical |
| Compliance guidelines | [COMPLIANCE_GUIDE.md](COMPLIANCE_GUIDE.md) |
| Dealer onboarding automation | [DEALER_ONBOARDING_AUTOMATION_PLAN.md](DEALER_ONBOARDING_AUTOMATION_PLAN.md) |
| Documentation improvement plan | [DOCUMENTATION_IMPROVEMENT_PLAN.md](DOCUMENTATION_IMPROVEMENT_PLAN.md) |

---

## Documentation by Category

### Core System Documentation
- **[CLAUDE.md](../CLAUDE.md)** - AI assistant instructions, dev workflow, mandatory rules, coding standards
- **[DATABASE.md](DATABASE.md)** - SQLite schema, field definitions, import scripts
- **[DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)** - High-level data model, Excel structure overview
- **[EXCEL_SYNC_REFERENCE.md](EXCEL_SYNC_REFERENCE.md)** - ⚠️ **Critical:** Column-by-column mapping table

### Workflows & Processes
- **[WORKFLOW_CURRENT.md](WORKFLOW_CURRENT.md)** - Current 9-step manual post creation process
- **[END_TO_END_DOCUMENTATION_DRAFT.md](END_TO_END_DOCUMENTATION_DRAFT.md)** - Complete automation implementation plan
- **[DEALER_ONBOARDING_AUTOMATION_PLAN.md](DEALER_ONBOARDING_AUTOMATION_PLAN.md)** - Automated dealer review workflow plan

### Compliance & Standards
- **[COMPLIANCE_GUIDE.md](COMPLIANCE_GUIDE.md)** - General compliance guidelines
- **[COMPLIANCE_WOODHOUSE_CREATIVE.md](COMPLIANCE_WOODHOUSE_CREATIVE.md)** - Project-specific compliance rules
- **[DEALER_NAMES.md](DEALER_NAMES.md)** - Naming conventions and display name standards

### Meta Documentation
- **[DOCUMENTATION_IMPROVEMENT_PLAN.md](DOCUMENTATION_IMPROVEMENT_PLAN.md)** - How to maintain accurate documentation

---

## Critical Documents (Read First)

If you're new to the project or working on data structure changes, read these in order:

1. **[CLAUDE.md](../CLAUDE.md)** - Start here for dev workflow and mandatory documentation rules
2. **[DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)** - Understand the overall data model
3. **[DATABASE.md](DATABASE.md)** - Learn the database schema details
4. **[EXCEL_SYNC_REFERENCE.md](EXCEL_SYNC_REFERENCE.md)** - ⚠️ **Critical for Excel sync work**

---

## Verification Dates

Documents with verification dates show when they were last checked against live code/data. If a date is >30 days old, the document may need updating.

| Document | Last Verified | Against | Status |
|----------|---------------|---------|--------|
| EXCEL_SYNC_REFERENCE.md | 2026-01-09 | lib/sync-excel.ts + Excel file | ✅ Current |
| DATABASE.md | (needs date) | SQLite database | ⚠️ Needs verification |
| DATA_ARCHITECTURE.md | (needs date) | Firestore schema | ⚠️ Needs verification |

---

## Documentation Standards

All documentation follows these standards (see [CLAUDE.md](../CLAUDE.md) for details):

1. **Verification dates** at top of each doc
2. **Code references** with file paths and line numbers
3. **3-step workflow** before updating: Read code → Read docs → Compare
4. **CHANGELOG.md entries** for all data structure changes

---

## How to Find Information

**Looking for a specific topic?**
1. Check the Quick Links table above
2. Use your IDE's search across all `.md` files
3. Check [CHANGELOG.md](../CHANGELOG.md) for recent changes

**Can't find what you need?**
- The information might be in comments in the code files
- Check the `scripts/` directory for Python script documentation
- Ask in the session - documentation may need updating

---

## Contributing to Documentation

Before updating any documentation:

1. **Read [CLAUDE.md](../CLAUDE.md)** - Documentation Updates section
2. **Follow the 3-step workflow** - Read code, read docs, compare
3. **Add verification dates** when you update
4. **Update CHANGELOG.md** with files changed
5. **Include code references** with line numbers

This prevents documentation drift and catches bugs before they happen.
