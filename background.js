function getTodayKey() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function computeWaterLevel(queriesUsedToday, dailyLimit) {
    const safeLimit = Math.max(1, Number(dailyLimit) || 1);
    const safeUsed = Math.max(0, Number(queriesUsedToday) || 0);
    return clamp(1 - safeUsed / safeLimit, 0, 1);
}

function getDefaultState() {
    return {
        dailyLimit: 20,
        queriesUsedToday: 0,
        waterLevel: 1,
        lastResetDate: getTodayKey(),
        lastLimitChangeDate: null
    };
}

function resetIfNewDay(data) {
    const today = getTodayKey();
    const merged = { ...getDefaultState(), ...data };

    if (merged.lastResetDate !== today) {
        merged.queriesUsedToday = 0;
        merged.waterLevel = 1;
        merged.lastResetDate = today;
    } else {
        merged.waterLevel = computeWaterLevel(
            merged.queriesUsedToday,
            merged.dailyLimit
        );
    }

    return merged;
}

// Initialize state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(null, (data) => {
        const merged = resetIfNewDay(data);
        chrome.storage.local.set(merged);
    });
});

// Optional: keep state fresh when extension starts
chrome.runtime.onStartup?.addListener(() => {
    chrome.storage.local.get(null, (data) => {
        const merged = resetIfNewDay(data);
        chrome.storage.local.set(merged);
    });
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PROMPT_SUBMITTED") {
        chrome.storage.local.get(null, (data) => {
            const state = resetIfNewDay(data);

            const nextUsed = state.queriesUsedToday + 1;
            const nextWaterLevel = computeWaterLevel(nextUsed, state.dailyLimit);

            const updated = {
                ...state,
                queriesUsedToday: nextUsed,
                waterLevel: nextWaterLevel
            };

            chrome.storage.local.set(updated, () => {
                sendResponse({
                    waterLevel: updated.waterLevel,
                    queriesUsedToday: updated.queriesUsedToday,
                    dailyLimit: updated.dailyLimit,
                    waterUsedMl: updated.queriesUsedToday * 40,
                    isDead: updated.waterLevel <= 0
                });
            });
        });

        return true;
    }

    if (msg.type === "GET_AQUARIUM_STATE") {
        chrome.storage.local.get(null, (data) => {
            const state = resetIfNewDay(data);

            chrome.storage.local.set(state, () => {
                sendResponse({
                    dailyLimit: state.dailyLimit,
                    queriesUsedToday: state.queriesUsedToday,
                    waterLevel: state.waterLevel,
                    waterUsedMl: state.queriesUsedToday * 40,
                    canChangeLimitToday:
                        state.lastLimitChangeDate !== getTodayKey()
                });
            });
        });

        return true;
    }

    if (msg.type === "SET_DAILY_LIMIT") {
        const requestedLimit = Number(msg.dailyLimit);

        if (
            !Number.isFinite(requestedLimit) ||
            requestedLimit < 1 ||
            requestedLimit > 50
        ) {
            sendResponse({
                ok: false,
                error: "Please enter a limit between 1 and 50."
            });
            return;
        }

        chrome.storage.local.get(null, (data) => {
            const state = resetIfNewDay(data);
            const today = getTodayKey();

            if (state.lastLimitChangeDate === today) {
                sendResponse({
                    ok: false,
                    error: "You can only change the daily limit once per day."
                });
                return;
            }

            const nextWaterLevel = computeWaterLevel(
                state.queriesUsedToday,
                requestedLimit
            );

            const updated = {
                ...state,
                dailyLimit: Math.floor(requestedLimit),
                waterLevel: nextWaterLevel,
                lastLimitChangeDate: today
            };

            chrome.storage.local.set(updated, () => {
                sendResponse({
                    ok: true,
                    dailyLimit: updated.dailyLimit,
                    queriesUsedToday: updated.queriesUsedToday,
                    waterLevel: updated.waterLevel,
                    waterUsedMl: updated.queriesUsedToday * 40,
                    canChangeLimitToday: false
                });
            });
        });

        return true;
    }
});