(function YouTubeSilenceSkipperPopup() {
  'use strict';

  const { DEFAULT_SETTINGS, MESSAGE_TYPES, YOUTUBE_URL_PATTERN, LOG_LEVELS } = window.SHARED_CONSTANTS;

  const UI = {
    elements: {
      skipToggle: null,
      minSkipInput: null,
      skipAfterSeekToggle: null,
      skipCCCaptionsToggle: null,
      logLevelSelect: null,
      applyBtn: null,
      preSpeechOffsetInput: null,
      postSilenceDelayInput: null
    },

    init: function() {
      this.elements.skipToggle = document.getElementById("skipToggle");
      this.elements.minSkipInput = document.getElementById("minSkipInput");
      this.elements.skipAfterSeekToggle = document.getElementById("skipAfterSeekToggle");
      this.elements.skipCCCaptionsToggle = document.getElementById("skipCCCaptionsToggle");
      this.elements.logLevelSelect = document.getElementById("logLevelSelect");
      this.elements.applyBtn = document.getElementById("applyBtn");
      this.elements.preSpeechOffsetInput = document.getElementById("preSpeechOffsetInput");
      this.elements.postSilenceDelayInput = document.getElementById("postSilenceDelayInput");

      if (!this.elements.skipToggle || 
          !this.elements.minSkipInput || 
          !this.elements.skipAfterSeekToggle || 
          !this.elements.skipCCCaptionsToggle ||
          !this.elements.logLevelSelect || 
          !this.elements.applyBtn ||
          !this.elements.preSpeechOffsetInput ||
          !this.elements.postSilenceDelayInput) {
        console.error("[YSS] Failed to initialize UI elements");
        return false;
      }

      return true;
    },

    readValues: function() {
      return {
        logLevel: this.elements.logLevelSelect.value,
        skipEnabled: this.elements.skipToggle.checked,
        minSkipSeconds: parseFloat(this.elements.minSkipInput.value) || 0,
        skipAfterSeek: this.elements.skipAfterSeekToggle.checked,
        skipCCCaptions: this.elements.skipCCCaptionsToggle.checked,
        preSpeechOffsetSeconds: parseFloat(this.elements.preSpeechOffsetInput.value) || 0,
        postSilenceDelaySeconds: parseFloat(this.elements.postSilenceDelayInput.value) || 0
      };
    },

    updateFromSettings: function(settings) {
      this.elements.logLevelSelect.value = settings.logLevel || DEFAULT_SETTINGS.logLevel;
      this.elements.skipToggle.checked = !!settings.skipEnabled;

      const val = Number(settings.minSkipSeconds);
      this.elements.minSkipInput.value = isNaN(val) ? "0.10" : val.toFixed(2);

      this.elements.skipAfterSeekToggle.checked = !!settings.skipAfterSeek;
      this.elements.skipCCCaptionsToggle.checked = !!settings.skipCCCaptions;

      const preSpeechOffsetVal = Number(settings.preSpeechOffsetSeconds);
      this.elements.preSpeechOffsetInput.value = isNaN(preSpeechOffsetVal) ? "0.00" : preSpeechOffsetVal.toFixed(2);

      const postSilenceDelayVal = Number(settings.postSilenceDelaySeconds);
      this.elements.postSilenceDelayInput.value = isNaN(postSilenceDelayVal) ? "0.00" : postSilenceDelayVal.toFixed(2);
    },

    getNormalizedMinSkip: function() {
      let value = parseFloat(this.elements.minSkipInput.value);
      if (isNaN(value) || value < 0) value = 0;
      value = Math.round(value * 100) / 100; 

      this.elements.minSkipInput.value = value.toFixed(2);
      return value;
    },

    getNormalizedPreSpeechOffset: function() {
      let value = parseFloat(this.elements.preSpeechOffsetInput.value);
      if (isNaN(value) || value < 0) value = 0;
      value = Math.round(value * 100) / 100; 

      this.elements.preSpeechOffsetInput.value = value.toFixed(2);
      return value;
    },

    getNormalizedPostSilenceDelay: function() {
      let value = parseFloat(this.elements.postSilenceDelayInput.value);
      if (isNaN(value) || value < 0) value = 0;
      value = Math.round(value * 100) / 100; 

      this.elements.postSilenceDelayInput.value = value.toFixed(2);
      return value;
    }
  };

  const SettingsManager = {

    storedSettings: null,

    loadSettings: async function() {
      const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      this.storedSettings = {
        logLevel: settings.logLevel || DEFAULT_SETTINGS.logLevel,
        skipEnabled: !!settings.skipEnabled,
        minSkipSeconds: Number(settings.minSkipSeconds) || DEFAULT_SETTINGS.minSkipSeconds,
        skipAfterSeek: !!settings.skipAfterSeek,
        skipCCCaptions: !!settings.skipCCCaptions,
        preSpeechOffsetSeconds: Number(settings.preSpeechOffsetSeconds) || DEFAULT_SETTINGS.preSpeechOffsetSeconds,
        postSilenceDelaySeconds: Number(settings.postSilenceDelaySeconds) || DEFAULT_SETTINGS.postSilenceDelaySeconds
      };
      return this.storedSettings;
    },

    saveSettings: async function(settings) {
      await chrome.storage.sync.set(settings);
      this.broadcastSettings(settings);
      this.storedSettings = { ...settings };
    },

    broadcastSettings: function(settings) {
      chrome.tabs.query({ url: "https://www.youtube.com/*" }).then((tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.SETTINGS_UPDATE, settings: settings });
        }
      });
    }
  };

  const EventHandlers = {

    updateApplyButton: function() {
      const uiValues = UI.readValues();
      const storedSettings = SettingsManager.storedSettings;

      if (!storedSettings) {
        UI.elements.applyBtn.disabled = true; 
        return;
      }

      const changed = 
        uiValues.logLevel !== storedSettings.logLevel ||
        uiValues.skipEnabled !== storedSettings.skipEnabled ||
        uiValues.skipAfterSeek !== storedSettings.skipAfterSeek ||
        uiValues.skipCCCaptions !== storedSettings.skipCCCaptions ||
        uiValues.minSkipSeconds.toFixed(2) !== storedSettings.minSkipSeconds.toFixed(2) ||
        uiValues.preSpeechOffsetSeconds.toFixed(2) !== storedSettings.preSpeechOffsetSeconds.toFixed(2) ||
        uiValues.postSilenceDelaySeconds.toFixed(2) !== storedSettings.postSilenceDelaySeconds.toFixed(2);

      UI.elements.applyBtn.disabled = !changed;
    },

    applySettings: function() {
      const settings = UI.readValues();
      SettingsManager.saveSettings(settings);
      EventHandlers.updateApplyButton();
    },

    setupEventListeners: function() {

      [
        UI.elements.skipToggle, 
        UI.elements.minSkipInput, 
        UI.elements.skipAfterSeekToggle, 
        UI.elements.skipCCCaptionsToggle,
        UI.elements.logLevelSelect,
        UI.elements.preSpeechOffsetInput,
        UI.elements.postSilenceDelayInput
      ].forEach((element) => {
        element.addEventListener("input", EventHandlers.updateApplyButton);
        element.addEventListener("change", EventHandlers.updateApplyButton);
      });

      UI.elements.applyBtn.addEventListener("click", EventHandlers.applySettings);
    }
  };

  function initialize() {

    if (!UI.init()) {
      console.error("[YSS] Failed to initialize popup");
      return;
    }

    SettingsManager.loadSettings().then((settings) => {
      UI.updateFromSettings(settings);
      EventHandlers.updateApplyButton();
    });

    EventHandlers.setupEventListeners();
  }

  document.addEventListener("DOMContentLoaded", initialize);

  // New functions for spinner buttons
  function getStep(input) {
    return parseFloat(input.step) || 1;
  }
  function getMin(input) {
    return input.min !== '' ? parseFloat(input.min) : -Infinity;
  }
  function getMax(input) {
    return input.max !== '' ? parseFloat(input.max) : Infinity;
  }
  function getPrecision(input) {
    const step = getStep(input);
    return step < 1 ? (step.toString().split('.')[1] || '').length : 0;
  }
  function spinInput(input, direction) {
    let step = getStep(input);
    let min = getMin(input);
    let max = getMax(input);
    let value = input.value === '' ? 0 : parseFloat(input.value);
    let newValue = direction === 'up' ? value + step : value - step;
    if (newValue > max) newValue = max;
    if (newValue < min) newValue = min;
    input.value = newValue.toFixed(getPrecision(input));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.custom-spinner .spinner-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        const wrapper = btn.closest('.number-input-wrapper');
        const input = wrapper.querySelector('input[type=number]');
        if (!input) return;
        if (btn.dataset.spin === 'up') {
          spinInput(input, 'up');
        } else {
          spinInput(input, 'down');
        }
      });
    });
  });
})();