# Billing System Quick Start

## 🚀 Quick Deploy Checklist

### Step 1: Apply Database Migrations
All migration files are in `supabase/migrations/`:

```sql
-- File: 20260212130000_add_runner_first_gig_tracking.sql
-- Adds gigs_completed, first_gig_completed_at, billing_activated columns

-- File: 20260212131000_add_posting_fee_tracking.sql  
-- Adds posting_fee_type field to transactions

-- File: 20260212132000_add_runner_subscription_transaction_type.sql
-- Adds 'runner_subscription' transaction type

-- File: 20260212133000_add_billing_functions.sql
-- Adds sync_runner_gigs_completed() and activate_runner_billing_if_needed() functions
```

**Apply via Supabase Dashboard**:
1. Go to SQL Editor
2. Copy each migration file content
3. Run each one in order
4. Verify no errors

**Or via Supabase CLI**:
```bash
supabase migration up
```

### Step 2: Deploy Frontend Code
Your code changes are in:
- `src/pages/RunnerDashboard.tsx` - Imports the new billing component
- `src/components/runner/RunnerBillingStatus.tsx` - New billing status display component

```bash
# Build
npm run build
# or
bun run build

# Deploy to your hosting
# (Vercel, Netlify, AWS, etc.)
```

### Step 3: Verify Backend Functions Updated
The following functions have been updated:

**`supabase/functions/update-errand-status/index.ts`**
- Enhanced with first gig completion tracking
- Lines ~195-252: New subscription activation logic
- Automatically triggers when errand moves to 'confirmed' status

**`supabase/functions/charge-runners/index.ts`**
- Line ~114: Uses 'runner_subscription' transaction type
- Processes weekly KES 300 charges
- Handles retry logic and pauses on failures

### Step 4: Set Up Weekly Billing Cron

**Option A: Vercel Cron** (Recommended)
```json
// vercel.json or package.json
{
  "crons": [{
    "path": "/api/charge-runners",
    "schedule": "0 0 * * 0"  // Every Sunday at midnight UTC
  }]
}
```

**Option B: AWS EventBridge**
```bash
# Create rule
aws events put-rule --name weekly-billing --schedule-expression "cron(0 0 ? * SUN *)"
aws events put-targets --rule weekly-billing --targets "Id"="1","Arn"="<lambda-arn>","RoleArn"="<role-arn>"
```

**Option C: GitHub Actions**
```yaml
# .github/workflows/billing.yml
name: Weekly Billing
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday
jobs:
  billing:
    runs-on: ubuntu-latest
    steps:
      - name: Charge Runners
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_KEY }}" \
            https://<project>.functions.supabase.co/charge-runners
```

**Option D: Manual Testing**
```bash
# Test the function locally
curl -X POST \
  -H "Authorization: Bearer your_supabase_key" \
  https://your-project.supabase.co/functions/v1/charge-runners
```

## 💰 Pricing Summary

### Runners
```
Week 1:    FREE
Week 2+:   KES 300/week
Activation: Must complete ≥1 gig
```

### Customers  
```
Per gig:   KES 100 (refundable)
Refund:    Automatic if cancelled/unassigned
```

## ✅ Verification Steps

### 1. Database Schema
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'runner_subscriptions'
AND column_name IN ('billing_activated', 'gigs_completed', 'first_gig_completed_at');

-- Check new transaction type
SELECT enum_label FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')
AND enum_label = 'runner_subscription';

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'activate_runner%';
```

### 2. Frontend Components
```bash
# Check component imports
grep -r "RunnerBillingStatus" src/pages/
# Should find: src/pages/RunnerDashboard.tsx

# Check component file exists
ls -la src/components/runner/RunnerBillingStatus.tsx
```

### 3. Test Trial Flow
```sql
-- Create test runner with trial subscription
INSERT INTO runner_subscriptions (runner_id, status, trial_end_at, started_at)
SELECT id, 'trial', now() + interval '7 days', now()
FROM profiles 
WHERE user_type = 'runner'
LIMIT 1;

-- Post test errand as customer
INSERT INTO errands (customer_id, title, description, category, location, budget, status)
VALUES ('customer-id', 'Test', 'Test desc', 'other', 'Test location', 100, 'open');

-- Assign to test runner and confirm
-- Check: billing_activated should become true
SELECT billing_activated, gigs_completed FROM runner_subscriptions 
WHERE runner_id = 'runner-id';
```

### 4. Test Posting Fee
```sql
-- Check wallet before posting
SELECT balance FROM wallets WHERE user_id = 'customer-id';

-- Post errand (frontend or SQL)
-- Check wallet after posting
SELECT balance FROM wallets WHERE user_id = 'customer-id';
-- Should be reduced by 100

-- Check transaction
SELECT * FROM transactions 
WHERE type = 'errand_payment' 
AND created_at > now() - interval '1 minute';
```

## 📊 Key Tables to Monitor

### runner_subscriptions
```sql
SELECT 
  runner_id,
  status,
  billing_activated,
  gigs_completed,
  trial_end_at,
  next_billing_at,
  created_at
FROM runner_subscriptions
ORDER BY created_at DESC;
```

### transactions (Billing)
```sql
SELECT 
  type,
  amount,
  status,
  description,
  created_at
FROM transactions
WHERE type IN ('runner_subscription', 'errand_payment', 'refund')
ORDER BY created_at DESC;
```

### Monitoring
```sql
-- Trial completion rate
SELECT 
  COUNT(CASE WHEN status = 'active' THEN 1 END) as activated,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN status = 'active' THEN 1 END) / COUNT(*), 2) || '%' as rate
FROM runner_subscriptions;

-- Refund rate
SELECT 
  ROUND(100.0 * COUNT(CASE WHEN type = 'refund' THEN 1 END) / 
    COUNT(CASE WHEN type = 'errand_payment' THEN 1 END), 2) || '%' as refund_rate
FROM transactions;

-- Revenue (weekly)
SELECT 
  DATE_TRUNC('week', created_at)::date as week,
  COUNT(*) as charges,
  SUM(amount) as revenue
FROM transactions
WHERE type = 'runner_subscription'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;
```

## 🐛 Troubleshooting

### Issue: "billing_activated not found" error
**Fix**: Apply migration `20260212130000_add_runner_first_gig_tracking.sql`

### Issue: Billing not activating on first gig
**Fix**: Ensure errand status moves to 'confirmed' (not just 'completed')

### Issue: Posting fee showing 0 in wallet
**Fix**: 
1. Check wallet exists: `SELECT * FROM wallets WHERE user_id = 'id'`
2. Check transaction created: `SELECT * FROM transactions WHERE type = 'errand_payment'`
3. Check balance logic in PostErrand.tsx

### Issue: Weekly charging not working
**Fix**:
1. Verify cron job is configured
2. Check function logs in Supabase dashboard
3. Verify wallets have sufficient balance
4. Check next_billing_at is set and in the past

### Issue: Real-time updates not working
**Fix**:
1. Check Realtime is enabled for runner_subscriptions table
2. Verify user has SELECT permission on the table
3. Check browser console for subscription errors

## 📚 Documentation Files

1. **docs/billing-system.md** - Complete system documentation
2. **docs/IMPLEMENTATION_GUIDE.md** - Detailed implementation guide
3. **docs/BILLING_QUICKSTART.md** - This file

## 🎯 Success Criteria

- [ ] All migrations applied successfully
- [ ] Frontend builds without errors
- [ ] runner_subscriptions table has new columns
- [ ] RunnerBillingStatus component displays on dashboard
- [ ] Trial status shows correctly with countdown
- [ ] Posting fee deducts on errand creation
- [ ] First gig completion activates billing
- [ ] Weekly charging executes (test or real)
- [ ] Refunds work when errand cancelled
- [ ] Notifications sent appropriately
- [ ] No console errors or warnings

## 🚀 Go Live Checklist

- [ ] Database migrations tested in staging
- [ ] Frontend code tested with runners
- [ ] Cron job configured and tested
- [ ] Admin dashboard can trigger charge-runners
- [ ] Error handling and monitoring set up
- [ ] Customer support docs prepared
- [ ] Feature flagged/announced to users
- [ ] Revenue tracking SQL queries ready
- [ ] Backup/disaster recovery plan in place
- [ ] Terms of service updated (if needed)

## 📞 Need Help?

Check these files first:
1. `docs/billing-system.md` - System design and architecture
2. `docs/IMPLEMENTATION_GUIDE.md` - Detailed deployment steps
3. Code comments in updated functions
4. Supabase logs and console for errors

Common commands:
```bash
# View function logs
tail -f /var/log/supabase/functions.log

# Test charge-runners manually
supabase functions test charge-runners

# Check database
psql $DATABASE_URL -c "SELECT * FROM runner_subscriptions LIMIT 5;"
```

---

**Last Updated**: February 12, 2026
**Version**: 1.0.0
**Status**: ✅ Ready for deployment
