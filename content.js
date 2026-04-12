// =======================
// CREATE AQUARIUM
// =======================

//inject aquarium
function createAquarium() {
    const root = document.createElement("div");
    root.id = "aquarium-root";

    root.innerHTML = `
    <div id="tank">
      <div id="water"></div>

      <div class="fish fish-1">
        <img src="${chrome.runtime.getURL("fish/goldfish.png")}" class="fish-img" />
      </div>

      <div class="fish fish-2">
        <img src="${chrome.runtime.getURL("fish/pufferfish.png")}" class="fish-img" />
      </div>

    </div>
  `;

    document.body.appendChild(root);
}

createAquarium();

//make aquarium draggable
function makeAquariumDraggable() {
    const root = document.getElementById("aquarium-root");
    if (!root) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    root.style.pointerEvents = "auto";
    root.style.cursor = "grab";

    root.addEventListener("mousedown", (e) => {
        isDragging = true;
        root.style.cursor = "grabbing";

        const rect = root.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        root.style.left = `${e.clientX - offsetX}px`;
        root.style.top = `${e.clientY - offsetY}px`;
        root.style.right = "auto";
        root.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        root.style.cursor = "grab";
    });
}

makeAquariumDraggable();

// =======================
// WATER LEVEL
// =======================

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

// listen for refill / drain changes instantly
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes.waterLevel) {
        updateWater(changes.waterLevel.newValue);
    }
});

// =======================
// PROMPT DETECTION
// =======================
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

//enter key detection
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        handlePrompt();
    }
});

//button detection (best-effort)
setInterval(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn && !btn.dataset.aquariumHooked) {
        btn.dataset.aquariumHooked = "true";
        btn.addEventListener("click", handlePrompt);
    }
}, 2000);

// =======================
// FISH ANIMATION
// =======================
function animateFish(fish, direction = 1) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;

    const tankWidth = tank.clientWidth;
    const tankHeight = tank.clientHeight;

    const y = Math.random() * (tankHeight - 60) + 10;
    const duration = 8000 + Math.random() * 6000;

    fish.style.top = `${y}px`;
}

//safe delayed start
setTimeout(() => {
    const fish1 = document.querySelector(".fish-1");
    const fish2 = document.querySelector(".fish-2");

    if (fish1) animateFish(fish1, 1);
    if (fish2) animateFish(fish2, -1);
}, 100);