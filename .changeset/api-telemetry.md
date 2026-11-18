---
"@siebix/create-effect": minor
---

The API Worker of a new project now provides `Cloudflare.Telemetry()`: deployed stages get Workers Logs and Traces in the Cloudflare dashboard, with Effect spans in each request's trace. The Worker pins compatibility date `2026-08-25`, which native tracing needs.
