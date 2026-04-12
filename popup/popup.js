document.getElementById("refill").addEventListener("click", () => {
    chrome.storage.local.set({ waterLevel: 1.0 });
});