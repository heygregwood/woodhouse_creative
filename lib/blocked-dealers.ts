/**
 * Blocked dealers configuration
 *
 * These dealers are excluded from automated emails (welcome, post scheduled, etc.)
 * They will still appear in Excel sync but emails will be suppressed.
 *
 * Use case: Test accounts, internal accounts, dealers who have opted out
 */

export const BLOCKED_DEALER_NOS = new Set([
  // Test account - G W Berkheimer Co Inc GW BERKHEIMER - HQ TEST ACCOUNT
  '10491009',
]);

/**
 * Check if a dealer should be blocked from receiving emails
 */
export function isDealerBlocked(dealerNo: string): boolean {
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
