# Errand Runners Billing System

## Overview

The billing system implements a tiered pricing model for errand runners and customers:

### Errand Runners (Service Providers)
- **Week 1 (Free Trial)**: FREE
- **Week 2+**: KES 300/week subscription
- **Activation Requirement**: Must complete at least 1 gig during week 1 to activate billing
- **Trial Period**: 7 days from subscription start

### Customers
- **Per Gig Posting Fee**: KES 100
- **Refund Policy**: Fee is credited back if gig is cancelled or unassigned

## Database Schema

### Tables

#### runner_subscriptions
Tracks billing status for each runner:
- `id` (UUID): Primary key
- `runner_id` (UUID): Foreign key to profiles
- `status` (text): 'trial', 'active', 'paused', or 'cancelled'
- `started_at` (timestamptz): When subscription began (usually at sign-up)
- `trial_end_at` (timestamptz): When the 7-day free trial ends
- `weekly_fee` (numeric): KES 300 (subscription cost per week)
- `last_billed_at` (timestamptz): When the runner was last charged
- `next_billing_at` (timestamptz): When the next weekly charge is due
- `active` (boolean): Whether subscription is active
- `billing_activated` (boolean): Whether billing has started (after 1 gig)
- `first_gig_completed_at` (timestamptz): When runner's first gig was confirmed
- `gigs_completed` (integer): Count of confirmed/paid errands
- `billing_attempts` (integer): Failed billing attempt counter
- `last_billing_error` (text): Error message from last failed attempt
- `created_at` (timestamptz): When subscription was created

#### transactions
Tracks all financial transactions:
- `type` can now be: 'deposit', 'withdrawal', 'errand_payment', 'errand_release', 'refund', 'commission', 'runner_subscription'
- New `posting_fee_type` field distinguishes between 'errand_posting' and 'house_posting'

## Workflow

### Runner Trial & Activation Flow

1. **Registration**: Runner signs up
   - `runner_subscriptions` record created with status='trial', next_billing_at=NULL
   - Week 1 is free

2. **During Trial Week**: Runner accepts and completes errands
   - `gigs_completed` counter increments per confirmed errand
   - Notifications sent when progress is made

3. **Trial End - First Gig Completed** (activation path):
   - When errand moves to 'confirmed' status AND gigs_completed >= 1:
     - `billing_activated = true`
     - `status = 'active'` (if paused)
     - `next_billing_at` set to trial_end_at (or immediate if paused)
     - Runner notified: "Billing activated. Week 1 is free, billing starts from Week 2"

4. **Trial End - No Gigs Completed** (pause path):
   - When trial ends with gigs_completed = 0:
     - `status = 'paused'`
     - `active = false`
     - Runner notified to complete a gig to activate billing

5. **Active Billing**: After trial ends
   - Weekly charge of KES 300 deducted from runner's wallet
   - Transaction type: 'runner_subscription'
   - If insufficient funds: retry with backoff, pause after 3 failures
   - Notifications sent on charge success or failure

### Customer Posting Fee Flow

1. **Post Errand**: Customer posts gig on marketplace
   - Wallet checked: must have at least KES 100
   - KES 100 deducted immediately
   - Transaction created: type='errand_payment', posting_fee_type='errand_posting'

2. **Errand Cancelled/Unassigned**: 
   - Check for original posting fee transaction
   - Create refund transaction with same amount
   - Credit runner's wallet balance
   - Notification sent: "Fee refunded - KES 100"
   - Only happens if refund doesn't already exist (prevents double-refunds)

3. **Errand Completed**:
   - Fee is kept by platform
   - Payment released from escrow to runner (minus 15% commission)

## Payment Processing

### Weekly Billing (charge-runners function)
Triggered: Daily/regularly via cron or manual invocation

For each active runner subscription:
1. Check if next_billing_at is due
2. Get runner's wallet balance
3. Deduct KES 300 weekly fee:
   - Create transaction: type='runner_subscription'
   - Update wallet balance
   - Set next_billing_at to 7 days later
4. On failure:
   - Increment billing_attempts
   - Store error message
   - Pause subscription after 3 failures
   - Notify runner

### Errand Payment Release
When errand status = 'confirmed':
1. Release escrow amount to platform (less 15% commission)
2. Distribute:
   - Runner gets: 85% of total_price
   - Platform keeps: 15% commission
3. Transactions created for audit trail

## API Functions

### Supabase Edge Functions

#### update-errand-status
Enhanced to track first gig completion:
```
POST /functions/v1/update-errand-status
Body: {
  errand_id: string
  new_status: "confirmed" | "cancelled" | "open" | ...
  notes?: string
  dispute_reason?: string
}
```
On 'confirmed' status:
- Fetches runner's subscription
- Increments gigs_completed
- Activates billing if first gig and status='trial'
- Reactivates if status='paused'

#### charge-runners
Processes weekly billing:
```
POST /functions/v1/charge-runners
```
Returns array of billing results per runner

### SQL Functions

#### sync_runner_gigs_completed(runner_id)
Syncs gigs_completed from errands table
Returns: INTEGER (count of confirmed/paid errands)

#### activate_runner_billing_if_needed(runner_id)
Checks and activates billing for runner
Returns: TABLE with subscription_id, activated status, and message

## Frontend Components

### RunnerBillingStatus
Displays runner's current billing status:
- Free trial countdown
- Activation status
- Weekly fee amount
- Gigs completed counter
- Next billing date
- Billing status alerts

Renders different alerts based on status:
- **trial (not activated)**: "Free Trial Active - Complete 1 gig to activate"
- **trial (activated)**: "Trial Ending Soon - Billing starts after..."
- **active**: "Billing Active - KES 300/week"
- **paused**: "Billing Paused - Complete a gig to reactivate"

## Configuration

### Constants
- `ACCESS_FEE = 100` (Customer posting fee in KES)
- `WEEKLY_FEE = 300` (Runner subscription fee in KES)
- `TRIAL_PERIOD = 7 days`
- `PLATFORM_COMMISSION = 0.15` (15%)

### Configurations in charge-runners
- `MAX_ATTEMPTS = 3` (billing retry attempts before pausing)
- Retry backoff: 500ms * attempt_number
- Next billing calculation: 7 * 24 * 60 * 60 * 1000 milliseconds (1 week)

## Error Handling

### Billing Failures
1. First failure: Record attempt, notify runner
2. Second failure: Record attempt, notify runner
3. Third failure: Pause subscription, notify runner to top up wallet

### Refund Failures
- Wrapped in try-catch to prevent disrupting errand status flow
- Logged to console for investigation
- Does not block errand payment release

### Transaction Atomicity
- Individual operations wrapped in try-catch
- Wallet balance updates checked for valid amounts
- Double-refund prevention via query check

## Testing

### Manual Testing Steps

1. **Setup**:
   ```sql
   -- Create test runner and subscription
   INSERT INTO runner_subscriptions (runner_id, status, trial_end_at)
   VALUES (uuid, 'trial', now() + interval '7 days');
   ```

2. **Test Trial Period**:
   - Create test errand, assign to runner
   - Move errand to 'confirmed' status
   - Check runner_subscriptions: billing_activated should be true

3. **Test Posting Fee**:
   - Post errand as customer
   - Check wallet balance reduced by KES 100
   - Check transactions table for 'errand_payment' type

4. **Test Fee Refund**:
   - Post errand as customer (balance drops KES 100)
   - Cancel errand
   - Check wallet balance increased by KES 100
   - Check refund transaction created

5. **Test Weekly Billing**:
   - Manually call charge-runners function
   - Check transactions for 'runner_subscription' type
   - Verify wallet balance reduced by KES 300
   - Check next_billing_at updated to 7 days later

## Monitoring

### Key Metrics
- runner_subscriptions.status distribution
- billing_attempts per runner
- Transaction success rates
- Average trial completion rate
- Revenue tracking (commissions + subscription fees)

### Alerts
- Set up monitoring on billing failures
- Track paused subscriptions
- Monitor refund rates
- Check for failed transactions

## Future Enhancements

1. **Flexible Pricing**: Support different subscription tiers
2. **Annual Billing**: Offer discounts for yearly subscriptions
3. **Payment Methods**: Direct M-Pesa integration with auto-pay
4. **Dispute Resolution**: Enhanced refund policies
5. **Analytics Dashboard**: Runner earnings and platform metrics
6. **Promotional Codes**: Support discount coupons for first month
7. **Billing History**: Detailed invoice generation per runner
