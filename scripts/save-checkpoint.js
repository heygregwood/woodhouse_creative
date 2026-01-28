/**
 * Save checkpoint to Firestore session context
 *
 * Usage:
 *   node scripts/save-checkpoint.js --trigger=pre_compact
 *
 * Called by PreCompact hook to persist checkpoint state before
 * auto-compaction. Reads .claude-checkpoint.json, validates,
 * and writes to claude_sessions collection.
 *
 * NEW: Also captures the active plan file automatically using active-plan.js.
 * Writes canonical plan state to claude_repo_state/{repo} for easy recall.
 *
 * Gracefully handles missing/corrupted checkpoint (logs, skips save).
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getActivePlan } = require('./active-plan');

// Parse command line args
const trigger = process.argv.find(arg => arg.startsWith('--trigger='))?.split('=')[1] || 'pre_compact';

// Initialize Firebase Admin - connects to claude-context-gregw
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.CLAUDE_CONTEXT_PROJECT_ID,
      clientEmail: process.env.CLAUDE_CONTEXT_CLIENT_EMAIL,
      privateKey: process.env.CLAUDE_CONTEXT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const sessionLogPath = path.join(__dirname, '..', 'docs', 'archive', 'sessions', 'session_log.txt');
const checkpointPath = path.join(__dirname, '..', '.claude-checkpoint.json');
const CURRENT_REPO = path.basename(process.cwd());

function logToSessionLog(message) {
  try {
    const timestamp = new Date().toISOString().substring(0, 16).replace('T', ' ');
    fs.appendFileSync(sessionLogPath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Silent fail on log write - don't break PreCompact hook
  }
}

/**
 * Get the last saved plan hash from repo_state (to detect changes)
 */
async function getLastPlanHash() {
  try {
    const doc = await db.collection('claude_repo_state').doc(CURRENT_REPO).get();
    if (doc.exists) {
      return doc.data().active_plan_hash || null;
    }
  } catch (e) {
    // Ignore errors - treat as no previous hash
  }
  return null;
}

/**
 * Update the canonical repo state with current plan
 */
async function updateRepoState(plan) {
  const repoStateDoc = {
    repo: CURRENT_REPO,
    active_plan_text: plan.text,
    active_plan_hash: plan.hash,
    active_plan_title: plan.title,
    active_plan_file: plan.file,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('claude_repo_state').doc(CURRENT_REPO).set(repoStateDoc, { merge: true });
}

async function saveCheckpoint() {
  // 1. Check if checkpoint file exists
  if (!fs.existsSync(checkpointPath)) {
    logToSessionLog('Checkpoint skip: .claude-checkpoint.json not found');
    process.exit(0);
  }

  // 2. Read checkpoint file
  let checkpoint;
  try {
    const content = fs.readFileSync(checkpointPath, 'utf8');
    checkpoint = JSON.parse(content);
  } catch (e) {
    logToSessionLog(`Checkpoint save failed: Invalid JSON - ${e.message}`);
    process.exit(0);
  }

  // 3. Light validation
  const errors = [];

  // Required fields
  if (!checkpoint.summary || typeof checkpoint.summary !== 'string' || !checkpoint.summary.trim()) {
    errors.push('summary must be a non-empty string');
  }

  if (!checkpoint.topics || !Array.isArray(checkpoint.topics) || checkpoint.topics.length === 0) {
    errors.push('topics must be a non-empty array');
  }

  if (!checkpoint.user_request || typeof checkpoint.user_request !== 'string' || !checkpoint.user_request.trim()) {
    errors.push('user_request must be a non-empty string');
  }

  // Optional fields with type checks (if present)
  if (checkpoint.plan && typeof checkpoint.plan !== 'string') {
    errors.push('plan must be a string');
  }

  if (checkpoint.plan_status && typeof checkpoint.plan_status !== 'string') {
    errors.push('plan_status must be a string');
  }

  if (checkpoint.decisions && !Array.isArray(checkpoint.decisions)) {
    errors.push('decisions must be an array');
  }

  if (checkpoint.blockers && !Array.isArray(checkpoint.blockers)) {
    errors.push('blockers must be an array');
  }

  if (checkpoint.entities && !Array.isArray(checkpoint.entities)) {
    errors.push('entities must be an array');
  }

  if (checkpoint.files_touched && !Array.isArray(checkpoint.files_touched)) {
    errors.push('files_touched must be an array');
  }

  if (checkpoint.commits && !Array.isArray(checkpoint.commits)) {
    errors.push('commits must be an array');
  }

  // If validation fails, skip save and log
  if (errors.length > 0) {
    logToSessionLog(`Checkpoint save failed: ${errors.join('; ')}`);
    process.exit(0);
  }

  // 4. Get active plan from plan file (automatic detection)
  let activePlan = null;
  let planChanged = false;

  try {
    activePlan = await getActivePlan();

    if (activePlan) {
      const lastHash = await getLastPlanHash();
      planChanged = activePlan.hash !== lastHash;

      // Log warnings
      if (activePlan.bootstrapped) {
        logToSessionLog(`Plan bootstrapped from newest file: ${activePlan.title}`);
      }
      if (activePlan.newerPlanExists) {
        logToSessionLog(`Note: Newer plan file exists: ${activePlan.newerPlanFile}. Use 'node scripts/active-plan.js set <path>' to switch.`);
      }
    }
  } catch (e) {
    logToSessionLog(`Warning: Could not get active plan - ${e.message}`);
    // Continue without plan - don't fail the checkpoint
  }

  // 5. Build session document
  // Use plan from active plan file (full text), not checkpoint (which may be summary)
  const planText = activePlan?.text || checkpoint.plan || null;
  const planStatus = checkpoint.plan_status || null;

  const sessionDoc = {
    // Metadata
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    machine: process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown',
    repo: CURRENT_REPO,
    trigger: trigger,

    // Core context (from checkpoint)
    summary: checkpoint.summary,

    // AI-extracted metadata
    topics: checkpoint.topics,
    decisions: checkpoint.decisions || [],
    blockers: checkpoint.blockers || [],
    entities: checkpoint.entities || [],
    files_touched: checkpoint.files_touched || [],

    // Status tracking
    outcome: checkpoint.outcome || 'in_progress',
    user_request: checkpoint.user_request,
    commits: checkpoint.commits || [],
    session_boundary: checkpoint.session_boundary || false,

    // Plan persistence - use full plan text from file
    ...(planText && { plan: planText }),
    ...(planStatus && { plan_status: planStatus }),
    ...(activePlan && { plan_hash: activePlan.hash }),
    ...(activePlan && { plan_title: activePlan.title }),

    // Flexible additional context
    important_context: checkpoint.important_context || {},
  };

  // 6. Write to Firestore
  try {
    // Write session doc
    const docRef = await db.collection('claude_sessions').add(sessionDoc);

    // Update repo_state if plan changed (or first time)
    if (activePlan && planChanged) {
      await updateRepoState(activePlan);
      logToSessionLog(`Checkpoint saved: ${docRef.id} (plan updated: ${activePlan.title})`);
    } else if (activePlan) {
      logToSessionLog(`Checkpoint saved: ${docRef.id} (plan unchanged)`);
    } else {
      logToSessionLog(`Checkpoint saved: ${docRef.id} (no plan)`);
    }

    process.exit(0);
  } catch (error) {
    logToSessionLog(`Checkpoint save failed: Firestore error - ${error.message}`);
    process.exit(0);
  }
}

saveCheckpoint().catch((e) => {
  logToSessionLog(`Checkpoint save failed: Unexpected error - ${e.message}`);
  process.exit(0);
});
