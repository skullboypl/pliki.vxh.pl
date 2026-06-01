# AGENTS.md - pliki.vxh.pl

## Storage / OPFS / quota (critical)

Large files are received via **WebRTC into OPFS**. Browser limits come from **`navigator.storage.estimate()` only**; never hardcode MB/GB.

**Copy:** Never use em dash (`—`) in user-facing strings. Use comma, period, or colon instead.

Before changing receive logic, storage UI, or quota errors, read:

- `.cursor/skills/browser-storage-quota/SKILL.md`
- `.cursor/skills/browser-storage-quota/reference.md`
- `.cursor/skills/browser-storage-quota/SOURCES.md`

Key code: `lib/opfsStorage.ts`, `lib/cacheQuotaInspect.ts`, `components/ShareApp.tsx`.

## Release version (before push to main)

Footer: `pliki.vxh.pl · v3.1 (2026) · #AAAB`.

- Bump **v3.x (2026)** before every push to `main`: `pnpm release:bump` (updates `lib/appRelease.ts` and `package.json`).
- **#AAAB** is the user short id from the server (`assigned_name`), not a release counter.

## Stack

Next.js, React, Socket.IO (signaling), WebRTC (data channels), OPFS for staging received files.
