# Implementation Summary: Errand Runners Billing System

## ✅ What's Been Implemented

### 1. **Database Migrations** (Schema Updates)

#### a. `20260212130000_add_runner_first_gig_tracking.sql`
- Adds `first_gig_completed_at` to track when runner completes their first gig
- Adds `gigs_completed` integer counter (default 0)
- Adds `billing_activated` boolean to flag when billing should start
- Creates index on `billing_activated` for faster queries

#### b. `20260212131000_add_posting_fee_tracking.sql`
- Adds `posting_fee_type` column to transactions
- Can be 'errand_posting' or 'house_posting'
- Creates index for faster lookups of errand posting fees

#### c. `20260212132000_add_runner_subscription_transaction_type.sql`
- Adds new transaction type: 'runner_subscription'
- Used for weekly billing charges to runners

#### d. `20260212133000_add_billing_functions.sql`
- Adds `sync_runner_gigs_completed()` function
- Adds `activate_runner_billing_if_needed()` function
- Both functions help keep billing data in sync

### 2. **Backend Services** (Edge Functions)

#### a. **update-errand-status** (Enhanced)
Enhanced logic added after errand status updates:
- **When status = 'confirmed'**: 
  - Fetches runner's subscription
  - Increments `gigs_completed` counter
  - **If this is 1st gig during trial**: Activates billing
  - **If paused with 1+ gigs**: Reactivates billing
  - Sends notification to runner about billing activation

**Key Changes**:
- Lines ~195-252: New subscription tracking logic
- Uses `billing_activated` flag to prevent duplicating activation
- Handles both trial and paused states

#### b. **charge-runners** (Updated)
Updated transaction type for billing:
- Changed from 'withdrawal' to 'runner_subscription' type
- Better tracking of subscription vs. other withdrawals
- Line ~114: Transaction type updated

### 3. **Frontend Components** (UI)

#### a. **RunnerBillingStatus Component** 
New component: `src/components/runner/RunnerBillingStatus.tsx`
- Displays current subscription status
- Real-time updates via Supabase subscriptions
- Shows different alerts based on status:
  - ✅ **Free Trial Active**: "Week 1 is free! Complete 1 gig to activate billing"
  - ✅ **Trial Ending Soon**: "Billing starts from Week 2"
  - ✅ **Billing Active**: Shows next billing date
  - ⏸️ **Paused**: "Complete a gig to reactivate"
- Shows gigs completed counter
- Shows weekly fee amount

#### b. **RunnerDashboard** (Updated)
- Imports RunnerBillingStatus component
- Displays billing status card at top of dashboard
- Gives runners immediate visibility of their subscription

### 4. **Documentation** (Reference)

#### a. `docs/billing-system.md`
Comprehensive documentation including:
- System overview
- Database schema details
- Complete workflows (trial, activation, billing)
- API function descriptions
- Frontend component details
- Configuration constants
- Testing procedures
- Monitoring recommendations
- Future enhancement ideas

## 📊 System Architecture

```
CUSTOMER SIDE:
├─ Post Errand (KES 100 charged)
│  └─ Transaction: type='errand_payment', posting_fee_type='errand_posting'
├─ Errand Cancelled/Unassigned
│  └─ Refund KES 100 back to wallet
└─ Errand Confirmed
   └─ Payment to Runner (85%) + Commission (15%)

RUNNER SIDE:
├─ Week 1: FREE TRIAL
│  ├─ Must complete ≥1 gig to activate billing
│  └─ Status: 'trial', billing_activated=false until 1st gig confirmed
├─ Week 2+: ACTIVE BILLING
│  ├─ Weekly charge: KES 300
│  ├─ Transaction type: 'runner_subscription'
│  ├─ Retry logic: 3 attempts with backoff
│  └─ Pause if 3 failures (insufficient funds or network)
└─ PAUSED STATE
   └─ Reactivate when: 1+ gig completed
```

## 🔄 Data Flow Examples

### Example 1: Runner Completes First Gig During Trial
```
1. Runner accepts errand (status = 'assigned')
2. Runner starts errand (status = 'in_progress')
3. Runner marks errand done (status = 'completed')
4. Customer confirms (status = 'confirmed')
   ↓
   [update-errand-status triggers]
   ↓
   - Fetches runner_subscriptions for this runner
   - Checks if billing_activated = false
   - If YES: Sets billing_activated = true
   - Sets next_billing_at = trial_end_at
   - Sends notification to runner
   - Increments gigs_completed = 1

5. Runner receives notification:
   "Congratulations! You've completed your first gig. 
    Your weekly subscription (KES 300/week) is now active.
    Week 1 is free, billing starts from Week 2."
```

### Example 2: Weekly Billing Charge
```
1. cron job triggers charge-runners function
2. Queries all subscriptions where:
   - status = 'active'
   - next_billing_at <= now()
   
3. For each subscription:
   - Get runner's wallet
   - Check balance >= 300
   - If YES:
     * Create transaction: type='runner_subscription', amount=300
     * Deduct from wallet balance
     * Update next_billing_at += 7 days
     * Reset billing_attempts = 0
     * Send success notification
   - If NO:
     * Increment billing_attempts
     * Store error: 'insufficient_funds'
     * If billing_attempts >= 3:
       - Set status = 'paused'
       - Set active = false
     * Send notification about failure

4. Returns results array with per-runner status
```

### Example 3: Customer Cancels Errand
```
1. Customer cancels errand (status = 'cancelled')
   ↓
   [update-errand-status triggers]
   ↓
2. Check for refund eligibility:
   - Find original errand_payment transaction
   - Check if refund already exists (prevent double-refund)
   
3. If eligible:
   - Create refund transaction: type='refund', amount=100
   - Credit customer wallet: balance += 100
   - Send notification: "KES 100 refund issued"

4. Customer sees refund in transaction history
```

## 🚀 Deployment Steps

### 1. Apply Database Migrations
```bash
# Option A: Via Supabase CLI
supabase migration up

# Option B: Via Supabase Dashboard
# Go to SQL Editor and run each migration file
```

### 2. Deploy Frontend Changes
```bash
# Build and deploy (Vercel, Netlify, etc.)
npm run build
# or
bun run build
```

### 3. Configure Cron Job
For weekly billing, set up a cron trigger:

**Option A: Vercel Cron (if using Vercel)**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/charge-runners",
    "schedule": "0 0 * * 0"  // Weekly on Sunday midnight
  }]
}
```

**Option B: External Cron Service**
Use EasyCron, AWS EventBridge, or similar:
```
POST https://<your-domain>/functions/v1/charge-runners
Every: Sunday at 00:00 UTC
```

**Option C: Manual Trigger**
Call via admin dashboard button:
```typescript
const { data, error } = await supabase.functions.invoke('charge-runners');
```

### 4. Verify Installation
```bash
# Check migrations applied
SELECT * FROM runner_subscriptions LIMIT 1;

# Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE 'activate_runner%';

# Check new transaction types
SELECT * FROM enum_ranges WHERE enum_name = 'transaction_type';
```

## 📱 User-Facing Features

### For Runners:
1. **Trial Status Indicator**
   - Shows "Free Trial Active" with countdown
   - Shows gigs completed counter
   - Clear activation requirements

2. **Billing Transparency**
   - Displays weekly fee (KES 300)
   - Shows next billing date
   - Clear status transitions

3. **Notifications**
   - "Billing Activated" on first confirmed gig
   - "Billing Paused" if insufficient funds
   - "Subscription Charged" on successful weekly billing

### For Customers:
1. **Posting Fee**
   - Clear indication: "KES 100 posting fee"
   - Deducted at post time (no surprise charges)
   - Refundable if gig cancelled/unassigned

2. **Transaction History**
   - See 'errand_posting' fees
   - See refund transactions with reasons
   - Track all payments clearly

## 🧪 Testing Checklist

- [ ] Database migrations apply successfully
- [ ] Runner can see billing status on dashboard
- [ ] First confirmed gig triggers billing activation
- [ ] Trial period countdown displays correctly
- [ ] Posting fee deducts on errand creation
- [ ] Fee refunds on errand cancellation
- [ ] Weekly billing charges (manual trigger)
- [ ] Insufficient funds handled gracefully
- [ ] Notifications sent at key points
- [ ] Real-time updates via Supabase subscriptions

## 🔧 Configuration Values

Update these in code if needed:
- `ACCESS_FEE = 100` (Customer posting fee)
- `weekly_fee = 300` (Runner subscription)
- `TRIAL_PERIOD = 7 days` (Free week)
- `PLATFORM_COMMISSION = 0.15` (15%)
- `MAX_ATTEMPTS = 3` (Billing retries)

## 📞 Support

### Common Issues & Solutions

**Issue**: Billing activated but runner still in trial status
- **Solution**: Normal - status changes to 'active' only at trial_end_at

**Issue**: Runner's gigs_completed doesn't match actual count
- **Solution**: Run `SELECT public.sync_runner_gigs_completed(runner_id)`

**Issue**: Refund not processing
- **Solution**: Check if refund transaction already exists to prevent duplicates

**Issue**: Weekly billing not running
- **Solution**: Verify cron job is configured and Supabase is accessible

## 📈 Monitoring & Analytics

Key metrics to track:
```sql
-- Trial completion rate
SELECT 
  COUNT(CASE WHEN status = 'active' THEN 1 END) as activated,
  COUNT(*) as total_runners,
  ROUND(COUNT(CASE WHEN status = 'active' THEN 1 END)::numeric / COUNT(*), 2) as activation_rate
FROM runner_subscriptions;

-- Revenue tracking
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as transactions,
  SUM(amount) as total_revenue
FROM transactions
WHERE type = 'runner_subscription'
GROUP BY DATE_TRUNC('week', created_at);

-- Refund rate
SELECT 
  COUNT(CASE WHEN type = 'refund' THEN 1 END) as refunds,
  COUNT(CASE WHEN type = 'errand_payment' THEN 1 END) as fees,
  ROUND(COUNT(CASE WHEN type = 'refund' THEN 1 END)::numeric / COUNT(CASE WHEN type = 'errand_payment' THEN 1 END), 2) as refund_rate
FROM transactions;
```

## ✨ Next Steps

1. Apply all migrations to production database
2. Deploy updated frontend code
3. Test with pilot group of runners
4. Monitor billing metrics
5. Adjust fees/periods based on feedback
6. Implement analytics dashboard
7. Consider future enhancements (tiered pricing, annual plans, etc.)
