# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers
**Status:** Active - 124 FULL dealers ready for automation
**Deployed:** https://woodhouse-creative.vercel.app
**Last Updated:** January 18, 2026

---

## Related Repo: woodhouse_social

⚠️ **CRITICAL:** There are TWO separate repos. Understanding the split prevents legacy code confusion.

**Repo:** `~/woodhouse_social`
**Purpose:** SaaS product for paying HVAC contractors (separate from Allied Air)
**Database:** Firestore (default database, same Firebase project)

### Key Differences

| Aspect | woodhouse_creative (this repo) | woodhouse_social |
|--------|-------------------------------|------------------|
| **Purpose** | Internal agency ops for Allied Air | SaaS product for customers |
| **Database** | `woodhouse-creative-db` (named) | Default Firestore database |
| **Users** | 351 Allied Air dealers | Paying SaaS customers |
| **Content** | Custom Creatomate renders per dealer | Shared reel_library + AI selection |
| **Scheduling** | Batch renders → Drive folders → Spreadsheet | AI scheduler → Late API |
| **Location** | `~/woodhouse_creative` | `~/woodhouse_social` |

### History & Context

**January 2026:** Repos were split from a single codebase
- **Before:** woodhouse_social contained Allied Air dealers + SaaS customers (shared database)
- **After:** Allied Air moved to woodhouse_creative with separate database
- **Why:** Different business models, different workflows, different data structures

### When to Reference woodhouse_social

**Use woodhouse_social context when:**
- Investigating SaaS features (Stripe, subscriptions, customer onboarding)
- Understanding reel_library (shared content pool used by SaaS)
- AI scheduling agents (may have patterns useful here)
- Comparing customer-facing features

**Stay in woodhouse_creative when:**
- Allied Air dealer operations (this is our primary focus)
- Excel sync from Allied Air database
- Custom Creatomate rendering workflows
- Spreadsheet/Drive automation for dealers

### What to Watch For

If you see references to:
- "Customer" terminology (SaaS) vs "Dealer" (Allied Air)
- `reel_library` collection (that's SaaS, not Allied)
- Subscription/payment logic (that's SaaS)
- AI scheduling agents (might be adaptable from SaaS)

You may be looking at code patterns from woodhouse_social that could inform decisions here.

---

## Current Work In Progress: Dealer Onboarding Automation

**Plan:** [docs/archive/DEALER_ONBOARDING_AUTOMATION_PLAN.md](docs/archive/DEALER_ONBOARDING_AUTOMATION_PLAN.md)
**Goal:** Reduce onboarding from 15 min to <1 min per dealer

### Completed (Commit 17e89f7)

| Phase | Description | Files Changed |
|-------|-------------|---------------|
| 1A | Website field optional | `dealer-review/page.tsx:217`, `dealer-review/route.ts:86` |
| 1B | Facebook logo in search | `fetch-logos/route.ts:178-238`, `lib/creatomate.ts:145-208` |
| 2 (API) | One-click logo save API | `save-logo-permanent/route.ts` (NEW), `lib/google-drive.ts:388-414` |

### Remaining Work

| Phase | Description | Priority |
|-------|-------------|----------|
| 2 (UI) | Add "Save Permanently & Auto-Fill" button | High |
| 3 | Automatic post-approval actions (spreadsheet, renders, emails) | High |
| - | Run `npx tsx scripts/init-firestore-posts.ts` to init posts collection | Medium |
| - | Final documentation updates | Low |

### Key Files for Continuation

- **Plan:** `docs/archive/DEALER_ONBOARDING_AUTOMATION_PLAN.md` - Full implementation details
- **Template Mapping:** `scripts/posts-template-mapping.json` - 28 post→template mappings
- **Init Script:** `scripts/init-firestore-posts.ts` - Populate Firestore posts collection

---

## CRITICAL: Read This FIRST Before ANY Code Changes

**MANDATORY WORKFLOW - NO EXCEPTIONS:**

```
1. Make code changes
2. ASK USER: "Ready to test on localhost?" (default 3000, falls back to 3001 if taken)
3. WAIT for user confirmation: "tests pass, push it"
4. ONLY THEN: Commit and push to main
5. Tell user: "Pushed to main - test on Preview (vercel.app)"
6. User tests on Preview
7. User manually deploys to production
```

**NEVER:**
- Push without local testing confirmation
- Push directly to production branch
- Skip waiting for user "tests pass, push it" approval
- Run `npm run build` without asking if dev server is running first
- Start the dev server (`npm run dev`) - let Greg run it so he can Ctrl+C it

This rule applies to ALL changes, even "small" ones.

---

## Documentation Updates - MANDATORY WORKFLOW

**CRITICAL:** This workflow prevents documentation drift like the Excel sync bug (where column mapping docs didn't match code, causing 331 dealers to be incorrectly flagged as removed).

### Before ANY commit touching data structures, databases, or column mappings:

1. **Identify what changed:**
   - Which code files were modified?
   - Which data structures/schemas/mappings are affected?

2. **Find corresponding docs:**
   - Search `docs/` for references to the changed structure
   - Check DATABASE.md, DATA_ARCHITECTURE.md, EXCEL_SYNC_REFERENCE.md, API docs
   - Check CLAUDE.md for workflow/process changes

3. **Read code → Read docs → Compare:**
   - Read the ACTUAL code to see current state
   - Read the ACTUAL docs to see what's documented
   - Identify specific deltas (what's missing, outdated, wrong)

4. **Make targeted edits:**
   - Update docs with specific changes (not wholesale rewrites)
   - Add verification date: `**Last Updated:** YYYY-MM-DD`
   - Add code references with line numbers: `lib/sync-excel.ts:88`

5. **Spot-check verification:**
   - Pick a random value from code (e.g., column index 3)
   - Find it in docs
   - If not there or different: **FIX BEFORE COMMITTING**

6. **Update CHANGELOG.md:**
   - List exact files changed with line numbers
   - Note data structure changes explicitly
   - Format: `[YYYY-MM-DD] - [Feature Name]`

**NEVER:**
- Update docs based on assumptions about what was built
- Make wholesale rewrites without reading both code and doc first
- Skip the comparison step
- Commit without updating CHANGELOG.md for data structure changes

**Example of what this prevents:**
The Excel sync bug happened because column mapping changed from `dealer_no: 0` to `dealer_no: 3` in code, but docs weren't updated. This workflow would catch the mismatch in step 3.

---

## Documentation System for AI Agents

**Purpose:** Ensure AI agents have complete context when making code changes, preventing errors like suggesting tests for deprecated code or missing doc updates.

**Context:** Greg is a non-technical founder using AI agents to build. AI agents handle ALL documentation updates automatically - Greg never manually updates docs.

---

## AI Agent MANDATORY Pre-Test Checklist

**Before asking "Ready to test?", Claude MUST complete ALL steps:**

### 1. Build the Feature/Fix
- Write code
- Ask business questions if needed ("What should happen when...?")

### 2. Update Documentation (AUTOMATIC - Don't ask Greg)

**Tier 1 (ALWAYS):**
- ✅ Update `CHANGELOG.md` with entry including:
  - What changed
  - Deprecated code (if any)
  - Testing steps (if non-trivial)

**Tier 2 (When Relevant):**
- ✅ Update `docs/engineering/API_REFERENCE.md` if API endpoint changed
- ✅ Update `docs/engineering/DATA_MODEL.md` if Firestore/SQLite schema changed
- ✅ Update `docs/engineering/EXCEL_SYNC_REFERENCE.md` if column mappings changed
- ✅ Update product specs in `docs/product/` if user-facing feature

**Tier 3 (Major Changes Only):**
- ✅ Update `CLAUDE.md` if workflow/process changed
- ✅ Update `docs/engineering/TYPESCRIPT_MODULES.md` if new modules added
- ✅ Update `docs/engineering/PYTHON_SCRIPTS.md` if new scripts added

### 3. Inform Greg What Was Updated

**Example:**
```
"I've updated the batch render to support the new template format.

Documentation updated:
- CHANGELOG.md (new entry)
- API_REFERENCE.md (updated render-batch endpoint)
- TYPESCRIPT_MODULES.md (new renderQueue functions)

Ready to test on localhost?"
```

### 4. THEN Ask "Ready to test?"

---

## AI Agent Verification Checklist (Before Suggesting Tests)

Before suggesting tests or making changes, Claude MUST:

1. ✅ **Read product spec** for the area being changed (check `docs/product/`)
2. ✅ **Check CHANGELOG.md** for recent changes in that area
3. ✅ **Check engineering docs** for current data schemas and mappings
4. ✅ **Trace code path** from entry point to verify flow is active
5. ✅ **Provide complete flow** when asking to test (not just one page)

**Example:**
```
❌ BAD: "Test /admin"
✅ GOOD: "Test the batch render flow: Navigate to /admin → enter post number 700, select template. Click 'Start Render'. Verify the cron at /api/cron/process-render-queue picks up jobs. Check Drive folder for rendered videos."
```

---

## Greg's Role (Business Decisions Only)

**What Greg does:**
1. Describe features from business perspective ("Add a new email template for content-ready dealers")
2. Answer business questions ("What should the email say?")
3. Test features when Claude asks
4. Approve commits ("tests pass, push it")

**What Greg does NOT do:**
- Manually update documentation files
- Remember to ask Claude to update docs
- Understand technical documentation structure
- Write CHANGELOG entries

**Greg's only doc responsibility:** Verify Claude updated docs before approving commit

---

## Key Documentation Files

| Doc | Purpose | Claude Updates When |
|-----|---------|---------------------|
| `CHANGELOG.md` | Every change | Every commit (ALWAYS) |
| `docs/product/*` | Feature specs | User-facing features |
| `docs/engineering/API_REFERENCE.md` | API endpoints | API changes |
| `docs/engineering/DATA_MODEL.md` | Database schema | Firestore/SQLite changes |
| `docs/engineering/EXCEL_SYNC_REFERENCE.md` | Column mappings | Excel sync changes |
| `docs/engineering/PYTHON_SCRIPTS.md` | Script docs | New/modified scripts |
| `docs/engineering/TYPESCRIPT_MODULES.md` | Module docs | New/modified modules |

---

## Example Conversation Flow

**Greg:** "Add a new email template for when a dealer gets promoted to FULL"

**Claude:**
```
Building FULL promotion email template...

I need to know:
1. What should the subject line be?
2. Should we include next steps (e.g., "we'll start posting for you")?
3. Should this auto-send on promotion or be manual from dashboard?

[Greg answers business questions]

Building:
- Email template in templates/emails/full_promotion.html
- Send function in scripts/email_sender/send_email.py
- Dashboard trigger in /admin

Updating documentation:
- CHANGELOG.md (new entry)
- docs/product/EMAIL_AUTOMATION.md (new template)
- API_REFERENCE.md (if new endpoint)

Ready to test on localhost?
```

**Greg:** Tests it

**Greg:** "tests pass, push it"

**Claude:** Commits everything (code + docs) together

---

## How This Prevents Issues

**What happened in woodhouse_social (Jan 19, 2026):**
1. Claude asked Greg to test `/onboarding/payment` (legacy code from Dec 2024)
2. No documentation existed about free trial implementation
3. Greg wasted time debugging non-issue

**With this workflow:**
1. When a feature is implemented, Claude automatically updates all docs
2. Before suggesting tests, Claude checks docs for current state
3. If code is deprecated, Claude sees it in docs and suggests the active flow instead

**The Excel sync version:**
The column mapping bug happened because docs weren't updated when code changed. With this workflow, doc updates are MANDATORY before commit.

**Result:** No wasted time, no confusion, Greg never touches docs.

---

## Compliance Mechanism

**If Claude forgets to update docs:**

**Greg:** "did you update docs?"

**Claude:** "You're right, let me update docs now before we commit." [Updates docs, shows what was updated, then commits]

**That's it.** Greg only needs to ask once if Claude forgets. Over time, Claude learns to always do it.

---

## Sensitive Data & Temporary Files - CRITICAL

**NEVER commit files that may contain dealer PII or sensitive data:**
- CSV files with dealer emails, phones, contacts
- Export files from Firestore or SQLite queries
- Data dumps or backups
- API response logs with dealer data
- Excel files with Allied Air dealer information

**Before committing, always check `git status` for:**
1. Untracked files in `/data/`, `/exports/`, or `/scripts/`
2. Any `.csv`, `.xlsx`, `.json` data files
3. Scripts that query dealer data
4. SQLite database files (`creative.db`)

**If you create a temporary script:** Delete it after use, or ensure .gitignore catches it.

---

## Development Workflow

```
LOCAL (localhost:3000) → PREVIEW (vercel.app) → PRODUCTION (woodhouse-creative.vercel.app)
```

| Step | Environment | URL | Branch |
|------|-------------|-----|--------|
| 1. Local | `npm run dev` | localhost:3000 | `main` |
| 2. Preview | Push to `main` | woodhouse-creative.vercel.app | `main` |

### Commands
```bash
# Push to Preview (Production)
ga && git commit -m "message" && gpush
```

### Multi-Machine Workflow (Desktop + Laptop)

**Desktop (Primary Development):**
```bash
# Normal development workflow
npm run dev              # Test on localhost:3000
ga && git commit -m "..." && gpush  # Push to Preview
```

**Laptop (Sync Only):**
```bash
# ONLY sync branches - DO NOT merge or push
git checkout main
git pull origin main
```

### Intermediate Commits During Sessions

**YES - Commit frequently during large changes:**

```bash
# After each logical step/fix
git add .
git commit -m "Step 1: Implement X"
git push

# Continue working
git add .
git commit -m "Step 2: Add Y"
git push
```

**Benefits:**
- Rollback to any step if something breaks
- Better git history showing progress
- Session compaction won't lose work
- Easier to test intermediate states

**When to Commit:**
- After each file/component is working
- Before starting risky refactors
- Every 30-60 minutes during long sessions
- Before switching tasks

---

### Session Hooks (Context Continuity)

**File:** `.claude/settings.local.json` (local only, not committed)

Session hooks are configured to help with context continuity across Claude Code sessions:

| Hook | Trigger | What It Does |
|------|---------|--------------|
| `PreCompact` | Before context compaction | Reads `.claude-checkpoint.json`, validates, and saves to Firestore via `save-checkpoint.js` |
| `SessionStart` | New session starts | Reads latest context from Firestore `claude_sessions` collection |

**Configuration:**
- `autoCompactThreshold: 30` - Auto-compacts after 30 conversation turns

**Note:** These hooks are machine-local (globally gitignored). Each developer sets up their own.

---

### Checkpoint Buffer System (Context Continuity)

**Problem:** Auto-compaction happens without warning at 30 turns. Behavioral rules ("save when you decide to") are bottlenecks because they depend on consistency. Even with good intentions, plans and work can be lost if compaction wins the race before a manual save.

**Solution:** Checkpoint buffer file (`.claude-checkpoint.json`) on disk that persists between compactions. PreCompact hook reads the checkpoint and saves it to Firestore automatically, regardless of whether I remembered to save.

**Key Idea:** Decouple writing the checkpoint (frequent work) from the save mechanism (automatic PreCompact hook). The file is always on disk; the hook always runs.

#### When to Write Checkpoint

Write every **5-10 minutes of work** (not per code edit, not per todo). Checkpoints are lightweight snapshots, not granular audit logs.

**Examples:**
- After completing a logical work block (feature, test, refactor)
- After a discussion that clarifies direction
- Before switching topics
- When you notice a new plan emerging
- Before committing code
- Any time you want to "lock in" current progress

**Don't write:**
- On every code edit (too frequent)
- On every todo creation (use the summary instead)
- When nothing meaningful has changed

#### Checkpoint Schema

File: `.claude-checkpoint.json` (project root, tracked in git for cross-machine sync)

```json
{
  "last_updated": "2026-01-28T06:30:00Z",
  "summary": "Building checkpoint buffer system for session persistence",
  "plan": "1. Create save-checkpoint.js\n2. Update PreCompact hook\n3. Test checkpoint save flow",
  "plan_status": "step 1 of 3 in progress",
  "topics": ["session-persistence", "checkpoint-buffer"],
  "user_request": "Improve session save triggers with buffer mechanism",
  "decisions": ["Use checkpoint file as buffer", "Write every 5-10 min"],
  "blockers": [],
  "entities": ["Firestore", "PreCompact hook"],
  "files_touched": ["scripts/save-checkpoint.js", "CLAUDE.md"],
  "commits": [],
  "important_context": {}
}
```

**Required fields:**
- `summary` (string, non-empty) — what's being worked on
- `topics` (array, non-empty) — 2-5 topics
- `user_request` (string, non-empty) — original ask or current goal

**Optional fields:**
- `plan` — full plan text (include if active)
- `plan_status` — progress through plan (e.g., "step 3 of 5 complete")
- `decisions`, `blockers`, `entities`, `files_touched`, `commits` — all arrays
- `important_context` — flexible key/value pairs
- `last_updated` — ISO timestamp (informational)

#### How It Works

```
Claude writes .claude-checkpoint.json (every 5-10 min)
                    ↓
         Auto-compaction at 30 turns
                    ↓
         PreCompact hook fires
                    ↓
  scripts/save-checkpoint.js runs
                    ↓
   Reads checkpoint, validates, writes to Firestore
                    ↓
  SessionStart hook loads from Firestore on next session
```

**Validation (light):**
- Required fields present and non-empty
- Field types correct (arrays are arrays, strings are strings)
- If validation fails: skip save, log to `session_log.txt`, don't error

**Benefits:**
- Survives auto-compaction without manual intervention
- No race condition between Greg typing "save session" and compaction
- Works across machines (tracked in git, pulled to laptop/desktop)
- Captured context is always the latest checkpoint, not pre-compaction summary

#### Setup: PreCompact Hook

The PreCompact hook is configured in `.claude/settings.local.json` (machine-local, not committed).

**To enable checkpoint saves on your machine:**

1. Open `.claude/settings.local.json` in your project root
2. Find or create the `hooks` object:
   ```json
   {
     "hooks": {
       "PreCompact": "node scripts/save-checkpoint.js --trigger=pre_compact"
     }
   }
   ```
3. Save the file (no commit needed — it's gitignored)
4. Restart Claude Code for the hook to take effect

**That's it.** From now on, whenever you run `/compact`:
1. PreCompact hook runs `save-checkpoint.js`
2. Script reads `.claude-checkpoint.json`
3. Validates, transforms, writes to Firestore
4. Logs result to `docs/archive/sessions/session_log.txt`
5. Compaction proceeds (you never lose the checkpoint)

**Troubleshooting:**
- If hook doesn't fire: Restart Claude Code
- If checkpoint saves are failing: Check `session_log.txt` for validation errors
- If `.claude-checkpoint.json` is missing: Hook silently skips (no error)

---

### Session Context Persistence (MANDATORY)

**Purpose:** Long-term memory system that survives auto-compaction and enables recall of past work.

**Firestore Collection:** `claude_sessions` (in DEFAULT database, shared with woodhouse_social)

**Scripts:**
- **Write:** `echo '{"summary": "...", "topics": [...]}' | node scripts/write-session-context.js`
- **Read (SessionStart):** `node scripts/read-session-context.js` (runs automatically)
- **Query:** `node scripts/recall-agent.js "batch render"` (semantic search)

**Schema:**
```typescript
{
  created_at: Timestamp,
  machine: string,
  repo: 'woodhouse_creative',
  trigger: 'task_complete' | 'decision' | 'blocker' | 'topic_switch' | 'pre_compact' | 'periodic' | 'plan_created',

  // Core (REQUIRED)
  summary: string,           // What was accomplished

  // AI-extracted metadata
  topics: string[],          // DYNAMIC - extracted from conversation
  decisions: string[],       // Key decisions made
  blockers: string[],        // Issues preventing progress
  entities: string[],        // Named things (Allied, Creatomate, components)
  files_touched: string[],   // Files modified

  // Status tracking
  outcome: 'completed' | 'in_progress' | 'blocked' | 'abandoned',
  user_request: string,      // Original ask that started work
  commits: string[],         // Git SHAs
  session_boundary: boolean, // true if at compact/session end

  // Plan persistence (survives compaction)
  plan?: string,             // Full plan text (when trigger is plan_created or plan is active)
  plan_status?: string,      // Progress tracker, e.g. "step 6 of 13 complete"

  // Flexible
  important_context: object
}
```

---

### Save Triggers (Event-Driven) - MANDATORY

**MUST save (never skip):**
- After completing any task or todo item (`trigger: 'task_complete'`)
- After making a significant decision (`trigger: 'decision'`)
- When hitting a blocker (`trigger: 'blocker'`)
- Before switching to a different topic (`trigger: 'topic_switch'`)
- Before user runs `/compact` (`trigger: 'pre_compact'`)
- **After creating or entering plan mode** (`trigger: 'plan_created'`) — include full plan text in `plan` field

**SHOULD save (when appropriate):**
- After ~10 conversation turns if no other trigger
- After modifying multiple files
- When making progress through a plan (update `plan_status` field, e.g. "step 4 of 10 complete")

---

### Plan Persistence (MANDATORY)

**Problem:** Plans created in plan mode or multi-step task plans are lost when auto-compaction occurs at 30 turns. Greg's workaround — manually typing "save session" before compaction — is race-prone.

**Solution:** Save early, not late. Save when the plan/todos are CREATED, not when work is finishing.

**Rule:** When Claude creates a plan (via plan mode OR by creating 3+ todos), Claude MUST save it to session context **immediately** with `trigger: 'plan_created'` and the full plan text in the `plan` field.

**When to save a plan:**
- After exiting plan mode (plan approved by user)
- **After creating 3+ todos via TodoWrite** — these ARE the plan in non-plan-mode workflows
- When a plan spans multiple work sessions

**What to include in the `plan` field:**
- Full numbered step list with descriptions
- The user's original request and WHY each step exists
- Current step status (done/pending/blocked)
- Key constraints or decisions baked into the plan

**What to include in `user_request`:**
- The original ask that prompted the todos/plan (verbatim or close to it)

**Example — plan mode:**
```json
{
  "trigger": "plan_created",
  "summary": "Created 8-step Creatomate batch render plan",
  "plan": "1. Query existing render queue\n2. Filter by status=pending\n3. Group by template type\n4. Generate render tasks\n5. Submit to Creatomate API\n6. Poll for completion\n7. Update spreadsheet\n8. Archive completed tasks",
  "plan_status": "step 2 of 8 complete",
  "topics": ["batch render", "creatomate"],
  "user_request": "Automate Creatomate batch rendering for FULL dealers",
  "outcome": "in_progress"
}
```

**Example — emergent todos (no plan mode):**
```json
{
  "trigger": "plan_created",
  "summary": "Created 4-step plan: add checkpoint buffer system to woodhouse_creative",
  "plan": "1. Create save-checkpoint.js\n2. Update write-session-context.js for plan fields\n3. Update recall-agent.js for plan retrieval\n4. Update CLAUDE.md with checkpoint documentation",
  "plan_status": "0 of 4 complete",
  "topics": ["checkpoint buffer", "session persistence"],
  "user_request": "Add checkpoint buffer system to woodhouse_creative for cross-machine sync",
  "outcome": "in_progress"
}
```

**Progress updates:** When completing plan steps, save with `trigger: 'task_complete'` and update `plan_status`. No need to repeat the full plan text on progress saves — only on creation or major plan changes.

**Timing:** The save happens IMMEDIATELY after todos are created — before any work begins. This front-loads persistence so auto-compaction can't eat it.

---

### How to Save Session Context (MANDATORY)

**CRITICAL:** Session saves are MANUAL. Hooks cannot access conversation content, so Claude must run the save command directly.

**⚠️ DO NOT prefix with `set -a && source .env.local` — the script loads `.env.local` via dotenv internally. Adding shell source commands breaks the stdin pipe.**

**Command (Option A — file argument, most reliable):**
```bash
node scripts/write-session-context.js /tmp/claude-session-context.json
```
Write the JSON to the file first using the Write tool, then run the command above.

**Command (Option B — pipe):**
```bash
echo '{"summary": "...", "topics": [...], "trigger": "task_complete", ...}' | node scripts/write-session-context.js
```

**For multi-task sessions using TodoWrite:**
- Add "Save session context to Firestore" as the FINAL todo item
- Mark it in_progress when starting the save
- Mark it completed after the script runs successfully

**Example todo list for multi-task session:**
```
1. [completed] Update batch render template mapping
2. [completed] Fix email sender for FULL dealers
3. [completed] Update CHANGELOG.md
4. [in_progress] Save session context to Firestore  <-- Always last
```

**Why this matters:** Without manual saves, work is lost when auto-compaction occurs at 30 turns. The SessionStart hook only READS previous sessions - it cannot WRITE them.

---

### Summary Quality Guidelines

**GOOD summary:**
```
"Updated batch render to support new holiday template.
 Added template ID mapping in posts-template-mapping.json.
 Tested with post 700 for dealer 10231005."
```

**BAD summary:**
```
"Worked on rendering. Made some changes."
```

**Required elements:**
- WHAT was done (specific)
- HOW it was done (technical approach)
- WHY if not obvious

---

### Topic Extraction Guidelines

Extract 2-5 topics from conversation content. Topics are **dynamic** - they emerge from what you're discussing, not a predefined list.

**Naming consistency:**
- Use "batch render" not "video rendering" or "creatomate renders"
- Use "excel sync" not "spreadsheet sync" or "allied data"
- Use "dealer onboarding" not "new dealer setup"
- Use "email automation" not "resend emails" or "notifications"
- Use "admin dashboard" not "admin panel" or "admin UI"

---

### Recall Trigger Patterns

When user asks patterns like these, run the recall agent:
- "where were we with X"
- "last time we worked on X"
- "did we ever discuss/implement X"
- "what did we decide about X"
- "pick up where we left off on X"

**Command:** `node scripts/recall-agent.js "user's query here"`

---

### Citing Sources (MANDATORY)

When answering questions about the project, ALWAYS cite where the information came from:

**Format:**
```
**Sources:**
- `claude_sessions` (Jan 25, 2026) - "summary excerpt..."
- [CLAUDE.md:40-57](CLAUDE.md#L40-L57) - Section name
- [docs/engineering/DATA_MODEL.md:20-35](docs/engineering/DATA_MODEL.md#L20-L35) - Table/section
- Current conversation - if from this session
```

**Source types:**
| Source | When to cite |
|--------|--------------|
| `claude_sessions` | When recall agent returned relevant sessions |
| File paths with lines | When info comes from docs/code in context |
| "Current conversation" | When referencing something said this session |
| "No matching sessions" | When recall searched but found nothing |

**Why:** Helps user understand what's documented vs. what's in session memory vs. what was just discussed.

---

### Example Save

```json
{
  "summary": "Updated batch render to support new holiday template. Added template mapping for post 700. Fixed cron timing for render queue.",
  "topics": ["batch render", "creatomate templates", "cron jobs"],
  "decisions": ["Use 25 jobs/minute rate limit for Creatomate", "Archive old posts on new render completion"],
  "blockers": [],
  "entities": ["Creatomate", "Google Drive", "render queue"],
  "files_touched": ["scripts/posts-template-mapping.json", "lib/renderQueue.ts", "app/api/cron/process-render-queue/route.ts"],
  "outcome": "completed",
  "user_request": "Add holiday template support to batch render",
  "commits": ["abc1234"],
  "session_boundary": false,
  "trigger": "task_complete"
}
```

**Why this matters:** Auto-compaction happens without warning at 30 turns. Continuous saves + recall agent enable true long-term memory across sessions.

---

## Dev Environment

- Windows 11 + WSL2 Ubuntu (8GB RAM limit via .wslconfig)
- Username: `heygregwood`
- Dev server: http://localhost:3000

### WSL Memory Management (CRITICAL - Prevents Crashes)

**Memory Limits:** WSL is configured with 8GB RAM + 4GB swap in `C:\Users\GregWood\.wslconfig`

**BEFORE running `npm run build`:**
1. **ASK GREG:** "Is the dev server running? I need to run a build."
2. **WAIT** for Greg to stop the dev server (Ctrl+C)
3. **THEN** run the build

**NEVER** run `npm run build` while dev server is running - it WILL crash WSL.

**If WSL crashes:** Run in PowerShell:
```powershell
wsl --shutdown
wsl -d Ubuntu
```

**If builds are slow or crashing:** Clean the .next folder first:
```bash
rm -rf .next && npm run build
```

The `.next` folder can balloon to 1-2GB and cause memory issues. Delete it before builds if things get sluggish.

### Build Command
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Bash Aliases
```bash
gp        # git pull
gs        # git status
dev       # npm run dev
gpush     # git push
ga        # git add .
```

### Machine-Specific Config (Desktop vs Laptop)

| Machine | WINDOWS_USERNAME | Notes |
|---------|-----------------|-------|
| Desktop | GregWood | Default in sync_from_excel.py |
| Laptop | gregw | Must set in .env.local |

The `WINDOWS_USERNAME` env var determines the OneDrive path for Excel sync:
`/mnt/c/Users/{WINDOWS_USERNAME}/OneDrive - woodhouseagency.com/...`

**On Laptop:** Add to `.env.local`:
```env
WINDOWS_USERNAME=gregw
```

**Claude: Detect Current Machine**
At the start of a session, Claude can check which machine is active:
```bash
grep WINDOWS_USERNAME .env.local
# gregw = laptop, GregWood = desktop
```
This helps Claude understand environment constraints (e.g., Excel sync only works on desktop).

### Querying Firestore

**IMPORTANT:** Use `npx tsx` with library imports, NOT standalone scripts. The app uses a named database `woodhouse-creative-db`, not the default database.

```bash
# Set environment first
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Count dealers
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const all = await getDealers();
console.log('Total:', all.length, '- FULL:', all.filter(d => d.program_status === 'FULL').length);
"

# Get specific dealer
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
const d = await getDealer('10251015');
console.log(JSON.stringify(d, null, 2));
"
```

**WRONG:** Do NOT use standalone scripts with `admin.firestore()` - this queries the wrong database.

---

## TypeScript & Coding Standards

**These standards are MANDATORY for all new code.**

### Type Safety

**Never use `any`:**
```typescript
// BAD
catch (error: any) {
  setError(error.message);
}

// GOOD
catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Something went wrong');
}
```

### Error Handling

**API Routes - Standard pattern:**
```typescript
catch (error: unknown) {
  console.error('[route-name] Error:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Something went wrong' },
    { status: 500 }
  );
}
```

**Client Components - Standard pattern:**
```typescript
catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Something went wrong');
}
```

### Logging

**Use bracket prefix for context:**
```typescript
console.log('[sync-excel] Processing dealer:', dealerId);
console.error('[batch-render] Error fetching reels:', error);
```

### API Response Format

**Standard format (pick one per route type):**
```typescript
// Data endpoints - return data directly
return NextResponse.json(dealer);

// Write operations - include success flag
return NextResponse.json({ success: true, id: newId });

// Error responses - always use { error: string }
return NextResponse.json({ error: 'Not found' }, { status: 404 });
```

### Import Organization

**Order imports consistently:**
```typescript
// 1. React/Next.js
import { useState } from 'react';
import { NextRequest, NextResponse } from 'next/server';

// 2. External packages
import Database from 'better-sqlite3';

// 3. Internal libs
import { db } from '@/lib/firebase';

// 4. Types (use 'import type' when possible)
import type { Dealer } from '@/lib/types/dealer';
```

---

## Quick Links

| Need to... | Go to |
|------------|-------|
| Understand the system | `docs/README.md` - Start here |
| Query Firestore | `docs/playbook/QUICK_COMMANDS.md` |
| Check data schema | `docs/engineering/DATA_MODEL.md` |
| API endpoints | `docs/engineering/API_REFERENCE.md` |
| Troubleshoot issues | `docs/playbook/TROUBLESHOOTING.md` |
| Email automation | `docs/product/EMAIL_AUTOMATION.md` |
| Python scripts | `docs/engineering/PYTHON_SCRIPTS.md` |
| TypeScript modules | `docs/engineering/TYPESCRIPT_MODULES.md` |
| Excel sync details | `docs/engineering/EXCEL_SYNC_REFERENCE.md` |
| Excel VBA macros | `docs/engineering/EXCEL_VBA_MACROS.md` |
| Dealer naming rules | `docs/engineering/DEALER_NAMES.md` |
| Migration history | `docs/engineering/MIGRATION_HISTORY.md` |
| Render pipeline | `docs/product/RENDER_PIPELINE.md` |
| Spreadsheet system | `docs/product/SPREADSHEET_SYSTEM.md` |
| Dealer lifecycle | `docs/product/DEALER_LIFECYCLE.md` |
| Admin dashboard | `docs/product/ADMIN_DASHBOARD.md` |
| Development workflow | `docs/playbook/DEVELOPMENT_WORKFLOW.md` |
| Compliance guide | `docs/playbook/COMPLIANCE_GUIDE.md` |

### Documentation Structure
```
docs/
├── README.md                    # Start here - system overview
├── engineering/                 # Technical implementation details
│   ├── API_REFERENCE.md         # All API endpoints
│   ├── DATA_MODEL.md            # Database schema (Firestore)
│   ├── DEALER_NAMES.md          # Naming conventions
│   ├── EXCEL_SYNC_REFERENCE.md  # Excel column mappings
│   ├── EXCEL_VBA_MACROS.md      # Allied Air VBA integration
│   ├── MIGRATION_HISTORY.md     # Database migrations
│   ├── PYTHON_SCRIPTS.md        # Script documentation
│   └── TYPESCRIPT_MODULES.md    # TS module docs
├── product/                     # Feature documentation
│   ├── ADMIN_DASHBOARD.md       # Dashboard features
│   ├── DEALER_LIFECYCLE.md      # Dealer states/transitions
│   ├── EMAIL_AUTOMATION.md      # Email system
│   ├── RENDER_PIPELINE.md       # Video rendering
│   └── SPREADSHEET_SYSTEM.md    # Google Sheets integration
├── playbook/                    # Operational guides
│   ├── COMPLIANCE_GUIDE.md      # Compliance rules
│   ├── COMPLIANCE_WOODHOUSE.md  # Woodhouse-specific compliance
│   ├── DEVELOPMENT_WORKFLOW.md  # Dev process
│   ├── QUICK_COMMANDS.md        # Common commands
│   └── TROUBLESHOOTING.md       # Problem solving
└── archive/                     # Historical/completed docs
    ├── DEALER_ONBOARDING_AUTOMATION_PLAN.md
    ├── DOCUMENTATION_IMPROVEMENT_PLAN.md
    ├── END_TO_END_DOCUMENTATION_DRAFT.md
    └── WORKFLOW_CURRENT.md
```

---

## Current Status (January 2026)

### Database: Firestore (woodhouse-creative-db)

| Metric | Count | Notes |
|--------|-------|-------|
| **Total Dealers** | 351 | Firestore source of truth |
| **FULL Dealers** | 130 | Ready for full automation |
| **CONTENT Dealers** | 221 | Content only |
| **Ready for Automate** | 130/130 | All FULL dealers ready |

### Batch Rendering
- Cron processes 25 jobs/minute (Creatomate rate limit: 30 req/10s)
- Videos uploaded to Google Drive dealer folders
- Old posts auto-archived when new renders complete

---

## Automation Features (All Complete)

### 1. Email Automation (Resend API)
- **Account:** communitymanagers@woodhouseagency.com
- **Domain:** woodhouseagency.com (verified)
- **Sender:** `Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>`

**Email Types:**
| Template | Trigger | File |
|----------|---------|------|
| Welcome | New dealer onboarding | `templates/emails/welcome.html` |
| FB Admin Accepted | After accepting FB admin invite | `templates/emails/fb_admin_accepted.html` |
| First Post Scheduled | First time posts scheduled for FULL dealer | `templates/emails/first_post_scheduled.html` |
| Post Scheduled | Ongoing post notifications | `templates/emails/post_scheduled.html` |
| Content Ready | Monthly content for CONTENT dealers | `templates/emails/content_ready.html` |
| Holiday | Seasonal campaigns | `templates/emails/holiday.html` |
| Onboarding Complete | After dealer onboarding is finalized | `templates/emails/onboarding_complete.html` |

**Scripts:**
- `scripts/email_sender/send_email.py` - Main email sending module
- `scripts/email_sender/blocked_dealers.py` - Blocklist for test accounts
- `scripts/process_done_status.py` - Batch process "Done" status dealers

**Blocked Dealers:**
- Test accounts are blocked from receiving emails via `lib/blocked-dealers.ts` (TypeScript) and `scripts/email_sender/blocked_dealers.py` (Python)
- Currently blocked: `10491009` (GW Berkheimer HQ Test Account)
- To add more: Edit both files and add dealer numbers to the `BLOCKED_DEALER_NOS` set

### 2. Spreadsheet Sync
- Syncs dealer metadata from SQLite to Google Sheets
- Populates personalized post copy from base templates
- Auto-updates email status after sending
- Script: `scripts/sync_spreadsheet.py`

### 3. Batch Video Rendering
- Triggers Creatomate renders for all FULL dealers
- Polls for completion via webhook
- Uploads to Google Drive dealer folders
- Script: `scripts/batch_render.py`
- API: `/api/creative/render-batch`

### 4. Dealer Status Automation
- Gmail monitoring via Apps Script for FB admin invites/removals
- Auto-updates SQLite, spreadsheet, creates Drive folders
- API: `/api/admin/dealer-status`
- Script: `scripts/update_dealer_status.py`

### 5. Dashboard Process Done Emails
- Admin dashboard shows dealers with "Done" status from scheduling spreadsheet
- One-click send for individual dealers or "Process All" button
- Automatically determines first_post vs post_scheduled email type
- API: `/api/admin/process-done`

### 6. Logo Staging with PNG Conversion
- Fetches logos from any source URL
- Converts all formats (jpg, webp, gif, svg) to PNG using Sharp
- Uploads to Google Drive staging folder
- API: `/api/admin/save-logo-staging`

### 7. Populate Post Copy (Dashboard)
- Enter base copy with variable placeholders in dashboard
- Variable picker buttons insert `{name}`, `{phone}`, `{website}` at cursor position
- Populates personalized copy to all dealer columns in scheduling spreadsheet
- Saves base copy to column C for reference
- API: `/api/admin/populate-post-copy`

### 8. Auto-Archive Old Posts
- When new renders complete, old posts are automatically archived
- Reads active post numbers from scheduling spreadsheet column A (rows 13+)
- Moves videos with post numbers NOT in spreadsheet to `Archive/` subfolder
- Archive subfolders are created automatically in each dealer's Drive folder
- Integrated into webhook handler: [route.ts:188-200](app/api/webhooks/creatomate/route.ts#L188-L200)

### 9. Create Post One-Click Workflow
- Full end-to-end post creation from admin dashboard
- Select Creatomate template, enter post number and copy
- Automatically: creates post record, adds to spreadsheet, populates personalized copy, triggers batch renders
- API: `/api/admin/create-post`

### 10. Copy Deck PDF Generation
- Generates PDF copy decks for CONTENT dealers
- Includes video thumbnails from Cloudinary
- Lists post numbers and personalized copy per dealer
- API: `/api/admin/generate-copy-deck`
- Lib: `lib/cloudinary.ts`

### 11. Email Delivery Tracking (Resend Webhooks)
- Tracks email delivery status: delivered, opened, clicked, bounced, complained
- Resend sends webhooks to `/api/webhooks/resend`
- Status queryable via `/api/admin/email-status`
- Displayed in scheduling page dealer status table

### 12. Mail Merge Automation
- Populates mail merge spreadsheet with CONTENT/NEW dealers from Firestore
- Used for welcome email automation workflow
- API: `/api/admin/populate-mail-merge`

### 13. Post Thumbnails
- Fetches video thumbnails from Google Drive by post number
- Proxies through server for display in admin dashboard
- APIs: `/api/admin/post-thumbnail`, `/api/admin/post-thumbnail-image`

---

## Google Apps Scripts (External)

These scripts run on Google's servers, not in this codebase. They're managed via https://script.google.com.

### 1. New Dealer Welcome Email
**Location:** communitymanagers@woodhouseagency.com Apps Script
**Name:** "New Dealer Welcome Email"
**Purpose:** Receives webhook from Excel automation, adds row to welcome email sheet for Mail Merge

```javascript
// Key configuration
const SHEET_NAME = 'Sheet1';
const INBOUND_SECRET = '<secret>';
const COLS = ['Brand', 'Distributor', 'BusinessName', 'FirstName', 'LastName',
              'Tier', 'VideoLink', 'EmailAddress', 'FileAttachment',
              'ScheduledDate', 'MailMergeStatus'];

// doPost(e) receives JSON from Excel VBA and appends to sheet
// Sets ScheduledDate = now() so Mail Merge addon auto-sends
```

### 2. Process Done Status (Deprecated)
**Location:** `scripts/google_apps_script/process_done_status.gs` (for reference)
**Status:** Replaced by dashboard button at `/admin` page
**Note:** Was going to be hourly automation but replaced with manual dashboard trigger

---

## Admin Dashboard Pages

### `/admin` - Overview & Sync
- **Excel Sync:** Preview/apply changes from Allied Excel (Microsoft Graph API - works on localhost and Vercel)
- **Quick Stats:** FULL dealers, posts, ready-for-automate counts
- **Navigation:** Cards linking to all other admin pages

### `/admin/posts` - Post Management
- **View Posts:** Search/filter existing posts with thumbnails from Google Drive
- **Create New Post:** One-click workflow — select template, enter copy, renders for all FULL dealers
- **Copy Deck PDF:** Generate PDF copy deck for CONTENT dealers with video thumbnails (Cloudinary)

### `/admin/scheduling` - FULL Dealer Operations
- **Dealer Status Table:** View all FULL dealers from scheduling spreadsheet with sorting
- **Process Done Emails:** Send emails to dealers marked "Done" (auto-detects first_post vs post_scheduled)
- **Batch Video Render:** Submit post number + template for batch rendering
- **Populate Post Copy:** Enter base copy with variable picker, populate to all dealer columns
- **Email Delivery Status:** Track delivered/opened/clicked/bounced status via Resend webhooks

### `/admin/content-dealers` - CONTENT Dealer Operations
- **Mail Merge:** Populate mail merge spreadsheet with CONTENT/NEW dealers from Firestore
- **Welcome Email Automation:** Manage welcome email workflow for non-FULL dealers

### `/admin/dealer-review` - Dealer Review & Approval
- List dealers pending review (promoted CONTENT → FULL)
- Manual form for validating display name, phone, website, logo
- Logo selector with Brandfetch + website scraping results
- One-click permanent logo save to Google Drive

### `/admin/email-templates` - Email Template Editor
- View/edit all 7 email templates
- Preview rendered template with live data
- Save changes back to disk

---

## API Routes (35 Total)

### Admin Routes `/api/admin/` (26 endpoints)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dealers` | GET | Fetch dealers (filters: not-ready, no-logo, round2, all) |
| `/sync-excel` | GET/POST | Preview/apply changes from Allied Excel (Microsoft Graph API) |
| `/dealer-review` | GET/POST | List pending dealers / approve after review |
| `/dealer-status` | POST | Update dealer CONTENT ↔ FULL (from Gmail webhook) |
| `/process-done` | GET/POST | Get/send emails to dealers marked "Done" |
| `/email-templates` | GET/POST | List/fetch/save email templates |
| `/email-status` | GET | Get email delivery status (delivered/opened/clicked/bounced) |
| `/fetch-logos` | GET | Fetch logo options from Brandfetch + website |
| `/save-logo` | POST | Save selected logo to creatomate_logo field |
| `/save-logo-staging` | POST | Convert & upload logo to Drive staging folder (PNG) |
| `/save-logo-permanent` | POST | Move logo from staging to permanent location |
| `/proxy-image` | GET | Proxy images for canvas rendering |
| `/mark-needs-design` | POST | Flag dealers needing logo redesign |
| `/send-welcome-email` | POST | Send welcome email (calls Python script) |
| `/send-batch-emails` | POST | Send emails to multiple dealers |
| `/spreadsheet-status` | GET | Fetch scheduling spreadsheet data |
| `/posts-excel` | GET | Fetch post archive spreadsheet |
| `/submit-post` | POST | Submit new post to archive |
| `/create-post` | POST | Full workflow: create post, add to spreadsheet, populate copy, trigger renders |
| `/populate-post-copy` | GET/POST | Preview/populate personalized post copy to all dealers |
| `/populate-mail-merge` | POST | Populate mail merge spreadsheet with CONTENT/NEW dealers |
| `/generate-copy-deck` | POST | Generate PDF copy deck with video thumbnails (Cloudinary) |
| `/post-thumbnail` | GET | Fetch video thumbnail from Google Drive by post number |
| `/post-thumbnail-image` | GET | Proxy Google Drive video thumbnails |
| `/template-preview` | GET | Fetch Creatomate template details/preview URL |
| `/test-graph-api` | GET | Test Microsoft Graph API connection |

### Creative Automation Routes `/api/creative/` (6 endpoints)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/render-batch` | POST | Start batch render for post number |
| `/render-batch` | GET | Get batch status by batchId |
| `/active-batches` | GET | Get all non-completed render batches |
| `/test-connection` | GET | Test Creatomate + Google Drive |
| `/test-drive-auth` | GET | Test Google Drive auth |
| `/manual-webhook` | POST | Manually trigger webhook (for testing) |

### Cron Routes `/api/cron/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/process-render-queue` | GET | Process 10 pending render jobs (runs every 1 min) |

### Webhook Routes `/api/webhooks/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/creatomate` | POST | Receive render completion notifications |
| `/resend` | POST | Receive email delivery/open/click/bounce webhooks from Resend |

---

## Key Directories

```
woodhouse_creative/
├── app/
│   ├── admin/                  # Admin dashboard pages (6 pages)
│   │   ├── page.tsx            # Overview & sync dashboard
│   │   ├── posts/              # Post management & copy deck
│   │   ├── scheduling/         # FULL dealer ops (status, emails, renders)
│   │   ├── content-dealers/    # CONTENT dealer ops (mail merge)
│   │   ├── dealer-review/      # Dealer approval
│   │   └── email-templates/    # Template editor
│   └── api/
│       ├── admin/              # Admin operations (26 endpoints)
│       ├── creative/           # Render automation (6 endpoints)
│       ├── cron/               # Scheduled tasks
│       └── webhooks/           # External callbacks (Creatomate, Resend)
├── lib/
│   ├── firebase.ts             # Firestore connection
│   ├── firestore-dealers.ts    # Dealer CRUD operations
│   ├── creatomate.ts           # Creatomate API client
│   ├── cloudinary.ts           # Cloudinary integration for video thumbnails
│   ├── google-drive.ts         # Google Drive upload, archive, move files
│   ├── google-sheets.ts        # Google Sheets API operations
│   ├── email.ts                # Email sending via Resend API
│   ├── renderQueue.ts          # Queue management
│   ├── blocked-dealers.ts      # Blocklist for test accounts
│   ├── microsoft-auth.ts       # OAuth2 device code auth for Graph API
│   ├── sync-excel.ts           # Excel sync implementation
│   └── types/
│       └── renderQueue.ts      # TypeScript interfaces
├── scripts/                    # Python/TypeScript automation scripts
│   ├── email_sender/           # Email automation module
│   │   ├── send_email.py       # Resend API + spreadsheet status update
│   │   └── __init__.py
│   ├── batch_render.py         # Batch video rendering
│   ├── sync_spreadsheet.py     # Sync dealer data to Google Sheets
│   ├── update_dealer_status.py # Promote/demote dealers
│   ├── process_done_status.py  # Process "Done" status dealers
│   ├── add_dealer_to_spreadsheet.py # Add new dealer column
│   ├── export_full_dealers.py  # Export CSV for Creatomate
│   ├── sync_from_excel.py      # Sync from Allied Excel
│   ├── import_creatomate_validated.py
│   ├── verify_logos.py
│   ├── crawl_websites.py
│   └── google_apps_script/     # Reference copies of Apps Scripts
│       └── process_done_status.gs
├── templates/
│   └── emails/                 # HTML email templates (7 total)
│       ├── welcome.html
│       ├── fb_admin_accepted.html
│       ├── first_post_scheduled.html
│       ├── post_scheduled.html
│       ├── content_ready.html
│       ├── holiday.html
│       └── onboarding_complete.html
├── data/
│   ├── sqlite/
│   │   └── creative.db         # SQLite database (source of truth)
│   └── full_dealers_for_creatomate.csv
├── docs/
│   ├── README.md               # Start here
│   ├── engineering/            # Technical docs (7 files)
│   ├── product/                # Feature docs (6 files)
│   ├── playbook/               # Operational guides (5 files)
│   └── archive/                # Historical docs (4 files)
├── public/
│   ├── template-bg.png         # Video template background for QA
│   └── Logo/                   # Woodhouse brand logos
└── logs/                       # Script execution logs
```

---

## Database Schema

### Main Table: `dealers`
```sql
dealer_no TEXT PRIMARY KEY      -- 8-digit Allied Air ID
dealer_name TEXT                -- Original Allied name
display_name TEXT               -- Cleaned name for videos
program_status TEXT             -- 'FULL' or 'CONTENT'
region TEXT                     -- 'NORTH', 'SOUTH', 'CANADA'

-- Contact
contact_name TEXT
contact_first_name TEXT
contact_email TEXT

-- Creatomate Fields (validated)
creatomate_phone TEXT           -- Formatted: "269-966-9595"
creatomate_website TEXT         -- Domain only: "hotairnow.com"
creatomate_logo TEXT            -- Google Drive URL

-- Tracking
ready_for_automate TEXT         -- 'yes' when all validated
first_post_email_sent TEXT      -- ISO timestamp
last_post_email_sent TEXT       -- ISO timestamp
facebook_page_id TEXT
```

### Other Tables
- `dealer_contacts` - Multi-source contact tracking
- `posts` - Post archive (656+ posts)
- `post_schedule` - Dealer × Post combinations
- `removed_dealers` - Historical archive
- `api_sync_log` - Sync audit trail

---

## Google Drive Resources

**Root Folder:** `Shared drives/Woodhouse Social/Creative Automation/`

| Resource | File ID | Purpose |
|----------|---------|---------|
| Scheduling Spreadsheet | `1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY` | Dealer columns, post rows |
| Posts Excel (No Images) | `1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE` | Post archive |
| Dealers Folder | `1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv` | Individual dealer folders |
| Logos Staging | `1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex` | Logo staging folder |

### Scheduling Spreadsheet Structure

| Row | Field | Source |
|-----|-------|--------|
| 1 | Dealer Number | Primary key |
| 2 | Schedule Email Status | Olivia (Pending/Done/Email Sent) |
| 3 | Last Post Date | Olivia |
| 4 | Who Posted | Olivia |
| 5 | First Name | Database |
| 6 | Email | Database |
| 7 | Region | Database |
| 8 | Website | Database |
| 9 | Phone | Database |
| 10 | Distributor | Database |
| 11 | Display Name | Database |
| 12+ | Post Rows | Base copy with {number} placeholder |

---

## Common Tasks

### Send dealer emails
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Test (dry run)
python3 scripts/email_sender/send_email.py welcome 10122026 --dry-run

# Send emails
python3 scripts/email_sender/send_email.py welcome 10122026
python3 scripts/email_sender/send_email.py first_post 10122026
python3 scripts/email_sender/send_email.py post_scheduled 10122026
python3 scripts/email_sender/send_email.py fb_admin_accepted 10122026
python3 scripts/email_sender/send_email.py content_ready 10122026 --download-url "https://..."

# Skip spreadsheet update
python3 scripts/email_sender/send_email.py post_scheduled 10122026 --no-spreadsheet
```

### Process "Done" status dealers
```bash
# From CLI (dry run)
python3 scripts/process_done_status.py --dry-run

# From CLI (send emails)
python3 scripts/process_done_status.py

# Or use the dashboard at /admin - "Process Scheduled Emails" section
```

### Add new dealer to spreadsheet
```bash
python3 scripts/add_dealer_to_spreadsheet.py 10122026
python3 scripts/add_dealer_to_spreadsheet.py 10122026 --dry-run
```

### Update dealer status
```bash
# Promote to FULL
python3 scripts/update_dealer_status.py --promote "Dealer Name"
python3 scripts/update_dealer_status.py --promote --dealer-no 10122026

# Demote to CONTENT
python3 scripts/update_dealer_status.py --demote "Dealer Name"
```

### Sync spreadsheet from database
```bash
# Sync dealer metadata (rows 5-11)
python3 scripts/sync_spreadsheet.py --sync-dealers

# Populate post copy for a specific post (CLI)
python3 scripts/sync_spreadsheet.py --post 666

# Both at once
python3 scripts/sync_spreadsheet.py --sync-dealers --post 666
```

### Populate post copy (Dashboard - preferred)
Use the dashboard at `/admin` - "Populate Post Copy" section:
1. Enter post number
2. Type base copy, use variable picker buttons to insert `{name}`, `{phone}`, `{website}`
3. Click "Preview" to see dry run, or "Populate All" to write to spreadsheet

### Batch render videos
```bash
python3 scripts/batch_render.py --post 700 --template abc123
python3 scripts/batch_render.py --post 700 --template abc123 --dealer 10122026
python3 scripts/batch_render.py --post 700 --template abc123 --dry-run
```

### Query SQLite (legacy - use Firestore instead)
```bash
sqlite3 ~/woodhouse_creative/data/sqlite/creative.db "SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL';"
```

### Query Firestore (primary database)
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a && npx tsx -e "
import { getDealers } from './lib/firestore-dealers';

async function check() {
  const dealers = await getDealers();
  console.log('Total dealers:', dealers.length);

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const d of dealers) {
    byStatus[d.program_status || 'unknown'] = (byStatus[d.program_status || 'unknown'] || 0) + 1;
  }
  console.log('By status:', byStatus);

  // Check specific dealer (replace with dealer number)
  const dealer = dealers.find(d => d.dealer_no === '10122026');
  if (dealer) console.log('Found:', dealer.dealer_no, dealer.dealer_name);
}
check();
"
```

### Run dev server
```bash
npm run dev
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Local Database | SQLite (better-sqlite3) |
| Runtime Database | Firebase Firestore |
| Video Rendering | Creatomate API |
| File Storage | Google Drive API |
| Email | Resend API |
| Image Processing | Sharp |
| Web Scraping | Cheerio |
| Hosting | Vercel |

---

## Environment Variables

```env
# Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=woodhouse-social
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Creatomate
CREATOMATE_API_KEY=
CREATOMATE_WEBHOOK_SECRET=

# Google Drive
GOOGLE_SERVICE_ACCOUNT_EMAIL=creative-automation@woodhouse-social.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=1jOmOJfLRvi2K8gZztoIxAad3cz72A16L
GOOGLE_DRIVE_LOGOS_STAGING_FOLDER_ID=1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex

# APIs
BRANDFETCH_API_KEY=
RESEND_API_KEY=
ANTHROPIC_API_KEY=               # Claude API (for recall agent semantic search)

# Security
CRON_SECRET=
```

---

## Key Concepts

### Dealer Number
- 8-digit ID assigned by Allied Air (e.g., `10231005`)
- PRIMARY KEY across all systems
- Exception: `TEMP-XXX` for dealers not yet in Allied system

### Program Status
- `FULL` (124 dealers) - We have FB admin access, handle posting
- `CONTENT` (209 dealers) - We create content, they post it

### Creatomate Fields
All validated for video generation:
- `display_name` - Clean name (proper case, "and" not "&")
- `creatomate_phone` - Formatted: "269-966-9595"
- `creatomate_website` - Domain only: "hotairnow.com"
- `creatomate_logo` - Google Drive shareable URL

### Render Job Lifecycle
1. **Pending** - Created, waiting for cron
2. **Processing** - Submitted to Creatomate
3. **Completed** - Video downloaded, uploaded to Drive
4. **Failed** - Error (retries up to 3x)

---

## Related Repos

| Repo | Purpose |
|------|---------|
| `woodhouse_social` | SaaS platform (customer signups, Stripe, auth) |
| `prospect_engine` | National HVAC prospect database (145K+) |
| `woodhouse_dealer_dashboard` | Static HTML performance reports |

**Note:** This repo is for **agency operations** (existing Allied dealers). `woodhouse_social` is the **SaaS product** (new customers). They share the same Firebase project, Google Drive service account, and Creatomate API key.

---

## Excel Sync (Microsoft Graph API)

Excel sync now works on both localhost and Vercel using Microsoft Graph API with OAuth2 device code flow.

### How It Works

```
SharePoint Excel → Microsoft Graph API → TypeScript Parser → Firestore
```

**Authentication:** OAuth2 device code flow with MSAL
- Token cached in `.microsoft-token-cache.json` (committed to repo)
- Refresh tokens last up to 90 days
- Re-authentication only needed every 90 days

### First-Time Setup (New Machine)

```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a
npx tsx scripts/test-microsoft-auth.ts
# Visit microsoft.com/devicelogin and enter the code shown
# Sign in with greg@woodhouseagency.com
```

After authenticating, pull the `.microsoft-token-cache.json` to other machines to share the auth session.

### Environment Variables

```env
MICROSOFT_TENANT_ID=6e2ff6f5-2943-474f-a4ae-cd7566bb8ccc
MICROSOFT_CLIENT_ID=7a9582ea-4528-4667-ac11-2e559723a565
SHAREPOINT_OWNER_EMAIL=greg@woodhouseagency.com
SHAREPOINT_FILE_PATH=/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm
```

### Using Sync from Excel

**Via CLI (preferred):**
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a
npx tsx -e "
import { syncFromExcel } from './lib/sync-excel';
const { changes } = await syncFromExcel(false);  // Dry run
console.log('New:', changes.new.length);
console.log('Removed:', changes.removed.length);
console.log('Updated:', changes.updated.length);
"
```

**Via Admin Dashboard:**
- Works on localhost: `http://localhost:3000/admin`
- Works on production: `https://woodhouse-creative.vercel.app/admin`

### Token Management

```bash
# Check token status
npx tsx scripts/test-microsoft-auth.ts --status

# Force re-authentication
npx tsx scripts/test-microsoft-auth.ts --clear
npx tsx scripts/test-microsoft-auth.ts
```

### Related Files

- [lib/microsoft-auth.ts](lib/microsoft-auth.ts) - OAuth2 device code authentication
- [lib/sync-excel.ts](lib/sync-excel.ts) - Excel sync implementation
- [docs/engineering/EXCEL_SYNC_REFERENCE.md](docs/engineering/EXCEL_SYNC_REFERENCE.md) - Column mapping
- [docs/engineering/EXCEL_VBA_MACROS.md](docs/engineering/EXCEL_VBA_MACROS.md) - VBA macro documentation

---

## What's Next (Waiting On)

- **Allied Air API credentials** from Billy (developer) - enables automated dealer sync
- Once received, implement `scripts/allied_api.py` for direct OAuth2 connection
