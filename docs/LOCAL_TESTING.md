# Local Testing Guide - Billing System

## 🧪 Testing on Your Local Machine

### Option 1: Supabase Local Development (Recommended)

#### Prerequisites
```bash
# Install Docker (required for local Supabase)
# Download from https://www.docker.com/products/docker-desktop

# Install Supabase CLI
npm install -g supabase
# or
bun install -g supabase

# Verify installation
supabase --version
```

#### Step 1: Start Local Supabase

```bash
cd c:\Users\Admin\Downloads\tumaapp

# Start local Supabase instance
supabase start

# This will:
# - Start PostgreSQL database
# - Start Supabase Studio (UI at http://localhost:54323)
# - Start Auth service
# - Create local environment
```

**First time output will show:**
```
API URL: http://localhost:54321
Database URL: postgresql://postgres:postgres@localhost:5432/postgres
Anon Key: eyJ...
Service Key: eyJ...
```

Save these! You'll use them for local testing.

#### Step 2: Apply Migrations Locally

```bash
# Method A: Using Supabase CLI
supabase migration up

# Method B: Connect to local database and run SQL manually
# Copy-paste migration files into Supabase Studio SQL Editor
# http://localhost:54323 → SQL Editor

# Verify migrations applied
supabase db push
```

#### Step 3: Test Migrations

```sql
-- Open: http://localhost:54323 → SQL Editor

-- Check new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'runner_subscriptions'
AND column_name IN ('billing_activated', 'gigs_completed');

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'activate_runner%';

-- Expected: Should show the new columns and functions
```

#### Step 4: Setup Local Environment

```bash
# Create .env.local file in project root
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...  # Replace with local key from Step 1
EOF

# Or edit your existing .env file with local values
```

#### Step 5: Start Frontend Dev Server

```bash
# In another terminal
npm run dev
# or
bun run dev

# Open: http://localhost:5173
```

#### Step 6: Create Test Data

```sql
-- In Supabase Studio (http://localhost:54323/sql)

-- 1. Create test runner (if not exists)
INSERT INTO profiles (id, email, full_name, user_type, verification_status)
SELECT 
  gen_random_uuid(),
  'test-runner@local.test',
  'Test Runner',
  'runner',
  'verified'
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE email = 'test-runner@local.test'
);

-- 2. Create runner subscription (trial)
INSERT INTO runner_subscriptions (runner_id, status, trial_end_at, started_at)
SELECT id, 'trial', now() + interval '7 days', now()
FROM profiles 
WHERE email = 'test-runner@local.test'
LIMIT 1;

-- 3. Get the runner ID for using in tests
SELECT id FROM profiles WHERE email = 'test-runner@local.test';
```

---

### Option 2: Staging/Development Supabase Project

If you don't want to use local Docker:

```bash
# Use your existing Supabase project as staging

# 1. Create branch from main project
# Go to: https://app.supabase.com → branching → new branch

# 2. Apply migrations to branch
supabase db push --linked

# 3. Test in branch
# Doesn't affect production

# 4. Delete branch after testing
# Go back to main after verification
```

---

## 🧪 Test Scenarios

### Test 1: Trial Period Activation

**Setup:**
```sql
-- Get test runner ID
SELECT id FROM profiles WHERE email = 'test-runner@local.test';
-- Copy the ID, use as RUNNER_ID below
```

**Frontend Test:**
```javascript
// 1. Login as test runner
// Go to: http://localhost:5173
// Use test-runner@local.test

// 2. Go to Runner Dashboard
// Should see: "Free Trial Active" card
// Should show: Trial ends in ~7 days
// Should show: Gigs completed: 0
```

**Verify in Database:**
```sql
SELECT 
  status, 
  billing_activated, 
  gigs_completed, 
  trial_end_at
FROM runner_subscriptions 
WHERE runner_id = 'RUNNER_ID';

-- Expected:
-- status: trial
-- billing_activated: false
-- gigs_completed: 0
-- trial_end_at: ~7 days from now
```

### Test 2: First Gig Completion & Activation

**Create Test Errand:**
```sql
-- Create test customer
INSERT INTO profiles (id, email, full_name, user_type)
SELECT 
  gen_random_uuid(),
  'test-customer@local.test',
  'Test Customer',
  'customer'
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE email = 'test-customer@local.test'
);

-- Create test errand
INSERT INTO errands (customer_id, runner_id, title, description, category, location, budget, status)
SELECT 
  c.id, r.id,
  'Test Errand', 
  'This is a test errand for billing system',
  'other',
  'Test Location',
  500,
  'open'
FROM profiles c, profiles r
WHERE c.email = 'test-customer@local.test' 
AND r.email = 'test-runner@local.test';

-- Get errand ID
SELECT id FROM errands WHERE title = 'Test Errand';
```

**Move Errand Through States:**
```bash
# Terminal: Test the update-errand-status function

curl -X POST \
  http://localhost:54321/functions/v1/update-errand-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "errand_id": "ERRAND_ID",
    "new_status": "assigned"
  }'

# Response should indicate: "status updated to assigned"
```

**Confirm Errand (Triggers Billing Activation):**
```bash
curl -X POST \
  http://localhost:54321/functions/v1/update-errand-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "errand_id": "ERRAND_ID",
    "new_status": "confirmed"
  }'

# This should trigger billing activation!
```

**Verify Billing Activated:**
```sql
SELECT 
  status, 
  billing_activated, 
  gigs_completed,
  first_gig_completed_at,
  next_billing_at
FROM runner_subscriptions 
WHERE runner_id = 'RUNNER_ID';

-- Expected after confirmation:
-- status: trial (stays trial until trial_end_at)
-- billing_activated: true ← CHANGED!
-- gigs_completed: 1 ← CHANGED!
-- first_gig_completed_at: now() ← SET!
-- next_billing_at: trial_end_at ← SET!
```

**Check Frontend:**
- Login as runner
- Go to Dashboard
- Should now see: "Trial Ending Soon" message
- Should show: "Gigs completed: 1"
- Should show: next billing date

### Test 3: Posting Fee (Customer)

**Database Setup:**
```sql
-- Create wallet for test customer if needed
INSERT INTO wallets (user_id, balance)
SELECT id, 1000
FROM profiles 
WHERE email = 'test-customer@local.test'
ON CONFLICT DO NOTHING;
```

**Frontend Test:**
```javascript
// 1. Login as test customer
// 2. Go to: Post Errand page
// 3. Fill form and submit
// 4. Should see: "KES 100 posting fee"

// 5. Check wallet
// Go to: Wallet page
// Balance should decrease by 100
```

**Verify in Database:**
```sql
-- Check wallet balance
SELECT balance FROM wallets 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'test-customer@local.test');

-- Should be: 900 (1000 - 100)

-- Check transaction
SELECT * FROM transactions 
WHERE type = 'errand_payment'
AND created_at > now() - interval '1 minute'
ORDER BY created_at DESC;

-- Should show: amount=100, type='errand_payment'
```

### Test 4: Fee Refund (Cancel Errand)

**Prerequisite:**
- Customer posted errand (Test 3 completed)
- Wallet balance: 900

**Cancel Errand:**
```bash
curl -X POST \
  http://localhost:54321/functions/v1/update-errand-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "errand_id": "ERRAND_ID",
    "new_status": "cancelled"
  }'
```

**Verify Refund:**
```sql
-- Check wallet
SELECT balance FROM wallets 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'test-customer@local.test');

-- Should be: 1000 (900 + 100 refund)

-- Check refund transaction
SELECT * FROM transactions 
WHERE type = 'refund'
AND created_at > now() - interval '1 minute';

-- Should show: amount=100, type='refund'
```

**Check Frontend:**
- Customer should see notification: "KES 100 Refunded"
- Balance should show: 1000

### Test 5: Weekly Billing

**Setup:**
```sql
-- Make subscription active and due for billing
UPDATE runner_subscriptions
SET 
  status = 'active',
  next_billing_at = now() - interval '1 minute'
WHERE runner_id = 'RUNNER_ID';

-- Check wallet has sufficient balance
SELECT balance FROM wallets 
WHERE user_id = 'RUNNER_ID';

-- Should be >= 300
-- If not, add funds:
UPDATE wallets
SET balance = 500
WHERE user_id = 'RUNNER_ID';
```

**Trigger Billing Function:**
```bash
# Call charge-runners function
curl -X POST \
  http://localhost:54321/functions/v1/charge-runners \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response should show billing results
```

**Verify Billing:**
```sql
-- Check wallet balance reduced
SELECT balance FROM wallets 
WHERE user_id = 'RUNNER_ID';

-- Should be: 200 (500 - 300)

-- Check transaction created
SELECT * FROM transactions 
WHERE type = 'runner_subscription'
AND created_at > now() - interval '1 minute';

-- Should show: amount=300, type='runner_subscription'

-- Check next billing scheduled
SELECT next_billing_at FROM runner_subscriptions 
WHERE runner_id = 'RUNNER_ID';

-- Should be: ~7 days from now
```

**Check Runner Notification:**
- Login as runner
- Should see notification: "Subscription Charged - KES 300"

### Test 6: Failed Billing (Insufficient Funds)

**Setup:**
```sql
-- Set balance to less than 300
UPDATE wallets
SET balance = 100
WHERE user_id = 'RUNNER_ID';

-- Set next_billing_at to now
UPDATE runner_subscriptions
SET next_billing_at = now() - interval '1 minute'
WHERE runner_id = 'RUNNER_ID';
```

**Trigger Billing:**
```bash
curl -X POST \
  http://localhost:54321/functions/v1/charge-runners \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Verify Retry Logic:**
```sql
-- Check billing_attempts counter
SELECT 
  billing_attempts,
  last_billing_error
FROM runner_subscriptions 
WHERE runner_id = 'RUNNER_ID';

-- Should show: billing_attempts = 1, last_billing_error = 'insufficient_funds'

-- Wallet should be unchanged (100)
SELECT balance FROM wallets 
WHERE user_id = 'RUNNER_ID';
```

**Check Notification:**
- Runner should see: "Low Wallet Balance"

**Call Again (2nd attempt):**
```bash
# Same curl command - will increment to attempt 2
curl -X POST http://localhost:54321/functions/v1/charge-runners ...
```

**After 3rd Failed Attempt:**
```sql
-- Check subscription paused
SELECT status FROM runner_subscriptions 
WHERE runner_id = 'RUNNER_ID';

-- Should be: 'paused' (after 3 attempts)
```

---

## 📊 Testing Dashboard

### View All Test Data

```sql
-- Overview of all test data
SELECT 
  p.email,
  p.user_type,
  rs.status,
  rs.billing_activated,
  rs.gigs_completed,
  w.balance,
  w.escrow_balance
FROM profiles p
LEFT JOIN runner_subscriptions rs ON rs.runner_id = p.id
LEFT JOIN wallets w ON w.user_id = p.id
WHERE p.email LIKE '%local.test%'
ORDER BY p.created_at;
```

### View All Transactions

```sql
-- Recent transactions
SELECT 
  type,
  amount,
  status,
  description,
  created_at
FROM transactions
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

### View All Notifications

```sql
-- Recent notifications
SELECT 
  type,
  title,
  message,
  created_at
FROM notifications
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

---

## 🐛 Debugging Tips

### Check Function Logs

```bash
# View Supabase function logs
supabase functions list
supabase functions download update-errand-status

# Or check in dashboard: http://localhost:54323 → Functions
```

### Test Function Directly

```bash
# Test update-errand-status function
curl -X POST \
  http://localhost:54321/functions/v1/update-errand-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "errand_id": "test-id",
    "new_status": "confirmed"
  }' \
  -v

# -v shows detailed response including errors
```

### Check Database Directly

```bash
# Connect to local database
psql postgresql://postgres:postgres@localhost:5432/postgres

# Run queries to verify data
SELECT * FROM runner_subscriptions;
SELECT * FROM transactions;

# Exit
\q
```

### Frontend Console Errors

```javascript
// Open browser console (F12)
// Check for any JavaScript errors
// Supabase auth errors
// Component render issues

// If component won't load:
// Check RunnerBillingStatus import in RunnerDashboard.tsx
// Verify path: src/components/runner/RunnerBillingStatus.tsx
```

---

## ✅ Complete Local Testing Checklist

- [ ] Docker installed and running
- [ ] Supabase CLI installed
- [ ] `supabase start` completed
- [ ] All 4 migrations applied
- [ ] Test data created (runner, customer, wallets)
- [ ] Test 1: Trial countdown displays ✓
- [ ] Test 2: First gig activates billing ✓
- [ ] Test 3: Posting fee deducts ✓
- [ ] Test 4: Fee refund works ✓
- [ ] Test 5: Weekly billing charges ✓
- [ ] Test 6: Failed billing pauses ✓
- [ ] All notifications sent correctly ✓
- [ ] Frontend component renders ✓
- [ ] Real-time updates working ✓
- [ ] No console errors ✓

---

## 🧼 Cleanup After Testing

```bash
# Stop local Supabase
supabase stop

# Or delete and reset
supabase stop --remove-all

# Next time just run: supabase start
```

---

## 📚 Troubleshooting Local Setup

**Error: Docker not running**
→ Start Docker Desktop

**Error: Port already in use**
→ `supabase stop`, then `supabase start --reset`

**Error: Migration fails**
→ Check migration files exist in: supabase/migrations/
→ Run: `supabase db reset`

**Error: Function not found**
→ Check: supabase/functions/ exists
→ Run: `supabase functions deploy`

**Error: Can't connect to database**
→ `supabase status` to check connection
→ Restart: `supabase stop && supabase start`

**Component not showing**
→ Check import path in RunnerDashboard.tsx
→ Check file exists: src/components/runner/RunnerBillingStatus.tsx
→ Restart dev server: `npm run dev`

---

## 🎓 Learning Path

1. **Start Supabase locally** (5 min)
2. **Apply migrations** (2 min)
3. **Run Test 1-4** (15 min)
4. **Test production flow** (20 min)
5. **Check dashboard UI** (10 min)
6. **Review logs & errors** (5 min)
7. **Ready to deploy!** ✅

Total local testing time: ~1 hour

---

Need help with any test step? Check the specific Test section above.
