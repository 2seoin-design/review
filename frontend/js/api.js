// 공용 fetch 래퍼 + 세션(localStorage) 헬퍼 + 토스트

async function apiFetch(path, options = {}) {
  const res = await fetch(`${window.MATCHIP_CONFIG.API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || '요청 중 문제가 생겼어요.');
  }
  return data;
}

function sessionKey(code) {
  return `matchip:${code.toUpperCase()}`;
}

function saveSession(code, session) {
  localStorage.setItem(sessionKey(code), JSON.stringify(session));
}

function loadSession(code) {
  const raw = localStorage.getItem(sessionKey(code));
  return raw ? JSON.parse(raw) : null;
}

function getCodeFromQuery() {
  return (new URLSearchParams(location.search).get('code') || '').toUpperCase();
}

// 어느 방에 있는지 헷갈리지 않도록 헤더에 방 코드를 표시
function showHeaderCode(code) {
  const el = document.getElementById('header-room-code');
  if (!el) return;
  el.textContent = code;
  el.hidden = false;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
