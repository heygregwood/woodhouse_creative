# Dealer Name Fields

## The Problem
Allied Air distributors enter dealer names in ALL CAPS with ampersands (`&`). This doesn't work for:
- Social media posts (looks unprofessional)
- File/folder naming (ampersands break paths)
- Brand consistency (should match dealer's own website)

## Solution: Two Name Fields

| Field | Source | Example | Use Case |
|-------|--------|---------|----------|
| `dealer_name` | Allied API | `ALL TEMP HEATING & COOLING` | Internal reference, API sync |
| `display_name` | Manual/Website | `All Temp Heating and Cooling` | Posts, folders, creative |

## Rules for `display_name`
1. **Proper case** - Not ALL CAPS
2. **No ampersands** - Use "and" instead of "&"
3. **Match their branding** - Check dealer's website/Facebook for official name
4. **Safe for filenames** - No special characters that break folder paths

## Validation Status
- If `display_name` is NULL → needs manual review
- If `display_name` is set → ready for creative automation

## Query: Dealers Needing Display Name
```sql
SELECT dealer_no, dealer_name, website
FROM dealers 
WHERE display_name IS NULL 
  AND program_status = 'FULL';
```
