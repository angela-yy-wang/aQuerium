//inject aquarium
function createAquarium() {
    const root = document.createElement("div");
    root.id = "aquarium-root";

    root.innerHTML = `
    <div id="tank">
      <div id="water"></div>
    </div>
  `;

    document.body.appendChild(root);
}

createAquarium();

//update the water level
function updateWater(level) {
    const water = document.getElementById("water");
    if (!water) return;

    water.style.height = `${level * 100}%`;
}

//load initial state
chrome.storage.local.get(["waterLevel"], (data) => {
    updateWater(data.waterLevel ?? 1.0);
});

//detect user prompting
function handlePrompt() {
    chrome.runtime.sendMessage(
        { type: "PROMPT_SUBMITTED" },
        (response) => {
            if (response?.waterLevel !== undefined) {
                updateWater(response.waterLevel);
            }
        }
    );
}

// Enter key detection
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        handlePrompt();
    }
});

// Button detection (best-effort)
setInterval(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn && !btn.dataset.aquariumHooked) {
        btn.dataset.aquariumHooked = "true";
        btn.addEventListener("click", handlePrompt);
    }
}, 2000);