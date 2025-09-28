document.getElementById("loadStations").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/stations");  // works if backend is same server
    const data = await res.json();

    const container = document.getElementById("stations");
    container.innerHTML = "";

    data.forEach(station => {
      const div = document.createElement("div");
      div.textContent = `${station.name} - (${station.lat}, ${station.lng})`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error fetching stations:", err);
  }
});
