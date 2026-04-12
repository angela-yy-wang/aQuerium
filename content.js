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
        const fishName = fishPath.split("/").pop();

        return `
        <div class="fish fish-${index + 1}" data-fish-name="${fishName}" data-dead="false" style="opacity: 0;">
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

// death stages so they only trigger once
let deathStage30Triggered = false;
let deathStage10Triggered = false;
let deathStage0Triggered = false;


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
// GET FISH POSITION
// =======================

function getFishVisualPosition(fish) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) {
        return { left: 0, top: 0 };
    }

    const tankRect = tank.getBoundingClientRect();
    const fishRect = fish.getBoundingClientRect();

    return {
        left: fishRect.left - tankRect.left,
        top: fishRect.top - tankRect.top
    };
}

function restartFishWithinBounds(fish) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;
    if (fish.dataset.dead === "true") return;

    const tankWidth = tank.clientWidth;
    const fishWidth = fish.offsetWidth || 120;
    const fishHeight = fish.offsetHeight || 120;

    const bounds = getWaterBounds();
    const minTop = bounds.minY;
    const maxTop = Math.max(minTop, bounds.maxY - fishHeight);

    const visualPos = getFishVisualPosition(fish);

    const safeLeft = clamp(
        visualPos.left,
        0,
        Math.max(0, tankWidth - fishWidth)
    );

    const safeTop = clamp(
        visualPos.top,
        minTop,
        maxTop
    );

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
        fish._swimAnimation = null;
    }

    fish.style.left = `${safeLeft}px`;
    fish.style.top = `${safeTop}px`;
    fish.style.opacity = "1";

    const movingRight = !fish.style.transform.includes("scaleX(-1)");
    animateFishFromCurrentPosition(fish, movingRight ? 1 : -1);
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
    applyDeathStages();
}

function keepFishBelowWater() {
    const fishes = document.querySelectorAll(".fish");
    const tank = document.getElementById("tank");
    if (!tank) return;

    const bounds = getWaterBounds();
    const tankWidth = tank.clientWidth;

    fishes.forEach((fish) => {
        if (fish.dataset.dead === "true") return;

        const fishWidth = fish.offsetWidth || 120;
        const fishHeight = fish.offsetHeight || 80;

        const visualPos = getFishVisualPosition(fish);

        const minTop = bounds.minY;
        const maxTop = Math.max(bounds.minY, bounds.maxY - fishHeight);
        const minLeft = 0;
        const maxLeft = Math.max(0, tankWidth - fishWidth);

        const isOutOfBounds =
            visualPos.top < minTop ||
            visualPos.top > maxTop ||
            visualPos.left < minLeft ||
            visualPos.left > maxLeft;

        // only intervene when the fish is actually outside the valid area
        if (isOutOfBounds) {
            restartFishWithinBounds(fish);
        }
    });

    layoutDeadFish();
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
// FISH POSITIONS
// =======================
function getFishVisualPosition(fish) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) {
        return { left: 0, top: 0 };
    }

    const tankRect = tank.getBoundingClientRect();
    const fishRect = fish.getBoundingClientRect();

    return {
        left: fishRect.left - tankRect.left,
        top: fishRect.top - tankRect.top
    };
}

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
// SET FISH DIRECTION (RANDOMISED MOVEMENT/BOB)
//=======================
function setFishFacing(fish, movingRight) {
    if (fish.dataset.dead === "true") {
        return;
    }

    fish.style.transform = movingRight ? "scaleX(1)" : "scaleX(-1)";
}

// =======================
// RANDOM HELPER
// =======================
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function shuffleArray(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}


// =======================
// DEAD FISH HELPERS
// =======================
function getAliveFish() {
    return [...document.querySelectorAll(".fish")].filter(
        (fish) => fish.dataset.dead !== "true"
    );
}

function getDeadFish() {
    return [...document.querySelectorAll(".fish")].filter(
        (fish) => fish.dataset.dead === "true"
    );
}

function getDeadFishPath(fish) {
    const fishName = fish.dataset.fishName;
    if (!fishName) return null;

    return `fish/dead_${fishName}`;
}

function layoutDeadFish() {
    const tank = document.getElementById("tank");
    const deadFish = getDeadFish();
    if (!tank || deadFish.length === 0) return;

    const floatingDeadFish = deadFish.filter(
        (fish) => fish.dataset.deadMode === "float"
    );

    const bottomDeadFish = deadFish.filter(
        (fish) => fish.dataset.deadMode === "bottom"
    );

    const tankWidth = tank.clientWidth;
    const tankHeight = tank.clientHeight;
    const sidePadding = 8;
    const floorPadding = 6;
    const surfaceOffset = 10;

    function layoutGroup(fishes, topValue) {
        if (fishes.length === 0) return;

        const gap = 10;
        const sizes = fishes.map((fish) => ({
            fish,
            width: fish.offsetWidth || 120,
            height: fish.offsetHeight || 120
        }));

        const totalFishWidth = sizes.reduce((sum, item) => sum + item.width, 0);
        const totalGapWidth = gap * Math.max(0, sizes.length - 1);
        const totalNeededWidth = totalFishWidth + totalGapWidth;
        const availableWidth = tankWidth - sidePadding * 2;

        let effectiveGap = gap;
        if (totalNeededWidth > availableWidth && sizes.length > 1) {
            effectiveGap = Math.max(
                0,
                (availableWidth - totalFishWidth) / (sizes.length - 1)
            );
        }

        let currentX = sidePadding;
        const usedWidth =
            totalFishWidth + effectiveGap * Math.max(0, sizes.length - 1);

        if (usedWidth < availableWidth) {
            currentX = sidePadding + (availableWidth - usedWidth) / 2;
        }

        sizes.forEach(({ fish, width, height }) => {
            const maxLeft = Math.max(sidePadding, tankWidth - width - sidePadding);
            const left = clamp(currentX, sidePadding, maxLeft);

            let top = topValue;
            if (topValue === "bottom") {
                top = Math.max(0, tankHeight - height - floorPadding);
            }

            fish.style.transition = "top 0.9s ease, left 0.9s ease";
            fish.style.left = `${left}px`;
            fish.style.top = `${top}px`;
            fish.style.bottom = "auto";
            fish.style.opacity = "1";
            fish.style.zIndex = "1";

            currentX += width + effectiveGap;
        });
    }

    // floating dead fish sit at the water surface
    const surfaceY = Math.max(
        0,
        tankHeight * (1 - currentWaterLevel) - surfaceOffset
    );

    layoutGroup(floatingDeadFish, surfaceY);
    layoutGroup(bottomDeadFish, "bottom");
}

function killFish(fish, mode = "float") {
    if (!fish || fish.dataset.dead === "true") return;

    const img = fish.querySelector("img");
    if (!img) return;

    fish.dataset.dead = "true";
    fish.dataset.deadMode = mode;

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
        fish._swimAnimation = null;
    }

    const deadFishPath = getDeadFishPath(fish);
    if (deadFishPath) {
        img.src = chrome.runtime.getURL(deadFishPath);

        img.onload = () => {
            layoutDeadFish();
        };

        img.onerror = () => {
            console.warn(`Could not load dead fish image: ${deadFishPath}`);
            layoutDeadFish();
        };
    }

    // stop bobbing once dead
    img.style.animation = "none";

    layoutDeadFish();
}

function killRandomFish(count, mode = "float") {
    const aliveFish = getAliveFish();
    const selectedFish = shuffleArray(aliveFish).slice(0, count);

    selectedFish.forEach((fish) => {
        killFish(fish, mode);
    });
}

function killAllRemainingFish(mode = "bottom") {
    const aliveFish = getAliveFish();

    aliveFish.forEach((fish) => {
        killFish(fish, mode);
    });
}

function applyDeathStages() {
    if (currentWaterLevel <= 0 && !deathStage0Triggered) {
        deathStage0Triggered = true;
        killAllRemainingFish("bottom");
        return;
    }

    if (currentWaterLevel < 0.1 && !deathStage10Triggered) {
        deathStage10Triggered = true;
        killRandomFish(2, "float");
    }

    if (currentWaterLevel < 0.3 && !deathStage30Triggered) {
        deathStage30Triggered = true;
        killRandomFish(1, "float");
    }
}

// =======================
// MAIN FISH ANIMATION
// =======================
function animateFish(fish, direction = 1) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;
    if (fish.dataset.dead === "true") return;

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
    }

    const tankWidth = tank.clientWidth;
    const fishWidth = fish.offsetWidth || 120;
    const fishHeight = fish.offsetHeight || 120;

    const bounds = getWaterBounds();
    const minTop = bounds.minY;
    const maxTop = Math.max(minTop, bounds.maxY - fishHeight);

    const minLeft = 0;
    const maxLeft = Math.max(0, tankWidth - fishWidth);

    const randomY = () => {
        if (maxTop <= minTop) return minTop;
        return randomBetween(minTop, maxTop);
    };

    const randomLeft = () => {
        if (maxLeft <= minLeft) return minLeft;
        return randomBetween(minLeft, maxLeft);
    };

    const startY = randomY();
    const midY1 = randomY();
    const midY2 = randomY();
    const endY = randomY();

    const startLeft =
        direction === 1 ? randomBetween(minLeft, maxLeft * 0.25) : randomBetween(maxLeft * 0.75, maxLeft);

    const midLeft1 =
        direction === 1 ? randomBetween(maxLeft * 0.2, maxLeft * 0.45) : randomBetween(maxLeft * 0.55, maxLeft * 0.8);

    const midLeft2 =
        direction === 1 ? randomBetween(maxLeft * 0.45, maxLeft * 0.7) : randomBetween(maxLeft * 0.3, maxLeft * 0.55);

    const endLeft =
        direction === 1 ? randomBetween(maxLeft * 0.7, maxLeft) : randomBetween(minLeft, maxLeft * 0.3);

    const duration = randomBetween(18000, 28000);

    setFishFacing(fish, direction === 1);

    // place fish before showing it
    fish.style.left = `${startLeft}px`;
    fish.style.top = `${startY}px`;
    fish.style.opacity = "1";

    const keyframes = [
        { left: `${startLeft}px`, top: `${startY}px` },
        { left: `${midLeft1}px`, top: `${midY1}px` },
        { left: `${midLeft2}px`, top: `${midY2}px` },
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
        if (fish.dataset.dead === "true") return;
        animateFish(fish, direction * -1);
    };
}

// =======================
// RESTART FISH IF WATER LEVEL CHANGES MID ANIMATION
// =======================

function animateFishFromCurrentPosition(fish, direction = 1) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;
    if (fish.dataset.dead === "true") return;

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
    }

    const tankWidth = tank.clientWidth;
    const fishWidth = fish.offsetWidth || 120;
    const fishHeight = fish.offsetHeight || 120;

    const bounds = getWaterBounds();
    const minTop = bounds.minY;
    const maxTop = Math.max(minTop, bounds.maxY - fishHeight);

    const minLeft = 0;
    const maxLeft = Math.max(0, tankWidth - fishWidth);

    const randomY = () => {
        if (maxTop <= minTop) return minTop;
        return randomBetween(minTop, maxTop);
    };

    const randomLeft = () => {
        if (maxLeft <= minLeft) return minLeft;
        return randomBetween(minLeft, maxLeft);
    };

    const startLeft = clamp(parseFloat(fish.style.left || "0"), minLeft, maxLeft);
    const startY = clamp(parseFloat(fish.style.top || "0"), minTop, maxTop);

    let endLeft = randomLeft();
    let endY = randomY();

    let tries = 0;
    while (
        tries < 8 &&
        Math.abs(endLeft - startLeft) < 40 &&
        Math.abs(endY - startY) < 20
    ) {
        endLeft = randomLeft();
        endY = randomY();
        tries++;
    }

    const midLeft1 = clamp(startLeft + (endLeft - startLeft) * 0.33, minLeft, maxLeft);
    const midLeft2 = clamp(startLeft + (endLeft - startLeft) * 0.66, minLeft, maxLeft);
    const midY1 = randomY();
    const midY2 = randomY();

    const duration = randomBetween(14000, 22000);

    setFishFacing(fish, endLeft >= startLeft);

    fish.style.left = `${startLeft}px`;
    fish.style.top = `${startY}px`;
    fish.style.opacity = "1";

    const keyframes = [
        { left: `${startLeft}px`, top: `${startY}px` },
        { left: `${midLeft1}px`, top: `${midY1}px` },
        { left: `${midLeft2}px`, top: `${midY2}px` },
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
        if (fish.dataset.dead === "true") return;

        fish.style.left = `${endLeft}px`;
        fish.style.top = `${endY}px`;

        animateFish(fish, endLeft >= startLeft ? 1 : -1);
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