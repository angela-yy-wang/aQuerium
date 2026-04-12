// Initialize state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        waterLevel: 1.0
    });
});

// Listen for prompt events from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PROMPT_SUBMITTED") {
        chrome.storage.local.get(["waterLevel"], (data) => {
            let newLevel = (data.waterLevel ?? 1.0) - 0.05;
            newLevel = Math.max(0, newLevel);

            chrome.storage.local.set({ waterLevel: newLevel });

            sendResponse({ waterLevel: newLevel });
        });

        return true; // async response
    }
});