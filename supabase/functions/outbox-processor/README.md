# Outbox Processor (Edge Function)

Processes `public.email_outbox` and `public.sms_outbox` queues:
- Sends email via Resend
- Sends SMS via Twilio
- Marks rows as `sent` (with `sent_at`) or `failed` (with `error`)
- Idempotent-ish claiming using an intermediate `processing` state to avoid duplicates under concurrency

## Environment variables (Secrets)
Set these in the Edge Function secrets:

Required for database:
- `PROJECT_URL` (or `SUPABASE_URL`)
- `SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)

Email (Resend):
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (e.g. `QLDA <no-reply@yourdomain.com>`)

SMS (Twilio):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (e.g. `+12025550123`)

## Deploy & Run
- Deploy as an Edge Function folder: `supabase/functions/outbox-processor`
- Invoke via HTTP: `POST/GET /functions/v1/outbox-processor`
  - Optional query params: `limit=50`, `emails=1|0`, `sms=1|0`

## Scheduling
Use the Supabase Scheduler to run every 1-5 minutes, e.g. cron `*/5 * * * *`.

## Notes
- The SQL in `setup-0830-reminders.sql` enqueues outbox rows only for overdue reminders when users opted in.
- This function uses the shared helpers in `_shared/notifiers.ts` for sending.
- Status lifecycle: `pending` -> `processing` (claimed) -> `sent` or `failed`.
