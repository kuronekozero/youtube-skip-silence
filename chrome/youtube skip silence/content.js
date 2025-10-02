(function YouTubeSilenceSkipper() {
  'use strict';

  if (!window.location.pathname.startsWith('/watch')) {
    return;
  }

  const { 
    TOAST_DURATION, 
    CAPTION_TOGGLE_TIMEOUT, 
    PLAYER_INIT_DELAY, 
    VIDEO_CHANGE_CHECK_INTERVAL,
    DEFAULT_SETTINGS, 
    MESSAGE_TYPES, 
    SELECTORS,
    LOG_LEVELS,
    DEVELOPER_EN_SYLLABLE_SPEED_FACTOR,
    DEVELOPER_EN_ONE_SYLLABLE_SKIP_THRESHOLD,
    DEVELOPER_EN_NOT_ENG_SKIP_THRESHOLD
  } = window.SHARED_CONSTANTS;

  const State = {

    initialized: false,

    hasCaptions: false,
    captionStateChanged: false,
    captionToggleTimer: null,
    originalCaptionState: null,
    currentLanguageCode: null, 
    currentTimedTextUrl: null, 

    skipEnabled: true,
    minSkipSeconds: 0.1,
    skipAfterSeek: false,
    skipCCCaptions: false,
    skipHandler: null,
    activeTimeoutId: null,
    videoEventListeners: [],
    preSpeechOffsetSeconds: 0.00,
    postSilenceDelaySeconds: 0.00,

    isAdPlaying: false,
    adCheckInterval: null,
    pendingCaptionRequest: false,

    logLevel: 'default',

    loadSettings: async function() {
      const res = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      this.skipEnabled = !!res.skipEnabled;
      this.minSkipSeconds = Number(res.minSkipSeconds) || DEFAULT_SETTINGS.minSkipSeconds;
      this.skipAfterSeek = !!res.skipAfterSeek;
      this.skipCCCaptions = !!res.skipCCCaptions;
      this.logLevel = res.logLevel || DEFAULT_SETTINGS.logLevel;
      this.preSpeechOffsetSeconds = Number(res.preSpeechOffsetSeconds);
      if(isNaN(this.preSpeechOffsetSeconds)) this.preSpeechOffsetSeconds = DEFAULT_SETTINGS.preSpeechOffsetSeconds;
      this.postSilenceDelaySeconds = Number(res.postSilenceDelaySeconds);
      if(isNaN(this.postSilenceDelaySeconds)) this.postSilenceDelaySeconds = DEFAULT_SETTINGS.postSilenceDelaySeconds;
    },

    resetForNewVideo: function() {
      this.hasCaptions = false;
      this.captionStateChanged = false;
      this.originalCaptionState = null;
      this.currentLanguageCode = null;
      this.currentTimedTextUrl = null;
      this.isAdPlaying = false;
      this.pendingCaptionRequest = false;
      this.skipHandler = null;

      if (this.captionToggleTimer !== null) {
        clearTimeout(this.captionToggleTimer);
        this.captionToggleTimer = null;
      }

      if (this.activeTimeoutId !== null) {
        clearTimeout(this.activeTimeoutId);
        this.activeTimeoutId = null;
      }

      this.removeAllVideoEventListeners();
    },

    addVideoEventListener: function(video, event, handler) {
      video.addEventListener(event, handler);
      this.videoEventListeners.push({ video, event, handler });
    },

    removeAllVideoEventListeners: function() {
      this.videoEventListeners.forEach(({ video, event, handler }) => {
        try {
          video.removeEventListener(event, handler);
        } catch (err) {

        }
      });
      this.videoEventListeners = [];
    }
  };

  const Utils = {

    logConsole: function(message, level = 'debug') {
      if (State.logLevel === LOG_LEVELS.NONE) return;

      if (State.logLevel === LOG_LEVELS.DEBUG || 
          (State.logLevel === LOG_LEVELS.DEFAULT && level === 'default')) {
        console.log('[YSS] ' + message);
      }
    },

    logToast: function(message, level = 'debug') {
      if (State.logLevel === LOG_LEVELS.NONE) return;

      if (State.logLevel === LOG_LEVELS.DEBUG || 
          (State.logLevel === LOG_LEVELS.DEFAULT && level === 'default')) {
        UI.showToast(message);
      }
    },

    extractVideoId: function() {
      const params = new URLSearchParams(window.location.search);
      return params.get("v") || "";
    },

    decodeHTMLEntities: function(str) {
      const txt = document.createElement("textarea");
      txt.innerHTML = str;
      return txt.value;
    }
  };

  const CaptionManager = {

    isCaptionEnabled: function() {
      try {

        const captionButton = document.querySelector(SELECTORS.CAPTION_BUTTON);
        if (!captionButton) return null;

        return captionButton.getAttribute('aria-pressed') === 'true';
      } catch (err) {
        console.error('[YSS] Failed to check caption state:', err);
        return null;
      }
    },

    toggleCaptions: function(enable) {
      try {
        const captionButton = document.querySelector(SELECTORS.CAPTION_BUTTON);
        if (!captionButton) return false;

        const currentState = captionButton.getAttribute('aria-pressed') === 'true';

        if (currentState !== enable) {
          captionButton.click();
          Utils.logConsole('Updating settings');
          return true;
        }
        return true; 
      } catch (err) {
        console.error('[YSS] Failed to toggle captions:', err);
        return false;
      }
    },

    temporarilyEnableCaptions: function() {

      if (State.captionToggleTimer !== null) {
        clearTimeout(State.captionToggleTimer);
        State.captionToggleTimer = null;
      }

      State.originalCaptionState = this.isCaptionEnabled();

      if (State.originalCaptionState === false) {
        Utils.logConsole('Initializing video analysis');

        if (this.toggleCaptions(true)) {
          State.captionStateChanged = true;

          State.captionToggleTimer = setTimeout(() => {
            if (State.captionStateChanged) {
              Utils.logToast('This video is not supported.', 'default');
              Utils.logToast('No captions found to work with! 🤷‍♂️', 'default');
              this.toggleCaptions(false);
              State.captionStateChanged = false;
            }
            State.captionToggleTimer = null;
          }, CAPTION_TOGGLE_TIMEOUT);
        }
      }
    },

    restoreOriginalCaptionState: function() {
      if (State.captionStateChanged && State.originalCaptionState !== null) {
        Utils.logConsole('Restoring original settings');
        this.toggleCaptions(State.originalCaptionState);
        State.captionStateChanged = false;
      }

      if (State.captionToggleTimer !== null) {
        clearTimeout(State.captionToggleTimer);
        State.captionToggleTimer = null;
      }
    }
  };

  const AdDetector = {

    init: function() {

      this.startAdCheck();
    },

    startAdCheck: function() {

      if (State.adCheckInterval !== null) {
        clearInterval(State.adCheckInterval);
      }

      this.checkForAd();

      State.adCheckInterval = setInterval(() => this.checkForAd(), 1000);
    },

    stopAdCheck: function() {
      if (State.adCheckInterval !== null) {
        clearInterval(State.adCheckInterval);
        State.adCheckInterval = null;
      }
    },

    checkForAd: function() {
      const wasAdPlaying = State.isAdPlaying;

      const player = document.querySelector(SELECTORS.PLAYER);
      const isAdShowing = player && player.classList.contains('ad-showing');

      const adOverlay = document.querySelector(SELECTORS.AD_OVERLAY);
      const skipButton = document.querySelector(SELECTORS.AD_SKIP_BUTTON);

      const adInfoPanel = document.querySelector(SELECTORS.AD_INFO_PANEL);

      State.isAdPlaying = isAdShowing || !!adOverlay || !!skipButton || !!adInfoPanel;

      if (wasAdPlaying !== State.isAdPlaying) {
        Utils.logConsole(`Ad state changed: ${State.isAdPlaying ? 'Ad started' : 'Ad ended'}`);

        if (State.isAdPlaying) {
          Utils.logToast("Ad detected - extension paused");
        } else {
          Utils.logToast("Ad ended - extension resumed");

          if (State.pendingCaptionRequest) {
            Utils.logConsole('Resuming operations after interruption');
            State.pendingCaptionRequest = false;
            requestCaptions();
          }

          if (typeof State.skipHandler === "function") {
            State.skipHandler();
          }
        }
      }
    }
  };

  const LanguageProcessorInterface = {

    getLanguageCode: function() {
      throw new Error('LanguageProcessorInterface.getLanguageCode() must be implemented');
    },

    calculatePronunciationTime: function(word) {
      throw new Error('LanguageProcessorInterface.calculatePronunciationTime() must be implemented');
    },

    extractWordEvents: function(events) {
      throw new Error('LanguageProcessorInterface.extractWordEvents() must be implemented');
    },

    canHandle: function(languageCode) {
      return languageCode === this.getLanguageCode();
    }
  };

  const BaseLanguageProcessor = Object.create(LanguageProcessorInterface);
  BaseLanguageProcessor.extractWordEvents = function(events) {
    const wordEvents = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.segs || !Array.isArray(event.segs)) continue;

      for (let j = 0; j < event.segs.length; j++) {
        const seg = event.segs[j];
        const segText = seg.utf8 || '';
        const cleanWord = segText.trim();

        if (cleanWord.length > 0) {
          const pronunciationTime = this.calculatePronunciationTime(cleanWord);
          const wordStartMs = (event.tStartMs || 0) + (seg.tOffsetMs || 0);
          const wordEndMs = wordStartMs + pronunciationTime.totalDurationMs;

          wordEvents.push({
            originalEvent: event,
            segmentIndex: j,
            startMs: wordStartMs,
            endMs: wordEndMs,
            word: cleanWord,
            pronunciationTime: pronunciationTime
          });
        }
      }
    }

    return wordEvents;
  };

  const EnglishProcessor = Object.create(BaseLanguageProcessor);

  EnglishProcessor.getLanguageCode = function() {
    return 'en';
  };

  EnglishProcessor.countSyllables = function(word) {
    if (!word || typeof word !== 'string') return 0;

    word = word.toLowerCase().trim();
    if (word.length === 0) return 0;

    let syllableCount = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const isVowel = /[aeiou]/.test(char);
      const isY = char === 'y';

      if (isVowel) {
        if (!previousWasVowel) {
          syllableCount++;
        }
        previousWasVowel = true;
      } else if (isY && i > 0) {

        if (!previousWasVowel) {
          syllableCount++;
        }
        previousWasVowel = true;
      } else {
        previousWasVowel = false;
      }
    }

    if (word.endsWith('e') && syllableCount > 1 && !/[aeiou]e$/.test(word.slice(-2))) {
      syllableCount--;
    }

    if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word.charAt(word.length - 3))) {
      syllableCount++;
    }

    if (word.endsWith('ed') && word.length > 2) {
      const beforeEd = word.charAt(word.length - 3);
      if (!/[td]/.test(beforeEd)) {
        syllableCount = Math.max(1, syllableCount - 1);
      }
    }

    if (word.endsWith('es') && word.length > 2) {
      const beforeEs = word.slice(-4, -2);
      if (/ch|sh|ss|[sxz]/.test(beforeEs)) {

      } else {
        syllableCount = Math.max(1, syllableCount - 1);
      }
    }

    return Math.max(1, syllableCount);
  };

  EnglishProcessor.calculatePronunciationTime = function(word) {

    if (true && TimedTextHandler.isCCCaption(word)) {
      return {
        totalDurationMs: 10 
      };
    }

    const hasNumbersOrUppercase = /[0-9A-Z]/.test(word);
    if (hasNumbersOrUppercase) {
      return {
        totalDurationMs: DEVELOPER_EN_NOT_ENG_SKIP_THRESHOLD 
      };
    }

    const syllableCount = this.countSyllables(word);

    if (syllableCount === 1) {
      return {
        totalDurationMs: DEVELOPER_EN_ONE_SYLLABLE_SKIP_THRESHOLD 
      };
    }

    let syllableDuration;
    if (syllableCount === 2) {
      syllableDuration = 225; 
    } else if (syllableCount === 3) {
      syllableDuration = 175; 
    } else {

      syllableDuration = 125;
    }

    const totalDuration = syllableCount * syllableDuration * DEVELOPER_EN_SYLLABLE_SPEED_FACTOR; 

    return {
      totalDurationMs: totalDuration
    };
  };

  const KoreanProcessor = Object.create(BaseLanguageProcessor);

  KoreanProcessor.getLanguageCode = function() {
    return 'ko';
  };

  KoreanProcessor.calculatePronunciationTime = function(word) {

    if (true && TimedTextHandler.isCCCaption(word)) {
      return {
        totalDurationMs: 10
      };
    }

    const charCount = word.length;
    const baseTimePerChar = 200; 

    return {
      totalDurationMs: Math.max(100, charCount * baseTimePerChar)
    };
  };

  const JapaneseProcessor = Object.create(BaseLanguageProcessor);

  JapaneseProcessor.getLanguageCode = function() {
    return 'ja';
  };

  JapaneseProcessor.getCharacterType = function(code) {
    if (code >= 0x3040 && code <= 0x309F) return 'hiragana';
    if (code >= 0x30A0 && code <= 0x30FF) return 'katakana';  
    if (code >= 0x4E00 && code <= 0x9FAF) return 'kanji';
    return 'other';
  };

  JapaneseProcessor.isSmallKana = function(char) {
    const smallKana = ['ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ', 'っ', 'ッ'];
    return smallKana.includes(char);
  };

  JapaneseProcessor.countHiraganaMora = function(char, nextChar) {

    switch (char) {
      case 'っ': 
        return 1; 
      case 'ー': 
        return 1; 
      case 'ん': 
        return 1; 
    }

    if (nextChar && this.isSmallKana(nextChar)) {
      return 1; 
    }

    return 1;
  };

  JapaneseProcessor.countKatakanaMora = function(char, nextChar) {

    switch (char) {
      case 'ッ': 
        return 1;
      case 'ー': 
        return 1;
      case 'ン': 
        return 1;
    }

    if (nextChar && this.isSmallKana(nextChar)) {
      return 1; 
    }

    return 1;
  };

  JapaneseProcessor.isCommonSingleMoraKanji = function(char) {
    const singleMoraKanji = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', 
                            '人', '大', '小', '中', '上', '下', '左', '右', '前', '後'];
    return singleMoraKanji.includes(char);
  };

  JapaneseProcessor.isCommonLongKanji = function(char) {

    const longKanji = ['難', '複', '雑', '議', '説', '関', '係', '様', '業'];
    return longKanji.includes(char);
  };

  JapaneseProcessor.estimateKanjiMora = function(char) {
    if (this.isCommonSingleMoraKanji(char)) {
      return 1;
    } else if (this.isCommonLongKanji(char)) {
      return 3;
    } else {
      return 2; 
    }
  };

  JapaneseProcessor.countMora = function(word) {
    if (!word || typeof word !== 'string') return 0;

    let moraCount = 0;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const code = char.charCodeAt(0);
      const nextChar = i + 1 < word.length ? word[i + 1] : null;

      const charType = this.getCharacterType(code);

      switch (charType) {
        case 'hiragana':
          moraCount += this.countHiraganaMora(char, nextChar);
          break;
        case 'katakana':
          moraCount += this.countKatakanaMora(char, nextChar);
          break;
        case 'kanji':
          moraCount += this.estimateKanjiMora(char);
          break;
        default:

          moraCount += 0.5;
      }
    }

    return Math.max(1, Math.round(moraCount));
  };

  JapaneseProcessor.analyzeCharacterTypes = function(word) {
    let hiraganaCount = 0;
    let katakanaCount = 0;
    let kanjiCount = 0;
    let otherCount = 0;

    for (const char of word) {
      const code = char.charCodeAt(0);
      const charType = this.getCharacterType(code);

      switch (charType) {
        case 'hiragana': hiraganaCount++; break;
        case 'katakana': katakanaCount++; break;
        case 'kanji': kanjiCount++; break;
        default: otherCount++;
      }
    }

    const total = hiraganaCount + katakanaCount + kanjiCount + otherCount;

    return {
      hiraganaCount: hiraganaCount,
      katakanaCount: katakanaCount,
      kanjiCount: kanjiCount,
      otherCount: otherCount,
      hiraganaRatio: hiraganaCount / total,
      katakanaRatio: katakanaCount / total,
      kanjiRatio: kanjiCount / total,
      otherRatio: otherCount / total
    };
  };

  JapaneseProcessor.processChōon = function(word) {
    const chōonCount = (word.match(/ー/g) || []).length;
    return chōonCount * 80; 
  };

  JapaneseProcessor.detectSpeechLevel = function(word) {

    const politeEndings = ['ます', 'です', 'ございます', 'であります'];

    const casualEndings = ['だ', 'である', 'じゃん', 'よ', 'ね'];

    for (const ending of politeEndings) {
      if (word.endsWith(ending)) {
        return 'polite';
      }
    }

    for (const ending of casualEndings) {
      if (word.endsWith(ending)) {
        return 'casual';
      }
    }

    return 'neutral';
  };

  JapaneseProcessor.hasRepeatingPattern = function(word) {
    if (word.length < 4) return false;

    const halfLength = Math.floor(word.length / 2);
    const firstHalf = word.substring(0, halfLength);
    const secondHalf = word.substring(halfLength, halfLength * 2);

    return firstHalf === secondHalf;
  };

  JapaneseProcessor.detectOnomatopoeia = function(word) {
    const characterTypes = this.analyzeCharacterTypes(word);

    if (characterTypes.katakanaRatio > 0.8 && this.hasRepeatingPattern(word)) {
      return 'onomatopoeia';
    }

    const exclamations = ['あっ', 'えっ', 'おっ', 'うわっ', 'わあ'];
    if (exclamations.includes(word)) {
      return 'exclamation';
    }

    return 'normal';
  };

  JapaneseProcessor.calculatePronunciationTime = function(word) {

    if (true && TimedTextHandler.isCCCaption(word)) {
      return {
        totalDurationMs: 10
      };
    }

    const moraCount = this.countMora(word);
    const characterTypes = this.analyzeCharacterTypes(word);

    let baseDurationPerMora = 150;

    if (characterTypes.kanjiRatio > 0.5) {
      baseDurationPerMora += 20; 
    }
    if (characterTypes.katakanaRatio > 0.5) {
      baseDurationPerMora -= 10; 
    }

    let totalDuration = moraCount * baseDurationPerMora;
    let adjustmentFactor = 1.0;

    totalDuration += this.processChōon(word);

    if (word.includes('っ') || word.includes('ッ')) {
      totalDuration += 30; 
    }

    const speechLevel = this.detectSpeechLevel(word);
    if (speechLevel === 'polite') {
      adjustmentFactor *= 1.1; 
    } else if (speechLevel === 'casual') {
      adjustmentFactor *= 0.95; 
    }

    const wordType = this.detectOnomatopoeia(word);
    if (wordType === 'onomatopoeia') {
      adjustmentFactor *= 1.2; 
    } else if (wordType === 'exclamation') {
      adjustmentFactor *= 1.15; 
    }

    const finalDuration = Math.round(totalDuration * adjustmentFactor);

    return {
      totalDurationMs: Math.max(100, finalDuration * 2.0),
      moraCount: moraCount,
      baseDurationPerMora: baseDurationPerMora,
      characterTypes: characterTypes,
      speechLevel: speechLevel,
      wordType: wordType,
      chōonTime: this.processChōon(word),
      adjustmentFactor: adjustmentFactor
    };
  };

  const ChineseProcessor = Object.create(BaseLanguageProcessor);

  ChineseProcessor.getLanguageCode = function() {
    return 'zh';
  };

  ChineseProcessor.canHandle = function(languageCode) {
    return false;
  };

  ChineseProcessor.calculatePronunciationTime = function(word) {

    if (true && TimedTextHandler.isCCCaption(word)) {
      return {
        totalDurationMs: 10
      };
    }

    let chineseCharCount = 0;
    for (const char of word) {
      const code = char.charCodeAt(0);
      if (code >= 0x4E00 && code <= 0x9FAF) {

        chineseCharCount++;
      }
    }

    const baseTimePerChar = 180; 
    const totalChars = chineseCharCount || word.length;

    return {
      totalDurationMs: Math.max(100, totalChars * baseTimePerChar)
    };
  };

  const SpanishProcessor = Object.create(BaseLanguageProcessor);

  SpanishProcessor.getLanguageCode = function() {
    return 'es';
  };

  SpanishProcessor.canHandle = function(languageCode) {
    return false;
  };

  SpanishProcessor.calculatePronunciationTime = function(word) {

    if (true && TimedTextHandler.isCCCaption(word)) {
      return {
        totalDurationMs: 10
      };
    }

    const vowelPattern = /[aeiouáéíóúü]/gi;
    const vowelGroups = word.match(vowelPattern) || [];
    let syllableCount = vowelGroups.length;

    const diphthongs = /[aeiouáéíóúü][iu]/gi;
    const diphthongCount = (word.match(diphthongs) || []).length;
    syllableCount = Math.max(1, syllableCount - diphthongCount);

    const baseTimePerSyllable = 160; 

    return {
      totalDurationMs: Math.max(100, syllableCount * baseTimePerSyllable)
    };
  };

  const LanguageProcessorManager = {
    processors: [],
    defaultProcessor: null,

    init: function() {

      this.processors = [
        EnglishProcessor,
        KoreanProcessor,
        JapaneseProcessor,
        ChineseProcessor,
        SpanishProcessor
      ];

      this.defaultProcessor = EnglishProcessor;
    },

    getProcessor: function(languageCode) {
      if (!languageCode) return this.defaultProcessor;

      const normalizedCode = languageCode.toLowerCase().split(/[-_]/)[0];

      for (const processor of this.processors) {
        if (processor.canHandle(normalizedCode)) {
          return processor;
        }
      }

      const languageName = this.getLanguageName(normalizedCode);
      Utils.logToast(`${languageName} auto-captions are currently not supported. 🌐`, 'default');
      Utils.logConsole(`No processor found for language '${languageCode}' (${languageName})`);

      return null;
    },

    getLanguageName: function(languageCode) {
      const languageNames = {
        'en': 'English',
        'ko': 'Korean',
        'ja': 'Japanese', 
        'zh': 'Chinese',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'th': 'Thai',
        'vi': 'Vietnamese',
        'tr': 'Turkish',
        'pl': 'Polish',
        'nl': 'Dutch',
        'sv': 'Swedish',
        'da': 'Danish',
        'no': 'Norwegian',
        'fi': 'Finnish',
        'he': 'Hebrew',
        'cs': 'Czech',
        'hu': 'Hungarian',
        'ro': 'Romanian',
        'bg': 'Bulgarian',
        'hr': 'Croatian',
        'sk': 'Slovak',
        'sl': 'Slovenian',
        'et': 'Estonian',
        'lv': 'Latvian',
        'lt': 'Lithuanian',
        'mt': 'Maltese'
      };

      return languageNames[languageCode] || languageCode.toUpperCase();
    },

    detectLanguageFromUrl: function(timedTextUrl) {
      if (!timedTextUrl || typeof timedTextUrl !== 'string') return null;

      try {
        const url = new URL(timedTextUrl);
        const params = url.searchParams;

        const lang = params.get('lang') || params.get('tlang') || params.get('hl');
        if (lang) {
          return lang.toLowerCase();
        }

        const langMatch = timedTextUrl.match(/[&?]lang=([a-z]{2}(?:-[A-Z]{2})?)/i);
        if (langMatch) {
          return langMatch[1].toLowerCase();
        }

      } catch (err) {
        Utils.logConsole('Failed to parse timedtext URL for language detection: ' + err.message);
      }

      return null;
    }
  };

  LanguageProcessorManager.init();

  const SkipProcessor = {

    createVideoEventHandlers: function(skipHandler, context) {
      return {
        seeking: () => { 
          context.userSeeked = true; 
          context.clearScheduled(); 
        },
        seeked: skipHandler,
        play: skipHandler,
        pause: context.clearScheduled
      };
    },

    createAutoGeneratedVideoEventHandlers: function(skipHandler, context) {
      return {
        seeking: () => { 

          if (!context.programmaticSkip) {
            context.userSeeked = true; 
          }
          context.clearScheduled(); 
        },
        seeked: () => {

          if (context.programmaticSkip) {
            context.programmaticSkip = false;
          }
          skipHandler();
        },
        play: skipHandler,
        pause: context.clearScheduled
      };
    },

    registerVideoEventListeners: function(video, handlers) {
      Object.entries(handlers).forEach(([event, handler]) => {
        State.addVideoEventListener(video, event, handler);
      });
    },

    createScheduler: function(processingFunction, state) {
      return {
        clearScheduled: function() {
          if (state.timeoutId !== null) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null;
            State.activeTimeoutId = null;
          }
        },
        scheduleNextCheck: function(waitMs) {
          this.clearScheduled();
          state.timeoutId = setTimeout(processingFunction, waitMs);
          State.activeTimeoutId = state.timeoutId;
        }
      };
    }
  };

  const AutoCaptionUtils = {

    extractWordEvents: function(events, languageCode) {
      const processor = LanguageProcessorManager.getProcessor(languageCode);

      if (!processor) {
        Utils.logConsole(`Language ${languageCode} not supported for auto-generated captions`);
        return [];
      }

      Utils.logConsole(`Using ${processor.getLanguageCode()} processor for word event extraction`);

      return processor.extractWordEvents(events);
    },

    calculateSkipZones: function(wordEvents) {
      const skipZones = [];

      for (let i = 0; i < wordEvents.length - 1; i++) {
        const currentWord = wordEvents[i];
        const nextWord = wordEvents[i + 1];
        const gapMs = nextWord.startMs - currentWord.endMs;
        const gapSec = gapMs / 1000;

        if (gapMs > 0) {
          skipZones.push({
            id: skipZones.length,
            fromWord: currentWord.word,
            toWord: nextWord.word,
            skipFromMs: currentWord.endMs,
            skipToMs: nextWord.startMs,
            gapDurationMs: gapMs,
            gapDurationSec: gapSec
          });
        }
      }

      return skipZones;
    }
  };

  const ManualCaptionProcessor = {

    process: function(events, video) {
      let currentEventIndex = 0;
      let timeoutId = null;
      let userSeeked = false;

      const scheduler = SkipProcessor.createScheduler(moveToNextCaption, { timeoutId });
      const context = { 
        get userSeeked() { return userSeeked; },
        set userSeeked(value) { userSeeked = value; },
        clearScheduled: scheduler.clearScheduled 
      };

      function moveToNextCaption() {
        const video = document.querySelector(SELECTORS.VIDEO);
        if (!video) return; 

        if (video.paused) {

          scheduler.clearScheduled();
          return;
        }

        if (State.isAdPlaying) {
          scheduler.scheduleNextCheck(1000);
          return;
        }

        const nowMs = video.currentTime * 1000;

        if (currentEventIndex > 0 && nowMs < (events[currentEventIndex].tStartMs ?? 0)) {
          currentEventIndex = 0;
        }

        while (
          currentEventIndex < events.length &&
          ((events[currentEventIndex].tStartMs ?? 0) +
            (events[currentEventIndex].dDurationMs ?? 0) <= nowMs)
        ) {
          currentEventIndex++;
        }

        currentEventIndex = TimedTextHandler.skipCCCaptionsIfEnabled(events, currentEventIndex);

        if (currentEventIndex >= events.length) {
          scheduler.clearScheduled();
          return;
        }

        const event = events[currentEventIndex];
        const startMs = event.tStartMs ?? 0;
        const endMs = startMs + (event.dDurationMs ?? 0);

        const targetSkipTimeMs = Math.max(0, startMs - (State.preSpeechOffsetSeconds * 1000));

        if (nowMs < startMs) {
          const gapSec = (startMs - nowMs) / 1000;
          const shouldSkip =
            State.skipEnabled &&
            (!userSeeked || State.skipAfterSeek) &&
            gapSec >= State.minSkipSeconds &&
            !State.isAdPlaying;

          if (shouldSkip) {

            if (video.currentTime * 1000 < targetSkipTimeMs) {
              video.currentTime = targetSkipTimeMs / 1000;
              Utils.logToast(
                `Skipped ${gapSec.toFixed(2)} s, now at ${(targetSkipTimeMs / 1000).toFixed(2)} s.`,
                'default'
              );

              return;
            }
          }

          const timeUntilNextCheckMs = Math.max(0, targetSkipTimeMs - nowMs);
          scheduler.scheduleNextCheck(timeUntilNextCheckMs);
        } else {
          userSeeked = false;

          scheduler.scheduleNextCheck(Math.max(0, endMs - nowMs));
        }
      }

      State.skipHandler = moveToNextCaption;
      const handlers = SkipProcessor.createVideoEventHandlers(moveToNextCaption, context);
      SkipProcessor.registerVideoEventListeners(video, handlers);
      moveToNextCaption();
    }
  };

  const AutoGeneratedCaptionProcessor = {

    process: function(events, video, languageCode) {
      Utils.logConsole(`Processing auto-generated captions for language: ${languageCode || 'unknown'}`);

      const wordEvents = AutoCaptionUtils.extractWordEvents(events, languageCode);
      const skipZones = AutoCaptionUtils.calculateSkipZones(wordEvents);

      Utils.logConsole(`Total skip zones calculated: ${skipZones.length}`);

      if (skipZones.length === 0) {
        Utils.logToast("Nothing to skip here! 🎵");
        State.skipHandler = undefined;
        return;
      }

      let currentSkipZoneIndex = 0;
      let timeoutId = null;
      let userSeeked = false;
      let programmaticSkip = false; 

      const scheduler = SkipProcessor.createScheduler(processSkipZones, { timeoutId });
      const context = { 
        get userSeeked() { return userSeeked; },
        set userSeeked(value) { userSeeked = value; },
        get programmaticSkip() { return programmaticSkip; },
        set programmaticSkip(value) { programmaticSkip = value; },
        clearScheduled: scheduler.clearScheduled 
      };

      function processSkipZones() {
        const video = document.querySelector(SELECTORS.VIDEO);
        if (!video) return; 

        if (video.paused) {

          scheduler.clearScheduled();
          return;
        }

        if (State.isAdPlaying) {
          scheduler.scheduleNextCheck(1000);
          return;
        }

        const nowMs = video.currentTime * 1000;

        if (currentSkipZoneIndex > 0 && nowMs < skipZones[currentSkipZoneIndex].skipFromMs) {
          currentSkipZoneIndex = 0;
        }

        while (
          currentSkipZoneIndex < skipZones.length &&
          skipZones[currentSkipZoneIndex].skipToMs <= nowMs
        ) {
          currentSkipZoneIndex++;
        }

        if (currentSkipZoneIndex >= skipZones.length) {
          scheduler.clearScheduled();
          return;
        }

        const currentSkipZone = skipZones[currentSkipZoneIndex];

        const adjustedSkipFromMs = currentSkipZone.skipFromMs + (State.postSilenceDelaySeconds * 1000);

        const adjustedSkipToMs = currentSkipZone.skipToMs - (State.preSpeechOffsetSeconds * 1000);

        const skipTargetTimeMs = Math.max(adjustedSkipFromMs, adjustedSkipToMs);

        if (nowMs >= adjustedSkipFromMs && nowMs < currentSkipZone.skipToMs) {
          const gapSec = (currentSkipZone.skipToMs - nowMs) / 1000;
          const shouldSkip =
            State.skipEnabled &&
            (!userSeeked || State.skipAfterSeek) &&
            gapSec >= State.minSkipSeconds &&
            !State.isAdPlaying;

          if (shouldSkip) {

            if (video.currentTime * 1000 < skipTargetTimeMs) {
              programmaticSkip = true; 
              video.currentTime = skipTargetTimeMs / 1000;
              if(gapSec > 0) {
                Utils.logToast(
                  `Skipped ${gapSec.toFixed(2)} s gap, now at ${(skipTargetTimeMs / 1000).toFixed(2)} s.`,
                  'default'
                );
              }

              return;
            }
          }

          const timeUntilNextCheckMs = Math.max(0, skipTargetTimeMs - nowMs);
          scheduler.scheduleNextCheck(timeUntilNextCheckMs);
        } else {
          userSeeked = false;

          const nextCheckTimeMs = (nowMs < adjustedSkipFromMs) ? adjustedSkipFromMs : currentSkipZone.skipFromMs; 
          scheduler.scheduleNextCheck(Math.max(0, nextCheckTimeMs - nowMs));
        }
      }

      State.skipHandler = processSkipZones;
      const handlers = SkipProcessor.createAutoGeneratedVideoEventHandlers(processSkipZones, context);
      SkipProcessor.registerVideoEventListeners(video, handlers);
      processSkipZones();
    }
  };

  const TimedTextHandler = {

    isAutoGeneratedCaption: function(data) {
      if (!data.events || !data.events.length) {
        return false;
      }

      for (const event of data.events) {
        if (event.segs && Array.isArray(event.segs)) {
          for (const seg of event.segs) {
            if ('acAsrConf' in seg) {
              return true;
            }
          }
        }
      }

      return false;
    },

    isCCCaption: function(text) {
      if (!text || typeof text !== 'string') {
        return false;
      }

      const trimmedText = text.trim();

      return (trimmedText.startsWith('(') && trimmedText.endsWith(')')) ||
             (trimmedText.startsWith('[') && trimmedText.endsWith(']'));
    },

    extractCaptionText: function(event) {
      if (!event) return '';

      if (event.segs && Array.isArray(event.segs)) {

        return event.segs.map(seg => seg.utf8 || '').join('').trim();
      } else if (event.aAppend) {

        return String(event.aAppend).trim();
      } else if (event.utf8) {

        return String(event.utf8).trim();
      }

      return '';
    },

    skipCCCaptionsIfEnabled: function(events, currentIndex) {
      if (!State.skipEnabled || !State.skipCCCaptions) {
        return currentIndex;
      }

      let index = currentIndex;
      while (
        index < events.length &&
        this.isCCCaption(this.extractCaptionText(events[index]))
      ) {
        const ccEvent = events[index];
        const ccText = this.extractCaptionText(ccEvent);
        index++;
      }

      return index;
    },

    handleTimedText: function(data) {

      const detectedLanguage = LanguageProcessorManager.detectLanguageFromUrl(State.currentTimedTextUrl);
      State.currentLanguageCode = detectedLanguage;

      if (detectedLanguage) {
        Utils.logConsole(`Detected video language: ${detectedLanguage}`);
      } else {
        Utils.logConsole('Could not detect caption language.');
      }

      if (this.isAutoGeneratedCaption(data)) {

        this.handleAutoGeneratedTimedText(data);
        return;
      }

      this.handleManualTimedText(data);
    },

    handleManualTimedText: function(data) {
      const events = data.events || [];

      State.hasCaptions = events.length > 0;
      if (!State.hasCaptions) {
        Utils.logToast("No data available for this video.");
        State.skipHandler = undefined;
        return;
      }

      const video = document.querySelector(SELECTORS.VIDEO);
      if (!video) {
        console.error("[YSS] No video element found.");
        return;
      }

      ManualCaptionProcessor.process(events, video);
    },

    handleAutoGeneratedTimedText: function(data) {
      const events = data.events || [];

      State.hasCaptions = events.length > 0;
      if (!State.hasCaptions) {
        Utils.logToast("This video isn't compatible.");
        State.skipHandler = undefined;
        return;
      }

      const video = document.querySelector(SELECTORS.VIDEO);
      if (!video) {
        console.error("[YSS] No video element found.");
        return;
      }

      const languageCode = State.currentLanguageCode;
      const processor = LanguageProcessorManager.getProcessor(languageCode);

      if (!processor) {

        return;
      }

      AutoGeneratedCaptionProcessor.process(events, video, languageCode);
    }
  };

  const UI = {

    showToast: function(message) {

      let container = document.querySelector(".yss-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.className = "yss-toast-container";
        document.body.appendChild(container);
      }

      const toast = document.createElement("div");
      toast.className = "yss-toast";
      toast.textContent = message;
      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.style.opacity = "1";
      });

      setTimeout(() => {
        toast.style.opacity = "0";
        toast.addEventListener("transitionend", () => toast.remove());
      }, TOAST_DURATION);
    }
  };

  const VideoChangeDetector = {
    lastVideoId: "",

    init: function() {
      this.lastVideoId = Utils.extractVideoId();

      window.addEventListener("yt-navigate-finish", this.checkVideoChange.bind(this));
      window.addEventListener("popstate", this.checkVideoChange.bind(this));

      setInterval(this.checkVideoChange.bind(this), VIDEO_CHANGE_CHECK_INTERVAL);
    },

    checkVideoChange: function() {

      if (!window.location.pathname.startsWith('/watch')) {

        if (this.lastVideoId) {
          State.resetForNewVideo();
          this.lastVideoId = "";
        }
        return;
      }

      const currentId = Utils.extractVideoId();
      if (currentId && currentId !== this.lastVideoId) {
        this.lastVideoId = currentId;
        Utils.logToast("Video changed.");

        State.resetForNewVideo();

        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESET_FETCH });

        setTimeout(() => {
          requestCaptions();
        }, PLAYER_INIT_DELAY);
      }
    }
  };

  const MessageHandler = {

    init: function() {
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    },

    handleMessage: function(msg) {
      if (msg?.type === MESSAGE_TYPES.TIMEDTEXT_XML && typeof msg.xml === "string") {
        Utils.logToast("Data loaded successfully!");
        TimedTextHandler.handleTimedText(msg.xml);

        CaptionManager.restoreOriginalCaptionState();
      } else if (msg?.type === MESSAGE_TYPES.TIMEDTEXT_URL && typeof msg.url === "string") {
        Utils.logToast("Getting video info...");

        State.currentTimedTextUrl = msg.url;

        CaptionManager.restoreOriginalCaptionState();

        fetch(msg.url, { credentials: "include" })
          .then((res) => res.text())
          .then((xml) => {
            Utils.logToast("All set to go!");
            try {
              const data = JSON.parse(xml);

              TimedTextHandler.handleTimedText(data);
            } catch (err) {
              console.error("[YSS] Failed to parse timedtext data:", err);
            }
          })
          .catch((err) => console.error("[YSS] Failed to fetch timedtext:", err));
      } else if (msg?.type === MESSAGE_TYPES.SET_SKIP_ENABLED) {
        State.skipEnabled = !!msg.enabled;
        Utils.logToast(`Auto-skip silence ${State.skipEnabled ? "on" : "off"}.`);
        if (State.skipEnabled && typeof State.skipHandler === "function") {

          State.skipHandler();
        }
      } else if (msg?.type === MESSAGE_TYPES.SET_MIN_SKIP) {
        const val = Number(msg.seconds);
        if (!isNaN(val) && val >= 0) {
          State.minSkipSeconds = val;
          Utils.logToast(`Minimum skip set to ${val.toFixed(2)} s.`);
        }
      } else if (msg?.type === MESSAGE_TYPES.SET_SKIP_AFTER_SEEK) {
        State.skipAfterSeek = !!msg.enabled;
        Utils.logToast(`Skip after seeking ${State.skipAfterSeek ? "on" : "off"}.`);
      } else if (msg?.type === MESSAGE_TYPES.SET_LOG_LEVEL) {
        State.logLevel = msg.level || DEFAULT_SETTINGS.logLevel;
        Utils.logToast(`Log level set to ${State.logLevel}.`);
      } else if (msg?.type === MESSAGE_TYPES.SET_SKIP_CC_CAPTIONS) {
        State.skipCCCaptions = !!msg.enabled;
        Utils.logToast(`Enhanced mode ${State.skipCCCaptions ? "on" : "off"}.`);
        if (State.skipEnabled && typeof State.skipHandler === "function") {

          State.skipHandler();
        }
      } else if (msg?.type === MESSAGE_TYPES.SET_PRE_SPEECH_OFFSET) {
        const val = Number(msg.seconds);
        if (!isNaN(val) && val >= 0) {
          State.preSpeechOffsetSeconds = val;
          Utils.logToast(`Pre-speech offset set to ${val.toFixed(2)} s.`);
          if (typeof State.skipHandler === "function") {
            State.skipHandler();
          }
        }
      } else if (msg?.type === MESSAGE_TYPES.SET_POST_SILENCE_DELAY) {
        const val = Number(msg.seconds);
        if (!isNaN(val) && val >= 0) {
          State.postSilenceDelaySeconds = val;
          Utils.logToast(`Post-silence delay set to ${val.toFixed(2)} s.`);
          if (typeof State.skipHandler === "function") {
            State.skipHandler();
          }
        }
      } else if (msg?.type === MESSAGE_TYPES.SETTINGS_UPDATE) {
        const settings = msg.settings;
        if (settings) {
          State.skipEnabled = !!settings.skipEnabled;
          State.minSkipSeconds = Number(settings.minSkipSeconds) || DEFAULT_SETTINGS.minSkipSeconds;
          State.skipAfterSeek = !!settings.skipAfterSeek;
          State.skipCCCaptions = !!settings.skipCCCaptions;
          State.logLevel = settings.logLevel || DEFAULT_SETTINGS.logLevel;
          State.preSpeechOffsetSeconds = Number(settings.preSpeechOffsetSeconds) || DEFAULT_SETTINGS.preSpeechOffsetSeconds;
          State.postSilenceDelaySeconds = Number(settings.postSilenceDelaySeconds) || DEFAULT_SETTINGS.postSilenceDelaySeconds;

          Utils.logToast("Settings updated.");
          if (State.skipEnabled && typeof State.skipHandler === "function") {
            State.skipHandler();
          }
        }
      }
    }
  };

  const DOMObserver = {

    init: function() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const video = document.querySelector(SELECTORS.VIDEO);
            if (video && !State.initialized) {
              initialize();
            }
          }
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  function requestCaptions() {

    const player = document.querySelector(SELECTORS.PLAYER);
    const isAdShowing = player && player.classList.contains('ad-showing');
    const adOverlay = document.querySelector(SELECTORS.AD_OVERLAY);
    const skipButton = document.querySelector(SELECTORS.AD_SKIP_BUTTON);
    const adInfoPanel = document.querySelector(SELECTORS.AD_INFO_PANEL);

    State.isAdPlaying = isAdShowing || !!adOverlay || !!skipButton || !!adInfoPanel;

    if (State.isAdPlaying) {

      Utils.logConsole('Ad playing - delaying data request');
      State.pendingCaptionRequest = true;
    } else {

      Utils.logConsole('No ad playing - requesting data');
      CaptionManager.temporarilyEnableCaptions();
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_TIMEDTEXT, url: window.location.href, tabId: State.tabId });
    }
  }

  function initialize() {

    if (State.initialized) {
      return;
    }
    State.initialized = true;

    State.loadSettings();

    setTimeout(() => {
      requestCaptions();
    }, PLAYER_INIT_DELAY);
  }

  function startup() {

    MessageHandler.init();

    VideoChangeDetector.init();

    DOMObserver.init();

    AdDetector.init();

    initialize();
  }

  startup();
})();