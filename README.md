<div align="center">
<img src="./icon.png" alt="YouTube Skip Silence Logo" width="128" height="128">
</div>

YouTube Skip Silence
YouTube Skip Silence is a browser extension that detects and skips silent portions of YouTube videos. It functions by analyzing the timestamps of a video's auto-generated captions to identify periods without speech.

This extension is available for both Google Chrome and Mozilla Firefox.

✨ Features
Silence Skipping: The primary function is to automatically skip segments of a video where no speech is detected.

Customizable Skip Behavior: The extension provides settings to control how silence is skipped:

Post-Speech Delay: A configurable delay can be added after a line of speech concludes before a skip is initiated. This allows for a more natural pause instead of an immediate jump.

Pre-Speech Offset: It is possible to configure the skip to land a specific amount of time before the next line of speech begins, avoiding an abrupt start.

General Settings: The popup menu provides options to enable or disable skipping, define the minimum duration of silence that should be skipped, and control whether skipping continues after the user manually seeks to a new point in the video.

🛠️ Installation Guide
This extension is not yet available on official browser stores and must be installed manually.

For Google Chrome (and Chromium-based browsers)
Download the Code: Download the repository from GitHub as a ZIP file.

Unzip the File: Extract the contents of the ZIP file to a permanent folder on your computer. You will see two sub-folders: chrome and firefox.

Open Chrome Extensions: Open Google Chrome and navigate to chrome://extensions in the address bar.

Enable Developer Mode: In the top-right corner of the extensions page, activate the "Developer mode" toggle.

Load the Extension:

Click the "Load unpacked" button.

In the file selection window, navigate to and select the chrome folder from the files you unzipped.

Click "Select Folder".

The extension will now be installed and active.

For Mozilla Firefox
Download the Code: Download the repository from GitHub as a ZIP file.

Unzip the File: Extract the contents of the ZIP file to a folder on your computer.

Open Firefox Debugging: Open Mozilla Firefox and navigate to about:debugging#/runtime/this-firefox in the address bar.

Load Temporary Add-on:

Click the "Load Temporary Add-on..." button.

Navigate into the unzipped firefox folder.

Select the manifest.json file and click "Open".

Note for Firefox Users: Temporary add-ons are removed when Firefox is closed. The add-on must be loaded again each time the browser is restarted.

📂 Project Structure
For those interested in modifying the code, this section provides an overview of the project's file structure.

manifest.json: The core configuration file for the extension. It declares permissions, registers scripts, and defines the user interface components.

background.js: A background script that intercepts network requests to capture the URLs for YouTube's caption data (timedtext).

content.js: This script is injected into the YouTube video page. It requests the caption data, analyzes timestamps to find silent gaps, and interacts with the video player to perform the skips.

popup.html: The HTML file that defines the structure of the settings panel.

popup.js: The JavaScript that controls the logic for the settings panel, including saving user preferences.

shared-constants.js: Contains variables and constants shared between different scripts to maintain consistency.

toast.css: The stylesheet for on-screen notifications.

🚀 Future Updates
A feature is planned for a future release to provide usage statistics. This will include tracking the total amount of time saved by skipping silent segments across all videos.