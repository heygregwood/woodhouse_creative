/**
 * Blocked dealers configuration
 *
 * These dealers are excluded from automated emails (welcome, post scheduled, etc.)
 * They will still appear in Excel sync but emails will be suppressed.
 *
 * Use case: Test accounts, internal accounts, dealers who have opted out
 */

// Set to true to enable testing mode - ONLY test dealer(s) will receive emails
export const TESTING_MODE = false;

// Test dealer number - receives emails even in testing mode
export const TEST_DEALER_NO = '99999999';

export const BLOCKED_DEALER_NOS = new Set([
  // Test account - G W Berkheimer Co Inc GW BERKHEIMER - HQ TEST ACCOUNT
  '10491009',
  // Note: 99999001 (Relief Heat and Air) and 99999002 (Eco) are REAL dealers
  // without Allied Air numbers - do NOT block them
]);

/**
 * Check if a dealer should be blocked from receiving emails
 *
 * In TESTING_MODE:
 * - Only TEST_DEALER_NO receives emails
 * - All other dealers are blocked (return true)
 *
 * In normal mode:
 * - Only dealers in BLOCKED_DEALER_NOS are blocked
 */
export function isDealerBlocked(dealerNo: string): boolean {
  if (TESTING_MODE) {
    // In testing mode, only allow test dealer
    return dealerNo !== TEST_DEALER_NO;
  }

  // Normal mode - check blocklist
  return BLOCKED_DEALER_NOS.has(dealerNo);
}

/**
 * Filter out blocked dealers from a list
 */
export function filterBlockedDealers<T extends { dealer_no: string }>(
  dealers: T[]
): T[] {
  return dealers.filter((d) => !BLOCKED_DEALER_NOS.has(d.dealer_no));
}
