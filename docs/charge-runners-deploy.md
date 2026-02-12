Charge Runners - Deployment & Scheduling

Options to run the `charge-runners` function regularly:

1) Supabase Edge Functions (recommended)
   - Deploy the function with `supabase functions deploy charge-runners --project-ref <ref>`.
   - Use Supabase scheduled functions (cron) in the dashboard or `supabase functions schedule create` to run weekly or daily depending on needs. Example cron (run daily at 00:05):

     ```bash
     # Run daily at 00:05 UTC
     supabase functions schedule create charge-runners --cron "5 0 * * *" --project-ref <ref>
     ```

2) External Cron (curl)
   - If you host elsewhere, call the function endpoint with a secure key via curl from your cron runner.
   - Example crontab entry (runs daily at 00:05):

     ```cron
     5 0 * * * curl -X POST -H "Authorization: Bearer $CHARGE_RUNNERS_KEY" https://<your-functions-host>/charge-runners
     ```

3) GitHub Actions scheduled workflow
   - Create a simple workflow that runs on schedule and curls the function endpoint.

Security notes
 - Protect the endpoint with an authentication header or use Supabase's built-in function auth and run via the Supabase scheduler.

Retry & failure handling
 - The function now retries transient failures up to 3 times and records `billing_attempts` and `last_billing_error` in `runner_subscriptions`.
 - After repeated failures the subscription is paused and the runner is notified.
