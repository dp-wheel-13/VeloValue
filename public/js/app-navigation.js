
(function () {
  const capacitor = window.Capacitor;

  if (!capacitor || typeof capacitor.isNativePlatform !== "function") return;
  if (!capacitor.isNativePlatform()) return;

  document.querySelectorAll("header h1 a").forEach((logo) => {
    logo.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  const style = document.createElement("style");

  style.textContent = `
    .hamburger, #hamburgerMenu, .menu-overlay { display: none !important; }

    #vv-app-nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999;
      height: calc(67px + env(safe-area-inset-bottom));
      padding: 0 8px env(safe-area-inset-bottom);
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: #050505;
      border-top: 1px solid #171717;
      font-family: Inter, sans-serif;
    }

    #vv-app-nav a {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #d0d0d0;
      text-decoration: none;
      font-size: 10px;
      font-weight: 500;
      -webkit-tap-highlight-color: transparent;
    }

    #vv-app-nav a.active {
      color: #00e676;
    }

    #vv-app-nav svg {
      width: 21px;
      height: 21px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #vv-app-nav .vv-add {
      flex: 0 0 46px;
      width: 46px;
      height: 46px;
      margin: -19px 5px 0;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: #00e676;
      color: #000;
      font-size: 32px;
      font-weight: 400;
      line-height: 46px;
      text-align: center;
      box-shadow: 0 0 12px rgba(0, 230, 118, 0.15);
      -webkit-tap-highlight-color: transparent;
    }

    #vv-app-actions {
      display: none;
      position: fixed;
      bottom: calc(78px + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      width: 230px;
      z-index: 100000;
      background: #151515;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 8px;
      box-shadow: 0 5px 25px rgba(0,0,0,.5);
    }

    #vv-app-actions.open {
      display: block;
    }

    #vv-app-actions a {
      display: block;
      padding: 14px;
      color: #fff;
      font-size: 14px;
      text-decoration: none;
      border-bottom: 1px solid #292929;
    }

    #vv-app-actions a:last-child {
      border-bottom: none;
    }

    body {
      padding-bottom: calc(76px + env(safe-area-inset-bottom)) !important;
    }
  `;

  document.head.appendChild(style);

  const currentPath = window.location.pathname.toLowerCase();

  const nav = document.createElement("nav");
  nav.id = "vv-app-nav";
  nav.setAttribute("translate", "no");
  nav.classList.add("notranslate");
  nav.innerHTML = `
    <a href="/explore-new-cars-beta/explorenewcars.html" data-page="explore">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"/>
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>
      </svg>
      <span>Explore</span>
    </a>

    <a href="/explore-smart-garage-beta/smartgarage.html" data-page="garage">
      <svg viewBox="0 0 24 24">
        <path d="m3 13 2-6h14l2 6v6h-2v-2H5v2H3z"/>
        <path d="M5 13h14"/>
      </svg>
      <span>Smart Garage</span>
    </a>

    <button class="vv-add" id="vv-app-add" aria-label="More options">+</button>

    <a href="/velocharge-beta/velocharge.html" data-page="charge">
      <svg viewBox="0 0 24 24">
        <path d="m13 2-9 12h7l-1 8 10-13h-7z"/>
      </svg>
      <span>VeloCharge</span>
    </a>

    <a href="/settings.html" data-page="profile">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
      <span>Profile</span>
    </a>
  `;

  const actions = document.createElement("div");
  actions.id = "vv-app-actions";
  actions.setAttribute("translate", "no");
  actions.classList.add("notranslate");
  actions.innerHTML = `
    <a href="/smartreminders.html">Smart Reminders</a>
    <a href="/smartsearch.html">Smart Search</a>
  `;

  document.body.appendChild(nav);
  document.body.appendChild(actions);

  let activePage = "explore";

  if (currentPath.includes("smartgarage") ||
      currentPath.includes("garage")) {
    activePage = "garage";
  } else if (currentPath.includes("velocharge")) {
    activePage = "charge";
  } else if (currentPath.includes("settings")) {
    activePage = "profile";
  }

  const activeLink = nav.querySelector(
    `[data-page="${activePage}"]`
  );

  if (activeLink) activeLink.classList.add("active");

  const addButton = document.getElementById("vv-app-add");

  addButton.addEventListener("click", () => {
    actions.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!actions.contains(event.target) &&
        !addButton.contains(event.target)) {
      actions.classList.remove("open");
    }
  });
})();
