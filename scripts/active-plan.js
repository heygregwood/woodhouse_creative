/**
 * Active Plan Manager
 *
 * Manages the "active plan" pointer for a repo. Detects new plan files
 * automatically by comparing mtimes, so the system doesn't rely on
 * Claude remembering to update the pointer.
 *
 * Usage:
 *   const { getActivePlan, readPlanText, hashPlan } = require('./active-plan');
 *   const plan = await getActivePlan();
 *   // plan = { file, title, text, hash, isStale, newerPlanExists }
 *
 * Plan files location: ~/.claude/plans/*.md (global, machine-local)
 * Pointer location: ./.claude/active-plan.json (repo-local, gitignored)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Plan files are stored globally in ~/.claude/plans/
const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans');

// Pointer is stored per-repo in ./.claude/active-plan.json
const POINTER_FILE = path.join(process.cwd(), '.claude', 'active-plan.json');

// Stale threshold: 24 hours
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Get all plan files sorted by mtime (newest first)
 */
function getPlanFiles() {
  if (!fs.existsSync(PLANS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const fullPath = path.join(PLANS_DIR, f);
      const stats = fs.statSync(fullPath);
      return {
        name: f,
        path: fullPath,
        mtime: stats.mtime,
        mtimeMs: stats.mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs); // Newest first

  return files;
}

/**
 * Read the current pointer file
 */
function readPointer() {
  if (!fs.existsSync(POINTER_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(POINTER_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Write the pointer file
 */
function writePointer(pointer) {
  const dir = path.dirname(POINTER_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(POINTER_FILE, JSON.stringify(pointer, null, 2));
}

/**
 * Extract title from plan file (first # heading or filename)
 */
function extractTitle(text, filename) {
  const match = text.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].replace(/^Plan:\s*/i, '').trim();
  }
  return filename.replace('.md', '').replace(/-/g, ' ');
}

/**
 * Hash plan text (SHA256, first 16 chars)
 */
function hashPlan(text) {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * Read plan text from file
 */
function readPlanText(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Get the active plan for this repo
 *
 * Logic:
 * 1. If pointer exists and points to valid file → use it (NEVER auto-switch)
 * 2. If pointer points to deleted file → bootstrap from newest
 * 3. If no pointer exists → bootstrap from newest plan file
 * 4. Warn if newer plan file exists (but don't switch)
 * 5. Staleness based on plan file mtime, not pointer age
 *
 * Returns: { file, title, text, hash, isStale, newerPlanExists, bootstrapped }
 */
async function getActivePlan() {
  const planFiles = getPlanFiles();

  if (planFiles.length === 0) {
    return null; // No plan files exist
  }

  const newestFile = planFiles[0];
  let pointer = readPointer();
  let bootstrapped = false;

  // If pointer exists and file is valid → keep it (no auto-switch)
  if (pointer && pointer.plan_file) {
    if (!fs.existsSync(pointer.plan_file)) {
      // Pointer points to deleted file → bootstrap from newest
      pointer = null;
      bootstrapped = true;
    }
    // Otherwise: keep current pointer, even if newer files exist
  }

  // Bootstrap pointer if needed (first time or deleted file)
  if (!pointer) {
    const text = readPlanText(newestFile.path);
    const title = extractTitle(text, newestFile.name);

    pointer = {
      repo: path.basename(process.cwd()),
      plan_file: newestFile.path,
      plan_title: title,
      updated_at: new Date().toISOString()
    };

    writePointer(pointer);
    bootstrapped = true;
  }

  // Read the active plan
  const text = readPlanText(pointer.plan_file);
  if (!text) {
    return null; // File disappeared between checks
  }

  const hash = hashPlan(text);
  const title = extractTitle(text, path.basename(pointer.plan_file));
  const planFileMtime = fs.statSync(pointer.plan_file).mtimeMs;

  // Update pointer title (in case plan heading changed)
  pointer.plan_title = title;
  writePointer(pointer);

  // Staleness based on plan FILE mtime (not pointer age)
  const isStale = (Date.now() - planFileMtime) > STALE_THRESHOLD_MS;

  // Check if newer plan exists (warning only, no switch)
  const newerPlanExists = newestFile.path !== pointer.plan_file;

  return {
    file: pointer.plan_file,
    title,
    text,
    hash,
    isStale,
    newerPlanExists,
    bootstrapped,
    newerPlanFile: newerPlanExists ? newestFile.path : null
  };
}

/**
 * Manually set the active plan (for explicit switches)
 */
function setActivePlan(planFilePath) {
  if (!fs.existsSync(planFilePath)) {
    throw new Error(`Plan file not found: ${planFilePath}`);
  }

  const text = readPlanText(planFilePath);
  const title = extractTitle(text, path.basename(planFilePath));

  const pointer = {
    repo: path.basename(process.cwd()),
    plan_file: planFilePath,
    plan_title: title,
    updated_at: new Date().toISOString()
  };

  writePointer(pointer);
  return pointer;
}

/**
 * List all available plan files
 */
function listPlanFiles() {
  return getPlanFiles();
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'list') {
    const files = listPlanFiles();
    console.log('Plan files in ~/.claude/plans:\n');
    files.forEach((f, i) => {
      const age = Math.round((Date.now() - f.mtimeMs) / (1000 * 60 * 60));
      console.log(`${i + 1}. ${f.name} (${age}h ago)`);
    });
  } else if (args[0] === 'set' && args[1]) {
    try {
      const pointer = setActivePlan(args[1]);
      console.log(`Active plan set to: ${pointer.plan_title}`);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  } else if (args[0] === 'current') {
    getActivePlan().then(plan => {
      if (!plan) {
        console.log('No active plan found.');
      } else {
        console.log(`Active plan: ${plan.title}`);
        console.log(`File: ${plan.file}`);
        console.log(`Hash: ${plan.hash}`);
        console.log(`Size: ${plan.text.length} chars, ${plan.text.split('\n').length} lines`);
        if (plan.isStale) {
          console.log('⚠️  Plan pointer is stale (>24h since last update)');
        }
        if (plan.newerPlanExists) {
          console.log(`⚠️  Newer plan exists: ${plan.newerPlanFile}`);
        }
        if (plan.bootstrapped) {
          console.log('Bootstrapped from newest plan file');
        }
      }
    });
  } else {
    console.log('Usage:');
    console.log('  node scripts/active-plan.js list              # List all plan files');
    console.log('  node scripts/active-plan.js current           # Show current active plan');
    console.log('  node scripts/active-plan.js set <path>        # Manually set active plan');
  }
}

module.exports = {
  getActivePlan,
  setActivePlan,
  readPlanText,
  hashPlan,
  listPlanFiles
};
