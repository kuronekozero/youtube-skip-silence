<div align="center">
  <img src="./icon.png" alt="YouTube Skip Silence Logo" width="128" height="128"/>
  
  # YouTube Skip Silence
</div>

[![Buy Me A Coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-yellow?style=flat-square)](https://www.buymeacoffee.com/kur0)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-blue?style=flat-square&logo=ko-fi)](https://ko-fi.com/N4N41M2YUG)

---

## 🎬 Demonstration

This GIF shows **YouTube Skip Silence** in action. The extension automatically detects and skips silent sections of a video.

<div align="center">
  <img src="./demonstration.gif" alt="YouTube Skip Silence Extension Demonstration GIF" width="600"/>
</div>

---

**YouTube Skip Silence** is a browser extension that skips silent parts of YouTube videos. It works by analyzing the timestamps in a video's **auto-generated captions** to find periods with no speech.

The extension is available for **Mozilla Firefox** and **Google Chrome** (and other Chromium browsers).

## ✨ Features

The extension is designed to remove dead air with simple configuration options:

* **Silence Skipping:** The main feature is automatically jumping over segments where no speech is detected.
* **Custom Skip Settings:** You can adjust how the skipping works for a smoother experience:
    * **Post-Speech Delay:** Adds a short delay after someone stops speaking before a skip is initiated.
    * **Pre-Speech Offset:** Configures the skip to land a moment *before* the next speech starts, preventing an abrupt beginning.
* **General Controls:** The popup menu provides settings to:
    * Enable or disable the skipping feature.
    * Set the **minimum duration of silence** that should be skipped.
    * Control if skipping continues after you manually seek (jump) to a new point in the video.

---

## 🛠️ Installation Guide

### For Mozilla Firefox

To install **YouTube Skip Silence** on Firefox, simply visit the official Firefox Add-ons page and download it directly:

* **[Install on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/youtube-skip-silence/)**

### For Google Chrome (and Chromium-based browsers)

This extension is not yet available on the official Chrome Web Store, so it must be **installed manually** using the "unpacked" method.

1.  **Download the Code:** Get the repository from GitHub as a ZIP file.
2.  **Unzip the File:** Extract the ZIP file contents to a permanent folder. You will see two folders: `chrome` and `firefox`.
3.  **Open Chrome Extensions:** Go to `chrome://extensions` in your address bar.
4.  **Enable Developer Mode:** In the top-right, switch on the **"Developer mode"** toggle.
5.  **Load the Extension:**
    * Click the **"Load unpacked"** button.
    * Select the **`chrome`** folder from your unzipped files.
    * Click "Select Folder".
    * The extension is now installed and active.

---

## 📂 Project Structure

This section outlines the main files for those who want to modify the code:

| File Name | Description |
| :--- | :--- |
| **`manifest.json`** | The core configuration file. It defines permissions, registers scripts, and the user interface. |
| **`background.js`** | A background script that intercepts network requests to capture YouTube's caption data URLs (`timedtext`). |
| **`content.js`** | This script is injected into the video page. It gets the caption data, finds silent gaps, and controls the video player to perform skips. |
| **`popup.html`** | The HTML file that defines the structure of the settings panel. |
| **`popup.js`** | The JavaScript logic for the settings panel, including saving user settings. |
| **`shared-constants.js`** | Contains variables and constants shared across different scripts. |
| **`toast.css`** | The stylesheet for on-screen notifications. |

---

## 🚀 Future Updates

A future update is planned to include **usage statistics**. This will track the total time saved by skipping silent segments across all videos.
