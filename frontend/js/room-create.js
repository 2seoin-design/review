const createForm = document.getElementById('create-form');
const createResult = document.getElementById('create-result');
const createError = document.getElementById('create-error');

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  createError.hidden = true;
  const name = document.getElementById('room-name').value.trim();
  const capacity = Number(document.getElementById('room-capacity').value);
  const submitBtn = createForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const { code } = await apiFetch('/rooms', { method: 'POST', body: { name, capacity } });
    document.getElementById('room-code').textContent = code;
    document.getElementById('go-join').href = `room-join.html?code=${code}`;
    createForm.hidden = true;
    createResult.hidden = false;
  } catch (err) {
    createError.textContent = err.message;
    createError.hidden = false;
    submitBtn.disabled = false;
  }
});
