# Verification — 2026-10-22

## Passed
- TypeScript strict typecheck against the Phase 1 + Phase 2 workspace.
- 25 unit tests: 13 prior tests + 12 Phase 3 tests.
- Tests cover paired company/site scope in reports, assigned technician restrictions, closed-job restrictions, literal search escaping, report date bounds, lead-day limits, anchored month end, efficient calendar projection, Bangkok completion date, image signature checks, occurrence version keys, and XLSX ZIP checksums/literal cell strings.
- Independent XLSX verification: Python ZIP CRC check, all XML files parse, openpyxl reads Thai/numeric/literal formula-like cells correctly, header freeze and AutoFilter present. This verifies the writer output, not Microsoft Excel UI behavior.
- Installer tested in a temporary Phase 2 project: known baseline upgrade, backups, idempotent reinstall, auth preserved, and refusal of unrecognized modifications before copying.
- Next.js production build passed with /pm/advanced, /api/pm3 and /api/pm3/photos.

## Not performed / limits
- Browser/device visual and interaction QA was attempted but could not run: no installed browser binary and browser download failed. Desktop/mobile appearance remains a UAT item.
- No live MongoDB Atlas transaction, concurrent-worker, R2 signed URL/upload or Windows Scheduler test was performed in this environment.
- Unit tests do not establish real transaction isolation, storage permissions, or compatibility with the user's locally modified latest source.
- Native Microsoft Excel manual opening remains UAT.

Use UAT_TH.md on a test database and R2 bucket before production. No runtime fake database, fake metrics, test fixture route or user credentials are included in this delivery.
