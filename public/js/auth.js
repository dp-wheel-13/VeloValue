// auth.js
document.addEventListener("DOMContentLoaded", async () => {
  const authSection = document.getElementById("authSection");
  if (!authSection) return; // exit if authSection not found

  try {
    const res = await fetch("/api/user");
    const data = await res.json();

    if (data.loggedIn) {
      // Show logged-in state
      authSection.innerHTML = `
        <span>👋 Hello, <strong>${data.username}</strong></span>
        <button id="logoutBtn">Logout</button>
      `;

      document.getElementById("logoutBtn").addEventListener("click", async () => {
        try {
          await fetch("/logout", { method: "POST" });
          window.location.href = "/login"; // redirect after logout
        } catch (err) {
          console.error("Logout failed:", err);
        }
      });

    } else {
      // Show logged-out state
      authSection.innerHTML = `
        <button id="loginBtn">Login / Register</button>
      `;
      document.getElementById("loginBtn").addEventListener("click", () => {
        window.location.href = "/login";
      });
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    // fallback to logged-out state
    authSection.innerHTML = `
      <button id="loginBtn">Login / Register</button>
    `;
    document.getElementById("loginBtn").addEventListener("click", () => {
      window.location.href = "/login";
    });
  }
});
