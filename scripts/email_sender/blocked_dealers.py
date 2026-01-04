"""
Blocked dealers configuration for email automation.

These dealers are excluded from automated emails (welcome, post scheduled, etc.)
They will still appear in Excel sync but emails will be suppressed.

Use case: Test accounts, internal accounts, dealers who have opted out
"""

# Set of dealer numbers to block from receiving emails
BLOCKED_DEALER_NOS = {
    # Test account - G W Berkheimer Co Inc GW BERKHEIMER - HQ TEST ACCOUNT
    '10491009',
}


def is_dealer_blocked(dealer_no: str) -> bool:
    """Check if a dealer should be blocked from receiving emails."""
    return str(dealer_no) in BLOCKED_DEALER_NOS
