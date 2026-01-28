/**
 * Recall Agent - Long-term memory retrieval for Claude Code
 *
 * Usage:
 *   node scripts/recall-agent.js                    # SessionStart mode (recent + topics)
 *   node scripts/recall-agent.js "admin dashboard"  # Query mode (semantic search)
 *
 * SessionStart mode:
 *   - Shows active plan from repo_state (verbatim)
 *   - Returns last 3 session summaries
 *   - Lists all topics with dates
 *   - Shows active blockers
 *
 * Query mode:
 *   - Fetches active plan from repo_state (printed verbatim)
 *   - Calls Claude Haiku to find semantically relevant sessions
 *   - Synthesizes context across multiple sessions
 *   - Returns decisions, blockers, files for the topic
 *
 * NEW: Plans are read from claude_repo_state/{repo} and printed verbatim.
 *      Haiku only summarizes sessions/decisions - it doesn't reproduce plans.
 */

// Use override: true so .env.local values take precedence over
// Claude Code's process env (which sets ANTHROPIC_API_KEY="" empty string)
require('dotenv').config({ path: '.env.local', override: true });
const path = require('path');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk').default;

// Detect current repo from directory name
const CURRENT_REPO = path.basename(process.cwd());

// Initialize Firebase Admin - connects to claude-context-gregw (dedicated context DB)
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

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Fetch the canonical repo state (active plan)
 */
async function fetchRepoState(repo) {
  try {
    const doc = await db.collection('claude_repo_state').doc(repo).get();
    if (doc.exists) {
      const data = doc.data();
      return {
        title: data.active_plan_title,
        text: data.active_plan_text,
        hash: data.active_plan_hash,
        file: data.active_plan_file,
        updated_at: data.updated_at?.toDate?.() || null,
      };
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

/**
 * Fetch sessions from Firestore (last 6 months)
 */
async function fetchSessions() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const snapshot = await db
    .collection('claude_sessions')
    .where('created_at', '>=', admin.firestore.Timestamp.fromDate(sixMonthsAgo))
    .orderBy('created_at', 'desc')
    .limit(500)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      created_at: data.created_at?.toDate?.() || new Date(),
      repo: data.repo || 'unknown',
      summary: data.summary || '',
      topics: data.topics || [],
      decisions: data.decisions || [],
      blockers: data.blockers || [],
      entities: data.entities || [],
      files_touched: data.files_touched || [],
      outcome: data.outcome || 'unknown',
      user_request: data.user_request || null,
      plan_status: data.plan_status || null,
      // Note: we don't fetch plan text from sessions anymore - use repo_state instead
    };
  });
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Short repo label for display
 */
function repoLabel(repo) {
  if (repo === 'woodhouse_social') return 'social';
  if (repo === 'woodhouse_creative') return 'creative';
  return repo;
}

/**
 * Print the active plan (verbatim from repo_state)
 */
function printActivePlan(repoState) {
  if (!repoState || !repoState.text) {
    return;
  }

  console.log('## Active Plan\n');
  console.log(`**${repoState.title}**`);
  console.log(`*(${repoState.text.length} chars, updated ${formatDate(repoState.updated_at)})*\n`);
  console.log(repoState.text);
  console.log('');
}

/**
 * SessionStart mode - return recent sessions and topic index
 */
async function sessionStartMode(sessions, repoState) {
  // Split sessions by repo
  const currentRepoSessions = sessions.filter((s) => s.repo === CURRENT_REPO);
  const otherRepoSessions = sessions.filter((s) => s.repo !== CURRENT_REPO);

  // Get last 3 from current repo
  const recentCurrent = currentRepoSessions.slice(0, 3);
  // Get last 2 from other repos for cross-repo awareness
  const recentOther = otherRepoSessions.slice(0, 2);

  // Build topic index (topic -> dates) from current repo only
  const topicIndex = {};
  currentRepoSessions.forEach((session) => {
    const dateStr = formatDate(session.created_at);
    session.topics.forEach((topic) => {
      if (!topicIndex[topic]) {
        topicIndex[topic] = [];
      }
      if (!topicIndex[topic].includes(dateStr)) {
        topicIndex[topic].push(dateStr);
      }
    });
  });

  // Sort topics by most recent
  const sortedTopics = Object.entries(topicIndex).sort((a, b) => {
    return new Date(b[1][0]) - new Date(a[1][0]);
  });

  // Collect active blockers from current repo
  const activeBlockers = [];
  currentRepoSessions.slice(0, 10).forEach((session) => {
    if (session.outcome !== 'completed' && session.blockers.length > 0) {
      session.blockers.forEach((blocker) => {
        if (!activeBlockers.includes(blocker)) {
          activeBlockers.push(blocker);
        }
      });
    }
  });

  // Output formatted markdown
  console.log(`# Session Context (${CURRENT_REPO})\n`);

  console.log('## Recent Work');
  if (recentCurrent.length > 0) {
    recentCurrent.forEach((session) => {
      const date = formatDate(session.created_at);
      const outcome = session.outcome === 'completed' ? 'completed' : session.outcome;
      console.log(`- [${date}] ${session.summary.substring(0, 80)} - ${outcome}`);
    });
  } else {
    console.log('- No recent sessions for this repo.');
  }
  console.log('');

  if (recentOther.length > 0) {
    console.log('## Recent from Other Repos');
    recentOther.forEach((session) => {
      const date = formatDate(session.created_at);
      const label = repoLabel(session.repo);
      console.log(`- [${date}] [${label}] ${session.summary.substring(0, 70)} - ${session.outcome}`);
    });
    console.log('');
  }

  if (sortedTopics.length > 0) {
    console.log('## Topics with History');
    sortedTopics.slice(0, 15).forEach(([topic, dates]) => {
      console.log(`- ${topic} (${dates.slice(0, 3).join(', ')})`);
    });
    console.log('');
  }

  if (activeBlockers.length > 0) {
    console.log('## Active Blockers');
    activeBlockers.slice(0, 5).forEach((blocker) => {
      console.log(`- ${blocker}`);
    });
    console.log('');
  }

  console.log('*Ask about any topic for full context.*');
}

/**
 * Query mode - use Haiku to find relevant sessions
 * Plan is printed verbatim from repo_state - Haiku only summarizes sessions
 */
async function queryMode(sessions, query, repoState) {
  // Prepare session summaries for Haiku (WITHOUT full plan text - too large)
  const sessionSummaries = sessions.map((s) => ({
    id: s.id,
    date: formatDate(s.created_at),
    repo: s.repo,
    summary: s.summary,
    topics: s.topics,
    decisions: s.decisions,
    blockers: s.blockers,
    files: s.files_touched,
    outcome: s.outcome,
    // Include plan_status but NOT full plan text
    ...(s.plan_status && { plan_status: s.plan_status }),
  }));

  // Haiku's job: find relevant sessions, summarize decisions/blockers
  // NOT: reproduce plans (we do that ourselves from repo_state)
  const systemPrompt = `You are a recall agent for a software development project. Your job is to find sessions relevant to the user's query and synthesize the context.

Sessions come from multiple repos (woodhouse_social = SaaS product, woodhouse_creative = Allied Air agency ops). Each session has a "repo" field. The current repo is "${CURRENT_REPO}". Prioritize sessions from the current repo but include cross-repo sessions if relevant.

Given a list of session summaries and a query, you must:
1. Identify sessions that are semantically relevant (not just keyword matching)
2. Synthesize information across sessions
3. Return a clear summary of what was done, decisions made, and any blockers

IMPORTANT: Do NOT include an "Active Plan" section. The plan is handled separately and printed verbatim by the system.

Output format (use exactly this structure):
## Relevant Sessions
[List the 1-5 most relevant sessions by date, repo, and summary]

## Summary
[2-3 sentence synthesis of work done on this topic]

## Key Decisions
[Bullet list of decisions made, or "None recorded" if empty]

## Blockers
[Bullet list of unresolved blockers, or "None" if resolved/empty]

## Files Involved
[Bullet list of files touched, or "None recorded" if empty]

Be concise. Only include information that's relevant to the query.`;

  const userMessage = `Query: "${query}"

Session history (${sessionSummaries.length} sessions from last 6 months):
${JSON.stringify(sessionSummaries, null, 2)}

Find sessions relevant to this query and synthesize the context.`;

  console.log(`# Recall: "${query}"\n`);

  // Print active plan FIRST (verbatim from repo_state)
  if (repoState && repoState.text) {
    printActivePlan(repoState);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048, // Increased from 1024 for better summaries
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const result = response.content[0].text;
    console.log(result);
  } catch (error) {
    console.error(`Error calling Haiku: ${error.message}`);
    // Fallback to simple search
    console.log('## Matching Sessions (fallback mode)\n');
    const relevant = sessions.filter(
      (s) =>
        s.summary.toLowerCase().includes(query.toLowerCase()) ||
        s.topics.some((t) => t.toLowerCase().includes(query.toLowerCase()))
    );
    if (relevant.length > 0) {
      relevant.slice(0, 5).forEach((s) => {
        console.log(`- [${formatDate(s.created_at)}] ${s.summary}`);
      });
    } else {
      console.log('No matching sessions found.');
    }
  }
}

/**
 * Main function
 */
async function main() {
  const query = process.argv[2];

  // Fetch repo state (active plan) first
  const repoState = await fetchRepoState(CURRENT_REPO);

  // Fetch sessions
  const sessions = await fetchSessions();

  if (sessions.length === 0 && !repoState) {
    console.log('# Session Context\n');
    console.log('No previous sessions found. This appears to be a fresh start.');
    return;
  }

  if (query) {
    // Query mode - semantic search with Haiku
    await queryMode(sessions, query, repoState);
  } else {
    // SessionStart mode - recent + topic index
    await sessionStartMode(sessions, repoState);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Recall agent error:', e.message);
    process.exit(1);
  });
