document.addEventListener('DOMContentLoaded', () => {
  const toast      = document.getElementById('toast');
  const toastText  = document.getElementById('toastText');
  const toastClose = document.getElementById('toastClose');

  const showToast = (msg, kind='success') => {
    toastText.textContent = msg;
    toast.classList.remove('toast-hidden', 'toast-success', 'toast-error');
    toast.classList.add(kind === 'success' ? 'toast-success' : 'toast-error');

    const t = setTimeout(() => toast.classList.add('toast-hidden'), 3000);
    toastClose.onclick = () => { clearTimeout(t); toast.classList.add('toast-hidden'); };
  };

  const apiFetch = (url, options = {}) =>
    fetch(url, { credentials: 'include', ...options });

  function setHeaderAvatars(url) {
    if (!url) return;
    const fresh = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const selectors = ['#profile_btn img', '#miniProfileBtn img', '.profile-btn img'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(img => { img.src = fresh; });
    });
    const preview = document.getElementById('avatarPreview');
    if (preview) preview.src = fresh;
  }
  const setAvatar = (url) => setHeaderAvatars(url);

  const avatarForm    = document.getElementById('avatarForm');
  const avatarInput   = document.getElementById('avatar');
  const fileNameEl    = document.getElementById('fileName');
  const avatarPreview = document.getElementById('avatarPreview');

  avatarInput?.addEventListener('change', () => {
    const f = avatarInput.files[0];
    if (!f) { if (fileNameEl) fileNameEl.textContent = 'No file chosen'; return; }
    if (fileNameEl) fileNameEl.textContent = f.name;

    const isImage = /^image\/(png|jpeg)$/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name);
    if (!isImage || f.size > 2 * 1024 * 1024) {
      showToast('Invalid image (PNG/JPG ≤ 2MB).', 'error');
      avatarInput.value = '';
      if (fileNameEl) fileNameEl.textContent = 'No file chosen';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => (avatarPreview.src = e.target.result);
    reader.readAsDataURL(f);
  });

  avatarForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = avatarInput.files[0];
    if (!f) { showToast('Choose an image first.', 'error'); return; }
    const fd = new FormData();
    fd.append('avatar', f);

    try {
      const resp = await apiFetch('/api/settings/avatar/', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      if (data.avatar_url) setAvatar(data.avatar_url);
      avatarInput.value = '';
      if (fileNameEl) fileNameEl.textContent = 'No file chosen';
      showToast('Profile picture updated.');
    } catch (err) {
      console.error(err);
      showToast('Upload failed.', 'error');
    }
  });

  const profileForm = document.getElementById('profileForm');

  profileForm?.addEventListener('submit', async e => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email    = document.getElementById('email').value.trim();
    const fullName = document.getElementById('full_name').value.trim();

    const payload = {};
    if (username) payload.username = username;
    if (email)    payload.email    = email;
    payload.full_name = fullName;

    try {
      const resp = await apiFetch('/api/settings/me/', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.error || 'Update failed');
      }

      showToast('Profile saved successfully.');

      const headerName = document.getElementById('ddUserName');
      if (headerName) {
          headerName.textContent = fullName || username;
      }

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  });

  const passwordForm = document.getElementById('passwordForm');

  passwordForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const current = document.getElementById('current_password').value;
    const newPwd  = document.getElementById('new_password').value;
    const conf    = document.getElementById('confirm_password').value;

    if (newPwd && newPwd.length < 6) {
      showToast('Password too short (min 6 chars).', 'error');
      return;
    }
    if (newPwd !== conf) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    try {
      const resp = await apiFetch('/api/settings/password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            current_password: current,
            new_password: newPwd
        })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Password update failed');
      }

      showToast('Password updated successfully.');
      passwordForm.reset();

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  });

  const delBtn = document.getElementById('deleteAccount');

  delBtn?.addEventListener('click', async () => {
    const confirmed = confirm(
        'Are you sure?\n\n' +
        'Your account will be scheduled for permanent deletion in 28 days.\n' +
        'You can cancel this anytime by contacting support before the deadline.'
    );

    if (!confirmed) return;

    try {
      const resp = await apiFetch('/api/settings/delete-account/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
      });

      if (resp.ok) {
          showToast('Account scheduled for deletion.');

          setTimeout(() => {
              window.location.href = "/dashboard";
          }, 500);

      } else {
          throw new Error('Server error');
      }
    } catch (err) {
      console.error(err);
      showToast('Request failed. Try again later.', 'error');
    }
  });

  apiFetch('/api/settings/me/')
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if (data) {
        if (data.avatar_url) setAvatar(data.avatar_url);

        const u = document.getElementById('username');
        const e = document.getElementById('email');
        const f = document.getElementById('full_name');

        if (u && !u.value) u.value = data.username || '';
        if (e && !e.value) e.value = data.email || '';
        if (f && !f.value && data.full_name) f.value = data.full_name;


        if (data.deletion_pending && delBtn) {
            delBtn.disabled = true;
            delBtn.innerText = `Deletion Pending (${data.days_left} days left)`;
            delBtn.style.background = "#FEF2F2";
            delBtn.style.color = "#991B1B";
            delBtn.style.borderColor = "#FCA5A5";
            delBtn.style.cursor = "default";
        }
    }
  })
  .catch(() => {});
});