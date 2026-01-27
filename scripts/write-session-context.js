/**
 * Write session context to Firestore
 *
 * Usage:
 *   node scripts/write-session-context.js <path-to-json-file>   (preferred)
 *   echo '{"summary": "..."}' | node scripts/write-session-context.js  (pipe)
 *
 * Called by Claude during sessions to persist context that survives
 * across compaction and enables long-term memory recall.
 *
 * Accepts JSON via file argument (most reliable) OR stdin pipe.
 * DO NOT prefix with "set -a && source .env.local" — dotenv loads it internally.
 *
 * NOTE: Uses DEFAULT Firestore database (not woodhouse-creative-db) so that
 * sessions from both woodhouse_creative and woodhouse_social are searchable
 * together in the shared `claude_sessions` collection.
 */

require('dotenv').config({ path: '.env.local', override: true });
const admin = require('firebase-admin');

// Initialize Firebase Admin (DEFAULT database for cross-repo session storage)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// Use DEFAULT database (not woodhouse-creative-db) for cross-repo sessions
const db = admin.firestore();

async function writeSessionContext() {
  let input = '';

  // Option 1: Read from file argument (most reliable)
  const filePath = process.argv[2];
  if (filePath) {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    input = fs.readFileSync(filePath, 'utf8');
  } else {
    // Option 2: Read from stdin pipe
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      input += chunk;
    }
  }

  if (!input.trim()) {
    console.error('Error: No input provided.');
    console.error('Usage:');
    console.error('  node scripts/write-session-context.js <path-to-json-file>');
    console.error(
      '  echo \'{"summary": "...", "topics": ["x"]}\' | node scripts/write-session-context.js'
    );
    process.exit(1);
  }

  let context;
  try {
    context = JSON.parse(input);
  } catch (e) {
    console.error('Error: Invalid JSON input');
    console.error(e.message);
    process.exit(1);
  }

  // Validate required fields
  if (!context.summary) {
    console.error('Error: "summary" field is required');
    process.exit(1);
  }

  // Validate topics if provided
  if (context.topics && !Array.isArray(context.topics)) {
    console.error('Error: "topics" must be an array');
    process.exit(1);
  }

  // Build the document
  const sessionDoc = {
    // Metadata
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    machine: process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown',
    repo: 'woodhouse_creative',
    trigger: context.trigger || 'periodic',

    // Core context (REQUIRED)
    summary: context.summary,

    // AI-extracted metadata (dynamic topics)
    topics: context.topics || [],
    decisions: context.decisions || [],
    blockers: context.blockers || [],
    entities: context.entities || [],
    files_touched: context.files_touched || [],

    // Status tracking
    outcome: context.outcome || 'in_progress',
    user_request: context.user_request || null,
    commits: context.commits || [],
    session_boundary: context.session_boundary || false,

    // Flexible additional context
    important_context: context.important_context || {},

    // Legacy field support (map old names to new)
    ...(context.key_files && !context.files_touched && { files_touched: context.key_files }),
    ...(context.recent_decisions &&
      !context.decisions && { decisions: context.recent_decisions }),
  };

  try {
    const docRef = await db.collection('claude_sessions').add(sessionDoc);
    console.log(`Session context saved: ${docRef.id}`);
    console.log(`Summary: ${context.summary.substring(0, 100)}...`);
    if (context.topics && context.topics.length > 0) {
      console.log(`Topics: ${context.topics.join(', ')}`);
    }
  } catch (error) {
    console.error('Error writing to Firestore:', error.message);
    process.exit(1);
  }
}

writeSessionContext()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
