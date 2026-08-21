const code = getCodeFromQuery();
const session = code ? loadSession(code) : null;
if (!code || !session) {
  location.href = `room-join.html${code ? `?code=${code}` : ''}`;
}
showHeaderCode(code);

const state = {
  regions: [],
  selected: new Set(),
  room: null,
  submittedRound: null,
  polling: null,
};

const els = {
  roundInfo: document.getElementById('round-info'),
  retryBanner: document.getElementById('retry-banner'),
  cards: document.getElementById('region-cards'),
  chips: document.getElementById('selected-chips'),
  submitBtn: document.getElementById('submit-selection'),
  waiting: document.getElementById('waiting-panel'),
  mapEl: document.getElementById('naver-map'),
  mapNote: document.getElementById('map-note'),
};

// 네이버 지도 인포윈도우 버튼(문자열 HTML)에서 호출하기 위해 전역에 노출
window.__selectRegion = toggleRegion;

async function init() {
  const [{ room }, { regions }] = await Promise.all([
    apiFetch(`/rooms/${code}`),
    apiFetch('/regions'),
  ]);
  state.room = room;
  state.regions = regions;

  if (room.status === 'confirmed') { location.href = `result.html?code=${code}`; return; }
  if (room.status === 'failed') { location.href = `room.html?code=${code}`; return; }

  renderRoundInfo();
  renderCards();
  loadNaverMap();
}

function renderRoundInfo() {
  els.roundInfo.textContent = state.room.round > 1
    ? `재선택 ${state.room.round - 1}/3회차`
    : '원하는 여행지를 자유롭게 골라주세요';
}

function toggleRegion(regionCode) {
  if (state.selected.has(regionCode)) state.selected.delete(regionCode);
  else state.selected.add(regionCode);
  renderCards();
}

function renderCards() {
  els.cards.innerHTML = state.regions.map((r) => `
    <li class="region-card ${state.selected.has(r.code) ? 'is-selected' : ''}">
      <button type="button" class="region-card-btn" onclick="window.__selectRegion('${r.code}')">
        <span class="region-name">${r.name}</span>
        <span class="region-route">${r.recommended_route}</span>
      </button>
    </li>
  `).join('');

  els.chips.innerHTML = [...state.selected].map((c) => {
    const r = state.regions.find((x) => x.code === c);
    return `<span class="chip">${r ? r.name : c}</span>`;
  }).join('') || '<span class="chip-empty">아직 고른 곳이 없어요</span>';

  els.submitBtn.disabled = state.selected.size === 0;
}

els.submitBtn.addEventListener('click', async () => {
  els.submitBtn.disabled = true;
  try {
    const res = await apiFetch(`/rooms/${code}/selections`, {
      method: 'POST',
      body: { participant_id: session.participantId, region_codes: [...state.selected] },
    });
    state.submittedRound = state.room.round;
    state.room = res.room;
    handleSubmitResult(res.status);
  } catch (err) {
    showToast(err.message);
    els.submitBtn.disabled = false;
  }
});

function handleSubmitResult(status) {
  if (status === 'confirmed') {
    showToast(`${state.room.name} 여행지가 확정됐어요!`);
    setTimeout(() => { location.href = `result.html?code=${code}`; }, 1000);
    return;
  }
  if (status === 'failed') {
    showToast('겹치는 여행지를 찾지 못했어요.');
    setTimeout(() => { location.href = `room.html?code=${code}`; }, 1000);
    return;
  }
  enterWaiting();
}

function enterWaiting() {
  els.waiting.hidden = false;
  els.submitBtn.hidden = true;
  state.polling = setInterval(pollRoom, 3000);
}

async function pollRoom() {
  const { room } = await apiFetch(`/rooms/${code}`);
  state.room = room;
  if (room.status === 'confirmed') {
    clearInterval(state.polling);
    showToast(`${room.name} 여행지가 확정됐어요!`);
    setTimeout(() => { location.href = `result.html?code=${code}`; }, 1000);
  } else if (room.status === 'failed') {
    clearInterval(state.polling);
    location.href = `room.html?code=${code}`;
  } else if (room.round > state.submittedRound) {
    clearInterval(state.polling);
    state.selected.clear();
    els.waiting.hidden = true;
    els.submitBtn.hidden = false;
    els.retryBanner.hidden = false;
    renderRoundInfo();
    renderCards();
  }
}

function loadNaverMap() {
  const clientId = window.MATCHIP_CONFIG.NAVER_MAP_CLIENT_ID;
  if (!clientId) {
    els.mapEl.parentElement.hidden = true;
    els.mapNote.hidden = false;
    return;
  }
  const script = document.createElement('script');
  script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
  script.onload = renderMap;
  script.onerror = () => {
    els.mapEl.parentElement.hidden = true;
    els.mapNote.hidden = false;
  };
  document.head.appendChild(script);
}

function renderMap() {
  const map = new naver.maps.Map(els.mapEl, {
    center: new naver.maps.LatLng(36.2, 127.9),
    zoom: 7,
  });
  state.regions.forEach((r) => {
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(r.lat, r.lng),
      map,
      title: r.name,
    });
    const infoWindow = new naver.maps.InfoWindow({
      content: `
        <div class="map-popup">
          <strong>${r.name}</strong>
          <p>${r.recommended_route}</p>
          <button type="button" onclick="window.__selectRegion('${r.code}')">이 지역 선택하기</button>
        </div>`,
    });
    naver.maps.Event.addListener(marker, 'click', () => {
      if (infoWindow.getMap()) infoWindow.close();
      else infoWindow.open(map, marker);
    });
  });
}

init();
