/**
 * Recall Agent - Long-term memory retrieval for Claude Code
 *
 * Usage:
 *   node scripts/recall-agent.js                    # SessionStart mode (recent + topics)
 *   node scripts/recall-agent.js "batch render"     # Query mode (semantic search)
 *
 * SessionStart mode:
 *   - Returns last 3 session summaries
 *   - Lists all topics with dates
 *   - Shows active blockers
 *
 * Query mode:
 *   - Calls Claude Haiku to find semantically relevant sessions
 *   - Synthesizes context across multiple sessions
 *   - Returns decisions, blockers, files for the topic
 *
 * NOTE: Uses DEFAULT Firestore database (not woodhouse-creative-db) so that
 * sessions from both woodhouse_creative and woodhouse_social are searchable
 * together. Filters by repo='woodhouse_creative' for SessionStart mode.
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

/**
 * Fetch sessions from Firestore (last 6 months)
 * In SessionStart mode, filters to this repo only.
 * In Query mode, searches across all repos.
 */
async function fetchSessions(repoFilter) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let query = db
    .collection('claude_sessions')
    .where('created_at', '>=', admin.firestore.Timestamp.fromDate(sixMonthsAgo))
    .orderBy('created_at', 'desc')
    .limit(500);

  const snapshot = await query.get();

  let sessions = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      repo: data.repo || 'unknown',
      created_at: data.created_at?.toDate?.() || new Date(),
      summary: data.summary || '',
      topics: data.topics || [],
      decisions: data.decisions || [],
      blockers: data.blockers || [],
      entities: data.entities || [],
      files_touched: data.files_touched || [],
      outcome: data.outcome || 'unknown',
      user_request: data.user_request || null,
    };
  });

  // Filter by repo if specified (SessionStart mode)
  if (repoFilter) {
    sessions = sessions.filter((s) => s.repo === repoFilter);
  }

  return sessions;
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * SessionStart mode - return recent sessions and topic index
 */
async function sessionStartMode(sessions) {
  // Get last 3 sessions
  const recentSessions = sessions.slice(0, 3);

  // Build topic index (topic -> dates)
  const topicIndex = {};
  sessions.forEach((session) => {
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

  // Collect active blockers
  const activeBlockers = [];
  sessions.slice(0, 10).forEach((session) => {
    if (session.outcome !== 'completed' && session.blockers.length > 0) {
      session.blockers.forEach((blocker) => {
        if (!activeBlockers.includes(blocker)) {
          activeBlockers.push(blocker);
        }
      });
    }
  });

  // Output formatted markdown
  console.log('# Session Context\n');

  console.log('## Recent Work');
  recentSessions.forEach((session) => {
    const date = formatDate(session.created_at);
    const outcome = session.outcome === 'completed' ? 'completed' : session.outcome;
    console.log(`- [${date}] ${session.summary.substring(0, 80)} - ${outcome}`);
  });
  console.log('');

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
 */
async function queryMode(sessions, query) {
  // Check if Anthropic SDK is available
  let anthropic;
  try {
    const Anthropic = require('@anthropic-ai/sdk').default;
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  } catch (e) {
    // Anthropic SDK not installed - use fallback
    console.log(`# Recall: "${query}" (fallback mode - install @anthropic-ai/sdk for semantic search)\n`);
    fallbackSearch(sessions, query);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`# Recall: "${query}" (fallback mode - ANTHROPIC_API_KEY not set)\n`);
    fallbackSearch(sessions, query);
    return;
  }

  // Prepare session summaries for Haiku
  const sessionSummaries = sessions.map((s) => ({
    id: s.id,
    repo: s.repo,
    date: formatDate(s.created_at),
    summary: s.summary,
    topics: s.topics,
    decisions: s.decisions,
    blockers: s.blockers,
    files: s.files_touched,
    outcome: s.outcome,
  }));

  const systemPrompt = `You are a recall agent for a software development project (woodhouse_creative - Allied Air dealer automation). Your job is to find sessions relevant to the user's query and synthesize the context.

Given a list of session summaries and a query, you must:
1. Identify sessions that are semantically relevant (not just keyword matching)
2. Synthesize information across sessions
3. Return a clear summary of what was done, decisions made, and any blockers

Output format (use exactly this structure):
## Relevant Sessions
[List the 1-5 most relevant sessions by date and summary]

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

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const result = response.content[0].text;
    console.log(`# Recall: "${query}"\n`);
    console.log(result);
  } catch (error) {
    console.error(`Error calling Haiku: ${error.message}`);
    // Fallback to simple search
    console.log(`# Recall: "${query}" (fallback mode)\n`);
    fallbackSearch(sessions, query);
  }
}

/**
 * Simple keyword-based search fallback
 */
function fallbackSearch(sessions, query) {
  const relevant = sessions.filter(
    (s) =>
      s.summary.toLowerCase().includes(query.toLowerCase()) ||
      s.topics.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );
  if (relevant.length > 0) {
    console.log('## Matching Sessions');
    relevant.slice(0, 5).forEach((s) => {
      const repoTag = s.repo !== 'woodhouse_creative' ? ` [${s.repo}]` : '';
      console.log(`- [${formatDate(s.created_at)}]${repoTag} ${s.summary}`);
    });
  } else {
    console.log('No matching sessions found.');
  }
}

/**
 * Main function
 */
async function main() {
  const query = process.argv[2];

  if (query) {
    // Query mode - search across ALL repos for broader context
    const sessions = await fetchSessions(null);

    if (sessions.length === 0) {
      console.log('# Session Context\n');
      console.log('No previous sessions found.');
      return;
    }

    await queryMode(sessions, query);
  } else {
    // SessionStart mode - filter to this repo only
    const sessions = await fetchSessions('woodhouse_creative');

    if (sessions.length === 0) {
      console.log('# Session Context\n');
      console.log('No previous sessions found. This appears to be a fresh start.');
      return;
    }

    await sessionStartMode(sessions);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Recall agent error:', e.message);
    process.exit(1);
  });
