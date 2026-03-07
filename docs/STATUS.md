# Status

## What This Node Is
YT-Assist is a YouTube helper web app that combines packaging tools with an AI chat experience backed by provider-based API routes.

## Current State
The repository is a runnable full-stack app root with an active planning folder and a Hono server for chat endpoints. The root README now reflects the current combined frontend/API development flow.

## Runtime Snapshot
- Package manager: `npm`
- Main dev command: `npm run dev:all`
- Frontend-only dev command: `npm run dev`
- Server-only dev command: `npm run dev:server`
- Build command: `npm run build`
- Preview command: `npm run preview`
- Proven API server default port: `3000`
- Frontend dev port: not explicitly declared in tracked config

## Blockers
The app depends on AI provider keys for core chat functionality. The frontend dev port is still implicit in tracked config, so the local frontend URL remains Vite-assigned rather than fixed.

## Next Focus
Decide whether the frontend dev server should keep its Vite-assigned port behavior or move to an explicit pinned port for automation-friendly local URLs.

## Drift Check
`server/index.ts` defaults the API server to `http://localhost:3000`, and the root README now matches that runtime contract. `vite.config.ts` still leaves the frontend dev port implicit, so the repo is aligned but remains `legacy` instead of `compliant`.
