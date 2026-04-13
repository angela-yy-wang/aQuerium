# aQuerium 🐠

> *Query-osity killed the fish.*

aQuerium is a Chrome extension that places a small aquarium in the corner of your AI chat window. Every time you submit a prompt, the water level drops. Don't let your fish die!

Works on **ChatGPT** and **Claude**.

---

## Installation

1. Download or clone this repository so you have the `aQuerium` folder on your computer.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `aQuerium` folder.

The aquarium will appear in the bottom-right corner of your screen the next time you open ChatGPT or Claude. Pin and click on aQuerium to see water usage statistics, and number of queries left before the tank is empty.

---

## How It Works

- A small tank is injected into the page when you visit a supported AI chat site. The tank refreshes every 24 hours.
- Each prompt you submit drops the water level by 1/(number of total queries). You can reset your daily query limit once a day.
- The water level is saved between sessions — close the tab and come back, your tank will be right where you left it.

---

## File Structure

```
aQuerium/
├── manifest.json      # Extension configuration
├── background.js      # Stores and updates water level
├── content.js         # Injects the tank and detects prompts
├── styles.css         # Tank styling
├── popup              # Manages extension popup
└── fish               # Fish images
```

---

## Supported Sites

- `chat.openai.com`
- `chatgpt.com`
- `claude.ai`
