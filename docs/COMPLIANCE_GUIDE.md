# Allied Air Compliance Guide

## Master Framework for Contract Transition

**Last Updated:** December 2024  
**Contract Status:** Active through February 2026  
**Repo:** woodhouse_creative

---

## Quick Reference

See `prospect_engine/docs/COMPLIANCE_GUIDE.md` for the full master framework.

### Core Principles

1. **Archive ≠ Destroy** - Keep Allied data for records, not operations
2. **No Surviving Flags** - No `was_allied` markers in production
3. **Structural Incapability** - Separate storage so Allied data can't be queried
4. **Runtime Suppression** - Ephemeral checks during contract, deleted at termination
5. **Unmatched = Unreachable** - If only in Allied data, can't contact
6. **Standalone Openers** - Post-contract outreach needs no Allied context

---

## This Repo's Role

`woodhouse_creative` handles:
- Dealer logos and branding assets
- Video rendering (Creatomate)
- Content scheduling data
- Dealer contact information

**Allied Data Present:** Yes - dealer database, logos, scheduling data

---

## At Termination

### Archive to Cold Storage

Move to `archive_allied/` or encrypted folder:
- `data/sqlite/*.db` (dealer databases)
- `data/logos/` (dealer logo files)
- `data/*.csv` (dealer lists)
- Any Allied-branded templates

### Production State After Termination

- No Allied dealer data in active databases
- No Allied logos in active storage
- Templates are Allied-neutral
- Rendering system works for any client

---

## See Also

- `COMPLIANCE_WOODHOUSE_CREATIVE.md` - Detailed implementation for this repo
