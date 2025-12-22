/**
 * Google Apps Script - Facebook Admin Email Monitor
 *
 * Monitors the communitymanagers@woodhouseagency.com inbox for Facebook admin
 * invite and removal emails, then triggers the Woodhouse Creative API.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to script.google.com while logged into communitymanagers@woodhouseagency.com
 * 2. Create a new project named "FB Admin Monitor"
 * 3. Paste this entire script
 * 4. Update the CONFIG values below
 * 5. Run setupTrigger() once to create the scheduled trigger
 * 6. Authorize the script when prompted
 *
 * The script will then run every 5 minutes automatically.
 */

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================================

const CONFIG = {
  // Your Woodhouse Creative API endpoint
  WEBHOOK_URL: 'https://woodhouse-creative.vercel.app/api/admin/dealer-status',

  // Secret for webhook authentication (set this in Vercel env as DEALER_STATUS_WEBHOOK_SECRET)
  WEBHOOK_SECRET: 'your-secret-here-change-this',

  // How many minutes back to check for emails (should match trigger frequency)
  CHECK_MINUTES: 5,

  // Email addresses to monitor
  FB_INVITE_FROM: 'notification@facebookmail.com',
  FB_REMOVAL_FROM: 'security@facebookmail.com',

  // Subject patterns (case insensitive)
  INVITE_PATTERN: "invited to manage",  // "You're invited to manage X's Page"
  REMOVAL_PATTERN: "no longer have full control",  // "You no longer have full control of X"
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Main function - runs on schedule to check for new FB admin emails
 */
function checkForFacebookEmails() {
  const now = new Date();
  const checkSince = new Date(now.getTime() - CONFIG.CHECK_MINUTES * 60 * 1000);

  Logger.log(`Checking emails since ${checkSince.toISOString()}`);

  // Check for admin invites
  const inviteQuery = `from:${CONFIG.FB_INVITE_FROM} subject:"${CONFIG.INVITE_PATTERN}" after:${formatDateForSearch(checkSince)}`;
  processEmails(inviteQuery, 'promote');

  // Check for admin removals
  const removalQuery = `from:${CONFIG.FB_REMOVAL_FROM} subject:"${CONFIG.REMOVAL_PATTERN}" after:${formatDateForSearch(checkSince)}`;
  processEmails(removalQuery, 'demote');
}

/**
 * Process emails matching a query and trigger webhooks
 */
function processEmails(query, action) {
  const threads = GmailApp.search(query);

  Logger.log(`Found ${threads.length} threads for action: ${action}`);

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      // Skip if already processed (check for label)
      if (hasLabel(message, 'Processed-FB-Admin')) {
        continue;
      }

      const subject = message.getSubject();
      const dealerName = extractDealerName(subject, action);

      if (dealerName) {
        Logger.log(`Processing: ${action} - ${dealerName}`);

        const result = callWebhook(action, dealerName);

        if (result.success) {
          // Mark as processed
          addLabel(thread, 'Processed-FB-Admin');
          Logger.log(`Success: ${result.message}`);
        } else {
          Logger.log(`Failed: ${result.error}`);
          // Add error label for manual review
          addLabel(thread, 'FB-Admin-Error');
        }
      }
    }
  }
}

/**
 * Extract dealer name from email subject
 */
function extractDealerName(subject, action) {
  if (action === 'promote') {
    // "You're invited to manage Frank Devos National Heating and Cooling's Page"
    const match = subject.match(/invited to manage (.+?)['']s Page/i);
    if (match) return match[1].trim();
  } else {
    // "You no longer have full control of Owen AC Services, LLC"
    const match = subject.match(/no longer have full control of (.+?)$/i);
    if (match) return match[1].trim();
  }

  Logger.log(`Could not extract dealer name from: ${subject}`);
  return null;
}

/**
 * Call the Woodhouse Creative webhook
 */
function callWebhook(action, dealerName) {
  const payload = {
    action: action,
    dealer_name: dealerName,
    source: 'gmail_webhook',
    secret: CONFIG.WEBHOOK_SECRET,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      const data = JSON.parse(responseBody);
      return { success: true, message: data.display_name || 'Updated' };
    } else {
      return { success: false, error: `HTTP ${responseCode}: ${responseBody}` };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for Gmail search query
 */
function formatDateForSearch(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * Check if a message has a specific label
 */
function hasLabel(message, labelName) {
  const thread = message.getThread();
  const labels = thread.getLabels();
  return labels.some(label => label.getName() === labelName);
}

/**
 * Add a label to a thread (creates label if it doesn't exist)
 */
function addLabel(thread, labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  thread.addLabel(label);
}

// ============================================================================
// SETUP FUNCTIONS - RUN ONCE
// ============================================================================

/**
 * Run this once to set up the automatic trigger
 */
function setupTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'checkForFacebookEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new trigger - runs every 5 minutes
  ScriptApp.newTrigger('checkForFacebookEmails')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Trigger created: checkForFacebookEmails runs every 5 minutes');
}

/**
 * Create the labels used for tracking
 */
function createLabels() {
  const labels = ['Processed-FB-Admin', 'FB-Admin-Error'];

  for (const labelName of labels) {
    let label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      GmailApp.createLabel(labelName);
      Logger.log(`Created label: ${labelName}`);
    } else {
      Logger.log(`Label exists: ${labelName}`);
    }
  }
}

/**
 * Test the webhook connection
 */
function testWebhook() {
  const result = callWebhook('promote', 'Test Dealer Company');
  Logger.log(JSON.stringify(result));
}

/**
 * Manual test - process a specific email subject
 */
function testExtraction() {
  // Test promote pattern
  const promoteSubject = "You're invited to manage Frank Devos National Heating and Cooling's Page";
  const promoteName = extractDealerName(promoteSubject, 'promote');
  Logger.log(`Promote test: "${promoteName}"`);

  // Test demote pattern
  const demoteSubject = "You no longer have full control of Owen AC Services, LLC";
  const demoteName = extractDealerName(demoteSubject, 'demote');
  Logger.log(`Demote test: "${demoteName}"`);
}
