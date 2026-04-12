// =======================
// CREATE AQUARIUM
// =======================
// Builds the aquarium root once, randomly picks 5 fish,
// and injects the fish + water HTML into the page.
function createAquarium() {
    if (document.getElementById("aquarium-root")) return;

    const root = document.createElement("div");
    root.id = "aquarium-root";

    const allFish = [
        "fish/goldfish.png",
        "fish/pufferfish.png",
        "fish/lionfish.png",
        "fish/shark.png",
        "fish/tuna.png",
        "fish/bettafish.png",
        "fish/lemonshark.png"
    ];

    const shuffled = [...allFish].sort(() => Math.random() - 0.5);
    const selectedFish = shuffled.slice(0, 5);

    const fishHTML = selectedFish
        .map((fishPath, index) => {
            const fishName = fishPath.split("/").pop();

            return `
        <div
            class="fish fish-${index + 1}"
            data-fish-name="${fishName}"
            data-dead="false"
            data-started="false"
        >
            <img src="${chrome.runtime.getURL(fishPath)}" class="fish-img" />
        </div>
        `;
        })
        .join("");

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
let aquariumInitialized = false;

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
    const waterTop = tankHeight * (1 - currentWaterLevel);

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


// =======================
// UPDATE WATER LEVEL
// =======================
function updateWater(level) {
    const water = document.getElementById("water");
    if (!water) return;

    currentWaterLevel = clamp(level ?? 1, 0, 1);
    water.style.height = `${currentWaterLevel * 100}%`;

    if (!aquariumInitialized) {
        return;
    }

    keepFishBelowWater();
    applyDeathStages();
}


// =======================
// KEEP FISH BELOW WATER
// =======================
function keepFishBelowWater() {
    const fishes = document.querySelectorAll(".fish");
    const tank = document.getElementById("tank");
    if (!tank) return;

    const bounds = getWaterBounds();

    fishes.forEach((fish) => {
        if (fish.dataset.dead === "true") return;
        if (fish.dataset.started !== "true") return;

        const fishHeight = fish.offsetHeight || 120;
        const visualPos = getFishVisualPosition(fish);

        const minTop = bounds.minY;
        const maxTop = Math.max(bounds.minY, bounds.maxY - fishHeight);

        const tolerance = 4;

        const isVerticallyOutOfBounds =
            visualPos.top < minTop - tolerance ||
            visualPos.top > maxTop + tolerance;

        if (isVerticallyOutOfBounds) {
            adjustFishVerticalPositionOnly(fish, minTop, maxTop);
        }
    });

    layoutDeadFish();
}


// =======================
// VERTICAL-ONLY CORRECTION
// =======================
function adjustFishVerticalPositionOnly(fish, minTop, maxTop) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;
    if (fish.dataset.dead === "true") return;
    if (fish.dataset.started !== "true") return;

    const tankWidth = tank.clientWidth;
    const fishWidth = fish.offsetWidth || 120;

    const visualPos = getFishVisualPosition(fish);

    const safeLeft = clamp(
        visualPos.left,
        -fishWidth - 40,
        tankWidth + fishWidth + 40
    );

    const safeTop = clamp(visualPos.top, minTop, maxTop);

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
        fish._swimAnimation = null;
    }

    fish.style.left = `${safeLeft}px`;
    fish.style.top = `${safeTop}px`;
    fish.style.visibility = "visible";
    fish.style.opacity = "1";

    const movingRight = (fish._pathDirection || 1) === 1;

    animateFishFromCurrentPosition(fish, movingRight, {
        left: safeLeft,
        top: safeTop
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


// =======================
// SET FISH DIRECTION
// =======================
function setFishFacing(fish, movingRight) {
    if (fish.dataset.dead === "true") {
        return;
    }

    fish.style.transform = movingRight ? "scaleX(1)" : "scaleX(-1)";
}


// =======================
// RANDOM HELPERS
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


// =======================
// DEAD FISH LAYOUT
// =======================
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
            fish.style.visibility = "visible";
            fish.style.zIndex = "1";

            currentX += width + effectiveGap;
        });
    }

    const surfaceY = Math.max(
        0,
        tankHeight * (1 - currentWaterLevel) - surfaceOffset
    );

    layoutGroup(floatingDeadFish, surfaceY);
    layoutGroup(bottomDeadFish, "bottom");
}


// =======================
// FISH DEATH
// =======================
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


// =======================
// WATER-BASED DEATH STAGES
// =======================
// below 10% -> kill 2 fish floating
// at 0%     -> kill all remaining on bottom
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
}


// =======================
// MAIN FISH ANIMATION
// =======================
function animateFish(fish, direction = 1) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;
    if (fish.dataset.dead === "true") return;

    fish.dataset.started = "true";

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

    const offscreenPadding = fishWidth + 30;

    const startLeft = direction === 1
        ? -offscreenPadding
        : tankWidth + offscreenPadding;

    const endLeft = direction === 1
        ? tankWidth + offscreenPadding
        : -offscreenPadding;

    const midLeft1 = startLeft + (endLeft - startLeft) * 0.33;
    const midLeft2 = startLeft + (endLeft - startLeft) * 0.66;

    const startY = randomY();
    const midY1 = randomY();
    const midY2 = randomY();
    const endY = randomY();

    const duration = randomBetween(18000, 28000);

    setFishFacing(fish, direction === 1);

    fish.style.left = `${startLeft}px`;
    fish.style.top = `${startY}px`;
    fish.style.visibility = "visible";
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

    fish._pathKeyframes = keyframes;
    fish._pathDirection = direction;
    fish._swimAnimation = animation;

    animation.onfinish = () => {
        if (fish.dataset.dead === "true") return;

        fish.style.left = `${endLeft}px`;
        fish.style.top = `${endY}px`;

        animateFish(fish, direction * -1);
    };
}


// =======================
// CONTINUE PATH FROM CURRENT POSITION
// =======================
function animateFishFromCurrentPosition(
    fish,
    movingRight = true,
    startPosition = null
) {
    const tank = document.getElementById("tank");
    if (!tank || !fish) return;
    if (fish.dataset.dead === "true") return;

    fish.dataset.started = "true";

    if (fish._swimAnimation) {
        fish._swimAnimation.cancel();
    }

    const tankWidth = tank.clientWidth;
    const fishWidth = fish.offsetWidth || 120;
    const fishHeight = fish.offsetHeight || 120;

    const bounds = getWaterBounds();
    const minTop = bounds.minY;
    const maxTop = Math.max(minTop, bounds.maxY - fishHeight);

    const currentPos = startPosition || getFishVisualPosition(fish);

    const offscreenPadding = fishWidth + 30;
    const minLeft = -offscreenPadding;
    const maxLeft = tankWidth + offscreenPadding;

    const startLeft = clamp(currentPos.left, minLeft, maxLeft);
    const startY = clamp(currentPos.top, minTop, maxTop);

    const endLeft = movingRight
        ? tankWidth + offscreenPadding
        : -offscreenPadding;

    const midLeft1 = startLeft + (endLeft - startLeft) * 0.33;
    const midLeft2 = startLeft + (endLeft - startLeft) * 0.66;

    const randomY = () => {
        if (maxTop <= minTop) return minTop;
        return randomBetween(minTop, maxTop);
    };

    const midY1 = randomY();
    const midY2 = randomY();
    const endY = randomY();

    const duration = randomBetween(10000, 16000);

    setFishFacing(fish, movingRight);

    fish.style.left = `${startLeft}px`;
    fish.style.top = `${startY}px`;
    fish.style.visibility = "visible";
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

    fish._pathKeyframes = keyframes;
    fish._pathDirection = movingRight ? 1 : -1;
    fish._swimAnimation = animation;

    animation.onfinish = () => {
        if (fish.dataset.dead === "true") return;

        fish.style.left = `${endLeft}px`;
        fish.style.top = `${endY}px`;

        animateFish(fish, movingRight ? -1 : 1);
    };
}


// =======================
// SAFE START
// =======================
setTimeout(() => {
    const fishes = document.querySelectorAll(".fish");
    let startedCount = 0;

    fishes.forEach((fish, index) => {
        const direction = index % 2 === 0 ? 1 : -1;

        setTimeout(() => {
            animateFish(fish, direction);

            startedCount += 1;
            if (startedCount === fishes.length) {
                aquariumInitialized = true;
                keepFishBelowWater();
                applyDeathStages();
            }
        }, index * 250);
    });
}, 150);