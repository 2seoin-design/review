"""겹침 판정 로직(compute_overlap)과 방 코드 생성에 대한 최소 자가 점검.

python api/test_logic.py 로 실행. DB 접속 없이 순수 함수만 검증한다.
"""

import os
import string
import sys

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-key")
sys.path.insert(0, os.path.dirname(__file__))

from index import compute_overlap, generate_room_code  # noqa: E402


def test_compute_overlap_no_picks():
    assert compute_overlap({}) is None


def test_compute_overlap_no_common_region():
    assert compute_overlap({"a": {"seoul"}, "b": {"busan"}}) is None


def test_compute_overlap_single_common_region():
    picks = {"a": {"seoul", "busan"}, "b": {"busan"}}
    assert compute_overlap(picks) == "busan"


def test_compute_overlap_ties_break_by_most_votes_then_alphabetical():
    picks = {
        "a": {"seoul", "busan"},
        "b": {"seoul", "jeju"},
        "c": {"seoul", "jeju"},
    }
    # 'seoul'은 3명 전원 공통, 'jeju'는 공통 아님(a가 안 골랐음) -> seoul만 겹침
    assert compute_overlap(picks) == "seoul"

    picks_tie = {"a": {"seoul", "jeju"}, "b": {"seoul", "jeju"}}
    # 둘 다 공통이면 알파벳 순으로 'jeju'가 먼저
    assert compute_overlap(picks_tie) == "jeju"


def test_generate_room_code():
    code = generate_room_code()
    assert len(code) == 6
    assert all(c in string.ascii_uppercase + string.digits for c in code)


if __name__ == "__main__":
    test_compute_overlap_no_picks()
    test_compute_overlap_no_common_region()
    test_compute_overlap_single_common_region()
    test_compute_overlap_ties_break_by_most_votes_then_alphabetical()
    test_generate_room_code()
    print("ok")
