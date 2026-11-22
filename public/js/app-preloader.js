(function () {
  const capacitor = window.Capacitor;

  if (!capacitor || typeof capacitor.isNativePlatform !== "function") return;
  if (!capacitor.isNativePlatform()) return;

  try {
    if (sessionStorage.getItem("vv_preloader_seen") === "1") return;
    sessionStorage.setItem("vv_preloader_seen", "1");
  } catch (error) {
    return;
  }

  document.documentElement.classList.add("vv-preloader-pending");

  const style = document.createElement("style");
  style.textContent = `
    html.vv-preloader-pending body > :not(#vv-app-preloader) {
      visibility: hidden !important;
    }

    #vv-app-preloader {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      visibility: visible !important;
      opacity: 1;
      transition: opacity .3s ease;
    }

    #vv-app-preloader .vv-preloader-text {
      color: #fff;
      font-family: Inter, sans-serif !important;
      font-size: 4rem;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity .5s ease, transform .5s ease;
    }
  `;
  document.head.appendChild(style);

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.createElement("div");
    overlay.id = "vv-app-preloader";
    overlay.setAttribute("translate", "no");
    overlay.classList.add("notranslate");
    overlay.innerHTML = '<div class="vv-preloader-text">Hello</div>';
    document.body.prepend(overlay);

    const text = overlay.querySelector(".vv-preloader-text");

    async function play() {
      text.style.opacity = "1";
      text.style.transform = "translateY(0)";

      await wait(1000);

      text.style.opacity = "0";
      await wait(500);
      text.textContent = "Ciao";
      text.style.opacity = "1";

      await wait(1000);

      text.style.opacity = "0";
      await wait(500);
      text.textContent = "VeloValue";
      text.style.opacity = "1";

      await wait(1000);

      const target = document.querySelector("header h1 a");
      if (target) {
        const sourceRect = text.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const dx = targetRect.left + targetRect.width / 2 -
          (sourceRect.left + sourceRect.width / 2);
        const dy = targetRect.top + targetRect.height / 2 -
          (sourceRect.top + sourceRect.height / 2);
        const scale = targetRect.width / sourceRect.width;

        text.style.transition = "transform 1s cubic-bezier(.2,.8,.2,1)";
        text.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;

        await wait(1050);
      }

      overlay.style.opacity = "0";
      await wait(300);

      overlay.remove();
      document.documentElement.classList.remove("vv-preloader-pending");
    }

    window.addEventListener("load", () => {
      setTimeout(play, 200);
    }, { once: true });
  });
})();