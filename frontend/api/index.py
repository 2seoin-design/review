"""Matchip API — FastAPI app deployed as a Vercel Serverless Function.

Implements PRD.md §3 필수 기능: 방 생성/입장, 여행지 선택, 겹침 판정 및 자동 확정,
재선택(최대 3회), 방장 강제 마감, 확정 5일 뒤 자동 삭제(cron).

DB는 Supabase(Postgres) — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요하다.
service_role 키로 접속하므로 RLS(정책 없음)를 우회하며, 권한 체크는 이 API 레이어에서만 한다.
"""

import os
import secrets
import string
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

CODE_ALPHABET = string.ascii_uppercase + string.digits
MAX_ROUNDS = 4  # 최초 1회 + 재선택 최대 3회 (PRD §3, §6)
CONFIRMED_TTL_DAYS = 5  # 확정 후 5일 뒤 자동 삭제 (PRD §6 방 생명주기)

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
app = FastAPI()
# vercel.json이 /api/* 를 이 함수 하나로 rewrite하므로 배포에서는 항상 same-origin이라
# 실제로는 안 쓰이지만, `vercel dev` 없이 프론트를 다른 포트로 로컬 실행할 때를 위해 켜둔다.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def generate_room_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def compute_overlap(picks: dict[str, set[str]]) -> str | None:
    """picks: participant_id -> 이번 라운드에 고른 region_code 집합.
    전원이 공통으로 고른 지역이 없으면 None. 여러 곳이 겹치면 가장 많이 뽑힌 곳,
    동률이면 코드 알파벳 순으로 하나를 확정한다.
    """
    if not picks:
        return None
    common = set.intersection(*picks.values())
    if not common:
        return None
    counts = Counter()
    for regions in picks.values():
        for r in regions & common:
            counts[r] += 1
    return sorted(common, key=lambda r: (-counts[r], r))[0]


def _get_room_or_404(code: str) -> dict:
    rows = sb.table("rooms").select("*").eq("code", code.upper()).execute().data
    if not rows:
        raise HTTPException(404, "방을 찾을 수 없어요. 코드를 확인해주세요.")
    return rows[0]


def _require_host(room: dict, participant_id: str) -> None:
    rows = (
        sb.table("participants")
        .select("join_order")
        .eq("id", participant_id)
        .eq("room_id", room["id"])
        .execute()
        .data
    )
    if not rows or rows[0]["join_order"] != 1:
        raise HTTPException(403, "방장만 할 수 있어요.")


def _confirm_room(room: dict, region_code: str) -> dict:
    confirmed_at = datetime.now(timezone.utc)
    updated = (
        sb.table("rooms")
        .update(
            {
                "status": "confirmed",
                "confirmed_region": region_code,
                "confirmed_at": confirmed_at.isoformat(),
                "expires_at": (confirmed_at + timedelta(days=CONFIRMED_TTL_DAYS)).isoformat(),
            }
        )
        .eq("id", room["id"])
        .execute()
    )
    return updated.data[0]


def _round_picks(room: dict) -> dict[str, set[str]]:
    rows = (
        sb.table("selections")
        .select("participant_id, region_code")
        .eq("room_id", room["id"])
        .eq("round", room["round"])
        .execute()
        .data
    )
    picks: dict[str, set[str]] = {}
    for r in rows:
        picks.setdefault(r["participant_id"], set()).add(r["region_code"])
    return picks


class CreateRoomBody(BaseModel):
    name: str
    capacity: int


@app.post("/api/rooms")
def create_room(body: CreateRoomBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "방 이름을 입력해주세요.")
    if not (2 <= body.capacity <= 20):
        raise HTTPException(400, "인원 수는 2~20명 사이여야 해요.")

    code = generate_room_code()
    for _ in range(5):
        if not sb.table("rooms").select("id").eq("code", code).execute().data:
            break
        code = generate_room_code()

    row = sb.table("rooms").insert({"code": code, "name": name, "capacity": body.capacity}).execute()
    return {"code": code, "room": row.data[0]}


class JoinBody(BaseModel):
    nickname: str


@app.post("/api/rooms/{code}/join")
def join_room(code: str, body: JoinBody):
    room = _get_room_or_404(code)
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(400, "닉네임을 입력해주세요.")

    existing = (
        sb.table("participants")
        .select("*")
        .eq("room_id", room["id"])
        .eq("nickname", nickname)
        .execute()
        .data
    )
    if existing:
        return {"participant": existing[0]}

    current_count = (
        sb.table("participants").select("id", count="exact").eq("room_id", room["id"]).execute().count or 0
    )
    if current_count >= room["capacity"]:
        raise HTTPException(409, "이미 정원이 가득 찼어요.")

    row = (
        sb.table("participants")
        .insert({"room_id": room["id"], "nickname": nickname, "join_order": current_count + 1})
        .execute()
    )
    return {"participant": row.data[0]}


@app.get("/api/rooms/{code}")
def get_room(code: str, participant_id: str | None = None):
    room = _get_room_or_404(code)
    participants = (
        sb.table("participants").select("*").eq("room_id", room["id"]).order("join_order").execute().data
    )
    already_submitted = False
    if participant_id:
        rows = (
            sb.table("selections")
            .select("id")
            .eq("participant_id", participant_id)
            .eq("round", room["round"])
            .execute()
            .data
        )
        already_submitted = bool(rows)
    return {"room": room, "participants": participants, "already_submitted": already_submitted}


@app.get("/api/regions")
def list_regions():
    return {"regions": sb.table("regions").select("*").order("name").execute().data}


class SelectionBody(BaseModel):
    participant_id: str
    region_codes: list[str]


@app.post("/api/rooms/{code}/selections")
def submit_selection(code: str, body: SelectionBody):
    room = _get_room_or_404(code)
    if room["status"] != "collecting":
        raise HTTPException(409, "이미 종료된 방이에요.")
    if not body.region_codes:
        raise HTTPException(400, "여행지를 1개 이상 선택해주세요.")

    participant = (
        sb.table("participants")
        .select("id")
        .eq("id", body.participant_id)
        .eq("room_id", room["id"])
        .execute()
        .data
    )
    if not participant:
        raise HTTPException(404, "참여자 정보를 찾을 수 없어요.")

    already = (
        sb.table("selections")
        .select("id")
        .eq("participant_id", body.participant_id)
        .eq("round", room["round"])
        .execute()
        .data
    )
    if already:
        raise HTTPException(409, "이번 라운드에 이미 제출했어요.")

    sb.table("selections").insert(
        [
            {
                "room_id": room["id"],
                "participant_id": body.participant_id,
                "round": room["round"],
                "region_code": r,
            }
            for r in body.region_codes
        ]
    ).execute()

    participant_count = (
        sb.table("participants").select("id", count="exact").eq("room_id", room["id"]).execute().count or 0
    )
    if participant_count < room["capacity"]:
        return {"room": room, "status": "waiting_participants"}

    picks = _round_picks(room)
    if len(picks) < room["capacity"]:
        return {"room": room, "status": "waiting_selections"}

    winner = compute_overlap(picks)
    if winner:
        return {"room": _confirm_room(room, winner), "status": "confirmed"}

    if room["round"] >= MAX_ROUNDS:
        updated = sb.table("rooms").update({"status": "failed"}).eq("id", room["id"]).execute()
        return {"room": updated.data[0], "status": "failed"}

    updated = sb.table("rooms").update({"round": room["round"] + 1}).eq("id", room["id"]).execute()
    return {"room": updated.data[0], "status": "no_overlap_retry"}


class HostActionBody(BaseModel):
    participant_id: str


@app.post("/api/rooms/{code}/close")
def close_room(code: str, body: HostActionBody):
    room = _get_room_or_404(code)
    _require_host(room, body.participant_id)
    if room["status"] != "collecting":
        raise HTTPException(409, "이미 종료된 방이에요.")

    picks = _round_picks(room)
    winner = compute_overlap(picks) if picks else None
    if winner:
        return {"room": _confirm_room(room, winner), "status": "confirmed"}

    updated = sb.table("rooms").update({"status": "failed"}).eq("id", room["id"]).execute()
    return {"room": updated.data[0], "status": "failed"}


@app.delete("/api/rooms/{code}")
def delete_room(code: str, participant_id: str):
    room = _get_room_or_404(code)
    _require_host(room, participant_id)
    sb.table("rooms").delete().eq("id", room["id"]).execute()
    return {"deleted": True}


@app.get("/api/cron/cleanup")
def cleanup_expired_rooms():
    """Vercel Cron이 매일 호출 — 확정 후 5일 지난 방을 삭제한다 (PRD §6)."""
    now = datetime.now(timezone.utc).isoformat()
    result = sb.table("rooms").delete().eq("status", "confirmed").lt("expires_at", now).execute()
    return {"deleted": len(result.data or [])}
