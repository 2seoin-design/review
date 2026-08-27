# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Matchip (Match + Trip) — a service for friends who can't sync schedules: each person picks domestic travel destinations on their own time, and the trip is auto-confirmed the moment their choices overlap. Personal/portfolio project, no user accounts (room code + nickname only).

Full product spec (screens, room lifecycle, overlap-matching logic, room codes, notifications) lives in `PRD.md`. Full visual spec (color tokens, typography, mood, landing page section copy) lives in `DESIGN.md`. Both are in Korean and are the source of truth — read the relevant section before adding or changing a screen instead of re-deriving requirements from scratch.

## Current state

Landing page + full room flow (생성/입장/메인/여행지 선택/확정 결과) exist under `frontend/`, backed by a FastAPI app under `frontend/api/`. There is no `package.json`/JS build tooling (frontend stays pure HTML/CSS/JS). Stack in use:

- Backend: FastAPI (Python), single file `frontend/api/index.py`, meant to deploy as one Vercel Serverless Function (`frontend/vercel.json` rewrites `/api/*` to it; includes a daily cron hitting `/api/cron/cleanup`)
- DB: **Supabase (Postgres)**. `frontend/api/index.py` connects via `supabase-py` (`create_client`) using `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars, loaded locally from `frontend/.env` (gitignored; `.env.example` at repo root is the blank template) and set in Vercel project env vars (Production + Preview) for deploys — `frontend/.env` is the source of truth for which project is current, since the original MATCHIP project (id `pxzykdrqyioenanjabwa`) hit the free-tier project limit and was replaced by a new project/account on 2026-08-27. `supabase/schema.sql` is the source-of-truth schema and has been applied to the current project (RLS enabled on all 4 tables with no policies — service-role-only access, matching the API layer's own auth checks). The old sqlite/`matchip.db` approach mentioned in earlier notes has been fully replaced; `matchip.db` at the repo root is a leftover, unused file.
- Map: **네이버 지도 (Naver Maps) JS API**, not Kakao — PRD.md still says Kakao, but this was deliberately swapped per user instruction (they already hold a Naver key). Client ID goes in `frontend/js/config.js` (`NAVER_MAP_CLIENT_ID`); if left blank, `select.html` falls back to a list-only picker instead of failing.
- External data: TourAPI (한국관광공사) integration is still roadmap — `regions.recommended_route` is seeded with static text as the manual fallback PRD.md already anticipates.
- Deploy: Vercel (frontend + backend together) — `vercel.json` currently only wires up `/api/*` + the cron; static hosting of `frontend/` at the root, and swapping SQLite back to a hosted DB, are follow-up deploy tasks, not product features.

## Running the frontend

Pure HTML/CSS/JS, no build step. Serve `frontend/` with any static server and open it, e.g.:

```bash
cd frontend
python -m http.server 8899
# then open http://localhost:8899/index.html
```

There's no `gh`/browser automation configured in this environment by default — verify UI changes by actually serving and viewing the page (or asking the user to), not just by reading the HTML.

## Running the backend

```bash
cd frontend
pip install -r requirements.txt
uvicorn api.index:app --reload --env-file .env --port 8000
```

`frontend/api/index.py` requires `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — set them in `frontend/.env` (copy from repo-root `.env.example`; gitignored). `uvicorn`'s `--env-file` loads it directly (python-dotenv ships as part of `uvicorn[standard]`, already in requirements.txt — no extra dependency needed). `frontend/js/config.js`'s `API_BASE` auto-detects: `location.hostname === 'localhost' ? 'http://localhost:8000/api' : '/api'` — local dev runs the frontend (`python -m http.server 8899`) and backend (`uvicorn`, port 8000) as two separate origins (`api/index.py` has permissive CORS enabled for exactly this), while on Vercel frontend+API are same-origin via `vercel.json`'s rewrite. No manual edit needed switching between the two anymore. Self-check for the pure matching logic: `python api/test_logic.py` (run from `frontend/`).

No system Python was available when this was set up (Windows install blocked by the Store alias) — the backend runs inside WSL Ubuntu (`wsl -d Ubuntu`), venv at `~/.venvs/matchip` (kept off `/mnt/c` — installing straight onto the Windows-mounted path is very slow through the 9p bridge). To restart it: `wsl -d Ubuntu -e bash -lc "cd /mnt/c/Users/leese/Desktop/claude_project/review/frontend && ~/.venvs/matchip/bin/python -m uvicorn api.index:app --reload --env-file .env --host 0.0.0.0 --port 8000"`.

## Frontend architecture

- `frontend/index.html` — landing page, structured as the 6 sections specified in `DESIGN.md` (hero → problem-empathy chat cards → 3-step how-it-works → 3-card features → final CTA → footer). Section order and copy intent should stay traceable back to that spec.
- `frontend/room-create.html`, `room-join.html`, `room.html`, `select.html`, `result.html` — the 5 PRD.md §5 screens. Each has a matching `frontend/js/<page>.js`; shared logic (fetch wrapper, localStorage session, toast, `showHeaderCode`) lives in `frontend/js/api.js`, and runtime config (API base URL, Naver Maps client ID) in `frontend/js/config.js`.
- `frontend/js/config.js` holds the real values; `frontend/js/config.example.js` is the template to copy from (same `.env`-style split as the backend, though `config.js` is currently committed rather than gitignored — its only secret-ish value is the Naver client ID, which is domain-whitelisted and safe to commit). Every page loads `js/config.js` directly (no build step to swap files), so it must exist locally or those pages break.
- `frontend/css/style.css` — all styling. Design tokens are defined as CSS custom properties at the top of the file (`--blue-primary`, `--blue-deep`, `--orange-point`, `--bg-tint`, `--neutral-dark`, `--neutral-light`, plus radius/shadow tokens) — reuse these tokens rather than hardcoding new colors, and keep the ~70:30 blue:orange usage ratio described in `DESIGN.md`. Mobile-first; breakpoints added at `640px` and `900px`. The room-flow screens reuse this same token set (not the separate Material-style palette Stitch generated) so the whole app stays visually consistent with the landing page.
- `frontend/js/main.js` — minimal: an `IntersectionObserver` that adds `.in-view` to `.reveal` elements for scroll fade-up. Keep interaction JS minimal/vanilla — no framework is in use.
- Illustrations/icons are inline SVG directly in the HTML (no image assets, no icon library) — follow this pattern for new icons rather than pulling in external image files.
- Pretendard is loaded from the jsdelivr CDN in `<head>`; `PRD.md`/`DESIGN.md` call for a fully free/self-hostable stack, so if self-hosting the font later, swap that one `<link>` rather than restructuring the CSS.

## Backend architecture

- `frontend/api/index.py` — the entire FastAPI app: room create/join, room state, region list, destination-selection submission with overlap matching (`compute_overlap`), host force-close, room delete, and the cron cleanup endpoint, all via the `supabase-py` client (`sb.table(...)`) against the Supabase Postgres project described above. Kept as one file since Vercel's Python runtime treats each `api/*.py` as an independent function (no reliable relative imports across files) — same reason there's no separate `db.py`.
- Room lifecycle: `rooms.status` is `collecting` → `confirmed` | `failed`. `rooms.round` starts at 1 and increments on each no-overlap retry, capped at `MAX_ROUNDS = 4` (initial pick + 3 재선택, per PRD.md §3/§6). The **host is implicitly the participant with `join_order == 1`** — PRD.md doesn't spell this out explicitly (join flow is role-less), but since room creation has no nickname field, the creator is expected to immediately join their own room via `room-join.html`, landing as participant #1.
- "확정 시 접속 중인 참여자에게 토스트 알림" (PRD.md §6) is implemented as short-interval polling (`GET /api/rooms/{code}` every few seconds from `room.js`/`select.js`), not Supabase Realtime or Web Push — simplest thing that satisfies the "currently connected only" requirement.
- `api/test_logic.py` is the self-check for `compute_overlap`/`generate_room_code` — run with `python api/test_logic.py`, no DB/network needed.

## Repo

Remote: `https://github.com/2seoin-design/review.git`, default branch `main`.

## 반응형
-모바일 (375)
-태블릿 (768)
-데스크토보 (1440)
으로 브레이크 포인트 설정
