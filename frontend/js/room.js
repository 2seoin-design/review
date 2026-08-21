const code = getCodeFromQuery();
const session = code ? loadSession(code) : null;
if (!code || !session) {
  location.href = `room-join.html${code ? `?code=${code}` : ''}`;
}
showHeaderCode(code);

const els = {
  title: document.getElementById('room-title'),
  progress: document.getElementById('room-progress'),
  list: document.getElementById('participant-list'),
  goSelect: document.getElementById('go-select'),
  closeBtn: document.getElementById('close-room-btn'),
  deleteBtn: document.getElementById('delete-room-btn'),
  statusMsg: document.getElementById('room-status-msg'),
};

let redirected = false;
let pollTimer = null;

async function refresh() {
  const { room, participants } = await apiFetch(`/rooms/${code}`);
  const isHost = session.joinOrder === 1;

  els.title.textContent = room.name;
  els.progress.textContent = `${participants.length}/${room.capacity}명 참여`;
  els.list.innerHTML = participants
    .map((p) => `<li class="participant-chip">${p.join_order}. ${p.nickname}${p.join_order === 1 ? ' <span class="host-badge">방장</span>' : ''}</li>`)
    .join('');
  els.goSelect.href = `select.html?code=${code}`;

  if (room.status === 'confirmed') {
    if (!redirected) {
      redirected = true;
      showToast(`${room.name} 여행지가 확정됐어요!`);
      clearInterval(pollTimer);
      setTimeout(() => { location.href = `result.html?code=${code}`; }, 1200);
    }
    return;
  }

  if (room.status === 'failed') {
    clearInterval(pollTimer);
    els.goSelect.hidden = true;
    els.closeBtn.hidden = true;
    els.statusMsg.hidden = false;
    els.statusMsg.textContent = isHost
      ? '3번의 재선택에도 겹치는 곳이 없었어요. 방을 정리하고 새로 만들어주세요.'
      : '겹치는 여행지를 찾지 못했어요. 방장이 방을 정리할 때까지 기다려주세요.';
    els.deleteBtn.hidden = !isHost;
    return;
  }

  els.closeBtn.hidden = !isHost;
}

els.closeBtn.addEventListener('click', async () => {
  if (!confirm('지금 바로 마감할까요? 지금까지 제출된 선택만으로 겹치는 곳을 찾아요.')) return;
  els.closeBtn.disabled = true;
  try {
    await apiFetch(`/rooms/${code}/close`, { method: 'POST', body: { participant_id: session.participantId } });
    await refresh();
  } catch (err) {
    showToast(err.message);
  } finally {
    els.closeBtn.disabled = false;
  }
});

els.deleteBtn.addEventListener('click', async () => {
  if (!confirm('방을 삭제할까요? 되돌릴 수 없어요.')) return;
  try {
    await apiFetch(`/rooms/${code}?participant_id=${session.participantId}`, { method: 'DELETE' });
    location.href = 'index.html';
  } catch (err) {
    showToast(err.message);
  }
});

refresh();
pollTimer = setInterval(refresh, 4000);
