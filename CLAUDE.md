# CLAUDE.md — newmob

Project facts and rules only; keep it short. Scope lives in `SPEC.md` (create it with `/kickoff` if missing), history and decisions in `DECISIONS.md`. The general standard — kickoff, build standard, security baseline, quality gate, ship-check — comes from the `ghani-standard` plugin (enabled in `.claude/settings.json`), so it is not repeated here.

## What this is
A simple, white storefront. No build step, no dependencies: just Node.

## Stack and commands
- Stack: Node (no framework dependencies)
- Install: `npm install`
- dev: `npm run dev`
- start: `npm run start`
- Env: no `.env.example` yet — add one listing every variable (no values).
- Missing checks: no `typecheck`, `lint`, `test` script yet, so the quality gate can't check those. Add them.

## Project rules
- Never run in production without ADMIN_PASSWORD set: the server falls back to 'admin' without it.
- /api/login has no attempt limit yet: add one before going live.
- Uploads are written to public/uploads on local disk, so this needs a host with a persistent disk (not Vercel).

## Gotchas
- None recorded yet. One line each, with the fix.
