/**
 * YouTube Silence Skipper - Background Script (Service Worker)
 * 
 * Intercepts YouTube timedtext API requests and delivers URLs to content scripts.
 * Each tab is handled independently to prevent cross-tab interference.
 */
const { MESSAGE_TYPES, TIMEDTEXT_FILTER } = SHARED_CONSTANTS;

(function YouTubeSilenceSkipperBackground() {
  'use strict';

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
     * Initializes network request interception and message listeners.
     */
    init: function() {
      browser.webRequest.onBeforeRequest.addListener(
        this.handleTimedTextRequest,
        TIMEDTEXT_FILTER,
        ["blocking"]
      );
      browser.runtime.onMessage.addListener(this.handleMessage.bind(this));
    },
    
    /**
     * Handles intercepted timedtext network requests, processes the URL, and sends it to the content script if pending.
     * @param {object} details - The network request details.
     * @returns {object} An empty object, indicating the request is not modified.
     */
    handleTimedTextRequest: function(details) {
      const { tabId, url } = details;
      
      if (tabId < 0) return {};

      let processedUrl = url;
      if (url.includes('tlang=')) {
        try {
          const urlObj = new URL(url);
          urlObj.searchParams.delete('tlang');
          processedUrl = urlObj.toString();
        } catch (err) {
          console.error('[YSS] URL processing failed, using original:', err);
          processedUrl = url;
        }
      }

      CacheManager.storeUrl(tabId, processedUrl);

      if (CacheManager.isTabPending(tabId)) {
        try {
          browser.tabs.sendMessage(tabId, { 
            type: MESSAGE_TYPES.TIMEDTEXT_URL, 
            url: processedUrl 
          });
          CacheManager.removeTabFromPending(tabId);
        } catch (err) {
          console.error('[YSS] Failed to send timedtext URL to tab:', err);
        }
      }
      
      return {cancel: false};
    },

    /**
     * Handles messages received from content scripts, responding to requests for timedtext URLs, premium status, or fetch resets.
     * @param {object} msg - The message received from the content script.
     * @param {object} sender - Details about the message sender.
     */
    handleMessage: function(msg, sender) {
      if (msg.type === MESSAGE_TYPES.REQUEST_TIMEDTEXT) {
        const tabId = sender.tab.id;
        const cachedUrl = CacheManager.getUrl(tabId);
        
        if (cachedUrl) {
          browser.tabs.sendMessage(tabId, { 
            type: MESSAGE_TYPES.TIMEDTEXT_URL, 
            url: cachedUrl 
          });
        } else {
          CacheManager.markTabAsPending(tabId);
        }
      } else if (msg.type === MESSAGE_TYPES.RESET_FETCH) {
        CacheManager.removeTabFromPending(sender.tab.id);
        CacheManager.resetTab(sender.tab.id);
      }
    }
  };

  /**
   * Initializes the extension's background script, setting up network handlers.
   */
  function initialize() {
    NetworkHandler.init();
  }

  initialize();
})();
