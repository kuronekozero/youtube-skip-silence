/**
 * YouTube Silence Skipper - Background Service Worker
 * 
 * Intercepts YouTube timedtext API requests and delivers URLs to content scripts.
 * Each tab is handled independently to prevent cross-tab interference.
 */
import { SHARED_CONSTANTS } from './shared-constants-module.js';
const { MESSAGE_TYPES, TIMEDTEXT_FILTER } = SHARED_CONSTANTS;

const CacheManager = {
  timedtextCache: new Map(),
  pendingTabs: new Set(),
  
  /**
   * Stores a timedtext URL for a given tab.
   * @param {number} tabId - Identifier for the browser tab.
   * @param {string} url - The timedtext URL to store.
   */
  storeUrl: function(tabId, url) {
    this.timedtextCache.set(tabId, url);
  },
  
  /**
   * Retrieves the stored timedtext URL for a given tab.
   * @param {number} tabId - Identifier for the browser tab.
   * @returns {string|undefined} The timedtext URL or undefined if not found.
   */
  getUrl: function(tabId) {
    return this.timedtextCache.get(tabId);
  },
  
  /**
   * Checks if a timedtext URL is cached for a specific tab.
   * @param {number} tabId - Identifier for the browser tab.
   * @returns {boolean} True if a URL is cached, false otherwise.
   */
  hasUrl: function(tabId) {
    return this.timedtextCache.has(tabId);
  },
  
  /**
   * Marks a tab as awaiting a timedtext URL.
   * @param {number} tabId - Identifier for the browser tab.
   */
  markTabAsPending: function(tabId) {
    this.pendingTabs.add(tabId);
  },
  
  /**
   * Checks if a tab is currently awaiting a timedtext URL.
   * @param {number} tabId - Identifier for the browser tab.
   * @returns {boolean} True if the tab is pending, false otherwise.
   */
  isTabPending: function(tabId) {
    return this.pendingTabs.has(tabId);
  },
  
  /**
   * Removes a tab from the pending list.
   * @param {number} tabId - Identifier for the browser tab.
   */
  removeTabFromPending: function(tabId) {
    this.pendingTabs.delete(tabId);
  },
  
  /**
   * Resets all cached data for a specific tab.
   * @param {number} tabId - Identifier for the browser tab.
   */
  resetTab: function(tabId) {
    this.timedtextCache.delete(tabId);
    this.pendingTabs.delete(tabId);
  }
};

const NetworkHandler = {
  /**
   * Initializes network request listeners and message listeners.
   */
  init: function() {
    // Listen for timedtext API requests
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleTimedtextRequest.bind(this),
      { urls: ["https://www.youtube.com/api/timedtext*"] }
    );
    
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  },

  /**
   * Captures the timedtext URL, stores it, and sends it to a pending content script.
   * @param {object} details - Details of the intercepted web request.
   */
  handleTimedtextRequest: function(details) {
    const { tabId, url } = details;
    if (tabId < 0) return;

    // The 'tlang' parameter forces a translation, which we don't want.
    // We remove it to get the original language captions if available.
    let processedUrl = url;
    if (url.includes('tlang=')) {
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.delete('tlang');
        processedUrl = urlObj.toString();
      } catch (err) {
        console.error('[YSS] URL processing failed, using original:', err);
      }
    }

    CacheManager.storeUrl(tabId, processedUrl);

    // If the content script for this tab is already waiting for the URL, send it now.
    if (CacheManager.isTabPending(tabId)) {
      try {
        chrome.tabs.sendMessage(tabId, { 
          type: MESSAGE_TYPES.TIMEDTEXT_URL, 
          url: processedUrl 
        });
        CacheManager.removeTabFromPending(tabId);
      } catch (err) {
        // This can happen if the tab was closed before the message could be sent.
        console.warn('[YSS] Failed to send timedtext URL to tab, it may have closed:', err);
      }
    }
  },
  
  /**
   * Handles messages received from content scripts.
   * @param {object} msg - The message received.
   * @param {object} sender - Details about the message sender.
   */
  handleMessage: function(msg, sender) {
    if (msg.type === MESSAGE_TYPES.REQUEST_TIMEDTEXT) {
      const tabId = sender.tab.id;
      const cachedUrl = CacheManager.getUrl(tabId);
      
      if (cachedUrl) {
        // If we already have the URL, send it immediately.
        chrome.tabs.sendMessage(tabId, { 
          type: MESSAGE_TYPES.TIMEDTEXT_URL, 
          url: cachedUrl 
        });
      } else {
        // Otherwise, mark the tab as waiting for the URL.
        // The handleTimedtextRequest listener will send it when it arrives.
        CacheManager.markTabAsPending(tabId);
      }
    } else if (msg.type === MESSAGE_TYPES.RESET_FETCH) {
      // Clear cache when navigating to a new video.
      CacheManager.resetTab(sender.tab.id);
    }
    return true; // Indicates an async response may be sent.
  }
};

/**
 * Initializes the extension's background script, setting up network handlers.
 */
async function initialize() {
  await NetworkHandler.init();
}

initialize();
