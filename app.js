/*
   Sol - English to Tamil Dictionary Application Logic
   Offline-first indexing using IndexedDB, in-memory instant search,
   speech synthesis, interactive quiz, favorites, and search history.
*/

// Database Configuration
const DB_NAME = 'SolDictionaryDB';
const DB_VERSION = 2;
const STORE_NAME = 'words';
const DEFS_STORE_NAME = 'definitions_cache';

// Application State
const state = {
  db: null,
  words: [], // In-memory array of { eng, tamil }
  favorites: [], // Saved word objects
  history: [], // Last searched word strings
  currentWord: null, // Selected word object
  currentWordDefinitions: null, // English definitions fetched from API
  activeTab: 'tamil', // 'tamil' or 'english' tab on card
  quiz: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answers: [], // Track user answers for feedback
  },
  grammar: {
    currentLesson: null,
    quiz: {
      questions: [],
      currentIndex: 0,
      score: 0,
      answers: [],
    }
  },
  searchMode: 'eng-to-tam', // 'eng-to-tam' or 'tam-to-eng'
  reverseIndex: {}, // Tamil word -> array of word objects
  theme: 'dark',
  activityLog: [], // Comprehensive activity tracking
  transliterationMode: false, // English-to-Tamil transliteration mode
};

// English to Tamil Transliteration Mapping
const TRANSLITERATION_MAP = {
  // Vowels
  'a': 'அ', 'aa': 'ஆ', 'i': 'இ', 'ii': 'ஈ', 'u': 'உ', 'uu': 'ஊ',
  'e': 'எ', 'ee': 'ஏ', 'ai': 'ஐ', 'o': 'ஒ', 'oo': 'ஓ', 'au': 'ஔ',
  
  // Consonants with inherent vowel
  'k': 'க்', 'g': 'க்', 'ng': 'ங்',
  'ch': 'ச்', 'j': 'ஜ்', 'ny': 'ஞ்',
  'T': 'ட்', 'D': 'ட்', 'N': 'ண்',
  't': 'த்', 'd': 'த்', 'n': 'ந்',
  'th': 'த்', 'dh': 'த்',
  'p': 'ப்', 'b': 'ப்', 'm': 'ம்',
  'y': 'ய்', 'r': 'ர்', 'l': 'ல்',
  'v': 'வ்', 'zh': 'ழ்', 'L': 'ள்',
  'R': 'ற்', 'n': 'ன்',
  
  // Special characters
  'h': '', // removes virama
  'q': 'க்', 'w': 'வ்', 'x': 'க்ஷ்', 's': 'ஸ்',
  'S': 'ஶ்', 'sh': 'ஷ்',
  
  // Vowel signs (matras)
  'aa': 'ா', 'i': 'ி', 'ii': 'ீ', 'u': 'ு', 'uu': 'ூ',
  'e': 'ெ', 'ee': 'ே', 'ai': 'ை', 'o': 'ொ', 'oo': 'ோ',
  'au': 'ௌ',
  
  // Special
  '': '்', 'M': 'ஂ', 'H': 'ஃ'
};

// Common Tamil word patterns for better transliteration
const TAMIL_PATTERNS = {
  'am': 'அம்', 'an': 'அன்', 'ar': 'அர்',
  'kam': 'கம்', 'kan': 'கன்', 'kar': 'கர்',
  'tam': 'தம்', 'tan': 'தன்', 'tar': 'தர்',
  'pam': 'பம்', 'pan': 'பன்', 'par': 'பர்',
  'mam': 'மம்', 'man': 'மன்', 'mar': 'மர்',
  'yam': 'யம்', 'yan': 'யன்', 'yar': 'யர்',
  'ram': 'ரம்', 'ran': 'ரன்', 'rar': 'ரர்',
  'lam': 'லம்', 'lan': 'லன்', 'lar': 'லர்',
  'vam': 'வம்', 'van': 'வன்', 'var': 'வர்',
};

// DOM Elements
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingStatus: document.getElementById('loading-status'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  loadingTip: document.getElementById('loading-tip'),
  
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  suggestionsPanel: document.getElementById('suggestions-panel'),
  searchResultsGrid: document.getElementById('search-results-grid'),
  wordCardContainer: document.getElementById('word-card-container'),
  searchModeToggle: document.getElementById('search-mode-toggle'),
  modeLabelFrom: document.getElementById('mode-label-from'),
  modeLabelTo: document.getElementById('mode-label-to'),
  
  // Nav items
  navSearch: document.getElementById('nav-search'),
  navQuiz: document.getElementById('nav-quiz'),
  navGrammar: document.getElementById('nav-grammar'),
  navLibrary: document.getElementById('nav-library'),
  
  // Views
  viewSearch: document.getElementById('view-search'),
  viewQuiz: document.getElementById('view-quiz'),
  viewGrammar: document.getElementById('view-grammar'),
  viewLibrary: document.getElementById('view-library'),
  
  // Theme Toggle
  themeCheckbox: document.getElementById('theme-checkbox'),
  
  // Word of the Day
  wotdWord: document.getElementById('wotd-word'),
  wotdPos: document.getElementById('wotd-pos'),
  wotdMeaning: document.getElementById('wotd-meaning'),
  
  // Stats
  statTotalWords: document.getElementById('stat-total-words'),
  statFavoritesCount: document.getElementById('stat-favorites-count'),
  statHistoryCount: document.getElementById('stat-history-count'),
  
  // Library lists
  favoritesList: document.getElementById('favorites-list'),
  historyList: document.getElementById('history-list'),
  favCountBadge: document.getElementById('fav-count-badge'),
  histCountBadge: document.getElementById('hist-count-badge'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  
  // Quiz Elements
  quizStartView: document.getElementById('quiz-start-view'),
  quizPlayView: document.getElementById('quiz-play-view'),
  quizResultsView: document.getElementById('quiz-results-view'),
  quizProgressText: document.getElementById('quiz-progress-text'),
  quizProgressFill: document.getElementById('quiz-progress-fill'),
  quizWord: document.getElementById('quiz-word'),
  quizOptionsGrid: document.getElementById('quiz-options-grid'),
  quizFeedbackBar: document.getElementById('quiz-feedback-bar'),
  startQuizBtn: document.getElementById('start-quiz-btn'),
  restartQuizBtn: document.getElementById('restart-quiz-btn'),
  
  // Grammar Subviews
  grammarListView: document.getElementById('grammar-list-view'),
  grammarLessonView: document.getElementById('grammar-lesson-view'),
  grammarQuizView: document.getElementById('grammar-quiz-view'),
  grammarResultsView: document.getElementById('grammar-results-view'),
  
  // Grammar Lesson Details
  grammarTopicsGrid: document.getElementById('grammar-topics-grid'),
  grammarLessonTitle: document.getElementById('grammar-lesson-title'),
  grammarLessonNotes: document.getElementById('grammar-lesson-notes'),
  grammarExamplesBody: document.getElementById('grammar-examples-body'),
  
  // Grammar Quiz Items
  grammarQuizTitle: document.getElementById('grammar-quiz-title'),
  grammarQuizProgressText: document.getElementById('grammar-quiz-progress-text'),
  grammarQuizProgressFill: document.getElementById('grammar-quiz-progress-fill'),
  grammarQuizQuestionText: document.getElementById('grammar-quiz-question-text'),
  grammarQuizOptionsGrid: document.getElementById('grammar-quiz-options-grid'),
  grammarQuizExplanationBox: document.getElementById('grammar-quiz-explanation-box'),
  grammarQuizExplanationText: document.getElementById('grammar-quiz-explanation-text'),
  grammarQuizFeedbackBar: document.getElementById('grammar-quiz-feedback-bar'),
  
  // Grammar Buttons
  grammarBackToListBtn: document.getElementById('grammar-back-to-list-btn'),
  startGrammarQuizBtn: document.getElementById('start-grammar-quiz-btn'),
  grammarQuizExitBtn: document.getElementById('grammar-quiz-exit-btn'),
  grammarQuizRetryBtn: document.getElementById('grammar-quiz-retry-btn'),
  grammarQuizBackBtn: document.getElementById('grammar-quiz-back-btn'),
  
  // Toast
  toastContainer: document.getElementById('toast-container'),
};

// Tips for loading screen
const LOADING_TIPS = [
  "Searching works offline once the initial load is complete!",
  "Click the speaker icon next to a word to hear its pronunciation.",
  "Try the Quiz section to test and expand your Tamil vocabulary.",
  "You can search by typing in English or by typing Tamil definitions.",
  "Bookmark your favorite words to review them anytime in the Library tab."
];

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  setupNavigation();
  setupEventListeners();
  loadLibraryData();
  
  // Rotate tips on loading screen
  let tipIndex = 0;
  const tipInterval = setInterval(() => {
    if (elements.loadingOverlay.style.display !== 'none') {
      tipIndex = (tipIndex + 1) % LOADING_TIPS.length;
      elements.loadingTip.textContent = `Tip: ${LOADING_TIPS[tipIndex]}`;
    } else {
      clearInterval(tipInterval);
    }
  }, 4000);
  
  try {
    updateLoadingProgress(5, "Connecting to database...");
    state.db = await initDB();
    
    const count = await getWordsCount(state.db);
    if (count === 0) {
      updateLoadingProgress(15, "Downloading dictionary database (14MB)...");
      const fetchedWords = await fetchDictionary('dictionary.json');
      
      updateLoadingProgress(45, "Saving words locally for offline use...");
      await saveWordsToDB(state.db, fetchedWords, (percent) => {
        const overallPercent = 45 + Math.round((percent / 100) * 45); // Map to 45% - 90%
        updateLoadingProgress(overallPercent, `Storing records: ${percent}%`);
      });
      
      updateLoadingProgress(95, "Optimizing local indices...");
    }
    
    updateLoadingProgress(98, "Loading dictionary into memory...");
    state.words = await getAllWordsFromDB(state.db);
    
    // Fallback if for some reason database was empty or failed
    if (state.words.length === 0) {
      throw new Error("Local database is empty.");
    }
    
    // Hide Loading
    updateLoadingProgress(100, "Done!");
    setTimeout(() => {
      elements.loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        elements.loadingOverlay.style.display = 'none';
      }, 500);
    }, 400);
    
    // Setup dashboard details once words are loaded
    elements.statTotalWords.textContent = state.words.length.toLocaleString();
    buildReverseIndex();
    setupWordOfTheDay();
    updateLibraryUI();
    logUserActivity('app_loaded', { wordCount: state.words.length });
    
  } catch (error) {
    console.error("Initialization error:", error);
    elements.loadingStatus.innerHTML = `<span style="color:var(--error-color)">Error: Failed to load database.<br><span style="font-size:0.8rem">${error.message}</span></span>`;
    elements.progressBarFill.style.backgroundColor = 'var(--error-color)';
  }
});

// Theme Setup
function setupTheme() {
  const savedTheme = localStorage.getItem('sol_theme') || 'dark';
  state.theme = savedTheme;
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-theme');
    elements.themeCheckbox.checked = true;
  } else {
    document.documentElement.classList.remove('light-theme');
    elements.themeCheckbox.checked = false;
  }
}

// Navigation Setup
function setupNavigation() {
  const tabs = [
    { nav: elements.navSearch, view: elements.viewSearch },
    { nav: elements.navQuiz, view: elements.viewQuiz },
    { nav: elements.navGrammar, view: elements.viewGrammar },
    { nav: elements.navLibrary, view: elements.viewLibrary }
  ];
  
  tabs.forEach(tab => {
    tab.nav.addEventListener('click', () => {
      tabs.forEach(t => {
        t.nav.classList.remove('active');
        t.view.classList.remove('active');
      });
      tab.nav.classList.add('active');
      tab.view.classList.add('active');
      
      // Additional actions on tab change
      if (tab.nav === elements.navLibrary) {
        updateLibraryUI();
      } else if (tab.nav === elements.navGrammar) {
        renderGrammarTopicsList();
      }
    });
  });
}

// Global Event Listeners
function setupEventListeners() {
  // Theme Toggle
  elements.themeCheckbox.addEventListener('change', () => {
    if (elements.themeCheckbox.checked) {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('sol_theme', 'light');
      state.theme = 'light';
    } else {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('sol_theme', 'dark');
      state.theme = 'dark';
    }
  });
  
  // Search Input
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.searchInput.addEventListener('focus', () => {
    if (elements.searchInput.value.trim().length > 0) {
      elements.suggestionsPanel.style.display = 'block';
    }
  });
  
  // Close suggestions dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.searchInput.contains(e.target) && !elements.suggestionsPanel.contains(e.target)) {
      elements.suggestionsPanel.style.display = 'none';
    }
  });
  
  // Keyboard navigation for suggestions
  elements.searchInput.addEventListener('keydown', handleSearchKeydown);
  
  // Clear search
  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.suggestionsPanel.style.display = 'none';
    elements.clearSearchBtn.style.display = 'none';
    elements.searchInput.focus();
  });
  
  // Word of the Day Click
  elements.wotdWord.addEventListener('click', () => {
    const wordText = elements.wotdWord.textContent;
    const match = state.words.find(w => w.eng.toLowerCase() === wordText.toLowerCase());
    if (match) {
      displayWordCard(match);
      // Switch to search tab
      elements.navSearch.click();
    }
  });
  
  // Library Actions
  elements.clearHistoryBtn.addEventListener('click', () => {
    state.history = [];
    localStorage.setItem('sol_history', JSON.stringify(state.history));
    updateLibraryUI();
    showToast("Search history cleared", "info");
  });
  
  // Quiz Actions
  elements.startQuizBtn.addEventListener('click', startQuiz);

  // Search Mode Toggle
  elements.searchModeToggle.addEventListener('click', toggleSearchMode);
  elements.restartQuizBtn.addEventListener('click', startQuiz);
  
  // Tamil Keyboard Toggle
  const keyboardToggleBtn = document.getElementById('keyboard-toggle-btn');
  const tamilKeyboard = document.getElementById('tamil-keyboard');
  const keyboardCloseBtn = document.getElementById('keyboard-close-btn');
  const keyboardModeBtn = document.getElementById('keyboard-mode-btn');
  
  if (keyboardToggleBtn && tamilKeyboard) {
    keyboardToggleBtn.addEventListener('click', () => {
      // Toggle between virtual keyboard and transliteration mode
      if (tamilKeyboard.classList.contains('show')) {
        // If keyboard is open, close it and enable transliteration
        tamilKeyboard.classList.remove('show');
        toggleTransliterationMode();
      } else if (state.transliterationMode) {
        // If transliteration is on, turn it off
        toggleTransliterationMode();
      } else {
        // Open virtual keyboard
        tamilKeyboard.classList.add('show');
        keyboardToggleBtn.classList.add('active');
      }
    });
    
    keyboardCloseBtn.addEventListener('click', () => {
      tamilKeyboard.classList.remove('show');
      keyboardToggleBtn.classList.remove('active');
    });
    
    // Keyboard mode button (inside keyboard)
    if (keyboardModeBtn) {
      keyboardModeBtn.addEventListener('click', () => {
        tamilKeyboard.classList.remove('show');
        toggleTransliterationMode();
      });
    }
    
    // Keyboard key presses
    tamilKeyboard.querySelectorAll('.keyboard-key').forEach(key => {
      key.addEventListener('click', () => {
        const char = key.dataset.char;
        const action = key.dataset.action;
        
        if (char) {
          insertCharacter(char);
        } else if (action === 'backspace') {
          backspace();
        } else if (action === 'clear') {
          elements.searchInput.value = '';
          elements.searchInput.focus();
        } else if (action === 'enter') {
          tamilKeyboard.classList.remove('show');
          keyboardToggleBtn.classList.remove('active');
          // Trigger search
          handleSearchInput();
        }
      });
    });
  }
}

// Tamil Keyboard Helper Functions
function insertCharacter(char) {
  const input = elements.searchInput;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;
  
  input.value = value.substring(0, start) + char + value.substring(end);
  input.selectionStart = input.selectionEnd = start + char.length;
  input.focus();
  
  // Trigger search input event
  handleSearchInput();
}

function backspace() {
  const input = elements.searchInput;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;
  
  if (start === end && start > 0) {
    input.value = value.substring(0, start - 1) + value.substring(end);
    input.selectionStart = input.selectionEnd = start - 1;
  } else {
    input.value = value.substring(0, start) + value.substring(end);
    input.selectionStart = input.selectionEnd = start;
  }
  
  input.focus();
  handleSearchInput();
}

// English to Tamil Transliteration Function
function transliterateEnglishToTamil(englishText) {
  if (!englishText) return '';
  
  let tamilText = '';
  let i = 0;
  
  while (i < englishText.length) {
    let matched = false;
    
    // Try to match longer patterns first (2-3 characters)
    for (let len = 3; len >= 1; len--) {
      if (i + len <= englishText.length) {
        const substr = englishText.substring(i, i + len).toLowerCase();
        
        // Check for common patterns first
        if (TAMIL_PATTERNS[substr]) {
          tamilText += TAMIL_PATTERNS[substr];
          i += len;
          matched = true;
          break;
        }
        
        // Check for consonant + vowel combinations
        if (len === 2) {
          const consonant = substr[0];
          const vowel = substr[1];
          
          // Check if it's a consonant followed by a vowel
          if (TRANSLITERATION_MAP[consonant] && TRANSLITERATION_MAP[vowel]) {
            const consonantTamil = TRANSLITERATION_MAP[consonant];
            const vowelTamil = TRANSLITERATION_MAP[vowel];
            
            // Remove virama from consonant and add vowel sign
            const consonantBase = consonantTamil.replace('்', '');
            tamilText += consonantBase + vowelTamil;
            i += len;
            matched = true;
            break;
          }
        }
        
        // Check direct mapping
        if (TRANSLITERATION_MAP[substr]) {
          tamilText += TRANSLITERATION_MAP[substr];
          i += len;
          matched = true;
          break;
        }
      }
    }
    
    // If no pattern matched, keep the original character
    if (!matched) {
      tamilText += englishText[i];
      i++;
    }
  }
  
  return tamilText;
}

// Real-time transliteration handler
function handleTransliteration(e) {
  if (!state.transliterationMode) return;
  
  const input = e.target;
  const englishText = input.value;
  
  // Only transliterate if the input contains English characters
  if (!/[\u0b80-\u0bff]/.test(englishText)) {
    const tamilText = transliterateEnglishToTamil(englishText);
    
    // Store the English text in a data attribute for reference
    input.dataset.englishInput = englishText;
    
    // Update the input with Tamil text
    input.value = tamilText;
    
    // Move cursor to end
    input.selectionStart = input.selectionEnd = tamilText.length;
  }
  
  // Trigger search
  handleSearchInput();
}

// Toggle transliteration mode
function toggleTransliterationMode() {
  state.transliterationMode = !state.transliterationMode;
  
  const keyboardToggleBtn = document.getElementById('keyboard-toggle-btn');
  const keyboardModeBtn = document.getElementById('keyboard-mode-btn');
  
  if (state.transliterationMode) {
    keyboardToggleBtn.classList.add('active');
    keyboardToggleBtn.querySelector('span').textContent = 'ENG→TA';
    if (keyboardModeBtn) {
      keyboardModeBtn.classList.add('active');
    }
    showToast('Transliteration mode enabled. Type in English to get Tamil!', 'info');
    
    // Add input event listener for transliteration
    elements.searchInput.addEventListener('input', handleTransliteration);
  } else {
    keyboardToggleBtn.classList.remove('active');
    keyboardToggleBtn.querySelector('span').textContent = 'தமிழ்';
    if (keyboardModeBtn) {
      keyboardModeBtn.classList.remove('active');
    }
    showToast('Transliteration mode disabled. Use the virtual keyboard for direct Tamil input.', 'info');
    
    // Remove input event listener
    elements.searchInput.removeEventListener('input', handleTransliteration);
  }
}

// Loading UI Helper
function updateLoadingProgress(percent, statusText) {
  elements.progressBarFill.style.width = `${percent}%`;
  if (statusText) {
    elements.loadingStatus.textContent = statusText;
  }
}

// Database Helpers
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(DEFS_STORE_NAME)) {
        db.createObjectStore(DEFS_STORE_NAME, { keyPath: 'word' });
      }
    };
    
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getWordsCount(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveWordsToDB(db, wordsList, progressCallback) {
  const batchSize = 5000;
  for (let i = 0; i < wordsList.length; i += batchSize) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const end = Math.min(i + batchSize, wordsList.length);
      for (let j = i; j < end; j++) {
        store.put({
          eng: wordsList[j].eng,
          tamil: wordsList[j].tamil
        });
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
    const progress = Math.round((Math.min(i + batchSize, wordsList.length) / wordsList.length) * 100);
    if (progressCallback) progressCallback(progress);
  }
}

function getAllWordsFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Download stream with progress bar
async function fetchDictionary(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download dictionary. Status: ${response.status}`);
  }
  
  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    // If server does not provide content-length, fall back to standard JSON loading
    return await response.json();
  }
  
  const totalBytes = parseInt(contentLength, 10);
  let loadedBytes = 0;
  
  const reader = response.body.getReader();
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    loadedBytes += value.byteLength;
    
    const percent = Math.round((loadedBytes / totalBytes) * 100);
    // Download phase makes up the first 40% of loading (from 5% to 45%)
    const overallPercent = 5 + Math.round((percent / 100) * 40);
    updateLoadingProgress(overallPercent, `Downloading dictionary database: ${percent}%`);
  }
  
  const allChunks = new Uint8Array(loadedBytes);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }
  
  const decoder = new TextDecoder('utf-8');
  const jsonString = decoder.decode(allChunks);
  return JSON.parse(jsonString);
}

// Parse Tamil Definition & Part of Speech
function parseTamilDefinition(rawTamil) {
  let pos = "";
  let definition = rawTamil.trim();
  
  // Try to match patterns like "n. ", "v. ", "adv. ", "a.adv. ", "n. pl. "
  const prefixMatch = rawTamil.match(/^([a-z]{1,4}\.(?:\s*[a-z]{1,4}\.)*)\s+(.*)/i);
  if (prefixMatch) {
    pos = prefixMatch[1].trim();
    definition = prefixMatch[2].trim();
  } else {
    // Fallback: check if there's any lowercase word followed by a dot at the very beginning
    const genericMatch = rawTamil.match(/^([a-z\.\s]+)\s+(.*)/i);
    if (genericMatch && genericMatch[1].includes('.')) {
      pos = genericMatch[1].trim();
      definition = genericMatch[2].trim();
    }
  }
  
  // Map abbreviated parts of speech to friendly names
  const posMap = {
    'n.': 'Noun',
    'v.': 'Verb',
    'a.': 'Adjective',
    'adj.': 'Adjective',
    'adv.': 'Adverb',
    'pron.': 'Pronoun',
    'prep.': 'Preposition',
    'conj.': 'Conjunction',
    'interj.': 'Interjection',
    'a.adv': 'Adj / Adverb',
    'a.adv.': 'Adj / Adverb',
    'v.t.': 'Transitive Verb',
    'v.i.': 'Intransitive Verb'
  };
  
  const friendlyPos = posMap[pos.toLowerCase()] || pos || 'Definition';
  
  return {
    pos: friendlyPos,
    definition: definition
  };
}

// Build Reverse Index for Tamil to English Search
function buildReverseIndex() {
  state.reverseIndex = {};
  
  state.words.forEach(word => {
    if (!word.tamil) return;
    
    const parsed = parseTamilDefinition(word.tamil);
    const tamilDefinition = parsed.definition.toLowerCase();
    
    // Extract individual Tamil words (split by common delimiters)
    const tamilWords = tamilDefinition.split(/[,;\s]+/).filter(w => w.length > 0);
    
    tamilWords.forEach(tamilWord => {
      if (!state.reverseIndex[tamilWord]) {
        state.reverseIndex[tamilWord] = [];
      }
      state.reverseIndex[tamilWord].push(word);
    });
  });
}

// Toggle Search Mode between English->Tamil and Tamil->English
function toggleSearchMode() {
  if (state.searchMode === 'eng-to-tam') {
    state.searchMode = 'tam-to-eng';
    elements.modeLabelFrom.textContent = 'Tamil';
    elements.modeLabelTo.textContent = 'English';
    elements.searchInput.placeholder = 'Type a Tamil word...';
  } else {
    state.searchMode = 'eng-to-tam';
    elements.modeLabelFrom.textContent = 'English';
    elements.modeLabelTo.textContent = 'Tamil';
    elements.searchInput.placeholder = 'Type a word in English...';
  }
  
  // Clear search
  elements.searchInput.value = '';
  elements.suggestionsPanel.style.display = 'none';
  elements.clearSearchBtn.style.display = 'none';
  elements.wordCardContainer.innerHTML = `
    <div class="placeholder-card">
      <svg class="placeholder-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
      <h3 class="placeholder-title">No Word Selected</h3>
      <p class="placeholder-desc">Type a word in the search box above or browse the suggestions to see its ${state.searchMode === 'eng-to-tam' ? 'Tamil' : 'English'} meaning.</p>
    </div>
  `;
  
  elements.searchInput.focus();
}

// Word of the Day Pseudo-Random Selector
function setupWordOfTheDay() {
  if (state.words.length === 0) return;
  
  // Hash the date to get a stable random index
  const today = new Date();
  const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = dateString.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % state.words.length;
  const wotd = state.words[index];
  
  elements.wotdWord.textContent = wotd.eng;
  
  const parsed = parseTamilDefinition(wotd.tamil);
  elements.wotdPos.textContent = parsed.pos;
  elements.wotdMeaning.textContent = parsed.definition;
}

// Local Storage Managers
function loadLibraryData() {
  state.favorites = JSON.parse(localStorage.getItem('sol_favorites')) || [];
  state.history = JSON.parse(localStorage.getItem('sol_history')) || [];
  state.activityLog = JSON.parse(localStorage.getItem('sol_activity_log')) || [];
}

// Activity Tracking System
function logActivity(type, details = {}) {
  const activity = {
    id: Date.now(),
    type: type,
    timestamp: new Date().toISOString(),
    details: details
  };
  
  state.activityLog.unshift(activity);
  
  // Keep only last 1000 activities
  if (state.activityLog.length > 1000) {
    state.activityLog = state.activityLog.slice(0, 1000);
  }
  
  // Save to localStorage
  localStorage.setItem('sol_activity_log', JSON.stringify(state.activityLog));
  
  // Also try to send to server if available
  sendActivityToServer(activity);
}

function sendActivityToServer(activity) {
  if (!navigator.onLine) return;
  
  fetch('/api/log-activity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(activity)
  }).catch(err => {
    console.log('Server logging failed, activity saved locally:', err);
  });
}

function getActivityStats() {
  const stats = {
    totalSearches: 0,
    totalQuizAttempts: 0,
    totalGrammarLessons: 0,
    totalFavorites: state.favorites.length,
    averageQuizScore: 0,
    mostSearchedWords: {},
    activityByType: {}
  };
  
  state.activityLog.forEach(activity => {
    // Count by type
    stats.activityByType[activity.type] = (stats.activityByType[activity.type] || 0) + 1;
    
    switch(activity.type) {
      case 'search':
        stats.totalSearches++;
        const word = activity.details.word?.toLowerCase();
        if (word) {
          stats.mostSearchedWords[word] = (stats.mostSearchedWords[word] || 0) + 1;
        }
        break;
      case 'quiz_completed':
        stats.totalQuizAttempts++;
        if (activity.details.score !== undefined) {
          stats.averageQuizScore = ((stats.averageQuizScore * (stats.totalQuizAttempts - 1)) + activity.details.score) / stats.totalQuizAttempts;
        }
        break;
      case 'grammar_lesson':
        stats.totalGrammarLessons++;
        break;
    }
  });
  
  // Sort most searched words
  stats.mostSearchedWords = Object.entries(stats.mostSearchedWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [word, count]) => {
      obj[word] = count;
      return obj;
    }, {});
  
  return stats;
}

function toggleFavorite(wordObj) {
  const index = state.favorites.findIndex(w => w.eng.toLowerCase() === wordObj.eng.toLowerCase());
  let isFav = false;
  if (index === -1) {
    state.favorites.push(wordObj);
    isFav = true;
    showToast(`Added "${wordObj.eng}" to Favorites`, "success");
    logActivity('favorite_added', { word: wordObj.eng, tamil: wordObj.tamil });
  } else {
    state.favorites.splice(index, 1);
    showToast(`Removed "${wordObj.eng}" from Favorites`, "info");
    logActivity('favorite_removed', { word: wordObj.eng });
  }
  localStorage.setItem('sol_favorites', JSON.stringify(state.favorites));
  updateLibraryUI();
  return isFav;
}

function addToHistory(wordObj) {
  // Remove if already exists to move to top
  const filtered = state.history.filter(w => w.eng.toLowerCase() !== wordObj.eng.toLowerCase());
  filtered.unshift(wordObj);
  // Limit to 15 items
  state.history = filtered.slice(0, 15);
  localStorage.setItem('sol_history', JSON.stringify(state.history));
  updateLibraryUI();
  logActivity('search', { 
    word: wordObj.eng, 
    tamil: wordObj.tamil, 
    searchMode: state.searchMode 
  });
}

// Update Library & Sidebar Badges UI
function updateLibraryUI() {
  // Badges
  elements.favCountBadge.textContent = state.favorites.length;
  elements.histCountBadge.textContent = state.history.length;
  elements.statFavoritesCount.textContent = state.favorites.length;
  elements.statHistoryCount.textContent = state.history.length;
  
  // Render Favorites list
  if (state.favorites.length === 0) {
    elements.favoritesList.innerHTML = `<div class="library-empty">No bookmarked words yet. Toggle the star icon on any word details card to add favorites.</div>`;
  } else {
    elements.favoritesList.innerHTML = '';
    state.favorites.forEach(word => {
      const parsed = parseTamilDefinition(word.tamil);
      const item = document.createElement('div');
      item.className = 'library-item';
      item.innerHTML = `
        <div class="library-item-content">
          <div class="library-word-eng">${word.eng}</div>
          <div class="library-word-tam">${parsed.pos ? `[${parsed.pos}] ` : ''}${parsed.definition}</div>
        </div>
        <button class="library-remove-btn" title="Unfavorite">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </button>
      `;
      
      // Click event for the item
      item.addEventListener('click', (e) => {
        // If clicking the remove button
        if (e.target.closest('.library-remove-btn')) {
          e.stopPropagation();
          toggleFavorite(word);
          return;
        }
        displayWordCard(word);
        elements.navSearch.click();
      });
      
      elements.favoritesList.appendChild(item);
    });
  }
  
  // Render History list
  if (state.history.length === 0) {
    elements.historyList.innerHTML = `<div class="library-empty">Your search history is empty. Searched words will appear here.</div>`;
    elements.clearHistoryBtn.style.display = 'none';
  } else {
    elements.clearHistoryBtn.style.display = 'block';
    elements.historyList.innerHTML = '';
    state.history.forEach(word => {
      const parsed = parseTamilDefinition(word.tamil);
      const item = document.createElement('div');
      item.className = 'library-item';
      item.innerHTML = `
        <div class="library-item-content">
          <div class="library-word-eng">${word.eng}</div>
          <div class="library-word-tam">${parsed.pos ? `[${parsed.pos}] ` : ''}${parsed.definition}</div>
        </div>
        <button class="library-remove-btn" title="Delete from history">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      `;
      
      item.addEventListener('click', (e) => {
        if (e.target.closest('.library-remove-btn')) {
          e.stopPropagation();
          state.history = state.history.filter(w => w.eng.toLowerCase() !== word.eng.toLowerCase());
          localStorage.setItem('sol_history', JSON.stringify(state.history));
          updateLibraryUI();
          return;
        }
        displayWordCard(word);
        elements.navSearch.click();
      });
      
      elements.historyList.appendChild(item);
    });
  }
}

// Search Suggestions Handling
let activeSuggestionIndex = -1;

function handleSearchInput() {
  const query = elements.searchInput.value.trim().toLowerCase();
  
  if (query.length === 0) {
    elements.suggestionsPanel.style.display = 'none';
    elements.clearSearchBtn.style.display = 'none';
    return;
  }
  
  elements.clearSearchBtn.style.display = 'flex';
  
  // Find matching words based on search mode
  let matches = [];
  const isTamil = /[\u0b80-\u0bff]/.test(query);
  
  if (state.searchMode === 'tam-to-eng') {
    // Tamil to English search
    if (isTamil) {
      // Use reverse index for Tamil word lookup
      const exactMatches = state.reverseIndex[query] || [];
      const partialMatches = [];
      
      // Also search for partial matches in Tamil definitions
      Object.keys(state.reverseIndex).forEach(tamilWord => {
        if (tamilWord.includes(query) && tamilWord !== query) {
          partialMatches.push(...state.reverseIndex[tamilWord]);
        }
      });
      
      // Combine and deduplicate
      const allMatches = [...exactMatches, ...partialMatches];
      const uniqueMatches = [];
      const seen = new Set();
      
      allMatches.forEach(word => {
        if (!seen.has(word.eng)) {
          seen.add(word.eng);
          uniqueMatches.push(word);
        }
      });
      
      matches = uniqueMatches.slice(0, 15);
    } else {
      // If user types English in Tamil mode, show no matches or fallback
      matches = [];
    }
  } else {
    // English to Tamil search (original logic)
    if (isTamil) {
      // Substring match in Tamil definition
      matches = state.words
        .filter(word => word.tamil && word.tamil.includes(query))
        .slice(0, 15);
    } else {
      // English search
      // 1. First find words starting with the query (prefix match)
      const prefixes = state.words.filter(word => word.eng && word.eng.toLowerCase().startsWith(query));
      
      // Sort prefixes by length (shorter words are exact/better matches)
      prefixes.sort((a, b) => a.eng.length - b.eng.length);
      
      // 2. If we have less than 15 matches, search for substring matches
      if (prefixes.length < 15) {
        const substrings = state.words.filter(word => 
          word.eng && 
          word.eng.toLowerCase().includes(query) && 
          !word.eng.toLowerCase().startsWith(query)
        );
        
        // Sort substrings by length
        substrings.sort((a, b) => a.eng.length - b.eng.length);
        
        matches = prefixes.concat(substrings).slice(0, 15);
      } else {
        matches = prefixes.slice(0, 15);
      }
    }
  }
  
  renderSuggestions(matches, query, isTamil);
}

function renderSuggestions(matches, query, isTamil) {
  if (matches.length === 0) {
    elements.suggestionsPanel.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No matches found</div>`;
    elements.suggestionsPanel.style.display = 'block';
    return;
  }
  
  elements.suggestionsPanel.innerHTML = '';
  activeSuggestionIndex = -1;
  
  matches.forEach((word, idx) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.dataset.index = idx;
    
    const parsed = parseTamilDefinition(word.tamil);
    
    if (state.searchMode === 'tam-to-eng') {
      // Tamil to English mode: show Tamil word (from definition) and English word
      const reg = new RegExp(`(${query})`, 'gi');
      const highlightedTamil = parsed.definition.replace(reg, `<strong style="color: var(--primary-color)">$1</strong>`);
      item.innerHTML = `
        <span class="suggestion-match-tamil">${highlightedTamil}</span>
        <span>${word.eng}</span>
      `;
    } else if (isTamil) {
      // English to Tamil mode with Tamil input: highlight Tamil matching parts
      item.innerHTML = `
        <span>${word.eng}</span>
        <span class="suggestion-match-tamil">${parsed.definition}</span>
      `;
    } else {
      // English to Tamil mode with English input: highlight English matching parts
      const reg = new RegExp(`(${query})`, 'gi');
      const highlightedEng = word.eng.replace(reg, `<strong style="color: var(--primary-color)">$1</strong>`);
      item.innerHTML = `
        <span>${highlightedEng}</span>
        <span class="suggestion-match-tamil">${parsed.definition}</span>
      `;
    }
    
    item.addEventListener('click', () => {
      displayWordCard(word);
      elements.suggestionsPanel.style.display = 'none';
      elements.searchInput.value = state.searchMode === 'tam-to-eng' ? parsed.definition : word.eng;
    });
    
    elements.suggestionsPanel.appendChild(item);
  });
  
  elements.suggestionsPanel.style.display = 'block';
}

function handleSearchKeydown(e) {
  const items = elements.suggestionsPanel.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
    highlightSuggestion(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
    highlightSuggestion(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
      items[activeSuggestionIndex].click();
    } else if (items.length > 0) {
      items[0].click();
    }
  } else if (e.key === 'Escape') {
    elements.suggestionsPanel.style.display = 'none';
  }
}

function highlightSuggestion(items) {
  items.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
      // Update input field text temporarily
      const engWord = item.querySelector('span:first-child').textContent;
      elements.searchInput.value = engWord;
    } else {
      item.classList.remove('selected');
    }
  });
}

// Word Card Renderer
function displayWordCard(wordObj) {
  state.currentWord = wordObj;
  state.currentWordDefinitions = null; // Clear previous definitions
  state.activeTab = 'tamil';
  
  const parsed = parseTamilDefinition(wordObj.tamil);
  const isFavorite = state.favorites.some(w => w.eng.toLowerCase() === wordObj.eng.toLowerCase());
  
  // Determine display based on search mode
  const isTamToEng = state.searchMode === 'tam-to-eng';
  const mainWord = isTamToEng ? parsed.definition : wordObj.eng;
  const translationWord = isTamToEng ? wordObj.eng : parsed.definition;
  const meaningLabel = isTamToEng ? 'English Meaning' : 'Tamil Meaning';
  const tabLabel1 = isTamToEng ? 'Tamil Definition' : 'Tamil Meaning';
  const tabLabel2 = isTamToEng ? 'English Meaning' : 'English Definition';
  
  elements.wordCardContainer.innerHTML = `
    <div class="word-card">
      <div class="word-card-header">
        <div class="word-main-info">
          <h2 class="word-title">${mainWord}</h2>
          <div class="phonetic-container" id="card-phonetic-container">
            ${parsed.pos ? `<span class="part-of-speech-badge">${parsed.pos}</span>` : ''}
          </div>
        </div>
        <div class="word-actions">
          <button class="word-action-btn ${isFavorite ? 'active' : ''}" id="card-fav-btn" title="Add to Favorites">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
          <button class="word-action-btn" id="card-audio-btn" title="Listen Pronunciation">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
          <button class="word-action-btn" id="card-copy-btn" title="Copy to Clipboard">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="word-tabs-container">
        <button class="word-tab-btn active" id="tab-btn-primary">${meaningLabel}</button>
        <button class="word-tab-btn" id="tab-btn-secondary">${tabLabel2}</button>
      </div>
      
      <!-- Tab Contents -->
      <div class="word-card-body" id="tab-content-primary">
        <div class="meaning-label">${meaningLabel}</div>
        <div class="tamil-meanings">${translationWord}</div>
      </div>
      
      <div class="word-card-body" id="tab-content-secondary" style="display: none;">
        <!-- Loaded dynamically -->
      </div>
    </div>
  `;
  
  // Attach card event listeners
  document.getElementById('card-fav-btn').addEventListener('click', (e) => {
    const isFav = toggleFavorite(wordObj);
    const btn = e.currentTarget;
    if (isFav) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  document.getElementById('card-audio-btn').addEventListener('click', () => {
    // Only speak English words
    if (!isTamToEng) {
      speakWord(wordObj.eng);
    } else {
      showToast("Audio available for English words only", "info");
    }
  });
  
  document.getElementById('card-copy-btn').addEventListener('click', () => {
    const copyText = `${mainWord} : ${parsed.pos ? `[${parsed.pos}] ` : ''}${translationWord}`;
    navigator.clipboard.writeText(copyText).then(() => {
      showToast("Copied to clipboard!", "success");
    }).catch(err => {
      console.error("Copy failed", err);
    });
  });
  
  // Tab Switching Event Listeners
  const tabPrimary = document.getElementById('tab-btn-primary');
  const tabSecondary = document.getElementById('tab-btn-secondary');
  const contentPrimary = document.getElementById('tab-content-primary');
  const contentSecondary = document.getElementById('tab-content-secondary');
  
  tabPrimary.addEventListener('click', () => {
    tabPrimary.classList.add('active');
    tabSecondary.classList.remove('active');
    contentPrimary.style.display = 'block';
    contentSecondary.style.display = 'none';
    state.activeTab = 'primary';
  });
  
  tabSecondary.addEventListener('click', () => {
    tabSecondary.classList.add('active');
    tabPrimary.classList.remove('active');
    contentPrimary.style.display = 'none';
    contentSecondary.style.display = 'block';
    state.activeTab = 'secondary';
    
    if (isTamToEng) {
      // In Tamil-to-English mode, secondary tab shows Tamil definition
      contentSecondary.innerHTML = `
        <div class="meaning-label">Tamil Definition</div>
        <div class="tamil-meanings">${parsed.definition}</div>
      `;
    } else {
      // In English-to-Tamil mode, secondary tab shows English definition from API
      renderEnglishTab(wordObj.eng);
    }
  });
  
  // Add to Search History
  addToHistory(wordObj);
}

// Text to Speech
function speakWord(wordText) {
  if ('speechSynthesis' in window) {
    // Cancel active synthesis
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; // Slightly slower for clarity
    
    // Find an English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.localService) || 
                         voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } else {
    showToast("Speech synthesis not supported on this browser.", "warning");
  }
}

// Load voices once they are ready (Chrome async load issue)
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {};
}

// Toast Notifications System
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Remove after 3.5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3200);
}

// Quiz Game Logic
function startQuiz() {
  if (state.words.length < 10) return;
  
  // Prepare questions: 10 random words
  state.quiz.questions = [];
  state.quiz.currentIndex = 0;
  state.quiz.score = 0;
  state.quiz.answers = [];
  
  // Select 10 random distinct indices
  const selectedIndices = new Set();
  while (selectedIndices.size < 10) {
    const idx = Math.floor(Math.random() * state.words.length);
    selectedIndices.add(idx);
  }
  
  selectedIndices.forEach(idx => {
    state.quiz.questions.push(state.words[idx]);
  });
  
  // Switch Views
  elements.quizStartView.style.display = 'none';
  elements.quizResultsView.style.display = 'none';
  elements.quizPlayView.style.display = 'flex';
  
  loadQuizQuestion();
}

function loadQuizQuestion() {
  const currentIdx = state.quiz.currentIndex;
  const currentQuestion = state.quiz.questions[currentIdx];
  const parsedCorrect = parseTamilDefinition(currentQuestion.tamil);
  
  // Update Header progress
  elements.quizProgressText.textContent = `Question ${currentIdx + 1} of 10`;
  elements.quizProgressFill.style.width = `${(currentIdx / 10) * 100}%`;
  
  // Display Question Word
  elements.quizWord.textContent = currentQuestion.eng;
  
  // Generate distractors (3 distinct wrong options)
  const distractors = [];
  while (distractors.length < 3) {
    const randomIdx = Math.floor(Math.random() * state.words.length);
    const candidate = state.words[randomIdx];
    
    // Ensure distractor is not the correct word, and not already in distractors list, and has content
    if (candidate.eng.toLowerCase() !== currentQuestion.eng.toLowerCase() && 
        !distractors.some(d => d.eng.toLowerCase() === candidate.eng.toLowerCase())) {
      distractors.push(candidate);
    }
  }
  
  // Compile options (1 correct + 3 distractors)
  const options = [
    { text: parsedCorrect.definition, isCorrect: true, wordObj: currentQuestion },
    ...distractors.map(d => {
      const parsedWrong = parseTamilDefinition(d.tamil);
      return { text: parsedWrong.definition, isCorrect: false, wordObj: d };
    })
  ];
  
  // Shuffle options
  options.sort(() => Math.random() - 0.5);
  
  // Render options grid
  elements.quizOptionsGrid.innerHTML = '';
  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.innerHTML = `
      <span class="quiz-option-index">${String.fromCharCode(65 + idx)}</span>
      <span>${opt.text}</span>
    `;
    
    btn.addEventListener('click', () => handleQuizAnswer(opt, btn));
    elements.quizOptionsGrid.appendChild(btn);
  });
  
  // Clear Feedback Bar
  elements.quizFeedbackBar.innerHTML = '';
}

function handleQuizAnswer(selectedOption, clickedButton) {
  // Disable all options
  const optionButtons = elements.quizOptionsGrid.querySelectorAll('.quiz-option');
  optionButtons.forEach(btn => btn.classList.add('disabled'));
  
  const currentIdx = state.quiz.currentIndex;
  const currentQuestion = state.quiz.questions[currentIdx];
  const parsedCorrect = parseTamilDefinition(currentQuestion.tamil);
  
  let isCorrect = selectedOption.isCorrect;
  state.quiz.answers.push({
    question: currentQuestion,
    selected: selectedOption,
    isCorrect: isCorrect
  });
  
  if (isCorrect) {
    state.quiz.score++;
    clickedButton.classList.add('correct');
    
    elements.quizFeedbackBar.innerHTML = `
      <div class="quiz-feedback-text correct">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Correct! Excellent.</span>
      </div>
      <button class="primary-btn" id="quiz-next-btn">Next Word &rarr;</button>
    `;
  } else {
    clickedButton.classList.add('incorrect');
    
    // Highlight correct answer in green
    const indexCorrect = state.quiz.answers[currentIdx].question;
    optionButtons.forEach((btn) => {
      // Re-find the option which is actually correct
      const text = btn.querySelector('span:nth-child(2)').textContent;
      if (text === parsedCorrect.definition) {
        btn.classList.add('correct');
        btn.classList.remove('disabled'); // make it visually highlighted
        btn.classList.add('disabled');
      }
    });
    
    elements.quizFeedbackBar.innerHTML = `
      <div class="quiz-feedback-text incorrect">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Oops! Incorrect.</span>
      </div>
      <button class="primary-btn" id="quiz-next-btn">Next Word &rarr;</button>
    `;
  }
  
  // Attach next button event listener
  document.getElementById('quiz-next-btn').addEventListener('click', () => {
    state.quiz.currentIndex++;
    if (state.quiz.currentIndex < 10) {
      loadQuizQuestion();
    } else {
      showQuizResults();
    }
  });
}

function showQuizResults() {
  elements.quizPlayView.style.display = 'none';
  elements.quizResultsView.style.display = 'flex';
  
  // Update progress fill to 100%
  elements.quizProgressFill.style.width = '100%';
  
  // Render score circle
  const score = state.quiz.score;
  document.querySelector('.results-score-num').textContent = `${score}/10`;
  
  // Log quiz completion
  logActivity('quiz_completed', { 
    score: score, 
    totalQuestions: 10, 
    type: 'vocabulary_quiz' 
  });
  
  // Personalize title and description based on score
  let title = "";
  let desc = "";
  
  if (score === 10) {
    title = "Perfect Score! 🎉";
    desc = "Outstanding! You got every single translation correct. Your Tamil vocabulary is highly advanced!";
  } else if (score >= 8) {
    title = "Excellent Job! 🌟";
    desc = "Terrific performance! You have a strong grasp of English-Tamil translations. Keep it up!";
  } else if (score >= 5) {
    title = "Good Effort! 👍";
    desc = "Well done! You got more than half right. With a little more practice, you'll be an expert.";
  } else {
    title = "Keep Practicing! 💪";
    desc = "A good start, but there's room to improve. Use the search database to learn more definitions and try again!";
  }
  
  document.querySelector('.results-title').textContent = title;
  document.querySelector('.results-desc').textContent = desc;
}

// ==========================================================
// 1. English Definitions Fetching & Caching System
// ==========================================================

function getCachedDefinition(word) {
  return new Promise((resolve) => {
    if (!state.db) return resolve(null);
    try {
      const transaction = state.db.transaction([DEFS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(DEFS_STORE_NAME);
      const request = store.get(word.toLowerCase());
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

function cacheDefinition(defObj) {
  return new Promise((resolve) => {
    if (!state.db) return resolve();
    try {
      const transaction = state.db.transaction([DEFS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DEFS_STORE_NAME);
      store.put(defObj);
      transaction.oncomplete = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

async function fetchEnglishDefinitionFromAPI(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.status === 404 ? "Word not found" : "API error");
  }
  const data = await response.json();
  const entry = data[0];
  
  // Format entry
  const result = {
    word: entry.word.toLowerCase(),
    phonetic: entry.phonetic || (entry.phonetics && entry.phonetics.find(p => p.text)?.text) || "",
    audio: (entry.phonetics && entry.phonetics.find(p => p.audio && p.audio.length > 0)?.audio) || "",
    meanings: entry.meanings.map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.map(d => ({
        definition: d.definition,
        example: d.example || ""
      })).slice(0, 3) // Limit to 3 definitions per part of speech
    })),
    synonyms: entry.meanings.flatMap(m => m.synonyms || []).slice(0, 5) // Limit to 5 synonyms
  };
  
  return result;
}

async function renderEnglishTab(wordText) {
  const container = document.getElementById('tab-content-english');
  if (!container) return;
  
  // Show spinner
  container.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; min-height:120px;">
      <div class="spinner" style="width:32px; height:32px;"></div>
    </div>
  `;
  
  try {
    let defObj = await getCachedDefinition(wordText);
    
    if (!defObj) {
      if (!navigator.onLine) {
        container.innerHTML = `
          <div style="text-align:center; padding:1.5rem; color:var(--text-secondary);">
            <p style="margin-bottom:0.5rem; font-weight:600;">Offline Mode</p>
            <p style="font-size:0.85rem; color:var(--text-muted);">Please connect to the internet to load English definitions for "${wordText}". Once loaded, they will be saved for offline use.</p>
          </div>
        `;
        return;
      }
      
      defObj = await fetchEnglishDefinitionFromAPI(wordText);
      await cacheDefinition(defObj);
    }
    
    state.currentWordDefinitions = defObj;
    
    // Update phonetic text on card header
    const phoneticContainer = document.getElementById('card-phonetic-container');
    if (phoneticContainer) {
      if (defObj.phonetic) {
        phoneticContainer.innerHTML = `<span class="phonetic-text" style="color:var(--text-muted); font-size: 0.95rem; font-style:italic;">${defObj.phonetic}</span>`;
      }
      
      // Update phonetic audio if available
      if (defObj.audio) {
        const audioBtn = document.getElementById('card-audio-btn');
        if (audioBtn) {
          // Clone and replace to remove previous listeners
          const newAudioBtn = audioBtn.cloneNode(true);
          audioBtn.parentNode.replaceChild(newAudioBtn, audioBtn);
          
          newAudioBtn.addEventListener('click', () => {
            const audio = new Audio(defObj.audio);
            audio.play().catch(() => {
              // Fallback to text to speech
              speakWord(wordText);
            });
          });
        }
      }
    }
    
    // Render definitions
    let html = `<div class="english-definition-section">`;
    
    defObj.meanings.forEach(meaning => {
      html += `
        <div class="definition-group">
          <h4 class="definition-pos-title">${meaning.partOfSpeech}</h4>
      `;
      
      meaning.definitions.forEach(def => {
        html += `
          <div class="definition-item">
            <span>${def.definition}</span>
            ${def.example ? `<span class="definition-item-example">"${def.example}"</span>` : ''}
          </div>
        `;
      });
      
      html += `</div>`;
    });
    
    // Synonyms
    if (defObj.synonyms && defObj.synonyms.length > 0) {
      html += `
        <div style="margin-top:0.5rem;">
          <div class="meaning-label" style="font-size:0.75rem;">Synonyms</div>
          <div class="synonyms-container">
      `;
      defObj.synonyms.forEach(syn => {
        html += `<span class="synonym-badge">${syn}</span>`;
      });
      html += `
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
  } catch (error) {
    console.warn("Definitions fetch failed:", error);
    container.innerHTML = `
      <div style="text-align:center; padding:1.5rem; color:var(--text-secondary);">
        <p style="margin-bottom:0.5rem; font-weight:600;">Definitions Unavailable</p>
        <p style="font-size:0.85rem; color:var(--text-muted);">Could not fetch English definitions. The word may not exist in the dictionary, or the service is temporarily offline.</p>
      </div>
    `;
  }
}

// ==========================================================
// 2. English Grammar Curriculum Data
// ==========================================================

const GRAMMAR_CURRICULUM = [
  {
    id: "nouns",
    title: "Nouns (பெயர்ச்சொல்)",
    description: "Learn about naming words, singular vs plural rules, and categories of nouns.",
    notes: `
      <h3>What is a Noun?</h3>
      <p>A <strong>Noun</strong> is a naming word. It is a word used to name a person, place, animal, thing, quality, or idea. In Tamil, we call it <strong>பெயர்ச்சொல்</strong> (Peyarchol).</p>
      
      <h3>Categories of Nouns</h3>
      <ul>
        <li><strong>Common Noun (பொதுப் பெயர்ச்சொல்)</strong>: General names. Example: <em>boy</em> (பையன்), <em>city</em> (நகரம்), <em>river</em> (ஆறு).</li>
        <li><strong>Proper Noun (சிறப்புப் பெயர்ச்சொல்)</strong>: Specific names (always capitalized). Example: <em>John</em> (ஜான்), <em>Chennai</em> (சென்னை), <em>Ganges</em> (கங்கை).</li>
        <li><strong>Collective Noun (கூட்டுப் பெயர்ச்சொல்)</strong>: Group names. Example: <em>team</em> (அணி), <em>family</em> (குடும்பம்), <em>flock</em> (மந்தை).</li>
        <li><strong>Abstract Noun (பண்புப் பெயர்ச்சொல்)</strong>: Intangible concepts or qualities. Example: <em>honesty</em> (நேர்மை), <em>love</em> (அன்பு), <em>happiness</em> (மகிழ்ச்சி).</li>
      </ul>
      
      <h3>Singular & Plural Rules (ஒருமை - பன்மை)</h3>
      <p>Most nouns form their plural by adding <strong>-s</strong> or <strong>-es</strong>:</p>
      <ul>
        <li>Book &rarr; Books (புத்தகம் &rarr; புத்தகங்கள்)</li>
        <li>Box &rarr; Boxes (பெட்டி &rarr; பெட்டிகள்)</li>
        <li>For nouns ending in a consonant + y, change y to <strong>-ies</strong>: Baby &rarr; Babies (குழந்தை &rarr; குழந்தைகள்).</li>
      </ul>
    `,
    examples: [
      { en: "Sarah went to London last summer.", tm: "சாரா கடந்த கோடையில் லண்டனுக்குச் சென்றார். (Sarah & London are Proper Nouns)" },
      { en: "A flock of birds flew over the tree.", tm: "மரத்தின் மேல் ஒரு பறவைக் கூட்டம் பறந்தது. (Flock is a Collective Noun)" },
      { en: "Honesty is valued everywhere.", tm: "நேர்மை எல்லா இடங்களிலும் மதிக்கப்படுகிறது. (Honesty is an Abstract Noun)" },
      { en: "I bought three new books today.", tm: "நான் இன்று மூன்று புதிய புத்தகங்களை வாங்கினேன். (Books is plural)" },
      { en: "The children are playing in the park.", tm: "குழந்தைகள் பூங்காவில் விளையாடுகிறார்கள். (Children - plural noun)" },
      { en: "I need some water.", tm: "எனக்கு சில தண்ணீர் தேவை. (Water - uncountable noun)" },
      { en: "Freedom is our right.", tm: "சுதந்திரம் எங்கள் உரிமை. (Freedom - abstract noun)" },
      { en: "The family is happy.", tm: "குடும்பம் மகிழ்ச்சியாக உள்ளது. (Family - collective noun)" }
    ],
    quiz: [
      {
        question: "Identify the Proper Noun in this sentence: 'We will visit Paris next month.'",
        options: ["month", "visit", "Paris", "next"],
        answer: 2,
        explanation: "'Paris' is a specific city's name and starts with a capital letter, making it a Proper Noun."
      },
      {
        question: "What is the correct plural form of the noun 'Lady'?",
        options: ["Ladys", "Ladies", "Ladyies", "Ladye"],
        answer: 1,
        explanation: "For nouns ending in a consonant + 'y', we drop the 'y' and add 'ies': Lady -> Ladies."
      },
      {
        question: "Which of the following is a Collective Noun (கூட்டுப் பெயர்ச்சொல்)?",
        options: ["Teacher", "School", "Class", "Pen"],
        answer: 2,
        explanation: "'Class' represents a group of students, making it a Collective Noun."
      },
      {
        question: "What type of noun is 'Happiness' in the sentence: 'Good health brings happiness.'?",
        options: ["Proper Noun", "Common Noun", "Abstract Noun", "Collective Noun"],
        answer: 2,
        explanation: "'Happiness' represents a feeling or state of mind which cannot be touched, so it is an Abstract Noun."
      },
      {
        question: "Choose the correct plural form of the noun 'Glass':",
        options: ["Glasss", "Glassies", "Glasses", "Glase"],
        answer: 2,
        explanation: "Nouns ending in 's', 'sh', 'ch', or 'x' form their plural by adding '-es': Glass -> Glasses."
      },
      {
        question: "Identify the proper noun: 'Mary visited India last year.'",
        options: ["Mary, India", "visited", "last year", "Mary, India, visited"],
        answer: 0,
        explanation: "'Mary' and 'India' are proper nouns - specific names of a person and country."
      },
      {
        question: "Which sentence uses a collective noun?",
        options: ["The bird flew away.", "The flock of birds flew away.", "The birds flew away.", "The bird's wings"],
        answer: 1,
        explanation: "'Flock' is a collective noun referring to a group of birds."
      },
      {
        question: "Select the uncountable noun:",
        options: ["apple", "rice", "car", "book"],
        answer: 1,
        explanation: "'Rice' is uncountable as it's a substance that cannot be counted individually. The others are countable."
      }
    ]
  },
  {
    id: "pronouns",
    title: "Pronouns (பிரதிப் பெயர்ச்சொல்)",
    description: "Learn about words that replace nouns to avoid repetition, like I, He, She, They.",
    notes: `
      <h3>What is a Pronoun?</h3>
      <p>A <strong>Pronoun</strong> is a word used in place of a noun. In Tamil, it is called <strong>பிரதிப் பெயர்ச்சொல்</strong> (Pradhip Peyarchol).</p>
      
      <h3>Personal Pronouns (நபர் குறிக்கும் பிரதிப் பெயர்ச்சொற்கள்)</h3>
      <p>These are categorized based on their role in the sentence:</p>
      <ul>
        <li><strong>Subject Pronouns</strong>: Used as the subject (doing the action): <strong>I</strong> (நான்), <strong>We</strong> (நாங்கள்), <strong>You</strong> (நீ/நீங்கள்), <strong>He</strong> (அவன்), <strong>She</strong> (அவள்), <strong>It</strong> (அது), <strong>They</strong> (அவர்கள்/அவை).</li>
        <li><strong>Object Pronouns</strong>: Used as the object (receiving the action): <strong>me</strong> (என்னை/எனக்கு), <strong>us</strong> (எங்களை), <strong>you</strong> (உன்னை), <strong>him</strong> (அவனை), <strong>her</strong> (அவளை), <strong>it</strong> (அதை), <strong>them</strong> (அவர்களை).</li>
      </ul>
      
      <h3>Possessive Pronouns (உரிமைப் பிரதிப் பெயர்ச்சொற்கள்)</h3>
      <p>Show ownership: <strong>mine</strong> (என்னுடையது), <strong>ours</strong> (எங்களுடையது), <strong>yours</strong> (உன்னுடையது/உங்களுடையது), <strong>his</strong> (அவனுடையது), <strong>hers</strong> (அவளுடையது), <strong>theirs</strong> (அவர்களுடையது).</p>
    `,
    examples: [
      { en: "David is happy. He won the game.", tm: "டேவிட் மகிழ்ச்சியாக இருக்கிறான். அவன் ஆட்டத்தில் வென்றான். (He replaces David)" },
      { en: "Please call them tomorrow.", tm: "தயவுசெய்து அவர்களை நாளை அழையுங்கள். (them is Object Pronoun)" },
      { en: "This bag is mine.", tm: "இந்த பை என்னுடையது. (mine is Possessive Pronoun)" },
      { en: "We are learning English together.", tm: "நாம் இணைந்து ஆங்கிலம் கற்றுக் கொண்டிருக்கிறோம். (We is Subject Pronoun)" }
    ],
    quiz: [
      {
        question: "Fill in the blank: 'Ravi is asleep. Do not wake ___.'",
        options: ["he", "his", "him", "himself"],
        answer: 2,
        explanation: "'him' is the object pronoun used to refer to a male receiver of an action."
      },
      {
        question: "Identify the possessive pronoun: 'This blue bicycle is yours.'",
        options: ["This", "blue", "bicycle", "yours"],
        answer: 3,
        explanation: "'yours' indicates ownership (உன்னுடையது), so it is a possessive pronoun."
      },
      {
        question: "Choose the correct subject pronoun: '___ went to the zoo yesterday.' (referring to a group of friends)",
        options: ["Them", "They", "Their", "Us"],
        answer: 1,
        explanation: "'They' is the subject pronoun used for plural third-person subjects."
      },
      {
        question: "Complete the sentence: 'She invited my sister and ___ to her birthday party.'",
        options: ["I", "me", "my", "mine"],
        answer: 1,
        explanation: "'me' is the object pronoun required here because it receives the invitation."
      },
      {
        question: "In the sentence: 'The cat licked its paws.' What is 'its'?",
        options: ["Subject Pronoun", "Possessive Adjective", "Object Pronoun", "Noun"],
        answer: 1,
        explanation: "'its' describes ownership directly before a noun (paws), making it a Possessive Adjective."
      }
    ]
  },
  {
    id: "verbs",
    title: "Verbs & Action (வினைச்சொல்)",
    description: "Learn about action words, state-of-being words, and irregular verb forms.",
    notes: `
      <h3>What is a Verb?</h3>
      <p>A <strong>Verb</strong> is a word that shows action or state of being. In Tamil, it is called <strong>வினைச்சொல்</strong> (Vinaichol). No English sentence can be complete without a verb!</p>
      
      <h3>Types of Verbs</h3>
      <ul>
        <li><strong>Action Verbs (செயல் வினைகள்)</strong>: Physical or mental actions. Example: <em>run</em> (ஓடு), <em>think</em> (யோசி), <em>write</em> (எழுது).</li>
        <li><strong>Helping / Auxiliary Verbs (துணை வினைகள்)</strong>: Assist the main verb to indicate tense. Example: <em>is, am, are, was, were, have, has, do, does, can, will</em>.</li>
      </ul>
      
      <h3>Regular vs. Irregular Verbs</h3>
      <ul>
        <li><strong>Regular Verbs</strong>: Form the past tense by adding <strong>-ed</strong>. Example: Play &rarr; Played, Walk &rarr; Walked.</li>
        <li><strong>Irregular Verbs</strong>: Form the past tense in unpredictable ways. Example: Go &rarr; Went, Eat &rarr; Ate, Buy &rarr; Bought.</li>
      </ul>
    `,
    examples: [
      { en: "The boys run fast in the playground.", tm: "பையன்கள் விளையாட்டு மைதானத்தில் வேகமாக ஓடுகிறார்கள். (run is an Action Verb)" },
      { en: "She is playing the piano.", tm: "அவள் பியானோ வாசித்துக் கொண்டிருக்கிறாள். (is is helping verb, playing is main verb)" },
      { en: "I wrote a letter to my father yesterday.", tm: "நான் நேற்று என் தந்தைக்கு ஒரு கடிதம் எழுதினேன். (wrote is past irregular of write)" },
      { en: "They walked home together.", tm: "அவர்கள் ஒன்றாக வீட்டிற்கு நடந்து சென்றனர். (walked is regular past tense)" }
    ],
    quiz: [
      {
        question: "Identify the action verb: 'The teacher explains the lesson clearly.'",
        options: ["teacher", "explains", "lesson", "clearly"],
        answer: 1,
        explanation: "'explains' represents the action performed by the teacher."
      },
      {
        question: "What is the past tense of the irregular verb 'Buy'?",
        options: ["Buyed", "Bought", "Boughter", "Boughten"],
        answer: 1,
        explanation: "'Buy' is an irregular verb whose past tense is 'bought' (வாங்கியது)."
      },
      {
        question: "Which of the following is a helping (auxiliary) verb in: 'We have finished our task.'?",
        options: ["We", "have", "finished", "task"],
        answer: 1,
        explanation: "'have' is the auxiliary verb helping to form the present perfect tense."
      },
      {
        question: "Fill in the blank: 'They ___ TV every evening.'",
        options: ["watches", "watching", "watch", "watched"],
        answer: 2,
        explanation: "With plural subject 'They' in the simple present tense, we use the base form 'watch'."
      },
      {
        question: "Choose the correct past tense of 'Go':",
        options: ["Goed", "Gone", "Went", "Gose"],
        answer: 2,
        explanation: "'Went' is the irregular past tense form of 'go' (சென்றது)."
      }
    ]
  },
  {
    id: "tenses",
    title: "Tenses (காலங்கள்)",
    description: "Understand time frames in English: Simple Present, Past, and Future tenses.",
    notes: `
      <h3>Introduction to Tenses</h3>
      <p>Tenses show the time when an action takes place. In Tamil, tenses are called <strong>காலங்கள்</strong> (Kaalangal).</p>
      
      <h3>1. Simple Present Tense (நிகழ்காலம்)</h3>
      <p>Used for habits, general facts, and routines. Formula: <strong>Subject + Verb (+s/es for singular subjects)</strong>.</p>
      <ul>
        <li>He plays football. (அவன் கால்பந்து விளையாடுகிறான்.)</li>
        <li>I eat rice. (நான் சாதம் சாப்பிடுகிறேன்.)</li>
      </ul>
      
      <h3>2. Simple Past Tense (இறந்தகாலம்)</h3>
      <p>Used for actions completed in the past. Formula: <strong>Subject + Past Verb Form (V2)</strong>.</p>
      <ul>
        <li>He played football yesterday. (அவன் நேற்று கால்பந்து விளையாடினான்.)</li>
        <li>I ate rice. (நான் சாதம் சாப்பிட்டேன்.)</li>
      </ul>
      
      <h3>3. Simple Future Tense (எதிர்காலம்)</h3>
      <p>Used for actions that will happen. Formula: <strong>Subject + will + Base Verb</strong>.</p>
      <ul>
        <li>He will play football tomorrow. (அவன் நாளை கால்பந்து விளையாடுவான்.)</li>
        <li>I will eat rice. (நான் சாதம் சாப்பிடுவேன்.)</li>
      </ul>
    `,
    examples: [
      { en: "The sun rises in the east.", tm: "சூரியன் கிழக்கில் உதிக்கிறது. (General fact - Present Simple)" },
      { en: "We lived in Delhi in 2018.", tm: "நாங்கள் 2018 இல் டெல்லியில் வசித்தோம். (Completed action - Past Simple)" },
      { en: "I will call you tonight.", tm: "நான் உன்னை இன்று இரவு அழைப்பேன். (Future promise - Future Simple)" },
      { en: "She doesn't drink coffee.", tm: "அவள் காபி குடிப்பதில்லை. (Negative present simple)" }
    ],
    quiz: [
      {
        question: "Choose the correct sentence in Simple Present tense:",
        options: ["He write a story.", "He writes a story.", "He wrote a story.", "He will write a story."],
        answer: 1,
        explanation: "Third-person singular subjects (He, She, It) require verb + '-s' in the Simple Present: writes."
      },
      {
        question: "What tense is the sentence: 'We will fly to New York tomorrow.'?",
        options: ["Simple Present", "Simple Past", "Simple Future", "Present Continuous"],
        answer: 2,
        explanation: "The structure 'will + verb' indicates Simple Future tense."
      },
      {
        question: "Identify the Simple Past sentence:",
        options: ["I clean my room.", "I am cleaning my room.", "I cleaned my room.", "I will clean my room."],
        answer: 2,
        explanation: "'cleaned' is the past form of the verb 'clean', representing Simple Past."
      },
      {
        question: "Fill in the blank with the correct Present tense verb: 'Water ___ at 100 degrees Celsius.'",
        options: ["boil", "boils", "boiling", "boiled"],
        answer: 1,
        explanation: "Scientific truths are written in Simple Present. Since 'Water' is uncountable (treated as singular), we add '-s': boils."
      },
      {
        question: "Correct the sentence: 'She didn't liked the cake.'",
        options: ["She doesn't liked the cake.", "She didn't like the cake.", "She didn't likes the cake.", "She will not liked the cake."],
        answer: 1,
        explanation: "After negative auxiliary 'didn't', we must use the base form of the verb (like, not liked)."
      }
    ]
  },
  {
    id: "adjectives",
    title: "Adjectives (பெயரடை)",
    description: "Learn about describing words and comparison scales like tall, taller, tallest.",
    notes: `
      <h3>What is an Adjective?</h3>
      <p>An <strong>Adjective</strong> is a describing word. It describes or gives more information about a noun. In Tamil, it is called <strong>பெயரடை</strong> (Peyaradaicchol) or <strong>உரிச்சொல்</strong>.</p>
      
      <h3>Placement of Adjectives</h3>
      <ul>
        <li><strong>Before a noun</strong>: A <em>red</em> car (சிவப்பு கார்), a <em>big</em> house (பெரிய வீடு).</li>
        <li><strong>After a state verb (like is, are, was)</strong>: The car is <em>red</em>. (கார் சிவப்பாக உள்ளது.)</li>
      </ul>
      
      <h3>Degrees of Comparison (ஒப்பீட்டு நிலைகள்)</h3>
      <p>Adjectives change forms when comparing nouns:</p>
      <ol>
        <li><strong>Positive</strong>: Describes one noun. Example: <em>Tall</em> (உயரமான).</li>
        <li><strong>Comparative</strong> (compares two): Add <strong>-er</strong> or use <strong>more</strong>. Example: <em>Taller</em> (அதிக உயரமான).</li>
        <li><strong>Superlative</strong> (compares three or more): Add <strong>-est</strong> or use <strong>most</strong>. Example: <em>Tallest</em> (மிக உயரமான).</li>
      </ol>
    `,
    examples: [
      { en: "He is wearing a blue shirt.", tm: "அவன் நீல நிற சட்டை அணிந்திருக்கிறான். (blue describes shirt)" },
      { en: "This box is heavier than that one.", tm: "இந்த பெட்டி அதை விட கனமானது. (heavier is comparative)" },
      { en: "Mount Everest is the highest mountain peak.", tm: "எவரெஸ்ட் சிகரம் மிக உயர்ந்த மலைச் சிகரமாகும். (highest is superlative)" },
      { en: "She is a beautiful girl.", tm: "அவள் ஒரு அழகான பெண். (beautiful describes girl)" }
    ],
    quiz: [
      {
        question: "Identify the adjectives in: 'The hungry lion chased a small deer.'",
        options: ["chased", "lion and deer", "hungry and small", "deer"],
        answer: 2,
        explanation: "'hungry' describes the lion and 'small' describes the deer, making both of them adjectives."
      },
      {
        question: "Choose the correct comparative form of the adjective 'Good':",
        options: ["gooder", "better", "best", "more good"],
        answer: 1,
        explanation: "'Good' has an irregular comparative form: Good -> Better."
      },
      {
        question: "Fill in: 'This is the ___ book I have ever read.'",
        options: ["interesting", "more interesting", "most interesting", "interestingly"],
        answer: 2,
        explanation: "When comparing one item to all others, we use the superlative form: 'most interesting'."
      },
      {
        question: "What is the superlative form of 'Heavy'?",
        options: ["heavier", "heaviest", "most heavy", "heavyest"],
        answer: 1,
        explanation: "For adjectives ending in 'y', change 'y' to 'i' and add 'est': heaviest."
      },
      {
        question: "In the sentence: 'The tea is hot.' What does the adjective 'hot' modify?",
        options: ["is", "tea", "The", "none"],
        answer: 1,
        explanation: "'hot' describes the state of the noun 'tea'."
      }
    ]
  },
  {
    id: "prepositions",
    title: "Prepositions (முன்னிலைச் சொற்கள் / உருபுகள்)",
    description: "Learn spatial and temporal words like in, on, at, under, and between.",
    notes: `
      <h3>What is a Preposition?</h3>
      <p>A <strong>Preposition</strong> is a word placed before a noun to show its relation to another word (location, time, or direction). In Tamil, this meaning is often joined as suffixes (உருபுகள்).</p>
      
      <h3>Common Prepositions of Place (இடத்தைக் குறிக்கும் சொற்கள்)</h3>
      <ul>
        <li><strong>In</strong> (உள்ளே / இல்): Inside a boundary. Example: <em>in the box</em> (பெட்டிக்குள்).</li>
        <li><strong>On</strong> (மேல்): Resting on a surface. Example: <em>on the table</em> (மேஜை மேல்).</li>
        <li><strong>At</strong> (இல்): A specific point. Example: <em>at the bus stop</em> (பேருந்து நிறுத்தத்தில்).</li>
        <li><strong>Under</strong> (கீழே): Directly below. Example: <em>under the bed</em> (கட்டிலின் கீழே).</li>
      </ul>
      
      <h3>Common Prepositions of Time (காலத்தைக் குறிக்கும் சொற்கள்)</h3>
      <ul>
        <li><strong>In</strong>: Months, years, seasons. Example: <em>in July</em> (ஜூலையில்).</li>
        <li><strong>On</strong>: Days of the week, dates. Example: <em>on Monday</em> (திங்கட்கிழமை அன்று).</li>
        <li><strong>At</strong>: Specific times. Example: <em>at 5:00 PM</em> (5:00 மணிக்கு).</li>
      </ul>
    `,
    examples: [
      { en: "The keys are in my pocket.", tm: "சாவிகள் என் பையில் உள்ளன. (in shows location inside)" },
      { en: "Our test is on Monday at 10:00 AM.", tm: "எங்கள் தேர்வு திங்கட்கிழமை காலை 10:00 மணிக்கு நடக்கும். (on for day, at for time)" },
      { en: "He sat between his parents.", tm: "அவன் தன் பெற்றோருக்கு இடையில் அமர்ந்தான். (between compares two elements)" },
      { en: "The dog lay under the table.", tm: "நாய் மேஜையின் அடியில் படுத்திருந்தது. (under shows position beneath)" }
    ],
    quiz: [
      {
        question: "Fill in the blank: 'The cup is ___ the kitchen table.'",
        options: ["in", "on", "at", "under"],
        answer: 1,
        explanation: "Cups sit on the flat surface of a table, so 'on' is the correct preposition."
      },
      {
        question: "Choose the correct preposition: 'He was born ___ 2012.'",
        options: ["in", "on", "at", "by"],
        answer: 0,
        explanation: "We use 'in' before years (e.g., in 2012)."
      },
      {
        question: "Fill in the blank: 'We agreed to meet ___ 6:30 PM.'",
        options: ["in", "on", "at", "until"],
        answer: 2,
        explanation: "We use 'at' before precise clock times."
      },
      {
        question: "Complete the sentence: 'The cat jumped ___ the wall.'",
        options: ["over", "in", "between", "under"],
        answer: 0,
        explanation: "'over' implies moving above and across the wall."
      },
      {
        question: "Fill in the blank: 'The library is situated ___ the bank and the park.'",
        options: ["in", "at", "between", "among"],
        answer: 2,
        explanation: "We use 'between' when naming two distinct landmarks (bank and park)."
      }
    ]
  },
  {
    id: "conjunctions",
    title: "Conjunctions (இணைப்புச் சொற்கள்)",
    description: "Learn connecting words that join sentences, clauses, or phrases together.",
    notes: `
      <h3>What is a Conjunction?</h3>
      <p>A <strong>Conjunction</strong> is a word that connects words, phrases, or clauses. In Tamil, it's called <strong>இணைப்புச் சொல்</strong> (Inaippu Chol).</p>
      
      <h3>Types of Conjunctions</h3>
      <ul>
        <li><strong>Coordinating Conjunctions (FANBOYS)</strong>: Connect equal elements. For, And, Nor, But, Or, Yet, So.</li>
        <li><strong>Subordinating Conjunctions</strong>: Connect dependent clauses to independent clauses. Because, although, if, when, since, etc.</li>
      </ul>
      
      <h3>Common Coordinating Conjunctions</h3>
      <ul>
        <li><strong>And</strong> (மற்றும்): Adds items. Example: <em>Rice and curry</em> (சாதம் மற்றும் கறி).</li>
        <li><strong>But</strong> (ஆனால்): Shows contrast. Example: <em>Small but strong</em> (சிறியது ஆனால் வலிமையானது).</li>
        <li><strong>Or</strong> (அல்லது): Shows choice. Example: <em>Tea or coffee</em> (தேநீர் அல்லது காபி).</li>
        <li><strong>So</strong> (எனவே): Shows result. Example: <em>It rained, so we stayed home</em> (மழை பெய்தது, எனவே நாம் வீட்டிலேயே இருந்தோம்).</li>
      </ul>
    `,
    examples: [
      { en: "I like tea and coffee.", tm: "எனக்கு தேநீரும் காபியும் பிடிக்கும். (and adds items)" },
      { en: "He is poor but honest.", tm: "அவன் ஏழை ஆனால் நேர்மையானவன். (but shows contrast)" },
      { en: "Study hard, or you will fail.", tm: "கடினமாக படிப்பீர்களாயின், இல்லையெனில் தேர்வில் தோல்வி அடைவீர்கள். (or shows choice)" },
      { en: "It was late, so we went home.", tm: "நேரம் முடிந்தது, எனவே நாம் வீட்டிற்குச் சென்றோம். (so shows result)" }
    ],
    quiz: [
      {
        question: "Choose the correct conjunction: 'I wanted to go, ___ it was raining.'",
        options: ["and", "but", "or", "so"],
        answer: 1,
        explanation: "'but' shows contrast between wanting to go and the rain preventing it."
      },
      {
        question: "Fill in the blank: 'You can have tea ___ coffee.'",
        options: ["and", "but", "or", "so"],
        answer: 2,
        explanation: "'or' presents a choice between two options."
      },
      {
        question: "Identify the conjunction: 'She studied hard, so she passed.'",
        options: ["studied", "hard", "so", "passed"],
        answer: 2,
        explanation: "'so' is the conjunction connecting the cause (studied hard) to the result (passed)."
      },
      {
        question: "Complete the sentence: 'He is rich ___ unhappy.'",
        options: ["and", "but", "or", "yet"],
        answer: 1,
        explanation: "'but' shows the contrast between being rich and being unhappy."
      },
      {
        question: "Which is NOT a coordinating conjunction?",
        options: ["For", "Because", "Nor", "Yet"],
        answer: 1,
        explanation: "'Because' is a subordinating conjunction, not a coordinating one (FANBOYS)."
      }
    ]
  },
  {
    id: "articles",
    title: "Articles (கட்டுரைகள் / விருப்பச் சொற்கள்)",
    description: "Learn about A, An, and The - the small words that come before nouns.",
    notes: `
      <h3>What are Articles?</h3>
      <p><strong>Articles</strong> are words that define a noun as specific or unspecific. In Tamil, articles are often implied through context.</p>
      
      <h3>Types of Articles</h3>
      <ul>
        <li><strong>Indefinite Articles (A, An)</strong>: Used for non-specific items. 'A' before consonant sounds, 'An' before vowel sounds.</li>
        <li><strong>Definite Article (The)</strong>: Used for specific items or when the listener knows what we're referring to.</li>
      </ul>
      
      <h3>Rules for A vs An</h3>
      <ul>
        <li>Use <strong>A</strong> before words starting with consonant sounds: A book, A car, A university.</li>
        <li>Use <strong>An</strong> before words starting with vowel sounds: An apple, An hour, An umbrella.</li>
        <li>Note: It's about sound, not spelling! 'University' starts with 'u' but sounds like 'you', so use 'A'.</li>
      </ul>
      
      <h3>When to Use 'The'</h3>
      <ul>
        <li>When something is unique: The sun, The moon, The earth.</li>
        <li>When mentioning something the second time: I saw a cat. The cat was black.</li>
        <li>With superlatives: The best, The tallest, The most beautiful.</li>
      </ul>
    `,
    examples: [
      { en: "I saw an elephant at the zoo.", tm: "நான் உயிரியல் பூங்காவில் ஒரு யானையைப் பார்த்தேன். (an before elephant)" },
      { en: "The sun rises in the east.", tm: "சூரியன் கிழக்கில் உதிக்கிறது. (the for unique sun)" },
      { en: "She is a doctor.", tm: "அவள் ஒரு மருத்துவர். (a for profession)" },
      { en: "This is the best movie.", tm: "இதுவே சிறந்த திரைப்படம். (the with superlative)" }
    ],
    quiz: [
      {
        question: "Choose the correct article: 'I saw ___ owl in the tree.'",
        options: ["a", "an", "the", "no article"],
        answer: 1,
        explanation: "'owl' starts with a vowel sound, so we use 'an'."
      },
      {
        question: "Fill in: 'He is ___ honest man.'",
        options: ["a", "an", "the", "no article"],
        answer: 1,
        explanation: "'honest' starts with a vowel sound (silent 'h'), so we use 'an'."
      },
      {
        question: "Which sentence uses 'the' correctly?",
        options: ["I bought the car yesterday.", "I saw a bird. The bird flew away.", "The water is essential.", "All of the above"],
        answer: 3,
        explanation: "All sentences use 'the' correctly - for specific mention, second mention, and general unique noun."
      },
      {
        question: "Choose: '___ apple a day keeps the doctor away.'",
        options: ["A", "An", "The", "No article"],
        answer: 1,
        explanation: "'apple' starts with a vowel sound, so use 'an'."
      },
      {
        question: "Complete: 'She is ___ European.'",
        options: ["a", "an", "the", "no article"],
        answer: 0,
        explanation: "'European' starts with a consonant sound ('yoo'), so use 'a'."
      }
    ]
  },
  {
    id: "adverbs",
    title: "Adverbs (வினையடை)",
    description: "Learn words that describe verbs, adjectives, or other adverbs.",
    notes: `
      <h3>What is an Adverb?</h3>
      <p>An <strong>Adverb</strong> is a word that modifies a verb, adjective, or another adverb. In Tamil, it's called <strong>வினையடை</strong> (Vinaiyadai).</p>
      
      <h3>Types of Adverbs</h3>
      <ul>
        <li><strong>Adverbs of Manner</strong>: How something is done. Example: quickly, slowly, beautifully.</li>
        <li><strong>Adverbs of Time</strong>: When something happens. Example: yesterday, tomorrow, now.</li>
        <li><strong>Adverbs of Place</strong>: Where something happens. Example: here, there, everywhere.</li>
        <li><strong>Adverbs of Frequency</strong>: How often something happens. Example: always, never, sometimes.</li>
      </ul>
      
      <h3>Forming Adverbs</h3>
      <ul>
        <li>Most adverbs are formed by adding <strong>-ly</strong> to adjectives: Quick → Quickly, Happy → Happily.</li>
        <li>Some adverbs are irregular: Good → Well, Fast → Fast.</li>
      </ul>
    `,
    examples: [
      { en: "She speaks English fluently.", tm: "அவள் ஆங்கிலத்தை சரளமாக பேசுகிறாள். (fluently describes how she speaks)" },
      { en: "I will meet you tomorrow.", tm: "நாளை உன்னை சந்திப்பேன். (tomorrow tells when)" },
      { en: "He always arrives early.", tm: "அவன் எப்போதும் சீக்கிரம் வருகிறான். (always tells frequency)" },
      { en: "Look here!", tm: "இங்கே பாருங்கள்! (here tells place)" }
    ],
    quiz: [
      {
        question: "Identify the adverb: 'She runs very fast.'",
        options: ["runs", "very", "fast", "both very and fast"],
        answer: 3,
        explanation: "'very' modifies 'fast', and 'fast' modifies 'runs'. Both are adverbs."
      },
      {
        question: "Choose the correct adverb form: 'He drives ___.'",
        options: ["careful", "carefully", "carefull", "caring"],
        answer: 1,
        explanation: "The adverb form of 'careful' is 'carefully' (add -ly)."
      },
      {
        question: "Which is an adverb of frequency?",
        options: ["quickly", "yesterday", "always", "here"],
        answer: 2,
        explanation: "'always' tells how often something happens, making it an adverb of frequency."
      },
      {
        question: "Fill in: 'She did ___ in the exam.'",
        options: ["good", "well", "better", "best"],
        answer: 1,
        explanation: "'well' is the adverb form of 'good'. We use adverbs to modify verbs."
      },
      {
        question: "Complete: 'The children played ___ in the park.'",
        options: ["happy", "happily", "happiness", "happier"],
        answer: 1,
        explanation: "'happily' is the adverb form describing how the children played."
      }
    ]
  },
  {
    id: "sentences",
    title: "Sentence Types (வாக்கிய வகைகள்)",
    description: "Learn about different types of sentences: declarative, interrogative, imperative, and exclamatory.",
    notes: `
      <h3>Types of Sentences</h3>
      <p>Sentences are classified based on their purpose and structure. In Tamil, different sentence structures exist for each type.</p>
      
      <h3>1. Declarative Sentences (அறிவிப்பு வாக்கியங்கள்)</h3>
      <p>Make statements and end with a period (.). Example: <em>The sky is blue.</em> (வானம் நீல நிறமாக உள்ளது.)</p>
      
      <h3>2. Interrogative Sentences (வினா வாக்கியங்கள்)</h3>
      <p>Ask questions and end with a question mark (?). Example: <em>What is your name?</em> (உங்கள் பெயர் என்ன?)</p>
      
      <h3>3. Imperative Sentences (கட்டளை வாக்கியங்கள்)</h3>
      <p>Give commands or requests and end with a period or exclamation mark. Example: <em>Come here.</em> (இங்கே வாருங்கள்.)</p>
      
      <h3>4. Exclamatory Sentences (ஆச்சரியப்படுத்தும் வாக்கியங்கள்)</h3>
      <p>Express strong emotion and end with an exclamation mark (!). Example: <em>What a beautiful day!</em> (என்ன அழகான நாள்!)</p>
    `,
    examples: [
      { en: "The sun rises in the east.", tm: "சூரியன் கிழக்கில் உதிக்கிறது. (Declarative)" },
      { en: "Where are you going?", tm: "நீங்கள் எங்கே செல்கிறீர்கள்? (Interrogative)" },
      { en: "Please close the door.", tm: "தயவுசெய்து கதவை மூடுங்கள். (Imperative)" },
      { en: "How wonderful this is!", tm: "இது எவ்வளவு அற்புதமானது! (Exclamatory)" }
    ],
    quiz: [
      {
        question: "Identify the sentence type: 'What time is it?'",
        options: ["Declarative", "Interrogative", "Imperative", "Exclamatory"],
        answer: 1,
        explanation: "This sentence asks a question, making it interrogative."
      },
      {
        question: "Which is an imperative sentence?",
        options: ["The book is on the table.", "Is the book on the table?", "Put the book on the table.", "What a big table!"],
        answer: 2,
        explanation: "'Put the book on the table' gives a command, making it imperative."
      },
      {
        question: "Choose the exclamatory sentence:",
        options: ["I am happy.", "Are you happy?", "Be happy!", "How happy I am!"],
        answer: 3,
        explanation: "'How happy I am!' expresses strong emotion with an exclamation mark."
      },
      {
        question: "Complete to make it declarative: 'She ___ to school.'",
        options: ["goes", "goes?", "Go!", "Does she go?"],
        answer: 0,
        explanation: "'She goes to school.' is a statement, making it declarative."
      },
      {
        question: "Which punctuation mark ends an interrogative sentence?",
        options: ["Period (.)", "Question mark (?)", "Exclamation mark (!)", "Comma (,)"],
        answer: 1,
        explanation: "Interrogative sentences (questions) end with a question mark."
      }
    ]
  }
];

// ==========================================================
// Tamil Grammar Curriculum
// ==========================================================

const TAMIL_GRAMMAR_CURRICULUM = [
  {
    id: "tamil-nouns",
    title: "தமிழ் பெயர்ச்சொற்கள் (Tamil Nouns)",
    description: "Learn about Tamil noun classification, gender, and number systems.",
    notes: `
      <h3>தமிழ் பெயர்ச்சொற்கள் (Tamil Nouns)</h3>
      <p>தமிழில் பெயர்ச்சொற்கள் பால் (gender), எண் (number), மற்றும் இடம் (case) அடிப்படையில் வகைப்படுத்தப்படுகின்றன.</p>
      
      <h3>பால் வகைகள் (Gender Types)</h3>
      <ul>
        <li><strong>ஆண்பால் (Masculine)</strong>: ஆண் உயிரினங்களைக் குறிக்கும். எ.கா: மனிதன், நாய், யானை.</li>
        <li><strong>பெண்பால் (Feminine)</strong>: பெண் உயிரினங்களைக் குறிக்கும். எ.கா: மனிதி, பூனை, பசு.</li>
        <li><strong>பலர்பால் (Neuter/High)</strong>: கடவுள்கள், மதிப்பிற்குரியவர்கள். எ.கா: தெய்வம், ஆசான், குரு.</li>
        <li><strong>ஒன்றன்பால் (Neuter/Low)</strong>: பொருட்கள், தாவரங்கள், விலங்குகள். எ.கா: மரம், கல், புத்தகம்.</li>
      </ul>
      
      <h3>எண் வகைகள் (Number Types)</h3>
      <ul>
        <li><strong>ஒருமை (Singular)</strong>: ஒரு பொருளைக் குறிக்கும். எ.கா: புத்தகம்.</li>
        <li><strong>பன்மை (Plural)</strong>: பல பொருட்களைக் குறிக்கும். எ.கா: புத்தகங்கள்.</li>
      </ul>
      
      <h3>பன்மை விகுதிகள் (Plural Suffixes)</h3>
      <ul>
        <li>கள் - பொதுவான பன்மை: புத்தகங்கள், மரங்கள்</li>
        <li>டு/று - பலர்பால்: தெய்வங்கள், ஆசிரியர்கள்</li>
        <li>கள் - ஆண்பால்: மனிதர்கள், மாணவர்கள்</li>
      </ul>
    `,
    examples: [
      { en: "The boy is reading.", tm: "பையன் படிக்கிறான். (பையன் - ஆண்பால் ஒருமை)" },
      { en: "The girls are playing.", tm: "பெண்கள் விளையாடுகிறார்கள். (பெண்கள் - பெண்பால் பன்மை)" },
      { en: "The trees are tall.", tm: "மரங்கள் உயரமாக உள்ளன. (மரங்கள் - ஒன்றன்பால் பன்மை)" },
      { en: "God is great.", tm: "தெய்வம் மகத்துவமானது. (தெய்வம் - பலர்பால் ஒருமை)" }
    ],
    quiz: [
      {
        question: "பெண்பால் சொல்லைக் கண்டறியவும்:",
        options: ["மனிதன்", "மனிதி", "மரம்", "தெய்வம்"],
        answer: 1,
        explanation: "'மனிதி' பெண்பால் சொல், ஏனெனில் அது பெண்ணைக் குறிக்கிறது."
      },
      {
        question: "'புத்தகம்' என்பதன் பன்மை வடிவம்:",
        options: ["புத்தகம்", "புத்தகங்கள்", "புத்தகங்கள்", "புத்தகம்"],
        answer: 1,
        explanation: "'புத்தகம்' + 'கள்' = 'புத்தகங்கள்' (பன்மை)"
      },
      {
        question: "ஒன்றன்பால் சொல் எது?",
        options: ["மனிதன்", "பெண்", "மரம்", "தெய்வம்"],
        answer: 2,
        explanation: "'மரம்' ஒன்றன்பால் சொல், ஏனெனில் அது பொருளைக் குறிக்கிறது."
      },
      {
        question: "பலர்பால் எதற்குப் பயன்படுத்தப்படுகிறது?",
        options: ["பொருட்களுக்கு", "கடவுள்களுக்கு", "விலங்குகளுக்கு", "தாவரங்களுக்கு"],
        answer: 1,
        explanation: "பலர்பால் கடவுள்கள் மற்றும் மதிப்பிற்குரியவர்களுக்குப் பயன்படுத்தப்படுகிறது."
      },
      {
        question: "'ஆசிரியர்' எந்தப் பாலைச் சேர்ந்தது?",
        options: ["ஆண்பால்", "பெண்பால்", "பலர்பால்", "ஒன்றன்பால்"],
        answer: 2,
        explanation: "'ஆசிரியர்' பலர்பால் சொல், ஏனெனில் அது மதிப்பிற்குரியவரைக் குறிக்கிறது."
      }
    ]
  },
  {
    id: "tamil-verbs",
    title: "தமிழ் வினைச்சொற்கள் (Tamil Verbs)",
    description: "Learn about Tamil verb conjugation, tenses, and verb forms.",
    notes: `
      <h3>தமிழ் வினைச்சொற்கள் (Tamil Verbs)</h3>
      <p>தமிழில் வினைச்சொற்கள் பால், எண், மற்றும் காலம் அடிப்படையில் மாறுகின்றன.</p>
      
      <h3>காலங்கள் (Tenses)</h3>
      <ul>
        <li><strong>நிகழ்காலம் (Present Tense)</strong>: இப்போது நடக்கும் செயல். எ.கா: படிக்கிறான், எழுதுகிறாள்.</li>
        <li><strong>இறந்தகாலம் (Past Tense)</strong>: ஏற்கனவே நடந்த செயல். எ.கா: படித்தான், எழுதினாள்.</li>
        <li><strong>எதிர்காலம் (Future Tense)</strong>: எதிர்காலத்தில் நடக்கும் செயல். எ.கா: படிப்பான், எழுதுவாள்.</li>
      </ul>
      
      <h3>வினை முறைகள் (Verb Forms)</h3>
      <ul>
        <li><strong>ஒருமை ஆண்பால் (Singular Masculine)</strong>: படிக்கிறான், படித்தான், படிப்பான்</li>
        <li><strong>ஒருமை பெண்பால் (Singular Feminine)</strong>: படிக்கிறாள், படித்தாள், படிப்பாள்</li>
        <li><strong>பன்மை (Plural)</strong>: படிக்கிறார்கள், படித்தார்கள், படிப்பார்கள்</li>
      </ul>
      
      <h3>வினை விகுதிகள் (Verb Suffixes)</h3>
      <ul>
        <li>நிகழ்காலம்: -கிறான், -கிறாள், -க்கிறார்கள்</li>
        <li>இறந்தகாலம்: -த்தான், -த்தாள், -த்தார்கள்</li>
        <li>எதிர்காலம்: -ப்பான், -ப்பாள், -ப்பார்கள்</li>
      </ul>
    `,
    examples: [
      { en: "He is reading a book.", tm: "அவன் புத்தகம் படிக்கிறான். (நிகழ்காலம்)" },
      { en: "She wrote a letter.", tm: "அவள் கடிதம் எழுதினாள். (இறந்தகாலம்)" },
      { en: "They will come tomorrow.", tm: "அவர்கள் நாளை வருவார்கள். (எதிர்காலம்)" },
      { en: "We are studying Tamil.", tm: "நாம் தமிழ் கற்கிறோம். (நிகழ்காலம்)" }
    ],
    quiz: [
      {
        question: "'படிக்கிறான்' எந்தக் காலம்?",
        options: ["நிகழ்காலம்", "இறந்தகாலம்", "எதிர்காலம்", "எதுவுமில்லை"],
        answer: 0,
        explanation: "'படிக்கிறான்' நிகழ்கால வினைச்சொல், ஏனெனில் அது இப்போது நடக்கும் செயலைக் குறிக்கிறது."
      },
      {
        question: "'எழுதினாள்' எந்தக் காலம்?",
        options: ["நிகழ்காலம்", "இறந்தகாலம்", "எதிர்காலம்", "எதுவுமில்லை"],
        answer: 1,
        explanation: "'எழுதினாள்' இறந்தகால வினைச்சொல், ஏனெனில் அது ஏற்கனவே நடந்த செயலைக் குறிக்கிறது."
      },
      {
        question: "'வருவார்கள்' எந்தக் காலம்?",
        options: ["நிகழ்காலம்", "இறந்தகாலம்", "எதிர்காலம்", "எதுவுமில்லை"],
        answer: 2,
        explanation: "'வருவார்கள்' எதிர்கால வினைச்சொல், ஏனெனில் அது எதிர்காலத்தில் நடக்கும் செயலைக் குறிக்கிறது."
      },
      {
        question: "ஒருமை பெண்பால் நிகழ்கால விகுதி:",
        options: ["-கிறான்", "-கிறாள்", "-க்கிறார்கள்", "-ப்பான்"],
        answer: 1,
        explanation: "'-கிறாள்' ஒருமை பெண்பால் நிகழ்கால விகுதி."
      },
      {
        question: "பன்மை இறந்தகால விகுதி:",
        options: ["-த்தான்", "-த்தாள்", "-த்தார்கள்", "-ப்பார்கள்"],
        answer: 2,
        explanation: "'-த்தார்கள்' பன்மை இறந்தகால விகுதி."
      }
    ]
  },
  {
    id: "tamil-cases",
    title: "தமிழ் வேற்றுமைப் பெயர்கள் (Tamil Cases)",
    description: "Learn about the eight case systems in Tamil grammar.",
    notes: `
      <h3>தமிழ் வேற்றுமைப் பெயர்கள் (Tamil Cases)</h3>
      <p>தமிழில் எட்டு வேற்றுமைப் பெயர்கள் உள்ளன. இவை பெயர்ச்சொல்லின் பங்கைக் குறிக்கின்றன.</p>
      
      <h3>எட்டு வேற்றுமைகள் (Eight Cases)</h3>
      <ol>
        <li><strong>முதல் வேற்றுமை (Nominative Case)</strong>: பெயரின் அடிப்படை வடிவம். எ.கா: ராமன்.</li>
        <li><strong>இரண்டாம் வேற்றுமை (Accusative Case)</strong>: பொருள் வேற்றுமை. விகுதி: -ஐ, -ய். எ.கா: ராமனை.</li>
        <li><strong>மூன்றாம் வேற்றுமை (Instrumental Case)</strong>: கருவி வேற்றுமை. விகுதி: -ஆல், -ஓடு. எ.கா: ராமனால்.</li>
        <li><strong>நான்காம் வேற்றுமை (Dative Case)</strong>: இலக்கண வேற்றுமை. விகுதி: -க்கு, -க்கை. எ.கா: ராமனுக்கு.</li>
        <li><strong>ஐந்தாம் வேற்றுமை (Ablative Case)</strong>: பெறு வேற்றுமை. விகுதி: -இலிருந்து, -ஆகிவிட்டு. எ.கா: ராமனிடமிருந்து.</li>
        <li><strong>ஆறாம் வேற்றுமை (Genitive Case)</strong>: சம்பந்த வேற்றுமை. விகுதி: -இன், -அது. எ.கா: ராமனின்.</li>
        <li><strong>ஏழாம் வேற்றுமை (Locative Case)</strong>: இட வேற்றுமை. விகுதி: -இல், -இடம். எ.கா: ராமன் வீட்டில்.</li>
        <li><strong>எட்டாம் வேற்றுமை (Vocative Case)</strong>: அழைப்பு வேற்றுமை. எ.கா: ராமா!</li>
      </ol>
    `,
    examples: [
      { en: "Raman is here.", tm: "ராமன் இங்கே உள்ளான். (முதல் வேற்றுமை)" },
      { en: "I saw Raman.", tm: "நான் ராமனைப் பார்த்தேன். (இரண்டாம் வேற்றுமை)" },
      { en: "It was done by Raman.", tm: "இது ராமனால் செய்யப்பட்டது. (மூன்றாம் வேற்றுமை)" },
      { en: "I gave it to Raman.", tm: "நான் இதை ராமனுக்குக் கொடுத்தேன். (நான்காம் வேற்றுமை)" }
    ],
    quiz: [
      {
        question: "இரண்டாம் வேற்றுமை விகுதி:",
        options: ["-ஐ", "-ஆல்", "-க்கு", "-இன்"],
        answer: 0,
        explanation: "'-ஐ' இரண்டாம் வேற்றுமை (பொருள் வேற்றுமை) விகுதி."
      },
      {
        question: "மூன்றாம் வேற்றுமை எதற்குப் பயன்படுத்தப்படுகிறது?",
        options: ["பொருள்", "கருவி", "இலக்கணம்", "இடம்"],
        answer: 1,
        explanation: "மூன்றாம் வேற்றுமை கருவி வேற்றுமை, ஏனெனில் அது கருவியைக் குறிக்கிறது."
      },
      {
        question: "'ராமனுக்கு' எந்த வேற்றுமை?",
        options: ["இரண்டாம்", "மூன்றாம்", "நான்காம்", "ஆறாம்"],
        answer: 2,
        explanation: "'ராமனுக்கு' நான்காம் வேற்றுமை (இலக்கண வேற்றுமை)."
      },
      {
        question: "ஆறாம் வேற்றுமை விகுதி:",
        options: ["-ஐ", "-ஆல்", "-இன்", "-இல்"],
        answer: 2,
        explanation: "'-இன்' ஆறாம் வேற்றுமை (சம்பந்த வேற்றுமை) விகுதி."
      },
      {
        question: "எட்டாம் வேற்றுமை எதற்கு?",
        options: ["பொருள்", "கருவி", "அழைப்பு", "இடம்"],
        answer: 2,
        explanation: "எட்டாம் வேற்றுமை அழைப்பு வேற்றுமை, ஏனெனில் அது யாரையாவது அழைக்கப் பயன்படுகிறது."
      }
    ]
  },
  {
    id: "tamil-pronouns",
    title: "தமிழ் பிரதிப் பெயர்கள் (Tamil Pronouns)",
    description: "Learn about Tamil pronouns for persons, things, and demonstratives.",
    notes: `
      <h3>தமிழ் பிரதிப் பெயர்கள் (Tamil Pronouns)</h3>
      <p>பிரதிப் பெயர்கள் பெயர்களுக்குப் பதிலாகப் பயன்படுத்தப்படுகின்றன.</p>
      
      <h3>நபர் குறிக்கும் பிரதிப் பெயர்கள் (Personal Pronouns)</h3>
      <ul>
        <li><strong>முதல் பெயர் (First Person)</strong>: நான் (I), நாம் (We), நமக்கு (Us)</li>
        <li><strong>இரண்டாம் பெயர் (Second Person)</strong>: நீ (You - singular), நீங்கள் (You - plural)</li>
        <li><strong>மூன்றாம் பெயர் (Third Person)</strong>: அவன் (He), அவள் (She), அவர்கள் (They)</li>
      </ul>
      
      <h3>பொருள் குறிக்கும் பிரதிப் பெயர்கள் (Object Pronouns)</h3>
      <ul>
        <li><strong>அது (It)</strong>: ஒன்றன்பால் பொருள்களுக்கு</li>
        <li><strong>அவை (They)</strong>: ஒன்றன்பால் பன்மை பொருள்களுக்கு</li>
      </ul>
      
      <h3>குறிப்புப் பெயர்கள் (Demonstrative Pronouns)</h3>
      <ul>
        <li><strong>அந்த (That)</strong>: தொலைவில் உள்ளதைக் குறிக்க</li>
        <li><strong>இந்த (This)</strong>: அருகில் உள்ளதைக் குறிக்க</li>
      </ul>
    `,
    examples: [
      { en: "I am going to school.", tm: "நான் பள்ளிக்குச் செல்கிறேன். (நான் - First Person)" },
      { en: "You are a good student.", tm: "நீ ஒரு நல்ல மாணவர். (நீ - Second Person)" },
      { en: "He is my friend.", tm: "அவன் என் நண்பர். (அவன் - Third Person)" },
      { en: "This is my book.", tm: "This is my book. (This - Demonstrative)" }
    ],
    quiz: [
      {
        question: "முதல் பெயர் ஒருமை:",
        options: ["நான்", "நாம்", "நீ", "அவன்"],
        answer: 0,
        explanation: "'நான்' முதல் பெயர் ஒருமை (First Person Singular)."
      },
      {
        question: "இரண்டாம் பெயர் பன்மை:",
        options: ["நீ", "நீங்கள்", "அவன்", "அவள்"],
        answer: 1,
        explanation: "'நீங்கள்' இரண்டாம் பெயர் பன்மை (Second Person Plural)."
      },
      {
        question: "மூன்றாம் பெயர் ஆண்பால்:",
        options: ["அவன்", "அவள்", "அவர்கள்", "அது"],
        answer: 0,
        explanation: "'அவன்' மூன்றாம் பெயர் ஆண்பால் (Third Person Masculine)."
      },
      {
        question: "ஒன்றன்பால் பொருள் குறிக்கும் பிரதிப் பெயர்:",
        options: ["அவன்", "அவள்", "அது", "அவை"],
        answer: 2,
        explanation: "'அது' ஒன்றன்பால் பொருள் குறிக்கும் பிரதிப் பெயர்."
      },
      {
        question: "அருகில் உள்ளதைக் குறிக்கும் குறிப்புப் பெயர்:",
        options: ["அந்த", "இந்த", "அவன்", "அது"],
        answer: 1,
        explanation: "'இந்த' அருகில் உள்ளதைக் குறிக்கும் குறிப்புப் பெயர்."
      }
    ]
  },
  {
    id: "tamil-adjectives",
    title: "தமிழ் பெயரடைகள் (Tamil Adjectives)",
    description: "Learn about describing words in Tamil and their usage.",
    notes: `
      <h3>தமிழ் பெயரடைகள் (Tamil Adjectives)</h3>
      <p>பெயரடைகள் பெயர்ச்சொற்களை விவரிக்கப் பயன்படுகின்றன.</p>
      
      <h3>பெயரடை வகைகள் (Types of Adjectives)</h3>
      <ul>
        <li><strong>தருண பெயரடை (Qualitative Adjectives)</strong>: தரத்தைக் குறிக்கும். எ.கா: நல்ல, பெரிய, சிறிய.</li>
        <li><strong>எண் பெயரடை (Numerical Adjectives)</strong>: எண்ணைக் குறிக்கும். எ.கா: ஒரு, இரண்டு, பல.</li>
        <li><strong>உரிச்சொற்கள் (Demonstrative Adjectives)</strong>: குறிப்பைக் குறிக்கும். எ.கா: இந்த, அந்த.</li>
        <li><strong>வினா பெயரடை (Interrogative Adjectives)</strong>: கேள்வியைக் குறிக்கும். எ.கா: எந்த, எவை.</li>
      </ul>
      
      <h3>பெயரடை விகுதிகள் (Adjective Suffixes)</h3>
      <ul>
        <li>-ஆன - தருண பெயரடை: நல்லான, பெரியான</li>
        <li>-ஆர் - பலர்பால்: நல்லார், பெரியார்</li>
        <li>-ஆ - பெண்பால்: நல்லா, பெரியா</li>
      </ul>
    `,
    examples: [
      { en: "He is a good boy.", tm: "அவன் ஒரு நல்ல பையன். (நல்ல - Qualitative)" },
      { en: "I have two books.", tm: "எனக்கு இரண்டு புத்தகங்கள் உள்ளன. (இரண்டு - Numerical)" },
      { en: "This car is red.", tm: "இந்த கார் சிவப்பு நிறமானது. (இந்த - Demonstrative)" },
      { en: "Which book do you want?", tm: "எந்த புத்தகம் வேண்டும்? (எந்த - Interrogative)" }
    ],
    quiz: [
      {
        question: "தருண பெயரடை எது?",
        options: ["நல்ல", "இரண்டு", "இந்த", "எந்த"],
        answer: 0,
        explanation: "'நல்ல' தருண பெயரடை, ஏனெனில் அது தரத்தைக் குறிக்கிறது."
      },
      {
        question: "எண் பெயரடை எது?",
        options: ["நல்ல", "இரண்டு", "இந்த", "எந்த"],
        answer: 1,
        explanation: "'இரண்டு' எண் பெயரடை, ஏனெனில் அது எண்ணைக் குறிக்கிறது."
      },
      {
        question: "குறிப்புப் பெயரடை எது?",
        options: ["நல்ல", "இரண்டு", "இந்த", "எந்த"],
        answer: 2,
        explanation: "'இந்த' குறிப்புப் பெயரடை, ஏனெனில் அது குறிப்பைக் குறிக்கிறது."
      },
      {
        question: "வினா பெயரடை எது?",
        options: ["நல்ல", "இரண்டு", "இந்த", "எந்த"],
        answer: 3,
        explanation: "'எந்த' வினா பெயரடை, ஏனெனில் அது கேள்வியைக் குறிக்கிறது."
      },
      {
        question: "பெண்பால் பெயரடை விகுதி:",
        options: ["-ஆன", "-ஆர்", "-ஆ", "-ஆள்"],
        answer: 2,
        explanation: "'-ஆ' பெண்பால் பெயரடை விகுதி."
      }
    ]
  }
];

// ==========================================================
// 3. Grammar UI Handlers & Quiz Engine
// ==========================================================

// Grammar language state
let grammarLanguage = 'english'; // 'english' or 'tamil'

function renderGrammarTopicsList() {
  elements.grammarListView.style.display = 'block';
  elements.grammarLessonView.style.display = 'none';
  elements.grammarQuizView.style.display = 'none';
  elements.grammarResultsView.style.display = 'none';
  
  elements.grammarTopicsGrid.innerHTML = '';
  
  // Add language selector
  const languageSelector = document.createElement('div');
  languageSelector.className = 'grammar-language-selector';
  languageSelector.innerHTML = `
    <button class="lang-btn ${grammarLanguage === 'english' ? 'active' : ''}" data-lang="english">English Grammar</button>
    <button class="lang-btn ${grammarLanguage === 'tamil' ? 'active' : ''}" data-lang="tamil">தமிழ் இலக்கணம் (Tamil Grammar)</button>
  `;
  
  languageSelector.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grammarLanguage = btn.dataset.lang;
      renderGrammarTopicsList();
    });
  });
  
  elements.grammarTopicsGrid.appendChild(languageSelector);
  
  // Render topics based on selected language
  const curriculum = grammarLanguage === 'english' ? GRAMMAR_CURRICULUM : TAMIL_GRAMMAR_CURRICULUM;
  
  curriculum.forEach(topic => {
    const card = document.createElement('div');
    card.className = 'grammar-topic-card';
    card.innerHTML = `
      <div class="grammar-topic-title">${topic.title}</div>
      <div class="grammar-topic-desc">${topic.description}</div>
      <button class="primary-btn btn-sm" style="padding: 0.6rem 1rem; font-size: 0.85rem; width: fit-content;">Start Lesson</button>
    `;
    
    card.querySelector('button').addEventListener('click', () => {
      selectGrammarLesson(topic.id, grammarLanguage);
    });
    
    elements.grammarTopicsGrid.appendChild(card);
  });
}

function selectGrammarLesson(lessonId, language = 'english') {
  const curriculum = language === 'english' ? GRAMMAR_CURRICULUM : TAMIL_GRAMMAR_CURRICULUM;
  const lesson = curriculum.find(l => l.id === lessonId);
  if (!lesson) return;
  
  state.grammar.currentLesson = lesson;
  state.grammar.currentLanguage = language;
  
  // Log grammar lesson access
  logActivity('grammar_lesson', { 
    lessonId: lessonId, 
    title: lesson.title, 
    language: language 
  });
  
  // Render details
  elements.grammarLessonTitle.textContent = lesson.title;
  elements.grammarLessonNotes.innerHTML = lesson.notes;
  
  // Render examples
  elements.grammarExamplesBody.innerHTML = '';
  lesson.examples.forEach(ex => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); font-weight:600;">${ex.en}</td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">${ex.tm}</td>
    `;
    elements.grammarExamplesBody.appendChild(row);
  });
  
  // View Switch
  elements.grammarListView.style.display = 'none';
  elements.grammarLessonView.style.display = 'block';
}

function startGrammarQuiz() {
  const lesson = state.grammar.currentLesson;
  if (!lesson || !lesson.quiz) return;
  
  state.grammar.quiz.questions = [...lesson.quiz];
  state.grammar.quiz.currentIndex = 0;
  state.grammar.quiz.score = 0;
  state.grammar.quiz.answers = [];
  
  elements.grammarQuizTitle.textContent = `${lesson.title} - Quiz`;
  
  elements.grammarLessonView.style.display = 'none';
  elements.grammarResultsView.style.display = 'none';
  elements.grammarQuizView.style.display = 'block';
  
  loadGrammarQuizQuestion();
}

function loadGrammarQuizQuestion() {
  const quizState = state.grammar.quiz;
  const currentIdx = quizState.currentIndex;
  const currentQ = quizState.questions[currentIdx];
  
  // UI
  elements.grammarQuizProgressText.textContent = `Question ${currentIdx + 1} of 5`;
  elements.grammarQuizProgressFill.style.width = `${(currentIdx / 5) * 100}%`;
  elements.grammarQuizQuestionText.textContent = currentQ.question;
  
  // Options
  elements.grammarQuizOptionsGrid.innerHTML = '';
  currentQ.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.innerHTML = `
      <span class="quiz-option-index">${String.fromCharCode(65 + idx)}</span>
      <span>${opt}</span>
    `;
    btn.addEventListener('click', () => handleGrammarQuizAnswer(idx, btn));
    elements.grammarQuizOptionsGrid.appendChild(btn);
  });
  
  // Hide explanation and clear feedback
  elements.grammarQuizExplanationBox.style.display = 'none';
  elements.grammarQuizFeedbackBar.innerHTML = '';
}

function handleGrammarQuizAnswer(selectedIndex, clickedBtn) {
  const quizState = state.grammar.quiz;
  const currentIdx = quizState.currentIndex;
  const currentQ = quizState.questions[currentIdx];
  const optionButtons = elements.grammarQuizOptionsGrid.querySelectorAll('.quiz-option');
  
  // Disable all
  optionButtons.forEach(btn => btn.classList.add('disabled'));
  
  const isCorrect = (selectedIndex === currentQ.answer);
  quizState.answers.push({
    selectedIndex,
    isCorrect
  });
  
  if (isCorrect) {
    quizState.score++;
    clickedBtn.classList.add('correct');
  } else {
    clickedBtn.classList.add('incorrect');
    // Highlight correct
    optionButtons[currentQ.answer].classList.remove('disabled');
    optionButtons[currentQ.answer].classList.add('correct');
    optionButtons[currentQ.answer].classList.add('disabled');
  }
  
  // Render explanation box
  elements.grammarQuizExplanationText.textContent = currentQ.explanation;
  elements.grammarQuizExplanationBox.style.display = 'block';
  elements.grammarQuizExplanationBox.style.borderColor = isCorrect ? 'var(--success-color)' : 'var(--error-color)';
  
  // Next button
  elements.grammarQuizFeedbackBar.innerHTML = `
    <div style="flex-grow:1;"></div>
    <button class="primary-btn" id="grammar-quiz-next-btn">${currentIdx === 4 ? 'See Results' : 'Next Question &rarr;'}</button>
  `;
  
  document.getElementById('grammar-quiz-next-btn').addEventListener('click', () => {
    quizState.currentIndex++;
    if (quizState.currentIndex < 5) {
      loadGrammarQuizQuestion();
    } else {
      showGrammarQuizResults();
    }
  });
}

function showGrammarQuizResults() {
  elements.grammarQuizView.style.display = 'none';
  elements.grammarResultsView.style.display = 'flex';
  
  const score = state.grammar.quiz.score;
  document.getElementById('grammar-results-score-num').textContent = `${score}/5`;
  
  let title = "";
  let desc = "";
  if (score === 5) {
    title = "Perfect Score! 🏆";
    desc = `Flawless work on ${state.grammar.currentLesson.title}. You have fully mastered this grammar concept!`;
  } else if (score >= 4) {
    title = "Great Job! 🌟";
    desc = `Excellent understanding! You scored ${score} out of 5. You have a solid grasp of this topic.`;
  } else if (score >= 3) {
    title = "Good Attempt! 👍";
    desc = `Nice effort! You got more than half correct. Review the lesson notes and try again to get a perfect score.`;
  } else {
    title = "Keep Practicing! 💪";
    desc = `Don't worry! Grammar takes time. Read the lesson explanation, look at the bilingual examples, and retry.`;
  }
  
  document.getElementById('grammar-results-title').textContent = title;
  document.getElementById('grammar-results-desc').textContent = desc;
}

function exitGrammarQuiz() {
  if (confirm("Are you sure you want to exit the quiz? Your progress will be lost.")) {
    elements.grammarQuizView.style.display = 'none';
    elements.grammarLessonView.style.display = 'block';
  }
}

function setupGrammarEventListeners() {
  elements.grammarBackToListBtn.addEventListener('click', () => {
    elements.grammarLessonView.style.display = 'none';
    elements.grammarListView.style.display = 'block';
  });
  
  elements.startGrammarQuizBtn.addEventListener('click', startGrammarQuiz);
  elements.grammarQuizExitBtn.addEventListener('click', exitGrammarQuiz);
  elements.grammarQuizRetryBtn.addEventListener('click', startGrammarQuiz);
  
  elements.grammarQuizBackBtn.addEventListener('click', () => {
    elements.grammarResultsView.style.display = 'none';
    elements.grammarLessonView.style.display = 'block';
  });
}

// Invoke grammar event listeners on load
setupGrammarEventListeners();

