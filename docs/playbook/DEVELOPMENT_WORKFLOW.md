# Development Workflow

**Last Updated:** January 13, 2026

---

## Overview

Development workflow from local testing to production deployment.

```
LOCAL (localhost:3000) → PREVIEW (vercel.app) → PRODUCTION
```

---

## Local Development

### Start Dev Server

```bash
cd ~/woodhouse_creative
npm run dev
```

**Note:** Let Greg start the dev server so he can Ctrl+C it.

### Test Changes

1. Make code changes
2. Save files (hot reload updates)
3. Test in browser at http://localhost:3000

### Before Building

**CRITICAL:** Stop dev server before running builds to prevent WSL crashes.

```bash
# In terminal running dev server: Ctrl+C

# Then build
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Commit Workflow

### Mandatory Testing Protocol

```
1. Make code changes
2. ASK USER: "Ready to test on localhost?"
3. WAIT for user confirmation: "tests pass, push it"
4. ONLY THEN: Commit and push to main
5. Tell user: "Pushed to main - test on Preview"
6. User tests on Preview
7. User manually deploys to production
```

### Never Skip

- Push without local testing confirmation
- Push directly to production
- Run builds while dev server is running

### Commit Commands

```bash
# Stage all changes
ga

# Commit with message
git commit -m "feat: Add new feature"

# Push to origin
gpush

# All in one
ga && git commit -m "feat: Add new feature" && gpush
```

### Commit Message Format

```
type: description

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Code refactoring
- test: Tests
- chore: Maintenance
```

---

## Multi-Machine Workflow

### Desktop (Primary Development)

```bash
# Normal development
npm run dev
ga && git commit -m "..." && gpush
```

### Laptop (Sync Only)

```bash
# ONLY sync - DO NOT merge or push
git checkout main
git pull origin main
```

### Machine-Specific Config

| Machine | WINDOWS_USERNAME | Notes |
|---------|-----------------|-------|
| Desktop | GregWood | Default in scripts |
| Laptop | gregw | Set in .env.local |

**On Laptop:** Add to `.env.local`:
```env
WINDOWS_USERNAME=gregw
```

This affects Excel sync path: `/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive...`

---

## Intermediate Commits

**Commit frequently during large changes:**

```bash
# After each step
git add .
git commit -m "Step 1: Implement X"
git push

# Continue working
git add .
git commit -m "Step 2: Add Y"
git push
```

**Benefits:**
- Rollback to any step
- Better git history
- Session compaction won't lose work

**When to Commit:**
- After each file/component works
- Before risky refactors
- Every 30-60 minutes
- Before switching tasks

---

## Preview Deployment

Pushing to `main` automatically deploys to Preview:

```bash
ga && git commit -m "message" && gpush
```

**Preview URL:** https://woodhouse-creative.vercel.app

Test on Preview before considering production deployment.

---

## Documentation Updates

### Before Committing Data Changes

1. Identify what changed
2. Find corresponding docs
3. Read code → Read docs → Compare
4. Update docs with specific changes
5. Add verification date
6. Update CHANGELOG.md

### Never

- Update docs based on assumptions
- Skip the comparison step
- Commit without updating CHANGELOG.md

---

## WSL Memory Management

### Memory Limits

WSL configured with 8GB RAM + 4GB swap in:
`C:\Users\GregWood\.wslconfig`

### Before Building

1. Stop dev server (Ctrl+C)
2. Clean .next if needed: `rm -rf .next`
3. Run build with memory limit

### If Builds Are Slow

```bash
rm -rf .next && npm run build
```

### If WSL Crashes

```powershell
# In PowerShell
wsl --shutdown
wsl -d Ubuntu
```

---

## Environment Variables

### Required for Development

```env
# Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=woodhouse-social
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Creatomate
CREATOMATE_API_KEY=...

# Google
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...

# Resend
RESEND_API_KEY=...
```

### Machine-Specific

```env
# Desktop (default)
WINDOWS_USERNAME=GregWood

# Laptop
WINDOWS_USERNAME=gregw
```

---

## Related Documentation

| File | Purpose |
|------|---------|
| [QUICK_COMMANDS.md](QUICK_COMMANDS.md) | Common commands |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues |
