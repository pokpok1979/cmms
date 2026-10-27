# Email notifications

Configure and enable SMTP for each company in the existing SMTP settings screen.
Set the sender address, TLS/STARTTLS, credentials and public application URL.
Recipients need valid email addresses in their user accounts.

Run `npm run notifications:worker` as a persistent process alongside the API
(configure restart-on-failure in your service manager). It loads `.env.local`
using Next.js environment loading. For a scheduled task, run
`npm run notifications:worker -- --once` every minute.

The first run saves a persistent activation timestamp in `workerState`.
Only notifications created from that time onward are emailed; historical
notifications are not mailed. The worker checks every 30 seconds, processing
up to 50 records per cycle. It covers the existing in-app notifications for
repair requests, work orders, PM and inventory, using each notification's
existing recipient and company. PM generation still requires the PM worker.

Before sending, current account activity, email validity, role permissions,
company/site access and record assignment are checked using the inbox rules.
Ineligible recipients are marked skipped. The email contains the notification
message and a link to the notifications screen, which requires login.

Each record is claimed atomically for five minutes to coordinate workers.
Successful delivery is marked sent. SMTP/configuration failures retry with
backoff from one minute up to one hour without blocking business transactions.
Inspect `emailStatus`, `emailAttempts`, `emailRetryAt` and `emailFinishedAt` on
`notifications` for delivery state. SMTP acceptance does not guarantee inbox
delivery. If a process stops after SMTP accepts a message but before MongoDB
records success, a retry may duplicate it; each notification uses a stable
Message-ID. Removing an in-app notification before processing cancels its email.

MongoDB connectivity must be restored before the worker can operate.
