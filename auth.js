(function () {
  // FIX 1: Changed to match your actual backend route
  const USER_API = '/api/user';
  const LOGOUT_URL = '/logout';
  const LOGIN_URL = 'login.html';
  const UPDATE_DL_API = '/api/user/driving-license';

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
        width: 260px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px;
        backdrop-filter: blur(8px);
        box-shadow: 0 18px 50px rgba(0,0,0,.55);
        overflow: hidden;
        z-index: 1001;
      }
      .user-dropdown[hidden] { display: none; }

      .user-head { padding: 10px; border-bottom: 1px solid rgba(255,255,255,.1); }
      .user-head .welcome { font-weight: 800; }
      .user-head .welcome .name { font-weight: 900; }
      .user-head .email { opacity: .75; font-size: 12px; margin-top: 2px; }

      .menu-item {
        display: block; width: 100%;
        text-align: left;
        padding: 10px;
        color: #fff;
        text-decoration: none;
        background: transparent;
        border: 0;
        cursor: pointer;
      }
      .menu-item:hover { color: #1db954; }
      .menu-item.logout { color: rgba(255,255,255,.7); }
      .menu-item.logout:hover { color: #fff; }
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

  async function markDrivingLicense() {
    try {
      const res = await fetch(UPDATE_DL_API, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.success;
    } catch (err) {
      console.error("❌ Driving License update failed:", err);
      return false;
    }
  }

  function goToLoginWithRedirect() {
    const current = (location.pathname.split('/').pop() || 'homepage.html');
    console.log("Redirecting to login page with redirect back to:", current);
    const redirect = encodeURIComponent(current);
    window.location.href = `${LOGIN_URL}?redirect=${redirect}`;
  }

  function renderLoggedOut(root) {
    setUserKey({ loggedIn: false, user: null });

    root.innerHTML = `
      <button id="loginBtnIcon" class="icon-btn" type="button" aria-label="Login">👤</button>
      <button id="loginBtnText" class="text-btn" type="button">Login / Register</button>
    `;

    const iconBtn = $('#loginBtnIcon', root);
    const textBtn = $('#loginBtnText', root);

    const applyResponsive = () => {
      const isMobile = window.innerWidth <= 768;
      if (iconBtn) iconBtn.style.display = isMobile ? '' : 'none';
      if (textBtn) textBtn.style.display = isMobile ? 'none' : '';
    };

    iconBtn?.addEventListener('click', goToLoginWithRedirect);
    textBtn?.addEventListener('click', goToLoginWithRedirect);

    applyResponsive();

    if (!window.__vvAuthResizeBound) {
      window.__vvAuthResizeBound = true;
      window.addEventListener('resize', () => {
        const r = document.getElementById('authSection');
        if (!r) return;
        const ib = r.querySelector('#loginBtnIcon');
        const tb = r.querySelector('#loginBtnText');
        if (!ib || !tb) return;
        const isMobile = window.innerWidth <= 768;
        ib.style.display = isMobile ? '' : 'none';
        tb.style.display = isMobile ? 'none' : '';
      });
    }
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
          : `<button id="userBtn" class="avatar-btn" aria-expanded="false" aria-controls="userDropdown" title="${displayName}" type="button">${init}</button>`}
        <div id="userDropdown" class="user-dropdown" hidden>
          <div class="user-head">
            <div class="welcome">Welcome, <span class="name" id="vvUserName"></span></div>
            <div class="email" id="vvUserEmail"></div>
          </div>
          <a class="menu-item" id="smartGarage" href="#">My Smart Garage</a>
          <a class="menu-item" id="wishlistOpen" href="#">Wishlist</a>
          <button class="menu-item" id="myDocsBtn" type="button">My Documents</button>
          <button class="menu-item" id="dlBtn" type="button">${hasDL ? 'View Driving License' : 'Upload Driving License'}</button>
          <button class="menu-item logout" id="logoutBtn" type="button">Logout</button>
        </div>
      </div>
    `;

    $('#vvUserName', root).textContent = displayName;
    $('#vvUserEmail', root).textContent = email;

    const btn = $('#userBtn', root);
    const dd = $('#userDropdown', root);

    const closeDD = () => {
      if (!dd || !btn) return;
      dd.hidden = true;
      if (btn.setAttribute) btn.setAttribute('aria-expanded', 'false');
    };

    const toggleDD = () => {
      if (!dd || !btn) return;
      const open = dd.hidden;
      dd.hidden = !open;
      if (btn.setAttribute) btn.setAttribute('aria-expanded', String(open));
    };

    btn?.addEventListener('click', toggleDD);
    document.addEventListener('click', e => { if (!root.contains(e.target)) closeDD(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDD(); });

    // FIX 2: Use the exact same backend-checking logic as the green button
    $('#smartGarage', root)?.addEventListener('click', async (e) => {
      e.preventDefault();
      closeDD();
      try {
        const res = await fetch('/garage-entry', { method: 'GET', credentials: 'include' });
        const data = await res.json();
        if (data.status === 'NO_CAR') window.location.href = '/explore-smart-garage-beta/garagesearch.html';
        else if (data.status === 'HAS_CAR') window.location.href = '/explore-smart-garage-beta/garageview.html';
        else window.location.href = '/login.html';
      } catch (err) {
        window.location.href = '/login.html';
      }
    });

    $('#wishlistOpen', root)?.addEventListener('click', (e) => {
      e.preventDefault();
      const wrap = document.getElementById('wishlist');
      const wBtn = document.getElementById('wishlistBtn');
      if (wrap && wBtn) {
        wrap.classList.add('open');
        wBtn.setAttribute('aria-expanded', 'true');
        closeDD();
      } else {
        alert('Wishlist is available on pages with the heart icon.');
      }
    });

    $('#myDocsBtn', root)?.addEventListener('click', () => {
      alert('My Documents: coming soon.');
      closeDD();
    });

    const dlBtn = $('#dlBtn', root);
    dlBtn?.addEventListener('click', async () => {
      if (hasDL) {
        alert('Driving License on file (viewer coming soon).');
        closeDD();
      } else {
        const ok = confirm('No driving license uploaded. Mark as uploaded now?');
        if (ok) {
          const success = await markDrivingLicense();
          if (success) {
            localStorage.setItem(`vv_dl_uploaded_${userKey}`, 'true');
            hasDL = true;
            dlBtn.textContent = 'View Driving License';
            alert('Driving License successfully marked.');
          } else {
            alert('Failed to update driving license on server.');
          }
          closeDD();
        }
      }
    });

    $('#logoutBtn', root)?.addEventListener('click', async () => {
      try { await fetch(LOGOUT_URL, { method: 'POST', credentials: 'include' }); } catch {}
      window.location.href = LOGIN_URL;
    });
  }

  async function init() {
    injectAuthCSS();
    const root = document.getElementById('authSection');
    if (!root) return;

    root.innerHTML = `<button class="text-btn" type="button" disabled style="opacity:.7;cursor:default;">Loading…</button>`;

    const data = await fetchUser();
    if (data && data.loggedIn) renderLoggedIn(root, data);
    else renderLoggedOut(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();