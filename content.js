// =======================
// CREATE AQUARIUM
// =======================
function createAquarium() {
    if (document.getElementById("aquarium-root")) return;

    const root = document.createElement("div");
    root.id = "aquarium-root";

    // all available fish
    const allFish = [
        "fish/goldfish.png",
        "fish/pufferfish.png",
        "fish/lionfish.png",
        "fish/shark.png",
        "fish/tuna.png",
        "fish/bettafish.png",
        "fish/lemonshark.png"
    ];

    // randomly pick 5
    const shuffled = [...allFish].sort(() => Math.random() - 0.5);
    const selectedFish = shuffled.slice(0, 5);

    // build fish html
    const fishHTML = selectedFish.map((fishPath, index) => {
        return `
        <div class="fish fish-${index + 1}" style="opacity: 0;">
            <img src="${chrome.runtime.getURL(fishPath)}" class="fish-img" />
        </div>
        `;
    }).join("");

    // final html
    root.innerHTML = `
    <div id="tank">
        <div id="water"></div>
        ${fishHTML}
    </div>
    `;

    document.body.appendChild(root);
}

createAquarium();


// =======================
// DRAGGABLE AQUARIUM
// =======================
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
// GLOBAL WATER STATE
// =======================
let currentWaterLevel = 1.0;


// =======================
// WATER HELPERS
// =======================
function getWaterBounds() {
    const tank = document.getElementById("tank");
    if (!tank) {
        return { minY: 0, maxY: 0 };
    }

    const tankHeight = tank.clientHeight;

    // top of visible water inside tank
    const waterTop = tankHeight * (1 - currentWaterLevel);

    // small padding so fish do not clip through border/surface
    const topPadding = 10;
    const bottomPadding = 10;

    return {
        minY: waterTop + topPadding,
        maxY: tankHeight - bottomPadding
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}


// =======================
// UPDATE WATER LEVEL
// =======================
function updateWater(level) {
    const water = document.getElementById("water");
    if (!water) return;

    currentWaterLevel = clamp(level ?? 1, 0, 1);
    water.style.height = `${currentWaterLevel * 100}%`;

    keepFishBelowWater();
}

function keepFishBelowWater() {
    const fishes = document.querySelectorAll(".fish");
    const bounds = getWaterBounds();

    fishes.forEach((fish) => {
        const fishHeight = fish.offsetHeight || 80;

        // if water is very low, keep fish near the bottom
        const maxTop = Math.max(bounds.minY, bounds.maxY - fishHeight);
        const currentTop = parseFloat(fish.style.top || "0");

        fish.style.top = `${clamp(currentTop, bounds.minY, maxTop)}px`;
    });
}


// =======================
// LOAD INITIAL WATER
// =======================
chrome.storage.local.get(["waterLevel"], (data) => {
    updateWater(data.waterLevel ?? 1.0);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.waterLevel) return;

    updateWater(changes.waterLevel.newValue);
});


// =======================
// PROMPT DETECTION
// =======================
function handlePrompt() {
    chrome.runtime.sendMessage(
        { type: "PROMPT_SUBMITTED" },
        (response) => {
            if (chrome.runtime.lastError) {
                console.warn(chrome.runtime.lastError.message);
                return;
            }

            if (response?.waterLevel !== undefined) {
                updateWater(response.waterLevel);
            }
        }
    );
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        handlePrompt();
    }
});

setInterval(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn && !btn.dataset.aquariumHooked) {
        btn.dataset.aquariumHooked = "true";
        btn.addEventListener("click", handlePrompt);
    }
}, 2000);

// // =======================
// // SET FISH DIRECTION
// // =======================
// // Flips the fish horizontally depending on movement direction
// // movingRight = true  → face right
// // movingRight = false → face left
// function setFishFacing(fish, movingRight) {
//     fish.style.transform = movingRight ? "scaleX(1)" : "scaleX(-1)";
// }


// // =======================
// // MAIN FISH ANIMATION (constant bob no-lagging version)
// // =======================
// // Simpler and lighter:
// // - slow left/right movement
// // - only a small amount of vertical variation
// // - keeps fish under water
// // - less animation work, so less lag
// function animateFish(fish, direction = 1) {
//     const tank = document.getElementById("tank");
//     if (!tank || !fish) return;

//     // cancel previous swim animation so only one runs per fish
//     if (fish._swimAnimation) {
//         fish._swimAnimation.cancel();
//     }

//     const tankWidth = tank.clientWidth;
//     const fishWidth = fish.offsetWidth || 120;
//     const fishHeight = fish.offsetHeight || 120;

//     const bounds = getWaterBounds();
//     const minTop = bounds.minY;
//     const maxTop = Math.max(minTop, bounds.maxY - fishHeight);

//     // choose one base underwater height
//     const baseY =
//         maxTop <= minTop
//             ? minTop
//             : minTop + Math.random() * (maxTop - minTop);

//     // very small vertical drift only
//     const driftAmount = 12;
//     const midY = clamp(baseY + (Math.random() * driftAmount * 2 - driftAmount), minTop, maxTop);
//     const endY = clamp(baseY + (Math.random() * driftAmount * 2 - driftAmount), minTop, maxTop);

//     // slower movement
//     const duration = 18000 + Math.random() * 6000;

//     const startLeft = direction === 1 ? -fishWidth - 20 : tankWidth;
//     const endLeft = direction === 1 ? tankWidth : -fishWidth - 20;

//     setFishFacing(fish, direction === 1);

//     // place fish at its real starting point before animating
//     fish.style.left = `${startLeft}px`;
//     fish.style.top = `${baseY}px`;

//     const animation = fish.animate(
//         [
//             { left: `${startLeft}px`, top: `${baseY}px` },
//             { left: `${tankWidth * 0.5}px`, top: `${midY}px` },
//             { left: `${endLeft}px`, top: `${endY}px` }
//         ],
//         {
//             duration,
//             iterations: 1,
//             easing: "linear",
//             fill: "forwards"
//         }
//     );

//     fish._swimAnimation = animation;

//     animation.onfinish = () => {
//         animateFish(fish, direction * -1);
//     };
// }


//=======================
//SET FISH DIRECTION (RANDOMISED MOVEMENT/BOB)
//=======================
function setFishFacing(fish, movingRight) {
    fish.style.transform = movingRight ? "scaleX(1)" : "scaleX(-1)";
}

// =======================
// RANDOM HELPER
// =======================
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

// =======================
// MAIN FISH ANIMATION
// =======================
function animateFish(fish, direction = 1) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
    }

    const tankWidth = tank.clientWidth;
    const fishWidth = fish.offsetWidth || 120;
    const fishHeight = fish.offsetHeight || 120;

    const bounds = getWaterBounds();
    const minTop = bounds.minY;
    const maxTop = Math.max(minTop, bounds.maxY - fishHeight);

    const randomY = () => {
        if (maxTop <= minTop) return minTop;
        return randomBetween(minTop, maxTop);
    };

    const startY = randomY();
    const midY1 = randomY();
    const midY2 = randomY();
    const endY = randomY();

    const duration = randomBetween(18000, 28000);

    const startLeft = direction === 1 ? -fishWidth - 20 : tankWidth;
    const endLeft = direction === 1 ? tankWidth : -fishWidth - 20;

    setFishFacing(fish, direction === 1);

    // place fish before showing it
    fish.style.left = `${startLeft}px`;
    fish.style.top = `${startY}px`;
    fish.style.opacity = "1";

    const keyframes =
        direction === 1
            ? [
                  { left: `${startLeft}px`, top: `${startY}px` },
                  { left: `${tankWidth * 0.25}px`, top: `${midY1}px` },
                  { left: `${tankWidth * 0.55}px`, top: `${midY2}px` },
                  { left: `${endLeft}px`, top: `${endY}px` }
              ]
            : [
                  { left: `${startLeft}px`, top: `${startY}px` },
                  { left: `${tankWidth * 0.75}px`, top: `${midY1}px` },
                  { left: `${tankWidth * 0.45}px`, top: `${midY2}px` },
                  { left: `${endLeft}px`, top: `${endY}px` }
              ];

    const animation = fish.animate(keyframes, {
        duration,
        iterations: 1,
        easing: "linear",
        fill: "forwards"
    });

    fish._swimAnimation = animation;

    animation.onfinish = () => {
        animateFish(fish, direction * -1);
    };
}

// =======================
// SAFE START
// =======================
setTimeout(() => {
    const fishes = document.querySelectorAll(".fish");

    fishes.forEach((fish, index) => {
        const direction = index % 2 === 0 ? 1 : -1;

        // slight stagger so they do not all line up
        setTimeout(() => {
            animateFish(fish, direction);
        }, index * 250);
    });
}, 150);