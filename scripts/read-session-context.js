/**
 * Read session context from Firestore
 *
 * Usage: node scripts/read-session-context.js
 *
 * This script is called by the SessionStart hook to load context
 * from previous sessions. It delegates to recall-agent.js for
 * the actual retrieval and formatting.
 *
 * For query-based recall, use recall-agent.js directly:
 *   node scripts/recall-agent.js "admin dashboard"
 */

const { spawn } = require('child_process');
const path = require('path');

async function main() {
  // Delegate to recall-agent.js in SessionStart mode (no query)
  const recallAgent = spawn('node', [path.join(__dirname, 'recall-agent.js')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  return new Promise((resolve, reject) => {
    recallAgent.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`recall-agent.js exited with code ${code}`));
      }
    });
    recallAgent.on('error', reject);
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // Silent failure for SessionStart - don't block session
    console.log('# Session Context\n');
    console.log('Unable to load previous context. Starting fresh.');
    process.exit(0);
  });
