-- Matchip schema (Supabase / Postgres)
-- 대응: PRD.md §3 필수 기능, §6 상세 기능 명세

create extension if not exists pgcrypto;

create table if not exists regions (
  code text primary key,
  name text not null,
  lat numeric not null,
  lng numeric not null,
  recommended_route text not null
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  capacity integer not null check (capacity between 2 and 20),
  status text not null default 'collecting' check (status in ('collecting', 'confirmed', 'failed')),
  round integer not null default 1,
  confirmed_region text,
  confirmed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  nickname text not null,
  join_order integer not null,
  created_at timestamptz not null default now(),
  unique (room_id, nickname),
  unique (room_id, join_order)
);

create table if not exists selections (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  round integer not null,
  region_code text not null references regions(code),
  created_at timestamptz not null default now(),
  unique (participant_id, round, region_code)
);

create index if not exists idx_selections_room_round on selections(room_id, round);

-- 여행지 목록: 광역시/도 단위 12곳 (PRD §6 "10~15곳")
-- recommended_route는 관광공사 TourAPI 연동 전까지의 수동 폴백 데이터 (PRD §3 선택 기능 로드맵)
insert into regions (code, name, lat, lng, recommended_route) values
  ('seoul', '서울', 37.5665, 126.9780, '경복궁 → 광장시장 → 한강공원'),
  ('busan', '부산', 35.1796, 129.0756, '해운대 → 감천문화마을 → 자갈치시장'),
  ('incheon', '인천', 37.4563, 126.7052, '차이나타운 → 송도 센트럴파크 → 을왕리해수욕장'),
  ('gangwon', '강원(강릉·속초)', 37.7519, 128.8761, '경포해변 → 강릉 커피거리 → 속초 중앙시장'),
  ('gyeonggi', '경기(가평·양평)', 37.8315, 127.5095, '남이섬 → 아침고요수목원 → 양평 두물머리'),
  ('daejeon', '대전', 36.3504, 127.3845, '대전 엑스포공원 → 성심당 → 한밭수목원'),
  ('daegu', '대구', 35.8714, 128.6014, '서문시장 → 김광석다시그리기길 → 앞산공원'),
  ('gwangju', '광주', 35.1595, 126.8526, '국립아시아문화전당 → 양림동 역사문화마을 → 무등산'),
  ('ulsan', '울산', 35.5384, 129.3114, '태화강 국가정원 → 대왕암공원 → 간절곶'),
  ('jeonju', '전북(전주)', 35.8242, 127.1480, '전주한옥마을 → 남부시장 야시장 → 오목대'),
  ('gyeongju', '경북(경주)', 35.8562, 129.2247, '불국사 → 첨성대 → 동궁과 월지'),
  ('jeju', '제주', 33.4996, 126.5312, '성산일출봉 → 우도 → 협재해수욕장')
on conflict (code) do nothing;

-- RLS 켜기 (정책은 추가하지 않음): 백엔드(api/index.py)가 항상 SUPABASE_SERVICE_ROLE_KEY로 접속해
-- RLS를 우회하므로, 정책 없이 켜두면 anon/authenticated는 완전 차단되고 서비스는 그대로 동작한다.
alter table regions enable row level security;
alter table rooms enable row level security;
alter table participants enable row level security;
alter table selections enable row level security;
