const joinForm = document.getElementById('join-form');
const joinCode = document.getElementById('join-code');
const joinNickname = document.getElementById('join-nickname');
const joinError = document.getElementById('join-error');

const prefillCode = getCodeFromQuery();
if (prefillCode) joinCode.value = prefillCode;

joinCode.addEventListener('input', () => {
  joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  joinError.hidden = true;
  const code = joinCode.value.trim();
  const nickname = joinNickname.value.trim();
  const submitBtn = joinForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const { participant } = await apiFetch(`/rooms/${code}/join`, { method: 'POST', body: { nickname } });
    saveSession(code, {
      participantId: participant.id,
      nickname: participant.nickname,
      joinOrder: participant.join_order,
    });
    location.href = `room.html?code=${code}`;
  } catch (err) {
    joinError.textContent = err.message;
    joinError.hidden = false;
    submitBtn.disabled = false;
  }
});
