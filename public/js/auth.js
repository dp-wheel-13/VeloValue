document.addEventListener('DOMContentLoaded', () => {
  const USER_API = '/api/user';
  const LOGOUT_URL = '/logout';
  const LOGIN_URL = '/login.html';

  const $ = (s, r = document) => r.querySelector(s);

  function injectAuthCSS() {
    if (document.getElementById('vv-auth-css')) return;
    const style = document.createElement('style');
    style.id = 'vv-auth-css';
    style.textContent = `
      .auth-compact { position: relative; }
      .avatar-btn {
        width: 36px; height: 36px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,.25);
        background: transparent; color: #fff;
        display: grid; place-items: center;
        font-weight: 800; cursor: pointer;
      }
      .avatar-btn:hover { border-color: #1db954; }
      .avatar-btn:focus-visible { outline: 2px solid #1db954; outline-offset: 2px; }
      .user-dropdown {
        position: absolute; right: 0; top: calc(100% + 10px);
        width: 260px; background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px; backdrop-filter: blur(8px);
        box-shadow: 0 18px 50px rgba(0,0,0,.55);
        overflow: hidden; z-index: 1001;
      }
      .user-dropdown[hidden] { display: none; }
      .user-head { padding: 10px; border-bottom: 1px solid rgba(255,255,255,.1); }
      .user-head .welcome { font-weight: 800; }
      .user-head .welcome .name { font-weight: 900; }
      .user-head .email { opacity: .75; font-size: 12px; margin-top: 2px; }
      .menu-item {
        display: block; width: 100%; text-align: left;
        padding: 10px; color: #fff; text-decoration: none;
        background: transparent; border: 0; cursor: pointer;
      }
      .menu-item:hover { color: #1db954; }
      .menu-item.logout { color: rgba(255,255,255,.7); }
      .menu-item.logout:hover { color: #fff; }
      .auth-btn {
        background: #fff; color: #111; border: 1px solid #333;
        border-radius: 20px; padding: 6px 12px; font-weight: 600; cursor: pointer;
        transition: all .25s;
      }
      .auth-btn:hover { background: #444; color: #fff; border-color: #1db954; }
    `;
    document.head.appendChild(style);
  }

  function initials(name = '') {
    return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
  }

  function setUserKey(detail) {
    const u = detail?.user || {};
    const key = (u.email || u.id || 'guest').toString().toLowerCase();
    window.__vvUserKey = key;
    window.dispatchEvent(new CustomEvent('vv:user-change', {
      detail: { loggedIn: detail.loggedIn, userKey: key, user: u }
    }));
  }

  async function fetchUser() {
    try {
      const res = await fetch(USER_API, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { loggedIn: false };
    }
  }

  function renderLoggedOut(root) {
    setUserKey({ loggedIn: false, user: null });
    root.innerHTML = `<button id="loginBtn" class="auth-btn">Login / Register</button>`;
    $('#loginBtn')?.addEventListener('click', () => window.location.href = LOGIN_URL);
  }

  function renderLoggedIn(root, data) {
    setUserKey({ loggedIn: true, user: data.user });

    const displayName = data.user.name || data.user.email || 'User';
    const email = data.user.email || '';
    const init = initials(displayName);

    const avatarUrl = data.user.avatar || null;
    const apiHasDL =
      data.user.hasDrivingLicense ||
      (data.user.documents && (data.user.documents.drivingLicense || data.user.documents.licenseUploaded));

    const userKey = window.__vvUserKey || 'guest';
    let localHasDL = false;
    try { localHasDL = JSON.parse(localStorage.getItem(`vv_dl_uploaded_${userKey}`) || 'false'); } catch {}
    let hasDL = Boolean(apiHasDL || localHasDL);

     root.innerHTML = `
    <div class="auth-compact">
      ${avatarUrl
        ? `<img id="userBtn" src="${avatarUrl}" alt="${displayName}" class="avatar-btn" />`
        : `<button id="userBtn" class="avatar-btn" aria-expanded="false" aria-controls="userDropdown" title="${displayName}">${init}</button>`}
      <div id="userDropdown" class="user-dropdown" hidden>
        <div class="user-head">
          <div class="welcome">Welcome, <span class="name" id="vvUserName"></span></div>
          <div class="email" id="vvUserEmail"></div>
        </div>
        <a class="menu-item" id="smartGarage">My Smart Garage</a>
        <a class="menu-item" id="wishlistOpen">Wishlist</a>
        <button class="menu-item" id="myDocsBtn">My Documents</button>
        <button class="menu-item" id="dlBtn">${hasDL ? 'View Driving License' : 'Upload Driving License'}</button>
        <button class="menu-item logout" id="logoutBtn">Logout</button>
      </div>
    </div>
  `;

    $('#vvUserName', root).textContent = displayName;
    $('#vvUserEmail', root).textContent = email;

    const btn = $('#userBtn', root);
    const dd  = $('#userDropdown', root);
    const closeDD = () => { if (dd && btn) { dd.hidden = true; btn.setAttribute('aria-expanded', 'false'); } };
    const toggleDD = () => { if (!dd || !btn) return; const open = dd.hidden; dd.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };

    btn?.addEventListener('click', toggleDD);
    document.addEventListener('click', e => { if (!root.contains(e.target)) closeDD(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDD(); });

    // Actions
    $('#smartGarage', root)?.addEventListener('click', () => location.href = 'garageview.html');
    $('#wishlistOpen', root)?.addEventListener('click', () => {
      const wrap = document.getElementById('wishlist');
      const wBtn = document.getElementById('wishlistBtn');
      if (wrap && wBtn) { wrap.classList.add('open'); wBtn.setAttribute('aria-expanded','true'); closeDD(); }
      else { alert('Wishlist is available on pages with the heart icon.'); }
    });
    $('#myDocsBtn', root)?.addEventListener('click', () => { alert('My Documents: coming soon.'); closeDD(); });
    const dlBtn = $('#dlBtn', root);
    dlBtn?.addEventListener('click', () => {
      if (hasDL) { alert('Driving License on file (viewer coming soon).'); closeDD(); }
      else {
        const ok = confirm('No driving license uploaded. Mark as uploaded for now?');
        if (ok) { localStorage.setItem(`vv_dl_uploaded_${userKey}`, 'true'); hasDL = true; dlBtn.textContent='View Driving License'; closeDD(); alert('Driving License marked as uploaded.'); }
      }
    });

    $('#logoutBtn', root)?.addEventListener('click', async () => {
      try { await fetch(LOGOUT_URL, { method:'POST', credentials:'include' }); } catch {}
      window.location.href = LOGIN_URL;
    });
  }

  async function init() {
    injectAuthCSS();
    const root = document.getElementById('authSection');
    if (!root) return;
    root.innerHTML = `<button class="auth-btn" disabled style="opacity:.7;cursor:default;">Loading…</button>`;
    const data = await fetchUser();
    if (data && data.loggedIn) renderLoggedIn(root, data);
    else renderLoggedOut(root);
  }

  init();
});
