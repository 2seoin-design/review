const code = getCodeFromQuery();
if (!code) location.href = 'index.html';
showHeaderCode(code);

async function init() {
  const { room } = await apiFetch(`/rooms/${code}`);
  if (room.status !== 'confirmed') {
    location.href = room.status === 'failed' ? `room.html?code=${code}` : `select.html?code=${code}`;
    return;
  }
  const { regions } = await apiFetch('/regions');
  const region = regions.find((r) => r.code === room.confirmed_region);
  const regionName = region ? region.name : room.confirmed_region;

  document.getElementById('result-title').innerHTML = `<span class="hl">${regionName}</span> 여행지로 확정!`;
  document.getElementById('result-room-name').textContent = room.name;
  document.getElementById('result-route').textContent = region
    ? region.recommended_route
    : '추천 루트 정보를 찾을 수 없어요.';
}

init();
