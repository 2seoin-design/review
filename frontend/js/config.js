window.MATCHIP_CONFIG = {
  // 로컬(정적서버 8899 + uvicorn 8000, 서로 다른 origin)에서는 8000으로 직접,
  // 배포(Vercel, vercel.json이 /api/*를 같은 origin으로 rewrite)에서는 /api로.
  API_BASE: location.hostname === 'localhost' ? 'http://localhost:8000/api' : '/api',
  // 네이버맵 클라이언트 ID. 도메인 화이트리스트로 보호되는 공개 식별자라 커밋해도 안전함
  // (진짜 비밀값은 백엔드의 SUPABASE_SERVICE_ROLE_KEY 쪽).
  NAVER_MAP_CLIENT_ID: 'x5f946i55t',
};
