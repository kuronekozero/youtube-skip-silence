<div align="center">
  <img src="./icon.png" alt="YouTube Skip Silence Logo" width="128" height="128"/>
  
  # YouTube Skip Silence
</div>

[![Buy Me A Coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-yellow?style=flat-square)](https://www.buymeacoffee.com/kur0)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-blue?style=flat-square&logo=ko-fi)](https://ko-fi.com/N4N41M2YUG)

---

## 🎬 Video Demonstration

See **YouTube Skip Silence** in action! This short video demonstrates how the extension automatically detects and skips silent gaps in a video, saving you time.

<div align="center">
  <video src="./video.mp4" controls width="100%" poster="./icon.png"></video>
</div>

---

**YouTube Skip Silence** is a browser extension that detects and automatically skips silent portions of YouTube videos. It functions by analyzing the timestamps of a video's **auto-generated captions** to efficiently identify periods without speech.

This extension is available for both **Google Chrome** (and Chromium-based browsers) and **Mozilla Firefox**.

## ✨ Features

The extension is designed to provide a seamless viewing experience by eliminating dead air, with several configurable options:

* **Silence Skipping:** The core function is to automatically jump over segments of a video where no speech is detected.
* **Customizable Skip Behavior:** Fine-tune how the extension performs skips for a more natural flow:
    * **Post-Speech Delay:** A configurable delay can be added after a line of speech concludes before a skip is initiated. This creates a more natural pause instead of an immediate jump.
    * **Pre-Speech Offset:** Configure the skip to land a specific amount of time *before* the next line of speech begins, avoiding an abrupt start.
* **General Settings:** The extension's popup menu provides controls to:
    * Enable or disable skipping entirely.
    * Define the **minimum duration of silence** that should be skipped.
    * Control whether skipping continues after the user manually seeks to a new point in the video.

---

## 🛠️ Installation Guide

This extension is not yet available on official browser stores and must be **installed manually** using the "unpacked" method.

### For Google Chrome (and Chromium-based browsers)

1.  **Download the Code:** Download the repository from GitHub as a ZIP file.
2.  **Unzip the File:** Extract the contents of the ZIP file to a permanent folder on your computer. You will see two sub-folders: `chrome` and `firefox`.
3.  **Open Chrome Extensions:** Open Google Chrome and navigate to `chrome://extensions` in the address bar.
4.  **Enable Developer Mode:** In the top-right corner of the extensions page, activate the **"Developer mode"** toggle.
5.  **Load the Extension:**
    * Click the **"Load unpacked"** button.
    * In the file selection window, navigate to and select the **`chrome`** folder from the files you unzipped.
    * Click "Select Folder".
    * The extension will now be installed and active.

### For Mozilla Firefox

1.  **Download the Code:** Download the repository from GitHub as a ZIP file.
2.  **Unzip the File:** Extract the contents of the ZIP file to a folder on your computer.
3.  **Open Firefox Debugging:** Open Mozilla Firefox and navigate to `about:debugging#/runtime/this-firefox` in the address bar.
4.  **Load Temporary Add-on:**
    * Click the **"Load Temporary Add-on..."** button.
    * Navigate into the unzipped **`firefox`** folder.
    * Select the **`manifest.json`** file and click "Open".

> **Note for Firefox Users:** Temporary add-ons are removed when Firefox is closed. The add-on must be loaded again each time the browser is restarted.

---

## 📂 Project Structure

For those interested in modifying or contributing to the code, here is an overview of the project's key file structure:

| File Name | Description |
| :--- | :--- |
| **`manifest.json`** | The core configuration file for the extension. It declares permissions, registers scripts, and defines the user interface components. |
| **`background.js`** | A background script that intercepts network requests to capture the URLs for YouTube's caption data (`timedtext`). |
| **`content.js`** | Injected into the YouTube video page. It requests the caption data, analyzes timestamps to find silent gaps, and interacts with the video player to perform the skips. |
| **`popup.html`** | The HTML file that defines the structure of the settings panel. |
| **`popup.js`** | The JavaScript that controls the logic for the settings panel, including saving user preferences. |
| **`shared-constants.js`** | Contains variables and constants shared between different scripts to maintain consistency. |
| **`toast.css`** | The stylesheet for on-screen notifications. |

---

## 🚀 Future Updates

A feature is planned for a future release to provide **usage statistics**. This will include tracking the total amount of time saved by skipping silent segments across all videos, highlighting the extension's efficiency.