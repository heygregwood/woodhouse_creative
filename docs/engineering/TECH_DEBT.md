# Technical Debt & Codebase Improvements

Last updated: January 28, 2026

---

## Infrastructure - Shared Claude Session Scripts

**Status:** TO DO when creating additional repos

**Problem:**
Claude session persistence scripts (`write-session-context.js`, `recall-agent.js`, `read-session-context.js`, `save-checkpoint.js`) are duplicated across repos. Changes must be manually synced between `woodhouse_social` and `woodhouse_creative`. As more repos are added (personal, work), maintenance burden grows.

**Current State:**
- Scripts live independently in each repo's `/scripts/` folder
- CLAUDE.md session-related sections must be manually kept in sync
- `.env.local` with Firestore credentials duplicated per repo

**Recommended Solution: Symlinked Shared Folder**

Create a central folder that all repos reference via symlinks:

```
~/claude-shared-scripts/              # Source of truth
├── write-session-context.js
├── recall-agent.js
├── read-session-context.js
├── save-checkpoint.js
├── CLAUDE-SHARED.md
└── .env.local                        # Shared credentials

~/woodhouse_social/scripts/
├── write-session-context.js → ~/claude-shared-scripts/write-session-context.js
├── recall-agent.js → ~/claude-shared-scripts/recall-agent.js
└── import-homans-entries.js          # Repo-specific, not symlinked

~/woodhouse_creative/scripts/
├── write-session-context.js → ~/claude-shared-scripts/write-session-context.js
├── recall-agent.js → ~/claude-shared-scripts/recall-agent.js
└── ...
```

**Implementation Steps:**

1. Create shared folder:
   ```bash
   mkdir -p ~/claude-shared-scripts
   ```

2. Copy scripts from woodhouse_social (source of truth):
   ```bash
   cp ~/woodhouse_social/scripts/write-session-context.js ~/claude-shared-scripts/
   cp ~/woodhouse_social/scripts/recall-agent.js ~/claude-shared-scripts/
   cp ~/woodhouse_social/scripts/read-session-context.js ~/claude-shared-scripts/
   cp ~/woodhouse_social/scripts/save-checkpoint.js ~/claude-shared-scripts/  # when created
   cp ~/woodhouse_social/.env.local ~/claude-shared-scripts/
   ```

3. Remove originals and create symlinks in each repo:
   ```bash
   cd ~/woodhouse_social/scripts
   rm write-session-context.js recall-agent.js read-session-context.js
   ln -s ~/claude-shared-scripts/write-session-context.js .
   ln -s ~/claude-shared-scripts/recall-agent.js .
   ln -s ~/claude-shared-scripts/read-session-context.js .
   
   # Symlink .env.local
   cd ~/woodhouse_social
   rm .env.local
   ln -s ~/claude-shared-scripts/.env.local .
   ```

4. Repeat for woodhouse_creative and any new repos

5. Optionally version control the shared folder:
   ```bash
   cd ~/claude-shared-scripts
   git init
   git add .
   git commit -m "Initial: shared Claude session infrastructure"
   ```

**Benefits:**
- Edit once, all repos see changes immediately
- Adding new repos = 3-4 symlink commands
- No git submodule complexity
- Shared .env.local means one place to update credentials

**Limitations:**
- Symlinks break if cloned to another machine (must recreate shared folder there)
- CLAUDE.md sections still need manual sync unless entire file is symlinked
- Not suitable for CI/CD without additional setup

**Effort:** 1-2 hours for initial setup

**Trigger:** Do this when creating a third repo (personal or work)
