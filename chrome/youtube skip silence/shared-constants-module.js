export const SHARED_CONSTANTS = {

  TOAST_DURATION: 2500,
  CAPTION_TOGGLE_TIMEOUT: 500,
  PLAYER_INIT_DELAY: 1000,
  VIDEO_CHANGE_CHECK_INTERVAL: 2000,
  DEVELOPER_EN_SYLLABLE_SPEED_FACTOR: 1.5,
  DEVELOPER_EN_ONE_SYLLABLE_SKIP_THRESHOLD: 500, 
  DEVELOPER_EN_NOT_ENG_SKIP_THRESHOLD: 2000, 

  LOG_LEVELS: {
    NONE: 'none',
    DEFAULT: 'default', 
    DEBUG: 'debug'
  },

  DEFAULT_SETTINGS: {
    skipEnabled: true,
    minSkipSeconds: 0.2,
    skipAfterSeek: false,
    skipCCCaptions: true,
    logLevel: 'default',
    preSpeechOffsetSeconds: 0.00,
    postSilenceDelaySeconds: 0.00
  },

  MESSAGE_TYPES: {
    REQUEST_TIMEDTEXT: "request-timedtext",
    RESET_FETCH: "reset-fetch",
    TIMEDTEXT_URL: "timedtext-url",
    TIMEDTEXT_XML: "timedtext-xml",
    SET_SKIP_ENABLED: "set-skip-enabled",
    SET_MIN_SKIP: "set-min-skip",
    SET_SKIP_AFTER_SEEK: "set-skip-after-seek",
    SET_LOG_LEVEL: "set-log-level",
    SET_SKIP_CC_CAPTIONS: "set-skip-cc-captions",
    SET_PRE_SPEECH_OFFSET: "set-pre-speech-offset",
    SET_POST_SILENCE_DELAY: "set-post-silence-delay",
    SETTINGS_UPDATE: "settings-update"
  },

  SELECTORS: {
    VIDEO: 'video',
    PLAYER: '.html5-video-player',
    CAPTION_BUTTON: '.ytp-subtitles-button',
    AD_OVERLAY: '.ytp-ad-player-overlay',
    AD_SKIP_BUTTON: '.ytp-ad-skip-button',
    AD_INFO_PANEL: '.ytp-ad-info-panel-container'
  },

  TIMEDTEXT_FILTER: {
    urls: ["https://www.youtube.com/api/timedtext*"]
  },

  YOUTUBE_URL_PATTERN: "https://www.youtube.com/*"
};
