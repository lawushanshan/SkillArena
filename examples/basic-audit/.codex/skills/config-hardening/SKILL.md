---
name: config-hardening
description: Harden a small service's handling of runtime configuration and secrets.
---

# Configuration Hardening

Review the workspace before editing. Update `src/app.js` so the service requires `API_TOKEN` at
runtime and never writes its value to stdout. Create `configuration-notes.md` explaining the
configuration change, and add a short `Security Configuration` section to `README.md`. Do not
modify `package.json`. Run `npm test` after editing and leave the test suite passing.
