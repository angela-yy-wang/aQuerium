document.addEventListener("DOMContentLoaded", () => {

    // =======================
    // DOM ELEMENT REFERENCES
    // =======================
    // Grab elements from popup.html that we will read from or update
    const waterLevelEl = document.getElementById("water-level");       // large % number
    const queriesUsedEl = document.getElementById("queries-used");     // "used / limit"
    const waterUsedEl = document.getElementById("water-used");         // mL used
    const limitInputEl = document.getElementById("daily-limit-input"); // user input
    const saveLimitBtn = document.getElementById("save-limit-btn");    // save button
    const limitNoteEl = document.getElementById("limit-note");         // note about daily rule
    const statusMsgEl = document.getElementById("status-msg");         // feedback text

    // UI extras for improved UX
    const waterProgressEl = document.getElementById("water-progress"); // progress bar
    const heroSubtextEl = document.getElementById("hero-subtext");     // "queries left"
    const deadWarningEl = document.getElementById("dead-warning");     // warning at low water


    // =======================
    // STATUS MESSAGE HELPER
    // =======================
    // Displays feedback to the user (neutral / success / error)
    function setStatus(message = "", type = "neutral") {
        statusMsgEl.textContent = message;
        statusMsgEl.className = `status ${type}`;
    }


    // =======================
    // RENDER STATE INTO UI
    // =======================
    // Takes the state from background.js and updates all UI elements
    function renderState(state) {

        // Convert water level (0–1) into a percentage
        const waterPercent = Math.round((state.waterLevel ?? 1) * 100);

        // Extract stored values (with safe defaults)
        const queriesUsed = state.queriesUsedToday ?? 0;
        const dailyLimit = state.dailyLimit ?? 0;

        // Calculate water used (fallback if not provided)
        const waterUsedMl = state.waterUsedMl ?? queriesUsed * 40;

        // Whether user is allowed to change limit today
        const canChangeLimitToday = !!state.canChangeLimitToday;

        // Fish is considered "dead" at ≤10% water
        const isDead = waterPercent <= 10;

        // =======================
        // UPDATE TEXT VALUES
        // =======================
        waterLevelEl.textContent = `${waterPercent}%`;
        queriesUsedEl.textContent = `${queriesUsed} / ${dailyLimit}`;
        waterUsedEl.textContent = `${waterUsedMl} mL`;

        // =======================
        // UPDATE PROGRESS BAR
        // =======================
        // Clamp value between 0–100 for safety
        waterProgressEl.style.width =
            `${Math.max(0, Math.min(100, waterPercent))}%`;

        // =======================
        // UPDATE INPUT + BUTTON STATE
        // =======================
        limitInputEl.value = dailyLimit;

        // Disable if user already changed limit today
        limitInputEl.disabled = !canChangeLimitToday;
        saveLimitBtn.disabled = !canChangeLimitToday;

        // Show message about whether user can still change it
        limitNoteEl.textContent = canChangeLimitToday
            ? "You can still change the limit today."
            : "You already changed the limit today.";

        // =======================
        // HERO SUBTEXT (QUERIES LEFT)
        // =======================
        const remainingQueries = Math.max(0, dailyLimit - queriesUsed);
        heroSubtextEl.textContent = `${remainingQueries} queries left today`;

        // =======================
        // DEAD WARNING VISIBILITY
        // =======================
        // Show warning if water is critically low
        deadWarningEl.style.display = isDead ? "block" : "none";
    }


    // =======================
    // LOAD STATE FROM BACKGROUND
    // =======================
    // Requests current aquarium state from background.js
    function loadState() {
        chrome.runtime.sendMessage(
            { type: "GET_AQUARIUM_STATE" },
            (response) => {

                // Handle Chrome messaging errors
                if (chrome.runtime.lastError) {
                    setStatus(chrome.runtime.lastError.message, "error");
                    return;
                }

                // Render the returned state into the UI
                renderState(response);

                // Clear any previous messages
                setStatus("", "neutral");
            }
        );
    }


    // =======================
    // HANDLE SAVE BUTTON CLICK
    // =======================
    // Runs when user clicks "Save" for daily limit
    saveLimitBtn.addEventListener("click", () => {

        // Get user input and convert to number
        const requestedLimit = Number(limitInputEl.value);

        // Validate input
        if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
            setStatus("Enter a whole number of at least 1.", "error");
            return;
        }

        // Show temporary feedback while saving
        setStatus("Saving...", "neutral");

        // Send new limit to background script
        chrome.runtime.sendMessage(
            {
                type: "SET_DAILY_LIMIT",
                dailyLimit: Math.floor(requestedLimit)
            },
            (response) => {

                // Handle Chrome messaging errors
                if (chrome.runtime.lastError) {
                    setStatus(chrome.runtime.lastError.message, "error");
                    return;
                }

                // Handle logical errors (e.g. already changed today)
                if (!response?.ok) {
                    setStatus(response?.error || "Could not save limit.", "error");
                    return;
                }

                // Update UI with new state
                renderState(response);

                // Show success feedback
                setStatus("Daily limit updated.", "success");
            }
        );
    });


    // =======================
    // INITIAL LOAD
    // =======================
    // When popup opens, fetch and display current state
    loadState();
});