# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Matchip (Match + Trip) — a service for friends who can't sync schedules: each person picks domestic travel destinations on their own time, and the trip is auto-confirmed the moment their choices overlap. Personal/portfolio project, no user accounts (room code + nickname only).

Full product spec (screens, room lifecycle, overlap-matching logic, room codes, notifications) lives in `PRD.md`. Full visual spec (color tokens, typography, mood, landing page section copy) lives in `DESIGN.md`. Both are in Korean and are the source of truth — read the relevant section before adding or changing a screen instead of re-deriving requirements from scratch.

## Current state

Only the static landing page exists so far, under `frontend/`. There is no backend, no `package.json`, no build tooling, and no test suite yet — don't assume any of these exist. The planned stack per `PRD.md` (not yet implemented) is:

- Backend: FastAPI (Python), deployed as Vercel Serverless Functions
- DB: Supabase (PostgreSQL, free tier)
- Map: 카카오맵 (Kakao Map) API for destination markers + recommended routes
- External data: 한국관광공사 Open API (TourAPI) for per-region recommended routes
- Deploy: Vercel (frontend + backend together)

## Running the frontend

Pure HTML/CSS/JS, no build step. Serve `frontend/` with any static server and open it, e.g.:

```bash
cd frontend
python -m http.server 8899
# then open http://localhost:8899/index.html
```

There's no `gh`/browser automation configured in this environment by default — verify UI changes by actually serving and viewing the page (or asking the user to), not just by reading the HTML.

## Frontend architecture

- `frontend/index.html` — single landing page, structured as the 6 sections specified in `DESIGN.md` (hero → problem-empathy chat cards → 3-step how-it-works → 3-card features → final CTA → footer). Section order and copy intent should stay traceable back to that spec.
- `frontend/css/style.css` — all styling. Design tokens are defined as CSS custom properties at the top of the file (`--blue-primary`, `--blue-deep`, `--orange-point`, `--bg-tint`, `--neutral-dark`, `--neutral-light`, plus radius/shadow tokens) — reuse these tokens rather than hardcoding new colors, and keep the ~70:30 blue:orange usage ratio described in `DESIGN.md`. Mobile-first; breakpoints added at `640px` and `900px`.
- `frontend/js/main.js` — minimal: an `IntersectionObserver` that adds `.in-view` to `.reveal` elements for scroll fade-up. Keep interaction JS minimal/vanilla — no framework is in use.
- Illustrations/icons are inline SVG directly in the HTML (no image assets, no icon library) — follow this pattern for new icons rather than pulling in external image files.
- Pretendard is loaded from the jsdelivr CDN in `<head>`; `PRD.md`/`DESIGN.md` call for a fully free/self-hostable stack, so if self-hosting the font later, swap that one `<link>` rather than restructuring the CSS.
- CTA links (`room-create.html`, `room-join.html`) intentionally point to pages that don't exist yet — that's expected until those flows are built, not a bug.

## Repo

Remote: `https://github.com/2seoin-design/review.git`, default branch `main`.

## 반응형
-모바일 (375)
-태블릿 (768)
-데스크토보 (1440)
으로 브레이크 포인트 설정
