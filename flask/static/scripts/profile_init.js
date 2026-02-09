(function () {
  const AVATAR_SELECTORS = '#profile_btn img, #miniProfileBtn img, .profile-btn img, .mini-profile-btn img';


  function updateAvatars(url) {
    if (!url) return;
    

    const freshUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;


    document.querySelectorAll(AVATAR_SELECTORS).forEach(img => img.src = freshUrl);

    const preview = document.getElementById('avatarPreview');
    if (preview) preview.src = freshUrl;
  }

  window.__setHeaderAvatar = updateAvatars;


  document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/settings/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;

        if (data.avatar_url) {
            updateAvatars(data.avatar_url);
        }

        const nameEl = document.getElementById('ddUserName');
        if (nameEl) {
            nameEl.textContent = data.full_name?.trim() || data.username || 'User';
        }
      })
      .catch(() => { /* Silent fail */ });
  });
})();