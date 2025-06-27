
// --- MERGED JAVASCRIPT FOR CONCEPTRA APP ---

// NOTE: This file combines static/script_v2.js (AI Features) and New File.js (Main App)
// It ensures a single Firebase SDK instance and a unified Authentication state.

// --- FIREBASE SDK & INITIALIZATION (SINGLE INSTANCE) ---
// NOTE: Ensure your HTML includes <script type="module" src="merged_script.js"> (replace with your actual filename)
// We are using the module import style from the original New File.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    signOut,
    getIdToken // <<<--- ENSURE THIS IS IMPORTED
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; // <<<--- UPDATED: Added more auth functions
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    getDoc,
    doc,
    orderBy,
    writeBatch,
    deleteDoc,
    serverTimestamp,
    Timestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // <<<--- UPDATED: Added setDoc

// We use the firebaseConfig from New File.js as it's the main app's config
const firebaseConfig = {
    apiKey: "AIzaSyBKsycaVUdBKZMLIRhP3tkC36786MJFyq4", // <<<--- WARNING: YOUR API KEY IS PUBLIC. REPLACE IT IMMEDIATELY.
    authDomain: "conceptra-c1000.firebaseapp.com",
    databaseURL: "https://conceptra-c1000-default-rtdb.firebaseio.com",
    projectId: "conceptra-c1000",
    storageBucket: "conceptra-c1000.appspot.com",
    messagingSenderId: "298402987968",
    appId: "1:298402987968:web:c0d0d7d6c08cdfa6bc5225",
    measurementId: "G-QRQYEVSJJ6"
};

// Initialize Firebase - ONLY ONCE
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

console.log("DEBUG_MERGE: Firebase SDKs initialized.");


// --- GLOBAL USER STATE & AUTH MODE ---
let currentFirebaseUser = null;
let authStateLoaded = false;
let isLoginMode = false; // false = Sign Up mode, true = Login mode
let activePage = 'splash-screen'; // Initialize globally


// --- UI Update Functions ---
window.updateUIAfterLogin = function(user) {
    console.log("DEBUG_MERGE: updateUIAfterLogin called for user:", user);
    if (!user) {
        console.log("DEBUG_MERGE: updateUIAfterLogin called with null user, exiting.");
        return;
    }
    console.log("DEBUG_MERGE: User details - UID:", user.uid, "Email:", user.email, "Name:", user.displayName);

    const userNameDisplay = document.getElementById('user-name-display-header');
    if (userNameDisplay) {
        userNameDisplay.textContent = user.displayName || user.email || 'User';
    }
    const userProfileIcon = document.getElementById('user-profile-icon');
    if(userProfileIcon) {
        userProfileIcon.innerHTML = user.displayName ? user.displayName.charAt(0).toUpperCase() : '🧑‍🎓';
    }

    const cCoinBalanceDisplay = document.getElementById('c-coin-balance');
    if (cCoinBalanceDisplay) {
        const userDocRef = doc(db, "users", user.uid);
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists() && docSnap.data().cCoins !== undefined) {
                cCoinBalanceDisplay.textContent = `C-Coins: ${docSnap.data().cCoins}`;
            } else {
                cCoinBalanceDisplay.textContent = 'C-Coins: 0';
            }
        }).catch(error => {
            console.error("DEBUG_MERGE: Error fetching C-Coins for UI:", error);
            cCoinBalanceDisplay.textContent = 'C-Coins: N/A';
        });
    }

    // Assuming these buttons exist and should be enabled after login
    document.querySelectorAll('.btn-buy-premium').forEach(btn => btn.disabled = false);
    // Additional buttons to enable/disable based on login status can be added here

    // 'activePage' is now the global variable
    // Only redirect if the user was specifically on the login screen
    if (typeof activePage === 'string' && activePage === 'login-screen' && typeof window.showScreen === 'function') {
        console.log("DEBUG_MERGE: updateUIAfterLogin: User was on login screen, redirecting to home-screen.");
        window.showScreen('home-screen');
    } else {
         console.log(`DEBUG_MERGE: updateUIAfterLogin: Not redirecting from login-screen. Current activePage='${activePage}'. This might be normal if login happened on initial load.`);
    }
    console.log("DEBUG_MERGE: updateUIAfterLogin finished.");
};

window.updateUIAfterLogout = function() {
    console.log("DEBUG_MERGE: updateUIAfterLogout called.");

    const userNameDisplay = document.getElementById('user-name-display-header');
    if (userNameDisplay) {
        userNameDisplay.textContent = 'Guest';
    }
    const userProfileIcon = document.getElementById('user-profile-icon');
    if(userProfileIcon) {
        userProfileIcon.innerHTML = '🧑‍🎓'; // Default guest icon
    }

    const cCoinBalanceDisplay = document.getElementById('c-coin-balance');
    if (cCoinBalanceDisplay) {
        cCoinBalanceDisplay.textContent = 'C-Coins: 0';
    }

    // Assuming these buttons should be disabled after logout
    // document.querySelectorAll('.btn-buy-premium').forEach(btn => {
    //      btn.disabled = true;
    //      btn.textContent = 'Login to Buy';
    // });
    console.log("DEBUG_MERGE: updateUIAfterLogout finished.");
};


// --- SINGLE Firebase Auth State Listener ---
// This listener is the central point for handling user login/logout across the app.
onAuthStateChanged(auth, (user) => {
    console.log("DEBUG_MERGE: onAuthStateChanged Fired.");
    if (!authStateLoaded) {
        authStateLoaded = true;
        console.log("DEBUG_MERGE: authStateLoaded is now TRUE.");
    }

    if (user) {
        currentFirebaseUser = user;
        console.log("DEBUG_MERGE: User IS LOGGED IN. UID:", user.uid); // Keep user.uid log
        if (typeof window.updateUIAfterLogin === 'function') {
            window.updateUIAfterLogin(user);
        } else {
            console.error("DEBUG_MERGE: updateUIAfterLogin function not defined yet.");
        }
    } else {
        currentFirebaseUser = null;
        console.log("DEBUG_MERGE: User IS LOGGED OUT.");
        if (typeof window.updateUIAfterLogout === 'function') {
            window.updateUIAfterLogout();
        } else {
            console.error("DEBUG_MERGE: updateUIAfterLogout function not defined yet.");
        }

        // Handle redirection if user is on a protected screen AND THEN logs out
        // (e.g., from another tab/context)
        const protectedScreens = ['premium-package-screen', 'study-planner-screen', 'flashcard-screen', 'sticky-note-screen', 'self-progress-screen' /* Add other protected screen IDs like AI screen if needed */];
        if (typeof window.showScreen === 'function' && typeof activePage === 'string' && protectedScreens.includes(activePage)) {
            console.log(`DEBUG_MERGE: onAuthStateChanged: User logged out while on protected screen ('${activePage}'). Redirecting to login-screen.`);
             // Set to Sign Up / Information Collection mode by default if kicked out
            isLoginMode = false;
            window.toggleAuthMode(isLoginMode);
            window.showScreen('login-screen');
        } else {
            console.log(`DEBUG_MERGE: onAuthStateChanged: No redirection needed from current activePage='${activePage}' after logout.`);
        }
    }
});
console.log("DEBUG_MERGE: onAuthStateChanged listener attached.");


// --- PREMIUM PACKAGES DATA (NO CHANGE, KEPT AS IS) ---
const premiumPackagesData = [
    { name: "Starter Pack", coins: "15,000", priceVal: 25, priceDisplay: "₹25" },
    { name: "Bronze Pack", coins: "35,000", priceVal: 49, priceDisplay: "₹49" },
    { name: "Silver Pack", coins: "80,000", priceVal: 99, priceDisplay: "₹99" },
    { name: "Gold Pack", coins: "2,00,000", priceVal: 199, priceDisplay: "₹199" },
    { name: "Platinum Pack", coins: "3,50,000", priceVal: 299, priceDisplay: "₹299" },
    { name: "Diamond Pack", coins: "6,50,000", priceVal: 499, priceDisplay: "₹499" },
    { name: "Master Pack", coins: "11,00,000", priceVal: 799, priceDisplay: "₹799" },
    { name: "Grandmaster", coins: "18,00,000", priceVal: 1199, priceDisplay: "₹1,199" },
    { name: "Challenger", coins: "25,00,000", priceVal: 1499, priceDisplay: "₹1,499" },
    { name: "Legendary", coins: "45,00,000", priceVal: 1999, priceDisplay: "₹1,999" }
];


// --- DOM READY: MAIN APP SCRIPT AND INTEGRATED FEATURES ---
document.addEventListener("DOMContentLoaded", function() {
    console.log("DEBUG_MERGE: DOMContentLoaded Fired.");

    // Initialize global 'activePage' via initApp later if not already set by splash
    let splashTimer;
    let eventCountdownInterval;

    // --- THEME LOGIC (FROM New File.js) ---
    const themes = {
        basic: [
            { name: 'default', p: '#00B49B', s: '#00FFC3', o: '#FF6B6B' },
            { name: 'purple', p: '#4A00E0', s: '#8E2DE2', o: '#ffc400' },
            { name: 'red', p: '#d32f2f', s: '#ff6659', o: '#00b894' },
            { name: 'blue', p: '#1976d2', s: '#63a4ff', o: '#f57c00' },
            { name: 'teal', p: '#00796b', s: '#48a999', o: '#e91e63' },
            { name: 'brown', p: '#5d4037', s: '#8b6b61', o: '#29b6f6' },
            { name: 'green', p: '#4CAF50', s: '#81C784', o: '#FFEB3B' },
            { name: 'indigo', p: '#3F51B5', s: '#7986CB', o: '#FF9800' },
            { name: 'orange-basic', p: '#FF9800', s: '#FFB74D', o: '#3F51B5' },
            { name: 'grey', p: '#607D8B', s: '#90A4AE', o: '#FF5722' }
        ],
        neon: [
            { name: 'cyan-neon', p: '#00BCD4', s: '#00E5FF', o: '#E91E63' },
            { name: 'pink-neon', p: '#E91E63', s: '#F06292', o: '#00BCD4' },
            { name: 'lime-neon', p: '#AFB42B', s: '#DCE775', o: '#9C27B0' },
            { name: 'orange-neon', p: '#F57C00', s: '#FFB74D', o: '#1976d2' },
            { name: 'purple-neon', p: '#9C27B0', s: '#CE93D8', o: '#AFB42B' },
            { name: 'yellow-neon', p: '#FBC02D', s: '#FFF176', o: '#4A00E0' },
            { name: 'green-neon', p: '#76FF03', s: '#B2FF59', o: '#D500F9' },
            { name: 'blue-neon', p: '#2979FF', s: '#82B1FF', o: '#FFC400' },
            { name: 'red-neon', p: '#FF1744', s: '#FF8A80', o: '#00E676' },
            { name: 'white-glow', p: '#E0E0E0', s: '#FFFFFF', o: '#673AB7', textOverride: '#333' }
        ]
    };

    window.setTheme = function(themeName) {
        let themeData = themes.basic.find(t => t.name === themeName) || themes.neon.find(t => t.name === themeName);
        if (themeData) {
            const root = document.documentElement;
            root.style.setProperty('--primary', themeData.p);
            root.style.setProperty('--secondary', themeData.s);
            root.style.setProperty('--primary-opposite', themeData.o);
            if (themeData.textOverride) {
                root.style.setProperty('--text-on-primary', themeData.textOverride);
            } else {
                root.style.removeProperty('--text-on-primary');
            }
            localStorage.setItem('conceptra-theme', themeName);
            updateActiveSwatch(themeName);
        }
    }

    window.toggleDarkMode = function() {
        const isChecked = document.getElementById('dark-mode-checkbox').checked;
        document.body.classList.toggle('dark-mode', isChecked);
        localStorage.setItem('conceptra-dark-mode', isChecked ? 'enabled' : 'disabled');
    }
    function populateThemeSwatches() { const b = document.getElementById('basic-colors'); const n = document.getElementById('neon-colors'); if(!b || !n) return; b.innerHTML = ''; n.innerHTML = ''; themes.basic.forEach(t => { b.innerHTML += `<div class="theme-swatch" data-theme-name="${t.name}" style="background-color:${t.p}" onclick="setTheme('${t.name}')"></div>`; }); themes.neon.forEach(t => { n.innerHTML += `<div class="theme-swatch" data-theme-name="${t.name}" style="background-color:${t.p}" onclick="setTheme('${t.name}')"></div>`; }); }
    function updateActiveSwatch(themeName) { document.querySelectorAll('.theme-swatch').forEach(sw => { sw.classList.toggle('active', sw.dataset.themeName === themeName); }); }
    function loadTheme() { const savedTheme = localStorage.getItem('conceptra-theme') || 'default'; const darkMode = localStorage.getItem('conceptra-dark-mode'); setTheme(savedTheme); if (darkMode === 'enabled') { const checkbox = document.getElementById('dark-mode-checkbox'); if(checkbox) checkbox.checked = true; document.body.classList.add('dark-mode'); } }
    window.setDefaultTheme = function() { setTheme('default'); updateActiveSwatch('default'); }
    // --- END THEME LOGIC ---


    // --- NAVIGATION LOGIC (FROM New File.js - Kept as the main app navigation) ---
    window.showScreen = function(pageId, isBack = false) {
        console.log(`DEBUG_MERGE: showScreen called for pageId: ${pageId}, isBack: ${isBack}`);
        const newPageEl = document.getElementById(pageId);
        if (!newPageEl) { console.error("DEBUG_MERGE: Page not found:", pageId); return; }
        // 'activePage' here refers to the global variable
        if (activePage === pageId && newPageEl.classList.contains('active')) return;

        const currentlyActive = document.querySelector('.page.active');
        if (currentlyActive) {
            currentlyActive.classList.remove('active');
             // Apply transition class based on direction
            if (isBack) {
                currentlyActive.classList.add('animate-out-back');
            } else {
                currentlyActive.classList.add('animate-out');
            }
        }

        // Reset transform and opacity for the new page initially if it might have old styles
        newPageEl.style.transform = isBack ? 'translateX(-100%)' : 'translateX(100%)';
        newPageEl.style.opacity = 0;

        // Use a small timeout to allow the browser to register the initial state before transitioning
        setTimeout(() => {
            newPageEl.classList.add('active');
            // Trigger reflow to ensure the transform is applied before the transition
            void newPageEl.offsetWidth;

            // Apply transition class based on direction
             if (isBack) {
                newPageEl.classList.add('animate-in-back');
             } else {
                newPageEl.classList.add('animate-in');
             }

             // Set end state for transition
            newPageEl.style.transform = 'translateX(0)';
            newPageEl.style.opacity = 1;

            // Remove transition classes after animation ends
            const onTransitionEnd = () => {
                 newPageEl.classList.remove('animate-in', 'animate-in-back');
                 if (oldPage) oldPage.classList.remove('animate-out', 'animate-out-back'); // Clean up old page class too
                 newPageEl.removeEventListener('transitionend', onTransitionEnd);
                 if (oldPage) oldPage.removeEventListener('transitionend', onTransitionEnd);
            };
            newPageEl.addEventListener('transitionend', onTransitionEnd);
             if (oldPage) oldPage.addEventListener('transitionend', onTransitionEnd); // Listen on both

            activePage = pageId; // Update the global activePage
            console.log(`DEBUG_MERGE: showScreen: Active page is now '${activePage}'`);

             // Close any open overlays/menus
            if (document.getElementById('side-menu') && document.getElementById('side-menu').classList.contains('open')) toggleMenu(false);
            if (document.getElementById('settings-panel') && document.getElementById('settings-panel').classList.contains('open')) closeSettingsModal();
            if (document.getElementById('user-profile-menu-overlay') && document.getElementById('user-profile-menu-overlay').classList.contains('active')) closeUserProfileMenu();

             // Specific actions for certain screens
            if (activePage === 'comments-screen') {
                const commentsContainer = document.getElementById('comments-list-container');
                if(commentsContainer) commentsContainer.scrollTop = commentsContainer.scrollHeight;
            }

        }, 50); // Small delay


        // Login screen specific logic is now handled by onAuthStateChanged after successful login

    }

    // Navigation Helpers (FROM New File.js)
    window.toggleMenu = function(forceState) {
        const sideMenu = document.getElementById('side-menu');
        const menuOverlay = document.getElementById('menu-overlay');
        if (!sideMenu || !menuOverlay) return;
        const isOpen = sideMenu.classList.contains('open');

        if (typeof forceState === 'boolean') {
            if (forceState && !isOpen) {
                sideMenu.classList.add('open');
                menuOverlay.classList.add('show');
            } else if (!forceState && isOpen) {
                sideMenu.classList.remove('open');
                menuOverlay.classList.remove('show');
            }
        } else {
            sideMenu.classList.toggle('open');
            menuOverlay.classList.toggle('show');
        }
    }

    window.openSettingsModal = function() {
        toggleMenu(false);
        closeUserProfileMenu();
        const settingsPanel = document.getElementById('settings-panel');
        const settingsOverlay = document.getElementById('settings-overlay');
         if (settingsPanel && settingsOverlay) {
             settingsPanel.classList.add('open');
             settingsOverlay.classList.add('show');
         }
    }
    window.closeSettingsModal = function() {
         const settingsPanel = document.getElementById('settings-panel');
         const settingsOverlay = document.getElementById('settings-overlay');
         if (settingsPanel && settingsOverlay) {
            settingsPanel.classList.remove('open');
            settingsOverlay.classList.remove('show');
         }
    }

    window.toggleUserProfileMenu = function() {
        const menuOverlay = document.getElementById('user-profile-menu-overlay');
        if (!menuOverlay) return;
        if (menuOverlay.classList.contains('active')) {
            closeUserProfileMenu();
        } else {
            openUserProfileMenu();
        }
    }

    window.openUserProfileMenu = function() {
        const menuOverlay = document.getElementById('user-profile-menu-overlay');
        if (!menuOverlay) return;
        toggleMenu(false);
        if (document.getElementById('settings-panel') && document.getElementById('settings-panel').classList.contains('open')) closeSettingsModal();
        menuOverlay.classList.add('active');
    }

    window.closeUserProfileMenu = function() {
        const menuOverlay = document.getElementById('user-profile-menu-overlay');
        if (!menuOverlay) return;
        menuOverlay.classList.remove('active');
    }
    // --- END NAVIGATION LOGIC ---


    // --- AI UI RENDERING HELPERS (FROM static/script_v2.js) ---
    // This function formats markdown, math, and code
    async function renderEnhancedAIContent(element, content) {
        if (!element) return;
        console.log("DEBUG_MERGE: renderEnhancedAIContent called.");

        // MathJax and Chem tags are handled via replace
        let processedContent = content.replace(/[chem](.*?)[/chem]/g, '<span class="chem-reaction">$1</span>');

        const htmlContent = marked.parse(processedContent); // Assumes marked.js is loaded
        element.innerHTML = htmlContent;

        const highlightColors = ['highlight-yellow', 'highlight-skyblue', 'highlight-pink'];

        // Highlight strong tags with random colors
        element.querySelectorAll('strong').forEach((strongEl) => {
            const randomColorClass = highlightColors[Math.floor(Math.random() * highlightColors.length)];
            strongEl.classList.add(randomColorClass);
        });

        // Highlight code blocks
        element.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') { // Assumes highlight.js is loaded
                hljs.highlightElement(block);
            } else {
                console.warn("DEBUG_MERGE: highlight.js not loaded. Code blocks won't be highlighted.");
            }
        });

        // Render MathJax
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            try {
                await window.MathJax.typesetPromise([element]);
                 console.log("DEBUG_MERGE: MathJax typesetting complete.");
            } catch (err) {
                console.error('DEBUG_MERGE: MathJax rendering failed:', err);
            }
        } else {
             console.warn("DEBUG_MERGE: MathJax not loaded or typesetPromise not available.");
        }
    }

    // Typewriter effect function (kept but unused in new handlers)
    async function typewriterEffect(element, text, onComplete) {
        console.log("DEBUG_MERGE: typewriterEffect called (function kept, but not used in new AI handlers).");
        let i = 0;
        element.innerHTML = "";
        const speed = 15; // milliseconds per character

        function type() {
            if (i < text.length) {
                // Simple check for HTML tags to avoid typing them out character by character
                if (text.charAt(i) === '<') {
                    const closingTagIndex = text.indexOf('>', i);
                    if (closingTagIndex !== -1) {
                        element.innerHTML += text.substring(i, closingTagIndex + 1);
                        i = closingTagIndex;
                    }
                } else {
                    element.innerHTML += text.charAt(i);
                }
                i++;
                 // Keep scrolling down if content overflows
                 if (element.scrollHeight > element.clientHeight) {
                     element.scrollTop = element.scrollHeight;
                 }
                setTimeout(type, speed);
            } else if (onComplete) {
                onComplete();
            }
        }
        type();
    }

    // Pagination logic (FROM static/script_v2.js)
    let paginationData = {}; // Keep this scope local to DOMContentLoaded or higher if needed elsewhere
    async function renderPaginatedContent(contentAreaId, controlsId, content) {
        console.log("DEBUG_MERGE: renderPaginatedContent called.");
        const contentArea = document.getElementById(contentAreaId);
        const controlsArea = document.getElementById(controlsId);
        if (!contentArea || !controlsArea) {
            console.error("DEBUG_MERGE: Pagination elements not found.");
            return;
        }

        const pages = content.split(/\n---\n/).map(p => p.trim()).filter(p => p.length > 0);
        paginationData[contentAreaId] = { pages: pages, currentPage: 0 };

        contentArea.innerHTML = '';
        const pageDivs = pages.map((pageContent, index) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'content-page';
            if (index === 0) pageDiv.classList.add('active');
            contentArea.appendChild(pageDiv);
            return pageDiv;
        });

        for (let i = 0; i < pageDivs.length; i++) {
            // Use the enhanced renderer for each page content
            await renderEnhancedAIContent(pageDivs[i], pages[i]);
        }

        // Updated template literal syntax (already done in v2 provided)
        controlsArea.innerHTML = `<button class="pagination-btn" id="${contentAreaId}-back" onclick="window.changePage('${contentAreaId}', -1)">Back</button> <span class="page-indicator" id="${contentAreaId}-indicator"></span> <button class="pagination-btn" id="${contentAreaId}-next" onclick="window.changePage('${contentAreaId}', 1)">Next</button>`;
        updatePaginationControls(contentAreaId);

    }
    // Make changePage accessible globally as it's used in HTML onclick
    window.changePage = function(contentAreaId, direction) {
        console.log(`DEBUG_MERGE: changePage called for ${contentAreaId}, direction ${direction}.`);
        const data = paginationData[contentAreaId];
        if (!data) return;
        const newPage = data.currentPage + direction;
        if (newPage >= 0 && newPage < data.pages.length) {
            data.currentPage = newPage;
            const contentArea = document.getElementById(contentAreaId);
            if(contentArea) {
                contentArea.querySelectorAll('.content-page').forEach((page, index) => {
                    page.classList.toggle('active', index === newPage);
                });
            }
            updatePaginationControls(contentAreaId);
             // Scroll to top of the content area when page changes
             if(contentArea) contentArea.scrollTop = 0;
        }
    }
    function updatePaginationControls(contentAreaId) {
        console.log(`DEBUG_MERGE: updatePaginationControls called for ${contentAreaId}.`);
        const data = paginationData[contentAreaId];
        if (!data) return;
        // Updated template literal syntax (already done in v2 provided)
        const indicatorEl = document.getElementById(`${contentAreaId}-indicator`);
        const backBtn = document.getElementById(`${contentAreaId}-back`);
        const nextBtn = document.getElementById(`${contentAreaId}-next`);

        if (indicatorEl) indicatorEl.textContent = `Page ${data.currentPage + 1} of ${data.pages.length}`;
        if (backBtn) backBtn.disabled = (data.currentPage === 0);
        if (nextBtn) nextBtn.disabled = (data.currentPage === data.pages.length - 1);
    }
     // Flashcard display (FROM static/script_v2.js)
    async function displayFlashcards(cards) {
         console.log("DEBUG_MERGE: displayFlashcards called.");
         const container = document.getElementById('flashcard-response-container');
         if (!container) return;
         container.innerHTML = '';
         const grid = document.createElement('div');
         grid.className = 'flashcard-grid';

         if (!cards || cards.length === 0) {
              container.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No flashcards generated.</p>';
              return;
         }

         for (const cardData of cards) {
             const cardEl = document.createElement('div');
             cardEl.className = 'flashcard';
             const frontDiv = document.createElement('div');
             frontDiv.className = 'card-front';
             const backDiv = document.createElement('div');
             backDiv.className = 'card-back';

             // Use the enhanced renderer for card content
             await renderEnhancedAIContent(frontDiv, cardData.front);
             await renderEnhancedAIContent(backDiv, cardData.back);

             // Updated template literal syntax (already done in v2 provided)
             cardEl.innerHTML = `<div class="flashcard-inner">${frontDiv.outerHTML}${backDiv.outerHTML}</div>`;
             cardEl.addEventListener('click', () => cardEl.classList.toggle('flipped'));
             grid.appendChild(cardEl);
         }
         container.appendChild(grid);
    }

    // Quiz Question display (FROM static/script_v2.js)
    window.currentQuizQuestions = []; // Make global or accessible
    window.correctAnswers = []; // Make global or accessible

     async function displayQuestions(questions) {
         console.log("DEBUG_MERGE: displayQuestions called.");
         const quizContainer = document.getElementById('quiz-container');
         if (!quizContainer) return;
         quizContainer.innerHTML = '';
         window.currentQuizQuestions = questions; // Store for analysis later
         window.correctAnswers = questions.map(q => q.correct_answer);

         if (!questions || questions.length === 0) {
             quizContainer.innerHTML = '<p style="text-align:center; color: var(--color-red);">Could not generate quiz questions.</p>';
             return;
         }


         for (const [index, q] of questions.entries()) {
             const questionElement = document.createElement('div');
             questionElement.className = 'mcq-question-block';

             // Shuffle options (already done in v2 provided)
             const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);

             // Updated template literal syntax (already done in v2 provided)
             // Create basic structure first
             questionElement.innerHTML = `
                 <div class="mcq-question-text"></div>
                 <div class="options-container" id="options-${index}"></div>
             `;
             quizContainer.appendChild(questionElement);

             // Render question text using the enhanced renderer
             const questionTextDiv = questionElement.querySelector('.mcq-question-text');
             if(questionTextDiv) await renderEnhancedAIContent(questionTextDiv, `<strong>Q${index + 1}:</strong> ${q.question}`);

             // Render options using the enhanced renderer
             const optionsContainer = questionElement.querySelector(`#options-${index}`);
             if(optionsContainer) {
                 let optionsHTML = '';
                  for(let i = 0; i < shuffledOptions.length; i++) {
                      optionsHTML += `<label class="mcq-option"><input type="radio" name="question-${index}" value="${shuffledOptions[i]}"> <span></span></label>`;
                  }
                  optionsContainer.innerHTML = optionsHTML;

                 const optionLabels = optionsContainer.querySelectorAll('.mcq-option span');
                 for(let i = 0; i < optionLabels.length; i++) {
                     await renderEnhancedAIContent(optionLabels[i], shuffledOptions[i]);
                 }
             }
         }

     }

     // Quiz Analysis Helper (FROM static/script_v2.js)
     async function getQuizAnalysis(answers) {
         console.log("DEBUG_MERGE: getQuizAnalysis called.");
         const analysisDiv = document.getElementById('quiz-analysis-report');
         if (!analysisDiv) return;
         analysisDiv.style.display = 'block';
         analysisDiv.innerHTML = '<div class="loading-animation">Analyzing your performance...</div>';

         try {
             // Use the unified callAIEndpoint function for the analysis request
             const data = await callAIEndpoint('/analyze-quiz-results', { answers }, '#quiz-analysis-report');

             if (data && !data.error && data.analysis) {
                 // Use the enhanced renderer for the analysis report
                 await renderEnhancedAIContent(analysisDiv, data.analysis);
             } else {
                 // Error message will be handled by callAIEndpoint's catch block
                 // Or specifically handled here if data is null/error but callAIEndpoint didn't throw
                 if (data && data.error) {
                     analysisDiv.innerHTML = `<p style="color: var(--color-red);">Could not get analysis: ${data.error}</p>`;
                 } else {
                     analysisDiv.innerHTML = `<p style="color: var(--color-red);">Could not get analysis: Unexpected response format.</p>`;
                 }
             }
         } catch (error) {
             // This catch is secondary, callAIEndpoint's catch handles display
             console.error("DEBUG_MERGE: Error fetching quiz analysis:", error);
             // Ensure a message is displayed even if callAIEndpoint failed silently somehow
             if (analysisDiv.innerHTML === '<div class="loading-animation">Analyzing your performance...</div>') {
                 analysisDiv.innerHTML = `<p style="color: var(--color-red);">Could not get analysis: An error occurred during the request.</p>`;
             }
         }
     }
    // --- END AI UI RENDERING HELPERS ---


    // --- GENERIC AUTHENTICATED API REQUEST HELPER (FROM static/script_v2.js, RENAMED and MODIFIED slightly) ---
    // This is the function that will handle getting the user token and making the fetch request
    async function callAIEndpoint(endpoint, body, outputContainerSelector) {
        const outputContainer = document.querySelector(outputContainerSelector);

        console.log(`DEBUG_FE_AI_001: callAIEndpoint called for endpoint: ${endpoint}`); // <-- ADD DEBUG

        // 1. Check for user (Use the global auth object managed by onAuthStateChanged)
        const user = auth.currentUser; // Access the globally managed auth instance
        if (!user) {
            console.error("DEBUG_FE_AI_002: User not logged in (auth.currentUser is null)."); // <-- ADD DEBUG
            const errorMessage = "Authentication failed. Please login to use AI features.";
            if (outputContainer) {
                outputContainer.innerHTML = `<p style="color:red;">${errorMessage}</p>`;
            } else {
                alert(errorMessage);
            }
            // Redirect to login screen if user is not logged in
            console.log("DEBUG_FE_AI_003: Redirecting to login screen."); // <-- ADD DEBUG
             // Ensure the toggleAuthMode function exists and is accessible
            if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                 isLoginMode = true; // Default to login mode for AI features access prompt
                 window.toggleAuthMode(isLoginMode); // Update the auth form UI
                 window.showScreen('login-screen'); // Redirect
            } else {
                console.error("DEBUG_FE_AI_003a: showScreen or toggleAuthMode not available for redirection.");
            }
            return { error: "User not logged in." }; // Return error object as defined in v2 helper
        }

        let token = null; // Initialize token as null
        console.log("DEBUG_FE_AI_004: User is logged in. Attempting to get ID token."); // <-- ADD DEBUG
        try {
            // Attempt to get ID token, forcing a refresh.
            // This promise might reject on network errors or specific auth issues.
            // Use getIdToken from the imported auth object
            token = await getIdToken(user, true);
            console.log(`DEBUG_FE_AI_005: getIdToken call finished. Result type: ${typeof token}, value: ${token ? token.substring(0, 10) + '...' : token}`); // <-- ADD DEBUG

        } catch (tokenError) {
            // Handle errors specifically related to fetching the token
            console.error("DEBUG_FE_AI_006: Error getting ID token:", tokenError); // <-- ADD DEBUG
            const errorMessage = "Could not get authentication token. Please try logging in again.";
            if (outputContainer) {
                outputContainer.innerHTML = `<p style="color:red;">${errorMessage}</p>`;
            } else {
                alert(errorMessage);
            }
             // Redirect to login screen on token fetch failure
            console.log("DEBUG_FE_AI_007: Redirecting to login screen after token error."); // <-- ADD DEBUG
            if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                 isLoginMode = true; // Default to login mode for AI features access prompt
                 window.toggleAuthMode(isLoginMode);
                 window.showScreen('login-screen');
            } else {
                 console.error("DEBUG_FE_AI_007a: showScreen or toggleAuthMode not available for redirection.");
            }
            return { error: "Failed to get token due to error." }; // Return error object as defined in v2 helper
        }

        // --- REFINED CHECK FOR TOKEN BEFORE FETCH ---
        // Check if token is null, undefined, an empty string, or not a string.
        // If the code reaches here, getIdToken didn't throw, but the result might still be bad.
        if (!token || typeof token !== 'string' || token.length === 0) {
            console.error(`DEBUG_FE_AI_008: Token obtained from getIdToken is invalid (null, undefined, empty, or not string). Value: ${token}.`); // <-- ADD DEBUG
            const errorMessage = "Authentication token could not be retrieved. Please ensure you are logged in properly.";
             if (outputContainer) {
                 outputContainer.innerHTML = `<p style="color:red;">${errorMessage}</p>`;
             } else {
                 alert(errorMessage);
             }
            // Redirect to login screen if token is explicitly invalid after attempt
            console.log("DEBUG_FE_AI_009: Redirecting to login screen due to invalid token value."); // <-- ADD DEBUG
             if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                 isLoginMode = true; // Default to login mode
                 window.toggleAuthMode(isLoginMode);
                 window.showScreen('login-screen');
             } else {
                 console.error("DEBUG_FE_AI_009a: showScreen or toggleAuthMode not available for redirection.");
             }
             return { error: "Failed to retrieve authentication token." }; // Return error object
        }
         // --- END REFINED CHECK ---

        // If we reached here, user exists, getIdToken didn't throw, and token is a non-empty string.
        console.log("DEBUG_FE_AI_010: Token is valid. Proceeding to show loading state and send fetch request."); // <-- ADD DEBUG

        // 2. Show loading state (Move this AFTER successful token acquisition)
         if (outputContainer) {
             // Ensure this matches the loading state HTML used in v2
             outputContainer.innerHTML = `<div class="loading-animation">Generating... Please wait.</div>`; // Use the standard loading class from v2
             // You can add the spinner specific styles in CSS if needed, but matching v2's class is safer
         }

        // 3. Make the authenticated fetch call
        try {
             // Use the correct backend URL (Render URL)
             const backendUrl = 'https://soul-spark.onrender.com';
             const fetchUrl = `${backendUrl}${endpoint}`;
             console.log(`DEBUG_FE_AI_011: Attempting fetch to: ${fetchUrl}`); // <-- ADD DEBUG
             console.log(`DEBUG_FE_AI_012: Request headers being sent (Authorization header prefix shown): Authorization: Bearer ${token.substring(0, 10)}...`); // <-- ADD DEBUG (Log token prefix)

            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Ensure the token variable is used here
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            console.log(`DEBUG_FE_AI_013: Fetch response received. Status: ${response.status}.`); // <-- ADD DEBUG

            // Check for HTTP errors (status codes outside 200-299)
            if (!response.ok) {
                 // Attempt to parse JSON error body, fallback to status text
                 const errorData = await response.json().catch(() => ({ error: response.statusText || `HTTP error ${response.status}` }));
                 const errorMessageFromServer = errorData.error || `Server error: ${response.statusText || response.status}`;
                 console.error(`DEBUG_FE_AI_014: AI endpoint ${endpoint} responded with error status ${response.status}:`, errorData); // <-- ADD DEBUG
                 // Throw an error to be caught by the outer catch block for unified display
                 throw new Error(errorMessageFromServer);
            }

            // If response is OK, parse and return the data
            const data = await response.json();
            console.log(`DEBUG_FE_AI_015: AI endpoint ${endpoint} responded successfully:`, data); // <-- ADD DEBUG
            return data;

        } catch (error) {
            // Handle network errors or errors thrown from response.ok check above
            console.error(`DEBUG_FE_AI_016: Error during fetch or server error processing (Fetch/Server Error):`, error); // <-- ADD DEBUG
            // This is where the error from your screenshot is often displayed for backend errors
            const displayMessage = `माफ कीजिये, कुछ गड़बड़ हो गयी: ${error.message || 'Unknown error'}`;
            if (outputContainer) {
                 // Ensure the style matches the v2 error message style
                 outputContainer.innerHTML = `<p style="color: var(--color-red);">Sorry, an error occurred: ${error.message}</p>`; // Use v2 style
            } else {
                alert(displayMessage);
            }
            return { error: error.message }; // Return error object
        } finally {
             // Optional: Hide loading state in finally block if not replaced by content
             // This is handled within the individual feature handlers' logic after calling this function
             console.log(`DEBUG_FE_AI_017: callAIEndpoint for ${endpoint} finished.`); // <-- ADD DEBUG
        }
    }
    // --- END GENERIC AUTHENTICATED API REQUEST HELPER ---


    // --- AI FEATURE HANDLERS (FROM static/script_v2.js) ---
    // These functions are called by button clicks and use the callAIEndpoint helper
    // We need to make these globally accessible if they are called directly from HTML onclick attributes
    // We will also integrate their event listeners into the main DOMContentLoaded block below

    /**
     * Generic handler for simple AI API requests.
     * Handles button states, loading, calling callAIEndpoint, and rendering result.
     * (Combined logic from multiple handlers in v2 script)
     * @param {HTMLElement} button - The button element that triggered the request.
     * @param {string} responseContainerId - The ID of the container element where results will be displayed.
     * @param {string} endpoint - The backend API endpoint URL (e.g., '/generate-notes-ai').
     * @param {function} getBody - A function that returns the request body object, or null/undefined if input is invalid.
     */
    async function handleSimpleAIRequest(button, responseContainerId, endpoint, getBody) {
        const container = document.getElementById(responseContainerId);
        const responseDiv = container; // Assuming the container itself is where content goes, or adjust selector if needed

        const body = getBody();
        if (!body) {
             console.log("DEBUG_MERGE: Simple AI Request aborted due to invalid body.");
             return; // Input validation failed within getBody
        }
        if (!button || !container) {
             console.error("DEBUG_MERGE: Missing button or container for simple AI request.");
             return;
        }

        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Generating...';
        container.style.display = 'block'; // Ensure container is visible

        // Loading state is set by callAIEndpoint, so no need to set here
        // responseDiv.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>'; // Removed, handled by callAIEndpoint

        try {
            // callAIEndpoint handles authentication, fetch, and basic error display
            const data = await callAIEndpoint(endpoint, body, `#${responseContainerId}`);

            if (data && !data.error) {
                 // Assuming data structure matches v2's expectations (e.g., data.notes, data.explanation, etc.)
                 // Find the key in the response data that holds the main content
                 const key = Object.keys(data).find(k => k !== 'error');
                 const fullText = key ? data[key] : "No content received.";

                 if (fullText) {
                      // Use the enhanced renderer for the result
                      await renderEnhancedAIContent(responseDiv, fullText);
                 } else {
                      responseDiv.innerHTML = `<p style="color: var(--text-muted-color);">No detailed content received from AI.</p>`;
                 }
            }
            // Note: If data.error exists, callAIEndpoint has already updated responseDiv.innerHTML

        } catch (error) {
            // This catch block handles errors specifically thrown *after* callAIEndpoint returns (unlikely if callAIEndpoint handles errors well)
            // or if there was an issue processing the result *from* callAIEndpoint.
            console.error('DEBUG_MERGE: handleSimpleAIRequest CATCH block.', error);
            // Ensure an error message is displayed if not already done by callAIEndpoint
            if (!responseDiv.innerHTML.includes('color: var(--color-red)')) { // Avoid overwriting if callAIEndpoint already showed error
                 responseDiv.innerHTML = `<p style="color: var(--color-red);">An unexpected client-side error occurred: ${error.message}</p>`;
            }
        } finally {
            button.disabled = false;
            button.textContent = originalText;
            console.log("DEBUG_MERGE: handleSimpleAIRequest finally block executed.");
        }
    }

    // 1. Ask Doubt Handler (Specific logic for FormData)
    window.handleAskDoubt = async function() {
         console.log("DEBUG_MERGE: handleAskDoubt called.");
         const button = document.getElementById('ask-doubt-submit');
         const questionInput = document.getElementById('doubt-input');
         const imageInput = document.getElementById('doubt-image-input');
         const responseContainer = document.getElementById('ai-response-container');
         const responseDiv = document.getElementById('ai-response'); // Target element for output

         if (!button || !questionInput || !imageInput || !responseContainer || !responseDiv) {
             console.error("DEBUG_MERGE: Missing DOM elements for Ask Doubt.");
             alert("Error initializing Ask Doubt feature.");
             return;
         }

         const questionText = questionInput.value.trim();
         const imageFile = imageInput.files[0];

         if (questionText === '' && !imageFile) {
             alert('Please write your doubt or upload an image.');
             return;
         }

         // Check for user early (redundant with callAIEndpoint but good UX)
         const user = auth.currentUser;
         if (!user) {
             alert("Please log in to use AI features.");
             if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                  isLoginMode = true;
                  window.toggleAuthMode(isLoginMode);
                  window.showScreen('login-screen');
             }
             return;
         }

         button.disabled = true;
         const originalButtonText = button.textContent; // Save original text
         button.textContent = 'Analyzing...';
         responseContainer.style.display = 'block'; // Ensure container is visible
         // Loading state set by callAIEndpoint or directly below if no token

         const formData = new FormData();
         formData.append('question', questionText);
         if (imageFile) {
             formData.append('image', imageFile);
         }

         // Manually handle token fetch for FormData requests as callAIEndpoint is JSON-specific
         let token = null;
         try {
              responseDiv.innerHTML = '<div class="loading-animation">Preparing request...</div>'; // Set initial loading state
              token = await getIdToken(user, true);
              if (!token) {
                   throw new Error("Failed to obtain authentication token.");
              }
             console.log("DEBUG_MERGE: Ask Doubt: Token obtained for FormData request.");

             responseDiv.innerHTML = '<div class="loading-animation">Analyzing... Please wait.</div>'; // Update loading state

             const headers = {
                  // 'Content-Type': 'multipart/form-data' IS NOT needed for FormData; browser sets it automatically
                  'Authorization': `Bearer ${token}`
             };

             const fetchUrl = 'https://soul-spark.onrender.com/ask-ai-image';
             console.log(`DEBUG_MERGE: Ask Doubt: Attempting fetch to: ${fetchUrl}`);
             console.log(`DEBUG_MERGE: Ask Doubt: Headers (Authorization prefix): Bearer ${token.substring(0, 10)}...`);

             const response = await fetch(fetchUrl, {
                 method: 'POST',
                 headers: headers,
                 body: formData
             });

             console.log(`DEBUG_MERGE: Ask Doubt: Fetch response received. Status: ${response.status}.`);
             const data = await response.json();

             if (!response.ok) {
                  const errorMessageFromServer = data.error || `Server error: ${response.statusText || response.status}`;
                  console.error("DEBUG_MERGE: Ask Doubt: Server responded with error status:", response.status, data);
                  throw new Error(errorMessageFromServer);
             }

             if (data.error || !data.answer) {
                  const errorDetail = data.error || 'No answer received from AI.';
                  console.error("DEBUG_MERGE: Ask Doubt: Response data indicates error or missing answer:", data);
                  throw new Error(errorDetail);
             }

             const fullText = data.answer;
             await renderEnhancedAIContent(responseDiv, fullText);
             console.log("DEBUG_MERGE: Ask Doubt: Content rendered successfully.");


         } catch (error) {
             console.error('DEBUG_MERGE: handleAskDoubt CATCH block. Error:', error);
             // Ensure an error message is displayed
             responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`; // Use v2 style
         } finally {
             button.disabled = false;
             button.textContent = originalButtonText; // Restore original text
             questionInput.value = '';
             imageInput.value = '';
             const fileNameDisplay = document.getElementById('file-name-display');
             if(fileNameDisplay) fileNameDisplay.textContent = '';
             console.log("DEBUG_MERGE: handleAskDoubt finally block executed.");
         }
    }

    // 2. Generate Notes Handler
    window.handleGenerateNotes = async function() {
         console.log("DEBUG_MERGE: handleGenerateNotes called.");
         const button = document.getElementById('generate-notes-submit');
         const topicInput = document.getElementById('notes-topic-input');
         const container = document.getElementById('notes-output-container'); // Target element for output

         if (!button || !topicInput || !container) {
             console.error("DEBUG_MERGE: Missing DOM elements for Generate Notes.");
             alert("Error initializing Generate Notes feature.");
             return;
         }

         // Use the generic handler
         await handleSimpleAIRequest(button, 'notes-output-container', '/generate-notes-ai', () => {
             const topic = topicInput.value.trim();
             const noteTypeRadio = document.querySelector('input[name="note-length"]:checked');
             const noteType = noteTypeRadio ? noteTypeRadio.value : 'long';
             if (topic === '') {
                 alert('Please enter a topic.');
                 return null; // Return null to abort request
             }
             return { topic, noteType };
         });
    }

    // 3. Practice MCQs Handler
    window.startQuizHandler = async function() { // Renamed from start-quiz-btn handler to avoid conflict if any
         console.log("DEBUG_MERGE: startQuizHandler called.");
         const button = document.getElementById('start-quiz-btn');
         const topicInput = document.getElementById('mcq-topic-input');
         const countInputChecked = document.querySelector('input[name="mcq-count"]:checked');
         const customCountInput = document.getElementById('mcq-custom-count');
         const setupView = document.getElementById('mcq-setup-view');
         const quizView = document.getElementById('mcq-quiz-view');
         const quizTopicTitle = document.getElementById('quiz-topic-title');
         const quizContainer = document.getElementById('quiz-container'); // Target element for output

         if (!button || !topicInput || !countInputChecked || !customCountInput || !setupView || !quizView || !quizTopicTitle || !quizContainer) {
             console.error("DEBUG_MERGE: Missing DOM elements for Practice MCQs.");
             alert("Error initializing Practice MCQs feature.");
             return;
         }

         const topic = topicInput.value.trim();
         if (topic === '') {
             alert('Please enter a topic for the quiz.');
             return;
         }

         let count = countInputChecked.value;
         if (count === 'custom') {
             count = customCountInput.value;
         }
         // Ensure count is a number and positive
         count = parseInt(count);
         if (isNaN(count) || count <= 0) {
             alert('Please enter a valid number of questions.');
             return;
         }

         // Check for user early (redundant with callAIEndpoint but good UX)
         const user = auth.currentUser;
         if (!user) {
             alert("Please log in to use AI features.");
              if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                   isLoginMode = true;
                   window.toggleAuthMode(isLoginMode);
                   window.showScreen('login-screen');
              }
             return;
         }


         setupView.style.display = 'none';
         quizView.style.display = 'block';
         quizTopicTitle.innerText = `Quiz on: ${topic}`;
         quizContainer.innerHTML = '<div class="loading-animation">Generating Quiz...</div>'; // Set loading state

         button.disabled = true;
         const originalButtonText = button.textContent;
         button.textContent = 'Generating...';


         try {
             // Use the generic handler, but it needs to return the data to call displayQuestions
             // So, we make the call directly here instead of using handleSimpleAIRequest
             const data = await callAIEndpoint('/generate-mcq-ai', { topic, count }, '#quiz-container');

             if (data && !data.error && Array.isArray(data.questions)) {
                 window.currentQuizQuestions = data.questions; // Store for analysis
                 await displayQuestions(data.questions); // Display questions
                 document.getElementById('submit-quiz-btn').style.display = 'block'; // Show submit button
                 document.getElementById('post-quiz-options').style.display = 'none'; // Hide post-quiz options
                 document.getElementById('quiz-result').innerHTML = ''; // Clear previous results
                 document.getElementById('quiz-analysis-report').innerHTML = ''; // Clear previous analysis
                 console.log("DEBUG_MERGE: MCQs generated and displayed successfully.");
             } else {
                  // Error message handled by callAIEndpoint's catch, or handle specific data error
                  const errorMsg = data && data.error ? data.error : 'Could not generate quiz questions.';
                  console.error("DEBUG_MERGE: Error generating MCQs:", errorMsg, data);
                  quizContainer.innerHTML = `<p style="color: var(--color-red);">Error: ${errorMsg}</p>`; // Use v2 style
                  // Revert to setup view on error
                  setupView.style.display = 'block';
                  quizView.style.display = 'none';
             }

         } catch (error) {
             // This catch block handles errors specifically thrown *after* callAIEndpoint returns (unlikely)
             console.error('DEBUG_MERGE: startQuizHandler CATCH block.', error);
             // Ensure an error message is displayed if not already done by callAIEndpoint
              if (!quizContainer.innerHTML.includes('color: var(--color-red)')) {
                  quizContainer.innerHTML = `<p style="color: var(--color-red);">An unexpected client-side error occurred: ${error.message}</p>`;
              }
              // Revert to setup view on error
              setupView.style.display = 'block';
              quizView.style.display = 'none';
         } finally {
             button.disabled = false;
             button.textContent = originalButtonText;
             console.log("DEBUG_MERGE: startQuizHandler finally block executed.");
         }
    }

    // 4. Get Solved Examples Handler
    window.handleGetSolvedExamples = async function() { // Renamed slightly
         console.log("DEBUG_MERGE: handleGetSolvedExamples called.");
         const button = document.getElementById('get-solved-notes-btn');
         const topicInput = document.getElementById('solved-notes-topic-input');
         const container = document.getElementById('solved-notes-response-container'); // Target element for output

         if (!button || !topicInput || !container) {
             console.error("DEBUG_MERGE: Missing DOM elements for Solved Examples.");
             alert("Error initializing Solved Examples feature.");
             return;
         }

         // Use the generic handler
         await handleSimpleAIRequest(button, 'solved-notes-response-container', '/get-solved-notes-ai', () => {
             const topic = topicInput.value.trim();
             if (topic === '') {
                 alert('Please enter a topic.');
                 return null; // Abort request
             }
             let count = document.querySelector('input[name="solved-notes-count"]:checked').value;
             if (count === 'custom') {
                 count = document.getElementById('solved-notes-custom-count').value;
             }
             // Ensure count is a number and positive
             count = parseInt(count);
             if (isNaN(count) || count <= 0) {
                 alert('Please enter a valid number of examples.');
                 return null;
             }
             return { topic, count };
         });
    }

    // 5. Get Career Advice Handler (Uses Pagination)
    window.handleGetCareerAdvice = async function() { // Renamed slightly
         console.log("DEBUG_MERGE: handleGetCareerAdvice called.");
         const button = document.getElementById('get-career-advice-btn');
         const interestsInput = document.getElementById('career-interests-input');
         const container = document.getElementById('career-response-container');
         const contentArea = document.getElementById('career-paginated-content'); // Target element for output
         const controlsArea = document.getElementById('career-pagination-controls');

         if (!button || !interestsInput || !container || !contentArea || !controlsArea) {
             console.error("DEBUG_MERGE: Missing DOM elements for Career Advice.");
             alert("Error initializing Career Advice feature.");
             return;
         }

         const interests = interestsInput.value.trim();
         if (interests === '') {
             alert('Please enter your interests.');
             return;
         }

         // Check for user early (redundant with callAIEndpoint but good UX)
         const user = auth.currentUser;
         if (!user) {
             alert("Please log in to use AI features.");
              if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                   isLoginMode = true;
                   window.toggleAuthMode(isLoginMode);
                   window.showScreen('login-screen');
              }
             return;
         }

         button.disabled = true;
         const originalButtonText = button.textContent;
         button.textContent = 'Generating...';
         container.style.display = 'block';
         contentArea.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>'; // Set loading state
         controlsArea.innerHTML = ''; // Clear old controls

         try {
             // Call callAIEndpoint directly as it's a custom renderer
             const data = await callAIEndpoint('/get-career-advice-ai', { interests }, '#career-paginated-content');

             if (data && !data.error && data.advice) {
                 await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
                 console.log("DEBUG_MERGE: Career Advice generated and rendered successfully.");
             } else {
                 // Error message handled by callAIEndpoint's catch, or handle specific data error
                 const errorMsg = data && data.error ? data.error : 'Could not get career advice.';
                 console.error("DEBUG_MERGE: Error getting career advice:", errorMsg, data);
                 contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${errorMsg}</p>`; // Use v2 style
             }
         } catch (error) {
             // This catch block handles errors specifically thrown *after* callAIEndpoint returns (unlikely)
             console.error('DEBUG_MERGE: handleGetCareerAdvice CATCH block.', error);
             // Ensure an error message is displayed if not already done by callAIEndpoint
              if (!contentArea.innerHTML.includes('color: var(--color-red)')) {
                  contentArea.innerHTML = `<p style="color: var(--color-red);">An unexpected client-side error occurred: ${error.message}</p>`;
              }
         } finally {
             button.disabled = false;
             button.textContent = originalButtonText;
             console.log("DEBUG_MERGE: handleGetCareerAdvice finally block executed.");
         }
    }

    // 6. Generate Study Plan Handler (Uses Pagination)
    window.handleGenerateStudyPlan = async function() { // Renamed slightly
         console.log("DEBUG_MERGE: handleGenerateStudyPlan called.");
         const button = document.getElementById('generate-study-plan-btn');
         const detailsInput = document.getElementById('study-plan-details-input');
         const container = document.getElementById('study-plan-response-container');
         const contentArea = document.getElementById('study-plan-paginated-content'); // Target element for output
         const controlsArea = document.getElementById('study-plan-pagination-controls');

         if (!button || !detailsInput || !container || !contentArea || !controlsArea) {
             console.error("DEBUG_MERGE: Missing DOM elements for Study Plan.");
             alert("Error initializing Study Plan feature.");
             return;
         }

         const details = detailsInput.value.trim();
         if (details === '') {
             alert('Please provide details for the plan.');
             return;
         }

         // Check for user early (redundant with callAIEndpoint but good UX)
         const user = auth.currentUser;
         if (!user) {
             alert("Please log in to use AI features.");
              if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                   isLoginMode = true;
                   window.toggleAuthMode(isLoginMode);
                   window.showScreen('login-screen');
              }
             return;
         }

         button.disabled = true;
         const originalButtonText = button.textContent;
         button.textContent = 'Creating...';
         container.style.display = 'block';
         contentArea.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>'; // Set loading state
         controlsArea.innerHTML = ''; // Clear old controls

         try {
             // Call callAIEndpoint directly as it's a custom renderer
             const data = await callAIEndpoint('/generate-study-plan-ai', { details }, '#study-plan-paginated-content');

             if (data && !data.error && data.plan) {
                 await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
                 console.log("DEBUG_MERGE: Study Plan generated and rendered successfully.");
             } else {
                 // Error message handled by callAIEndpoint's catch, or handle specific data error
                 const errorMsg = data && data.error ? data.error : 'Could not create study plan.';
                 console.error("DEBUG_MERGE: Error creating study plan:", errorMsg, data);
                 contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${errorMsg}</p>`; // Use v2 style
             }
         } catch (error) {
             // This catch block handles errors specifically thrown *after* callAIEndpoint returns (unlikely)
             console.error('DEBUG_MERGE: handleGenerateStudyPlan CATCH block.', error);
             // Ensure an error message is displayed if not already done by callAIEndpoint
              if (!contentArea.innerHTML.includes('color: var(--color-red)')) {
                  contentArea.innerHTML = `<p style="color: var(--color-red);">An unexpected client-side error occurred: ${error.message}</p>`;
              }
         } finally {
             button.disabled = false;
             button.textContent = originalButtonText;
             console.log("DEBUG_MERGE: handleGenerateStudyPlan finally block executed.");
         }
    }

    // 7. Generate Flashcards Handler
    window.handleGenerateFlashcards = async function() { // Renamed slightly
         console.log("DEBUG_MERGE: handleGenerateFlashcards called.");
         const button = document.getElementById('generate-flashcards-btn');
         const topicInput = document.getElementById('flashcard-topic-input');
         const container = document.getElementById('flashcard-response-container'); // Target element for output

         if (!button || !topicInput || !container) {
             console.error("DEBUG_MERGE: Missing DOM elements for Flashcards.");
             alert("Error initializing Flashcards feature.");
             return;
         }

         const topic = topicInput.value.trim();
         if (topic === '') {
             alert('Please enter a topic for flashcards.');
             return;
         }

         let count = document.querySelector('input[name="flashcard-count"]:checked').value;
         if (count === 'custom') {
             count = document.getElementById('flashcard-custom-count').value;
         }
          // Ensure count is a number and positive
         count = parseInt(count);
         if (isNaN(count) || count <= 0) {
             alert('Please enter a valid number of flashcards.');
             return;
         }

         // Check for user early (redundant with callAIEndpoint but good UX)
         const user = auth.currentUser;
         if (!user) {
             alert("Please log in to use AI features.");
              if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                   isLoginMode = true;
                   window.toggleAuthMode(isLoginMode);
                   window.showScreen('login-screen');
              }
             return;
         }

         button.disabled = true;
         const originalButtonText = button.textContent;
         button.textContent = 'Creating...';
         container.style.display = 'block';
         container.innerHTML = '<div class="loading-animation">Generating Flashcards...</div>'; // Set loading state

         try {
             // Call callAIEndpoint directly as it's a custom renderer
             const data = await callAIEndpoint('/generate-flashcards-ai', { topic, count }, '#flashcard-response-container');

             if (data && !data.error && Array.isArray(data.cards)) {
                 await displayFlashcards(data.cards);
                 console.log("DEBUG_MERGE: Flashcards generated and displayed successfully.");
             } else {
                 // Error message handled by callAIEndpoint's catch, or handle specific data error
                 const errorMsg = data && data.error ? data.error : 'Could not create flashcards.';
                 console.error("DEBUG_MERGE: Error creating flashcards:", errorMsg, data);
                 container.innerHTML = `<p style="color: var(--color-red);">Error: ${errorMsg}</p>`; // Use v2 style
             }
         } catch (error) {
             // This catch block handles errors specifically thrown *after* callAIEndpoint returns (unlikely)
             console.error('DEBUG_MERGE: handleGenerateFlashcards CATCH block.', error);
              // Ensure an error message is displayed if not already done by callAIEndpoint
               if (!container.innerHTML.includes('color: var(--color-red)')) {
                   container.innerHTML = `<p style="color: var(--color-red);">An unexpected client-side error occurred: ${error.message}</p>`;
               }
         } finally {
             button.disabled = false;
             button.textContent = originalButtonText;
             console.log("DEBUG_MERGE: handleGenerateFlashcards finally block executed.");
         }
    }

    // 8. Write Essay Handler
    window.handleWriteEssay = async function() { // Renamed slightly
         console.log("DEBUG_MERGE: handleWriteEssay called.");
         const button = document.getElementById('write-essay-btn');
         const topicInput = document.getElementById('essay-topic-input');
         const container = document.getElementById('essay-writer-response-container'); // Target element for output

         if (!button || !topicInput || !container) {
             console.error("DEBUG_MERGE: Missing DOM elements for Write Essay.");
             alert("Error initializing Write Essay feature.");
             return;
         }

         // Use the generic handler
         await handleSimpleAIRequest(button, 'essay-writer-response-container', '/write-essay-ai', () => {
             const topic = topicInput.value.trim();
             if (topic === '') {
                 alert('Please enter a topic.');
                 return null; // Abort request
             }
             return { topic };
         });
    }

    // 9. Create Presentation Handler
    window.handleCreatePresentation = async function() { // Renamed slightly
         console.log("DEBUG_MERGE: handleCreatePresentation called.");
         const button = document.getElementById('create-presentation-btn');
         const topicInput = document.getElementById('presentation-topic-input');
         const container = document.getElementById('presentation-maker-response-container'); // Target element for output

         if (!button || !topicInput || !container) {
             console.error("DEBUG_MERGE: Missing DOM elements for Create Presentation.");
             alert("Error initializing Create Presentation feature.");
             return;
         }

         // Use the generic handler
         await handleSimpleAIRequest(button, 'presentation-maker-response-container', '/create-presentation-ai', () => {
             const topic = topicInput.value.trim();
             if (topic === '') {
                 alert('Please enter a topic.');
                 return null; // Abort request
             }
             return { topic };
         });
    }

    // 10. Get Explanation Handler
    window.handleExplainConcept = async function() { // Renamed slightly, originally called handleApiRequest in v2 for this endpoint
         console.log("DEBUG_MERGE: handleExplainConcept called.");
         const button = document.getElementById('get-explanation-btn');
         const conceptInput = document.getElementById('concept-input');
         const container = document.getElementById('concept-output-container'); // Target element for output

         if (!button || !conceptInput || !container) {
             console.error("DEBUG_MERGE: Missing DOM elements for Get Explanation.");
             alert("Error initializing Get Explanation feature.");
             return;
         }

         // Use the generic handler
         await handleSimpleAIRequest(button, 'concept-output-container', '/explain-concept-ai', () => {
             const topic = conceptInput.value.trim(); // v2 uses 'topic' key for explain concept
             if (topic === '') {
                 alert('Please enter a concept.');
                 return null; // Abort request
             }
             return { topic };
         });
    }
    // --- END AI FEATURE HANDLERS ---


    // --- AI FEATURE BUTTON EVENT LISTENERS (FROM static/script_v2.js, integrated here) ---
    // These listeners attach the above handlers to the actual buttons.
    // They assume the AI feature HTML elements with these IDs are present in the main index.html
    console.log("DEBUG_MERGE: Attaching AI Feature Event Listeners.");

    // Custom count input logic (FROM static/script_v2.js)
    document.querySelectorAll('input[type="radio"][value="custom"]').forEach(radio => {
        radio.addEventListener('change', function() {
        const customInput = this.closest('.option-selector-group')?.querySelector('.custom-count-input'); // Use optional chaining
        if (customInput) {
            customInput.disabled = !this.checked;
            if (this.checked) customInput.focus();
        }
        });
        const otherRadios = radio.closest('.option-selector-group')?.querySelectorAll('input[type="radio"]:not([value="custom"])'); // Use optional chaining
        if(otherRadios) {
            otherRadios.forEach(other => {
                other.addEventListener('change', function() {
                    const customInput = this.closest('.option-selector-group')?.querySelector('.custom-count-input'); // Use optional chaining
                    if (customInput) customInput.disabled = true;
                });
            });
        }
    });

    // Image file name display logic (FROM static/script_v2.js)
    const imageInput = document.getElementById('doubt-image-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    if (imageInput && fileNameDisplay) {
        imageInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                // Updated template literal (already done in v2 provided)
                fileNameDisplay.textContent = `File: ${this.files[0].name}`;
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    }

    // Attach handlers to buttons using their IDs
    const askDoubtSubmitBtn = document.getElementById('ask-doubt-submit');
    if(askDoubtSubmitBtn) askDoubtSubmitBtn.addEventListener('click', window.handleAskDoubt);
    else console.warn("DEBUG_MERGE: Ask Doubt submit button not found.");

    const generateNotesSubmitBtn = document.getElementById('generate-notes-submit');
    if(generateNotesSubmitBtn) generateNotesSubmitBtn.addEventListener('click', window.handleGenerateNotes);
    else console.warn("DEBUG_MERGE: Generate Notes submit button not found.");

    const startQuizBtn = document.getElementById('start-quiz-btn');
    if(startQuizBtn) startQuizBtn.addEventListener('click', window.startQuizHandler); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Start Quiz button not found.");

    const submitQuizBtn = document.getElementById('submit-quiz-btn');
    if(submitQuizBtn) submitQuizBtn.addEventListener('click', function() {
         console.log("DEBUG_MERGE: submit-quiz-btn clicked.");
         let score = 0;
         const userAnswersForAnalysis = []; // Array to hold data for analysis

         // Check if quiz questions and correct answers are available
         if (!window.currentQuizQuestions || !window.correctAnswers || window.currentQuizQuestions.length !== window.correctAnswers.length) {
             console.error("DEBUG_MERGE: Quiz data is inconsistent. Cannot submit.");
             alert("Error submitting quiz. Quiz data is not complete.");
             return;
         }

         window.correctAnswers.forEach((correctAnswer, i) => {
             const selectedRadio = document.querySelector(`input[name="question-${i}"]:checked`);
             const questionData = window.currentQuizQuestions[i];

             // Get user's answer, default to "Not Answered"
             let userAnswer = selectedRadio ? selectedRadio.value : "Not Answered";
             // Determine if the answer is correct
             let isCorrect = (userAnswer === correctAnswer);

             // Store answer details for analysis
             userAnswersForAnalysis.push({
                 question: questionData.question,
                 userAnswer: userAnswer,
                 isCorrect: isCorrect,
                 conceptTag: questionData.conceptTag || "General" // Include concept tag if available
             });

             // Update UI to show correct/incorrect options
             const optionsContainer = document.getElementById(`options-${i}`);
             if (optionsContainer) {
                 optionsContainer.querySelectorAll('label').forEach(label => {
                     // Disable further clicks on options for this question
                     label.style.pointerEvents = 'none';
                     const inputValue = label.querySelector('input')?.value; // Use optional chaining
                     if (inputValue === correctAnswer) {
                         // Mark correct answer
                         label.classList.add('correct');
                     }
                     // Mark user's selected answer if it was incorrect
                     if (selectedRadio && selectedRadio.value === inputValue && !isCorrect) {
                         label.classList.add('incorrect');
                     }
                 });
             }

             // Increment score if correct
             if (isCorrect) score++;
         });

         // Display final score
         const resultDiv = document.getElementById('quiz-result');
         if(resultDiv) resultDiv.innerHTML = `<h3>Your Score: ${score} / ${window.correctAnswers.length}</h3>`; // Use v2 style

         // Hide submit button and show post-quiz options
         this.style.display = 'none';
         const postQuizOptionsDiv = document.getElementById('post-quiz-options');
         if(postQuizOptionsDiv) postQuizOptionsDiv.style.display = 'block';

         // Generate quiz analysis report
         getQuizAnalysis(userAnswersForAnalysis);
         console.log("DEBUG_MERGE: Quiz submitted and analysis initiated.");
    });
    else console.warn("DEBUG_MERGE: Submit Quiz button not found.");


    const retakeQuizBtn = document.getElementById('retake-quiz-btn');
    if(retakeQuizBtn) retakeQuizBtn.addEventListener('click', function() {
         console.log("DEBUG_MERGE: retake-quiz-btn clicked.");
         const quizView = document.getElementById('mcq-quiz-view');
         const setupView = document.getElementById('mcq-setup-view');
         const topicInput = document.getElementById('mcq-topic-input');
         if(quizView) quizView.style.display = 'none';
         if(setupView) setupView.style.display = 'block';
         if(topicInput) topicInput.value = ''; // Clear topic input on retake
         console.log("DEBUG_MERGE: Retake Quiz: Returned to setup screen.");
    });
    else console.warn("DEBUG_MERGE: Retake Quiz button not found.");


    const getSolvedNotesBtn = document.getElementById('get-solved-notes-btn');
    if(getSolvedNotesBtn) getSolvedNotesBtn.addEventListener('click', window.handleGetSolvedExamples); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Get Solved Notes button not found.");


    const getCareerAdviceBtn = document.getElementById('get-career-advice-btn');
    if(getCareerAdviceBtn) getCareerAdviceBtn.addEventListener('click', window.handleGetCareerAdvice); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Get Career Advice button not found.");


    const generateStudyPlanBtn = document.getElementById('generate-study-plan-btn');
    if(generateStudyPlanBtn) generateStudyPlanBtn.addEventListener('click', window.handleGenerateStudyPlan); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Generate Study Plan button not found.");


    const generateFlashcardsBtn = document.getElementById('generate-flashcards-btn');
    if(generateFlashcardsBtn) generateFlashcardsBtn.addEventListener('click', window.handleGenerateFlashcards); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Generate Flashcards button not found.");


    const writeEssayBtn = document.getElementById('write-essay-btn');
    if(writeEssayBtn) writeEssayBtn.addEventListener('click', window.handleWriteEssay); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Write Essay button not found.");


    const createPresentationBtn = document.getElementById('create-presentation-btn');
    if(createPresentationBtn) createPresentationBtn.addEventListener('click', window.handleCreatePresentation); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Create Presentation button not found.");


    const getExplanationBtn = document.getElementById('get-explanation-btn');
    if(getExplanationBtn) getExplanationBtn.addEventListener('click', window.handleExplainConcept); // Use the renamed handler
    else console.warn("DEBUG_MERGE: Get Explanation button not found.");

    console.log("DEBUG_MERGE: Finished attaching AI Feature Event Listeners.");
    // --- END AI FEATURE BUTTON EVENT LISTENERS ---


    // --- RAZORPAY & PREMIUM PACKAGE LOGIC (FROM New File.js) ---
    function addPremiumPackageStyles() {
        const styleId = 'premium-package-styles';
        if (document.getElementById(styleId)) return;

        const css = `
            .premium-package-swiper-wrapper { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding-bottom: 10px; gap: 15px; scrollbar-width: none; }
            .premium-package-swiper-wrapper::-webkit-scrollbar { display: none; }
            .premium-card-slide { scroll-snap-align: center; flex: 0 0 90%; margin: 10px 0; background: linear-gradient(145deg, #FFDF00, #F0C000); border: 2px solid #DAA520; border-radius: 20px; padding: 25px 20px; color: #4A3B00; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.25), 0 0 5px #FFFACD inset; display: flex; flex-direction: column; justify-content: space-around; align-items: center; height: auto; min-height: 380px; box-sizing: border-box; font-family: 'Poppins', sans-serif; transition: transform 0.3s ease-in-out; }
            .premium-card-slide .package-name { font-size: 1.8em; font-weight: 700; color: #8B4513; margin-bottom: 10px; text-shadow: 1px 1px 2px rgba(0,0,0,0.1); }
            .premium-card-slide .package-coins { font-size: 2.5em; margin: 10px 0; color: #A0522D; font-weight: 600; }
            .premium-card-slide .package-coins .coins-label { font-size: 0.5em; display: block; color: #8B4513; font-weight: 500; margin-top: -5px; }
            .premium-card-slide .package-price { font-size: 2em; font-weight: 700; margin-bottom: 25px; color: #D2691E; }
            .premium-card-slide .btn-buy-premium { background-color: #8B4513; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-size: 1.2em; border: none; cursor: pointer; transition: background-color 0.3s ease, transform 0.2s ease; box-shadow: 0 4px 8px rgba(0,0,0,0.2); display: inline-block; line-height: normal; }
            .premium-card-slide .btn-buy-premium:hover { background-color: #A0522D; transform: translateY(-2px); }
            .premium-card-slide .btn-buy-premium:active { transform: translateY(0px); }
            .premium-card-slide .btn-buy-premium.clicked { background-color: #4CAF50; color: white !important; transform: none; }
            .premium-card-slide .btn-buy-premium.clicked:hover { background-color: #45a049; }
            .premium-package-pagination { text-align: center; padding: 15px 0 5px 0; }
            .premium-package-pagination .dot { height: 12px; width: 12px; margin: 0 6px; background-color: #ccc; border-radius: 50%; display: inline-block; cursor: pointer; transition: background-color 0.3s ease, transform 0.3s ease; border: 1px solid #bbb; }
            .premium-package-pagination .dot.active { background-color: var(--primary); transform: scale(1.2); border-color: var(--primary); }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    }

    window.showPremiumPackagesScreen = function() {
        console.log("DEBUG_MERGE: showPremiumPackagesScreen called.");
        closeUserProfileMenu();
        // Use the global auth object to check login state
        if (!auth.currentUser) {
            console.log("DEBUG_MERGE: User not logged in (auth.currentUser is null). Redirecting to login screen before showing premium packages.");
            alert("Please log in to view premium packages.");
            isLoginMode = true;
            window.toggleAuthMode(isLoginMode); // Ensure form is in login mode
            window.showScreen('login-screen');
            return;
        }
        showScreen('premium-package-screen');
        addPremiumPackageStyles();
        renderPremiumPackages();
        console.log("DEBUG_MERGE: Premium packages screen displayed.");
    }

    function updatePremiumPagination(swiperWrapper, paginationContainer) {
        if (!swiperWrapper || !paginationContainer || swiperWrapper.children.length === 0) return;
        const scrollLeft = swiperWrapper.scrollLeft;
        let minDistance = Infinity;
        let activeIndex = 0;
        for (let i = 0; i < swiperWrapper.children.length; i++) {
            const card = swiperWrapper.children[i];
            // Check if card is a valid element with offsetLeft and offsetWidth
            if (card && typeof card.offsetLeft === 'number' && typeof card.offsetWidth === 'number') {
                 const cardCenter = card.offsetLeft + card.offsetWidth / 2;
                 const viewportCenter = scrollLeft + swiperWrapper.offsetWidth / 2;
                 const distance = Math.abs(cardCenter - viewportCenter);
                 if (distance < minDistance) {
                     minDistance = distance;
                     activeIndex = i;
                 }
            }
        }
        const dots = paginationContainer.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === activeIndex);
        });
    }


    // handleBuyClick function (FROM New File.js - kept as is, already uses auth.currentUser correctly)
    window.handleBuyClick = async function(event, price, pkgName) {
        event.preventDefault();
        console.log(`DEBUG_MERGE: handleBuyClick function entry. Price: ${price}, Package: ${pkgName}`);

        const buyButton = event.currentTarget;
        if (!buyButton) {
             console.error("DEBUG_MERGE: Buy button element not found in handleBuyClick.");
             return;
        }

        console.log("DEBUG_MERGE: Checking user authentication status using auth.currentUser.");
        // Use the globally managed auth instance
        const userForPayment = auth.currentUser;

        if (!userForPayment) {
            console.error("DEBUG_MERGE: User not logged in for payment (auth.currentUser is null). Redirecting to login-screen.");
            alert("Please log in to make a purchase.");
            isLoginMode = true;
            if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                window.toggleAuthMode(isLoginMode); // Ensure form is in login mode
                window.showScreen('login-screen');
            } else {
                console.error("DEBUG_MERGE: window.showScreen or window.toggleAuthMode function is not available to redirect to login.");
            }
             buyButton.disabled = false;
             buyButton.textContent = 'Buy Now';
            return;
        }
        console.log("DEBUG_MERGE: User IS logged in for payment. UID:", userForPayment.uid);

        buyButton.disabled = true;
        buyButton.textContent = 'Processing...';

        try {
            console.log("DEBUG_MERGE: Attempting to get ID token (forced refresh) for user:", userForPayment.uid);
            let token;
            try {
                // Firebase v9 syntax for getting ID token using the globally managed auth object
                token = await getIdToken(userForPayment, true);
            } catch (tokenError) {
                console.error("DEBUG_MERGE: Error getting ID token for payment:", tokenError);
                throw new Error("Failed to obtain authentication token for payment. Please try logging in again. Details: " + tokenError.message);
            }

            if (!token) {
                console.error("DEBUG_MERGE: Failed to get ID Token for payment. Token is null/undefined after attempt.");
                throw new Error("Authentication token could not be retrieved for payment. Please ensure you are logged in properly.");
            }
            console.log("DEBUG_MERGE: ID Token obtained successfully for payment (actual token value not logged for security).");

             const backendUrl = 'https://soul-spark.onrender.com'; // Use the correct backend URL
            console.log("DEBUG_MERGE: Sending fetch request to /create-order with token.");
            const response = await fetch(`${backendUrl}/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: price, // This 'price' (priceVal) is in Rupees. Your backend needs to convert to paise for Razorpay.
                    uid: userForPayment.uid // Include UID in the body as well for server-side check
                })
            });

            console.log("DEBUG_MERGE: /create-order response status:", response.status, response.statusText);
            const responseText = await response.text();
            console.log("DEBUG_MERGE: /create-order raw response body (text):", responseText);

            let orderData;
            try {
                orderData = JSON.parse(responseText);
            } catch (parseError) {
                console.error("DEBUG_MERGE: Failed to parse server response as JSON:", parseError);
                throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Body (first 100 chars): ${responseText.substring(0, 100)}...`);
            }
            console.log("DEBUG_MERGE: /create-order parsed response body (JSON):", orderData);

            if (!response.ok) {
                const errorMessageFromServer = orderData.error || `Server error: ${response.statusText || response.status}`;
                console.error("DEBUG_MERGE: Server responded with !response.ok. Error from server:", errorMessageFromServer);
                throw new Error(`Failed to create order. ${errorMessageFromServer}`);
            }

            if (orderData.error || !orderData.order_id) {
                const errorDetail = orderData.error || 'Order ID not received from server or is invalid.';
                console.error("DEBUG_MERGE: Order creation failed logic after parsing. Error detail:", errorDetail);
                throw new Error(errorDetail);
            }
            console.log("DEBUG_MERGE: Order ID received from server:", orderData.order_id);

            // Ensure Razorpay script is loaded (Add this check if not globally loaded)
            if (typeof Razorpay === 'undefined') {
                console.error("DEBUG_MERGE: Razorpay SDK not loaded.");
                alert("Razorpay SDK not loaded. Please refresh the page.");
                throw new Error("Razorpay SDK not loaded.");
            }

            // Ensure orderData.amount received from server is in PAISA for Razorpay
            const options = {
                "key": "rzp_test_SzOZpCiXtvIxTr", // Your Razorpay Key ID (Test or Live)
                "amount": orderData.amount, // This amount MUST be in paise, as received from the server.
                "currency": "INR",
                "name": "Conceptra",
                "description": `Purchase of ${pkgName}`,
                "order_id": orderData.order_id,
                "handler": function (paymentResponse) {
                    console.log("DEBUG_MERGE: Razorpay payment successful (handler). Payment Response:", paymentResponse);
                    alert(`Payment Successful! Payment ID: ${paymentResponse.razorpay_payment_id}. Your C-Coins will be added shortly.`);
                    // You might want to trigger a UI update for C-Coins here or rely on the backend webhook
                     // Example: window.updateUIAfterLogin(auth.currentUser); // Refresh UI
                    buyButton.textContent = 'Purchased!';
                    buyButton.classList.add('clicked');
                    buyButton.disabled = true; // Keep disabled after success
                },
                "prefill": {
                    "name": userForPayment.displayName || 'Conceptra User',
                    "email": userForPayment.email || '',
                    // "contact": userForPayment.phoneNumber || '' // If you collect phone number
                },
                "notes": {
                    "firebase_uid": userForPayment.uid // Pass UID to backend webhook via notes
                },
                "theme": {
                    "color": "#00B49B" // Your app's primary color
                }
            };
            console.log("DEBUG_MERGE: Razorpay options prepared (stringified for checking, actual object passed to Razorpay):", JSON.stringify(options));

            const rzp = new Razorpay(options);

            rzp.on('payment.failed', function (paymentFailedResponse){
                console.error("DEBUG_MERGE: Razorpay payment.failed event triggered. Full error object:", paymentFailedResponse);
                let errorMessage = "Payment failed. Please try again.";
                if (paymentFailedResponse.error) {
                    if (paymentFailedResponse.error.description) {
                        errorMessage = `Payment failed: ${paymentFailedResponse.error.description}`;
                    }
                    // Add more specific error details from paymentFailedResponse.error if needed
                    console.error("DEBUG_MERGE: Razorpay failure details:", paymentFailedResponse.error); // Log full error details
                }
                alert(errorMessage);
                 // Reset button state on failure
                if (buyButton) {
                    console.log("DEBUG_MERGE: Resetting buy button after payment failure.");
                    buyButton.disabled = false;
                    buyButton.textContent = originalButtonText; // Restore original text
                }
            });

            console.log("DEBUG_MERGE: About to call rzp.open().");
            rzp.open();
            console.log("DEBUG_MERGE: rzp.open() has been called. Razorpay modal should be visible.");

        } catch (error) {
            console.error('DEBUG_MERGE: handleBuyClick CATCH block. Error:', error);
            alert(`An error occurred during purchase: ${error.message}. Please check the console for details and try again.`);
             // Reset button state on error
            if (buyButton) {
                 console.log("DEBUG_MERGE: Resetting buy button in main catch block.");
                 buyButton.disabled = false;
                 buyButton.textContent = originalButtonText; // Restore original text
            }
        }
    }


    window.renderPremiumPackages = function() {
        console.log("DEBUG_MERGE: renderPremiumPackages called.");
        const swiperWrapper = document.getElementById('premium-package-swiper-wrapper');
        const paginationContainer = document.getElementById('premium-package-pagination');

        if (!swiperWrapper || !paginationContainer) {
            console.error("DEBUG_MERGE: Premium package swiper wrapper or pagination container not found!");
            return;
        }
        swiperWrapper.innerHTML = '';
        paginationContainer.innerHTML = '';

        premiumPackagesData.forEach((pkg, index) => {
            const cardSlide = document.createElement('div');
            cardSlide.className = 'premium-card-slide';
            cardSlide.innerHTML = `
                <div class="package-name">${pkg.name}</div>
                <div class="package-coins">${pkg.coins} <span class="coins-label">C-Coins</span></div>
                <div class="package-price">${pkg.priceDisplay}</div>
                <!-- Use window.handleBuyClick to ensure it's accessible -->
                <button class="btn btn-buy-premium" onclick="window.handleBuyClick(event, ${pkg.priceVal}, '${pkg.name.replace(/'/g, "\\'")}')">Buy Now</button>
            `;
            swiperWrapper.appendChild(cardSlide);

            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = index;
            dot.onclick = () => {
                const cardToScrollTo = swiperWrapper.children[index];
                if (cardToScrollTo) {
                     const targetScrollLeft = cardToScrollTo.offsetLeft + (cardToScrollTo.offsetWidth / 2) - (swiperWrapper.offsetWidth / 2);
                     swiperWrapper.scrollTo({
                         left: targetScrollLeft,
                         behavior: 'smooth'
                     });
                }
            };
            paginationContainer.appendChild(dot);
        });

        // Need a short delay to ensure elements are rendered before calculating positions
        if (swiperWrapper.children.length > 0) {
            setTimeout(() => updatePremiumPagination(swiperWrapper, paginationContainer), 100);
        }

        // Add scroll listener to update dots
        swiperWrapper.onscroll = () => {
            updatePremiumPagination(swiperWrapper, paginationContainer);
        };
         console.log("DEBUG_MERGE: Premium packages rendered.");
    }

    // --- LOCAL STORAGE USER INFO FUNCTIONS (FROM New File.js) ---
    // These are for fallback or collecting extra info if not using Firebase Auth fully,
    // but primarily rely on Firebase Auth now.
    function getCurrentUser() {
        // Prefer Firebase Auth user
        if (currentFirebaseUser) {
             console.log("DEBUG_MERGE: getCurrentUser: Using currentFirebaseUser (UID:", currentFirebaseUser.uid, ")");
             return {
                id: currentFirebaseUser.uid,
                name: currentFirebaseUser.displayName || 'Conceptra User',
                email: currentFirebaseUser.email,
                isFirebaseUser: true
            };
        }
        // Fallback to localStorage if no Firebase user (less secure, used for legacy/guest features)
        const userInfo = loadFromStorage('conceptra-user-info');
        if (userInfo && (userInfo.email || userInfo.mobile)) { // Require at least email or mobile for non-anonymous LS user
            console.warn("DEBUG_MERGE: getCurrentUser: Falling back to localStorage for user info. User is NOT authenticated with Firebase.");
            return {
                id: userInfo.email || userInfo.mobile, // Use email or mobile as ID for LS user
                name: userInfo.name || 'Anonymous LS User',
                isFirebaseUser: false // Explicitly mark as non-Firebase
            };
        }
        console.log("DEBUG_MERGE: getCurrentUser: No Firebase user and no valid localStorage info. Returning anonymous guest.");
        // Return a transient guest ID if no persistent info
        return {
            id: 'anonymous_guest_' + Date.now(), // Unique ID for the session/usage
            name: 'Guest User',
            isFirebaseUser: false
        };
    }

    function saveToStorage(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); console.log(`DEBUG_MERGE: Saved ${key} to localStorage.`);} catch (e) { console.error("DEBUG_MERGE: Failed to save to storage:", key, e); } }
    function loadFromStorage(key) { const data = localStorage.getItem(key); try { const parsed = data ? JSON.parse(data) : null; console.log(`DEBUG_MERGE: Loaded ${key} from localStorage:`, parsed); return parsed; } catch (e) { console.error("DEBUG_MERGE: Failed to parse from storage:", key, e); return null; } }
    // --- END LOCAL STORAGE USER INFO FUNCTIONS ---


    // --- AUTHENTICATION & PROFILE MANAGEMENT LOGIC (FROM New File.js) ---
    window.editUserProfile = function() {
        console.log("DEBUG_MERGE: editUserProfile called.");
        closeUserProfileMenu();
        // Set mode to login/profile view
        isLoginMode = true; // Use login mode for editing/viewing profile
        if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
            window.showScreen('login-screen'); // Go to the auth/login screen
             setTimeout(() => { // Allow screen transition to happen
                const titleEl = document.getElementById('auth-form-title');
                const greetingEl = document.getElementById('auth-form-greeting');
                const nameInputGroup = document.getElementById('name-input-group');
                const signupFields = document.getElementById('signup-fields-container');
                const submitBtn = document.getElementById('auth-submit-button');
                const toggleLink = document.getElementById('auth-mode-toggle');
                const emailInput = document.getElementById('auth-email');

                // Toggle UI to match the current user state (view profile vs login form)
                window.toggleAuthMode(true); // Force login mode UI initially

                if (currentFirebaseUser) {
                     console.log("DEBUG_MERGE: editUserProfile: User is logged in, showing profile info.");
                    if (titleEl) titleEl.textContent = 'Your Profile / Login';
                    if (greetingEl) greetingEl.textContent = 'Logged in as ' + (currentFirebaseUser.displayName || currentFirebaseUser.email);
                    if (nameInputGroup) nameInputGroup.style.display = 'none'; // Hide name input
                    if (signupFields) signupFields.style.display = 'none'; // Hide extra signup fields
                    if (submitBtn) submitBtn.textContent = 'Login (if session expired)'; // Change button text
                    if (toggleLink) toggleLink.style.display = 'none'; // Hide login/signup toggle

                    if (emailInput && currentFirebaseUser.email) {
                         emailInput.value = currentFirebaseUser.email; // Pre-fill email
                         emailInput.disabled = true; // Disable email editing (Firebase restriction)
                    }
                    const passwordInput = document.getElementById('auth-password');
                    if(passwordInput) {
                         passwordInput.value = ''; // Clear password field
                         passwordInput.placeholder = 'Enter password to update profile'; // Hint for update
                    }


                } else {
                    // This case should ideally not happen if editUserProfile is called when logged in.
                    // If it does, ensure the form is in login mode for them to log in.
                    console.warn("DEBUG_MERGE: editUserProfile called but user is not logged in. Displaying standard login form.");
                    window.toggleAuthMode(true); // Force login mode
                }
            }, 0); // Use 0 timeout for next tick execution
        } else {
            console.error("DEBUG_MERGE: window.showScreen function not found in editUserProfile.");
            alert("Navigation error. Cannot show profile edit page.");
        }
    }


    window.logOutUser = function() {
        console.log("DEBUG_MERGE: logOutUser initiated.");
        // Use the globally managed auth object
        if (!auth.currentUser) {
             console.log("DEBUG_MERGE: logOutUser called but no user is logged in. Aborting.");
             closeUserProfileMenu();
             closeSettingsModal();
             // Redirect to login screen anyway as they might think they are logged in
             isLoginMode = false;
             if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                  window.toggleAuthMode(isLoginMode);
                  window.showScreen('login-screen');
             }
             return; // Exit early if no user
        }

        if(confirm("Are you sure you want to log out?")) {
            console.log("DEBUG_MERGE: Proceeding with logout.");
            closeUserProfileMenu();
            closeSettingsModal();
            auth.signOut().then(() => {
                console.log("DEBUG_MERGE: Firebase user signed out successfully via auth.signOut().");
                // No need to remove 'conceptra-user-info' as it's now deprecated as the primary auth source

                // Redirect directly to login/information screen
                if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                    console.log("DEBUG_MERGE: Redirecting to login-screen (information page) immediately after logout.");
                    isLoginMode = false; // Set to Sign Up / Information Collection mode
                    window.toggleAuthMode(isLoginMode); // Update the auth form UI to reflect this mode
                    window.showScreen('login-screen'); // Directly display the login/information screen
                } else {
                    console.error("DEBUG_MERGE: window.showScreen or window.toggleAuthMode function is not available. Cannot redirect to login-screen after logout.");
                    // Fallback: If critical functions are missing, try showing home or splash
                    if (typeof window.showScreen === 'function') {
                         console.log("DEBUG_MERGE: Fallback: Redirecting to home-screen after logout due to missing toggleAuthMode.");
                         window.showScreen('home-screen'); // Fallback to home
                    } else {
                        console.error("DEBUG_MERGE: Critical navigation functions missing, cannot redirect after logout.");
                         alert("Logged out successfully, but navigation failed. Please refresh manually.");
                    }
                }

            }).catch((error) => {
                console.error("DEBUG_MERGE: Sign out error in logOutUser:", error);
                alert("Failed to log out. Please try again. Error: " + error.message);
            });
        } else {
            console.log("DEBUG_MERGE: Logout cancelled by user.");
        }
    }


    // handleAuthFormSubmit function (FROM New File.js - kept as is)
    window.handleAuthFormSubmit = async function(event) {
        event.preventDefault();
        console.log("DEBUG_MERGE: handleAuthFormSubmit called. isLoginMode:", isLoginMode);

        const nameInput = document.getElementById('auth-name');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const mobileInput = document.getElementById('auth-mobile');
        const addressInput = document.getElementById('auth-address');
        const stateInput = document.getElementById('auth-state');
        const countryInput = document.getElementById('auth-country');
        const errorMessageDiv = document.getElementById('auth-error-message');
        const submitButton = document.getElementById('auth-submit-button');

        if (!emailInput || !passwordInput || ( !isLoginMode && !nameInput) || !errorMessageDiv || !submitButton) {
            console.error("DEBUG_MERGE: Auth form elements not found in handleAuthFormSubmit.");
            if(errorMessageDiv) errorMessageDiv.textContent = "Form error. Please refresh.";
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const name = nameInput ? nameInput.value.trim() : '';

        errorMessageDiv.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        try { // <<<--- Added try block to wrap both login and signup logic
            // Use the globally managed auth object
            if (isLoginMode) {
                // Check if user is ALREADY logged in (e.g., came via "Edit Profile")
                if (auth.currentUser) {
                     console.log("DEBUG_MERGE: handleAuthFormSubmit: User is already logged in. Assuming this is a profile update attempt.");
                     // Handle profile update logic here if needed,
                     // although updateProfile is primarily for displayName/photoURL.
                     // For email/password updates, Firebase requires re-authentication and specific methods (updateEmail, updatePassword).
                     // A simplified approach might just rely on the onAuthStateChanged listener to confirm login.
                     // For now, just confirm successful login/session status.
                     const user = auth.currentUser;
                     console.log("DEBUG_MERGE: User is logged in. No action needed on submit for already logged-in user.");
                     // Potentially update displayName if name input is visible and changed (e.g., if profile edit form allows it)
                     if (nameInputGroup && nameInputGroup.style.display !== 'none' && nameInput && name !== user.displayName) {
                          console.log("DEBUG_MERGE: Attempting to update displayName:", name);
                          await updateProfile(user, { displayName: name });
                          console.log("DEBUG_MERGE: Profile displayName updated.");
                          // Firestore user doc might also need updating if displayName is stored there
                           const userDocRef = doc(db, "users", user.uid);
                           await setDoc(userDocRef, { displayName: name }, { merge: true }); // Use merge to not overwrite other fields
                           console.log("DEBUG_MERGE: Firestore user doc updated with new displayName.");
                     }

                     // If they entered password, might assume they want to re-authenticate or update password (more complex)
                     // Skipping password update logic for now to keep merge simple as per instructions
                     // You would need reauthenticateWithCredential and updatePassword methods

                     // Since user is logged in, just act like a successful "login" and update UI
                      if (typeof window.updateUIAfterLogin === 'function') {
                           window.updateUIAfterLogin(user);
                      }
                       // Optionally show a success message
                      errorMessageDiv.textContent = "Profile updated or session confirmed!";
                      errorMessageDiv.style.color = 'var(--success)';


                } else {
                    console.log("DEBUG_MERGE: Attempting Firebase Login for email:", email);
                    // Use the globally managed auth object
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    console.log("DEBUG_MERGE: Firebase Login Successful. User UID:", user.uid);
                    // onAuthStateChanged -> updateUIAfterLogin handles redirection after successful state change
                }
            } else { // Sign Up Logic
                // Check if name is required for signup mode AND is empty
                if (nameInput && nameInput.required && name === '') {
                    errorMessageDiv.textContent = "Name is required for sign-up.";
                    // No need to throw error here, the finally block will reset the button
                } else { // Proceed with sign-up only if name is provided (or not required)
                    console.log("DEBUG_MERGE: Attempting Firebase Sign-Up for email:", email, "Name:", name);
                    // Use the globally managed auth object
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    console.log("DEBUG_MERGE: Firebase Account Creation Successful. User UID:", user.uid);

                    // Update Auth profile with display name
                    console.log("DEBUG_MERGE: Updating Firebase Auth profile displayName to:", name);
                    // Check if displayName is provided before attempting update
                    if (name) {
                        await updateProfile(user, { displayName: name });
                        console.log("DEBUG_MERGE: Firebase Auth profile displayName updated.");
                    } else {
                         console.log("DEBUG_MERGE: No display name provided for profile update.");
                    }


                    // Collect additional user info for Firestore profile
                    const mobile = mobileInput ? mobileInput.value.trim() : '';
                    const address = addressInput ? addressInput.value.trim() : '';
                    const state = stateInput ? stateInput.value : ''; // Selected value
                    const country = countryInput ? countryInput.value.trim() : 'India';

                    const userDocRef = doc(db, "users", user.uid);
                    const userData = {
                        uid: user.uid,
                        // Use the name that was potentially updated in auth profile, or fallback
                        displayName: user.displayName || name || 'New User',
                        email: email,
                        mobile: mobile || null,
                        address: address || null,
                        state: state || null,
                        country: country || null,
                        createdAt: serverTimestamp(), // Server timestamp for consistency
                        cCoins: 0 // Initial coins balance
                    };
                    console.log("DEBUG_MERGE: Saving user data to Firestore:", userData);
                    // Use setDoc with merge: true might be safer if user doc could pre-exist,
                    // but for new sign-up, setDoc without merge is fine.
                    await setDoc(userDocRef, userData);
                    console.log("DEBUG_MERGE: User profile data saved to Firestore for UID:", user.uid);
                    // onAuthStateChanged -> updateUIAfterLogin handles redirection after successful state change
                }
            }
        } catch (error) {
            console.error("DEBUG_MERGE: Firebase Auth Error in handleAuthFormSubmit :", error.code, error.message);
            errorMessageDiv.textContent = getAuthErrorMessage(error);
            errorMessageDiv.style.color = 'var(--danger)'; // Ensure error style is applied
        } finally {
            // This block will execute regardless of success or failure in the try block
            submitButton.disabled = false;
            if (isLoginMode) {
                submitButton.textContent = 'Login';
            } else {
                submitButton.textContent = 'Create Account';
            }
            console.log("DEBUG_MERGE: handleAuthFormSubmit finally block executed. Button state reset.");
        }
    };


    window.toggleAuthMode = function(forceLoginMode = null) {
        if (forceLoginMode !== null) {
            isLoginMode = forceLoginMode;
        } else {
            isLoginMode = !isLoginMode;
        }
        console.log("DEBUG_MERGE: toggleAuthMode called. New isLoginMode:", isLoginMode);

        const titleEl = document.getElementById('auth-form-title');
        const greetingEl = document.getElementById('auth-form-greeting');
        const messageEl = document.getElementById('auth-form-message');
        const nameInputGroup = document.getElementById('name-input-group');
        const authNameInput = document.getElementById('auth-name'); // Get the input itself
        const signupFields = document.getElementById('signup-fields-container');
        const submitBtn = document.getElementById('auth-submit-button');
        const toggleLink = document.getElementById('auth-mode-toggle');
        const errorMessageDiv = document.getElementById('auth-error-message');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');


        if (errorMessageDiv) errorMessageDiv.textContent = ''; // Clear previous errors

        // Clear sensitive fields when toggling modes
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (authNameInput) authNameInput.value = ''; // Clear name on toggle

        // Enable email input (it might have been disabled in edit profile mode)
        if (emailInput) emailInput.disabled = false;
        // Reset password placeholder
        if (passwordInput) passwordInput.placeholder = 'Password (min. 6 characters)';


        if (isLoginMode) {
             // Transition to Login Form UI
            if (titleEl) titleEl.textContent = 'Login';
            if (greetingEl) greetingEl.textContent = 'Welcome Back!';
            if (messageEl) messageEl.innerHTML = `Login to access your personalized learning experience.`;
            if (nameInputGroup) nameInputGroup.style.display = 'none';
            if (authNameInput) authNameInput.required = false; // Name not required for login
            if (signupFields) signupFields.style.display = 'none';
            if (submitBtn) submitBtn.textContent = 'Login';
            if (toggleLink) toggleLink.innerHTML = `New user? <a href="#" onclick="event.preventDefault(); window.toggleAuthMode(false);">Sign Up</a>`; // Use window.
        } else { // Sign Up mode (information page)
            // Transition to Sign-up/Information Form UI
            if (titleEl) titleEl.textContent = 'Create Account';
            if (greetingEl) greetingEl.textContent = 'Join Conceptra!';
            if (messageEl) messageEl.innerHTML = `Create an account to save your progress and unlock all features.`;
            if (nameInputGroup) nameInputGroup.style.display = 'flex'; // Show name input group (assuming flex)
            if (authNameInput) authNameInput.required = true; // Name required for sign-up
            if (signupFields) signupFields.style.display = 'block'; // Show extra signup fields (assuming block)
            if (submitBtn) submitBtn.textContent = 'Create Account';
            if (toggleLink) toggleLink.innerHTML = `Already have an account? <a href="#" onclick="event.preventDefault(); window.toggleAuthMode(true);">Login</a>`; // Use window.
        }
    };

    function getAuthErrorMessage(error) {
        console.warn("DEBUG_MERGE: Firebase Auth Error object for getAuthErrorMessage:", error);
        switch (error.code) {
            case 'auth/invalid-email':
                return 'Invalid email format.';
            case 'auth/user-disabled':
                return 'This user account has been disabled.';
            case 'auth/user-not-found':
                return 'No user found with this email. Please sign up or check your email.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/email-already-in-use':
                return 'This email is already registered. Please login or use a different email.';
            case 'auth/weak-password':
                return 'Password is too weak. It should be at least 6 characters long.';
            case 'auth/requires-recent-login':
                return 'This operation is sensitive and requires recent authentication. Please log in again.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please try again later.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection and try again.';
            default:
                return error.message || 'An unknown authentication error occurred. Please try again.';
        }
    }
    // --- END AUTHENTICATION & PROFILE MANAGEMENT LOGIC ---


    // --- VIDEO WATCH FEATURE (FROM New File.js) ---
    // Contains logic for fetching video data and handling purchases/playback
    let wvAppData = {};
    let wvNavigationStack = [];
    let wvIsAnimating = false;
    let wvYtPlayer;
    let currentOpenVideoIdForComments = null;
    let currentOpenVideoTitleForComments = null;

    function initWatchVideoFeature() {
        console.log("DEBUG_MERGE: initWatchVideoFeature called.");
        const screen = document.getElementById('watch-video-screen');
        if (!screen || screen.dataset.initialized) {
             console.log("DEBUG_MERGE: Watch Video feature already initialized or screen not found.");
             return;
        }
        screen.dataset.initialized = 'true';
        console.log("DEBUG_MERGE: Watch Video feature initializing...");

        const pageContainer = screen.querySelector('.wv-page-container');
        const header = screen.querySelector('.wv-header');
        const headerTitle = screen.querySelector('.wv-header-title');
        const backButton = screen.querySelector('.wv-back-button');
        const popupOverlay = screen.querySelector('.wv-popup-overlay');
        const popupCloseBtn = screen.querySelector('.wv-popup-close-btn');

        // --- CHANGE START: showVideoPlayerPage को फीचर के स्कोप में Attach करें ---
        // ताकि इसे handleVideoItemClick जैसे बाहरी फंक्शन से एक्सेस किया जा सके
        screen.showVideoPlayerPage = showVideoPlayerPage;
        console.log("DEBUG_MERGE: showVideoPlayerPage attached to screen element.");
        // --- CHANGE END ---

        async function fetchData() {
            console.log("DEBUG_MERGE: Fetching video data...");
            showLoader();
            try {
                // Use the globally managed db object
                const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);

                wvAppData = {}; // Clear previous data

                querySnapshot.forEach((doc) => {
                    const video = doc.data();
                    const videoWithId = { ...video, firestoreDocId: doc.id };
                    console.log("DEBUG_MERGE: Processing video:", videoWithId.title, videoWithId.firestoreDocId);

                    // Basic validation to skip malformed documents
                    if (!videoWithId.board || !videoWithId.class || !videoWithId.subject || !videoWithId.teacherName || !videoWithId.chapter || !videoWithId.title || !videoWithId.youtubeVideoID) {
                        console.warn("DEBUG_MERGE: Skipping malformed video document:", videoWithId.firestoreDocId, videoWithId);
                        return; // Correctly skips this iteration in forEach
                    }

                    const board = videoWithId.board;
                    const teacher = videoWithId.teacherName;
                    const subject = videoWithId.subject;
                    const chapter = videoWithId.chapter;

                    // Build the nested structure
                    if (!wvAppData[board]) wvAppData[board] = {};
                    if (!wvAppData[board][teacher]) wvAppData[board][teacher] = {};
                    if (!wvAppData[board][teacher][subject]) wvAppData[board][teacher][subject] = {};
                    if (!wvAppData[board][teacher][subject][chapter]) wvAppData[board][teacher][subject][chapter] = [];

                    // --- CHANGE START: Price और firestoreDocId को वीडियो डेटा में शामिल करें ---
                    // Push video data with necessary fields
                    wvAppData[board][teacher][subject][chapter].push({
                        title: videoWithId.title,
                        videoNo: videoWithId.videoNo || null,
                        videoId: videoWithId.youtubeVideoID, // This is the YouTube ID
                        teacher: videoWithId.teacherName,
                        // Ensure price is treated as 0 if not provided
                        price: videoWithId.price === undefined ? 0 : videoWithId.price,
                        firestoreDocId: videoWithId.firestoreDocId, // Firestore document ID for purchase tracking
                         board: board, // Add path info for back navigation if needed
                         class: videoWithId.class,
                         subject: subject,
                         chapter: chapter
                    });
                    // --- CHANGE END ---
                });

                hideLoader();
                console.log("DEBUG_MERGE: Video data fetched successfully. App data structure:", wvAppData);
                // Render the initial page
                renderVideoPage([], 'Explore Videos', true);

            } catch (error) {
                console.error("DEBUG_MERGE: Error fetching videos from Firebase: ", error);
                hideLoader(); // Ensure loader is hidden even on error
                if (pageContainer) pageContainer.innerHTML = `<div class="wv-loader">Failed to load videos. Please check your connection or app configuration.</div>`;
            }
        }

        // --- MODIFIED renderVideoPage function for back button ---
        function renderVideoPage(path, title, isFirstPage = false, direction = 'forward') {
            console.log(`DEBUG_MERGE: renderVideoPage called. Path: [${path.join(', ')}], Title: "${title}", First Page: ${isFirstPage}, Direction: ${direction}`);
            if (wvIsAnimating) {
                 console.log("DEBUG_MERGE: Animation in progress, skipping renderPage call.");
                 return;
            }
            wvIsAnimating = true;
            console.log("DEBUG_MERGE: Setting wvIsAnimating to true.");


            if(!pageContainer || !header || !headerTitle) {
                console.error("DEBUG_MERGE: Watch Video DOM elements not found for rendering.");
                wvIsAnimating = false; // Reset flag on error
                return;
            }

            // Hide header for the video player page, show for other list/detail pages
             if (path.length > 3) { // Assuming path structure is [board, teacher, subject, chapter] -> videos
                 pageContainer.classList.add('no-header');
                 header.style.display = 'none';
             } else {
                 pageContainer.classList.remove('no-header');
                 header.style.display = 'flex';
             }


            const oldPage = pageContainer.querySelector('.wv-page');
            const newPage = document.createElement('div');
            newPage.className = 'wv-page';

            let dataToShow = wvAppData;
            try {
                 dataToShow = path.reduce((level, key) => level?.[key], wvAppData);
            } catch (e) {
                 console.error("DEBUG_MERGE: Error reducing path for video data:", e, "Path:", path);
                 dataToShow = null; // Indicate data not found
            }


            if (!dataToShow || (Array.isArray(dataToShow) && dataToShow.length === 0) || (typeof dataToShow === 'object' && Object.keys(dataToShow).length === 0)) {
                 console.warn("DEBUG_MERGE: No content found for path:", path);
                 newPage.innerHTML = `<div class="wv-loader">No content found here.</div>`;
            } else if (Array.isArray(dataToShow)) { // This means we are at the video list level
                console.log("DEBUG_MERGE: Rendering video list.");
                // Sort videos by videoNo if available
                dataToShow.sort((a, b) => (a.videoNo || Infinity) - (b.videoNo || Infinity));
                dataToShow.forEach(video => {
                    // Ensure video object has necessary properties before creating item
                    if (video && video.videoId && video.title) {
                        newPage.appendChild(createVideoItem(video));
                    } else {
                        console.warn("DEBUG_MERGE: Skipping malformed video item due to missing videoId or title:", video);
                    }
                });
            } else if (dataToShow && typeof dataToShow === 'object') { // Rendering category/folder list
                console.log("DEBUG_MERGE: Rendering category/folder list.");
                 // Sort keys alphabetically for consistent display
                 Object.keys(dataToShow).sort().forEach(key => {
                     // Check if this level has a 'comingSoon' property (e.g., board or teacher level)
                     const itemData = dataToShow[key];
                      if (itemData?.comingSoon) {
                         newPage.appendChild(createListItem({ title: key, path: [...path, key], comingSoon: true }, title));
                      } else {
                          newPage.appendChild(createListItem({ title: key, path: [...path, key] }, title));
                      }
                 });
            } else {
                 console.error("DEBUG_MERGE: Unexpected data structure for path:", path, "Data:", dataToShow);
                 newPage.innerHTML = `<div class="wv-loader">Unexpected data structure.</div>`;
            }


             pageContainer.appendChild(newPage); // Append the new page before animation

            const animInClass = direction === 'forward' ? 'animate-in' : 'animate-in-back';
            const animOutClass = direction === 'forward' ? 'animate-out' : 'animate-out-back';

            if (oldPage) {
                 oldPage.classList.add(animOutClass);
                 oldPage.classList.remove('active'); // Deactivate old page immediately for screen reader/interaction
            }
            newPage.classList.add('active', animInClass); // Activate and animate in new page

            // Update header title after adding new page (so it's visible during transition)
             headerTitle.textContent = title;
             // Back button logic: show if not on the very first explore page
             if(backButton) {
                 backButton.style.display = path.length > 0 || !isFirstPage ? 'block' : 'none';
             }


            // Clean up animation classes and old page after transition
            const onTransitionEnd = () => {
                 newPage.classList.remove(animInClass);
                 if (oldPage) {
                     oldPage.classList.remove(animOutClass);
                     oldPage.remove(); // Remove the old page from DOM
                 }
                 newPage.removeEventListener('transitionend', onTransitionEnd);
                 if (oldPage) oldPage.removeEventListener('transitionend', onTransitionEnd);
                 wvIsAnimating = false; // Reset flag after animation
                 console.log("DEBUG_MERGE: Animation ended, wvIsAnimating is false.");
            };

            // Attach transitionend listener to the *new* page
             newPage.addEventListener('transitionend', onTransitionEnd);
             // Add listener to old page too, in case it finishes last (e.g., on slow devices)
             if (oldPage) oldPage.addEventListener('transitionend', onTransitionEnd);

             // Fallback timeout just in case transitionend doesn't fire
             setTimeout(() => {
                 if (wvIsAnimating) {
                      console.warn("DEBUG_MERGE: Transitionend fallback timeout triggered.");
                     newPage.classList.remove(animInClass);
                      if (oldPage) {
                          oldPage.classList.remove(animOutClass);
                          oldPage.remove();
                     }
                     wvIsAnimating = false;
                 }
             }, 600); // Slightly longer than CSS transition duration (0.35s)

        }
        // --- END MODIFIED renderVideoPage function ---


        function createListItem(item, currentTitle) {
            const div = document.createElement('div');
            div.className = 'wv-list-item';
            div.innerHTML = `<span>${item.title}</span><span class="arrow-icon"><svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"></path></svg></span>`;

            if (item.comingSoon) {
                 div.classList.add('coming-soon'); // Add a class for styling
                 div.innerHTML = `<span>${item.title} <small>(Coming Soon)</small></span>`; // Update HTML
                div.onclick = () => alert('This section is coming soon!');
            } else {
                div.onclick = () => {
                    // Push current state (the page *before* clicking this item) onto the stack
                    wvNavigationStack.push({ path: path.slice(0, path.length), title: currentTitle });
                    renderVideoPage(item.path, item.title); // Render the page for the item's path
                };
            }
            return div;
        }

        // --- CHANGE START: कीमत दिखाने और खरीदने की प्रक्रिया शुरू करने के लिए Video Item को अपडेट करें ---
        function createVideoItem(video) { // video object here should have videoId (YouTube ID), title, price, firestoreDocId, teacher, etc.
            const div = document.createElement('div');
            div.className = 'wv-video-item';
            const videoNumberPrefix = video.videoNo ? `Video ${video.videoNo}: ` : '';

            let priceHtml = '';
            if (video.price && video.price > 0) {
                priceHtml = `<span class="wv-video-price"><i class="fa-solid fa-coins"></i> ${video.price}</span>`;
            } else {
                priceHtml = `<span class="wv-video-price free">Free</span>`;
            }
            // console.log("DEBUG_MERGE: createVideoItem: Video object for item creation:", JSON.stringify(video)); // Log to check video object
            div.innerHTML = `
                <div class="wv-video-thumbnail-container">
                    <img class="wv-video-thumbnail" src="https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg" alt="${video.title} thumbnail">
                    ${video.price > 0 ? `<span class="wv-premium-badge"><i class="fa-solid fa-star"></i> Premium</span>` : ''}
                </div>
                <div class="wv-video-info">
                    <h3>${videoNumberPrefix}${video.title}</h3>
                    <p>Teacher: ${video.teacher || 'N/A'}</p>
                    <div class="wv-video-meta">
                        ${priceHtml}
                    </div>
                </div>`;

            // Attach click handler using window.handleVideoItemClick
            div.onclick = () => window.handleVideoItemClick(video);
            return div;
        }
        // --- CHANGE END ---


        // showVideoPlayerPage function (FROM New File.js - Kept as is, attached to screen element)
        function showVideoPlayerPage(video) { // video object here comes from handleVideoItemClick
             console.log("DEBUG_MERGE: showVideoPlayerPage called for video:", video);

             if (wvIsAnimating) {
                  console.log("DEBUG_MERGE: Animation in progress, skipping showVideoPlayerPage.");
                  return;
             }
             wvIsAnimating = true;
             console.log("DEBUG_MERGE: Setting wvIsAnimating to true.");

             // Capture the current list/detail page state before navigating to player
             const currentTitle = headerTitle ? headerTitle.textContent : "Explore Videos";
             const currentPath = wvNavigationStack.length > 0 ? [...wvNavigationStack[wvNavigationStack.length - 1].path] : []; // Copy the path from the previous state

             // Find the path for the current list view (e.g., [board, teacher, subject, chapter])
             // We need to reconstruct this from the video object itself, which contains board, subject, teacher, chapter
             const videoListPath = [video.board, video.teacher, video.subject, video.chapter];

             // Push the state of the *list page* onto the stack so we can go back to it
             // Use the path determined from the video object's properties
             wvNavigationStack.push({ path: videoListPath, title: `${video.chapter || 'Videos'}` }); // Use chapter name as title for back button


            if(header) header.style.display = 'none'; // Hide header for player page
            if(pageContainer) pageContainer.classList.add('no-header'); // Add class for styles

            const oldPage = pageContainer ? pageContainer.querySelector('.wv-page') : null;
            const newPage = document.createElement('div');
            newPage.className = 'wv-page active animate-in'; // Add animation classes

            // Ensure video.videoId (YouTube ID) and video.title are present for the player and comments button
            if (!video || !video.videoId || !video.title) {
                console.error("DEBUG_MERGE: showVideoPlayerPage: videoId or title is missing from video object:", video);
                newPage.innerHTML = `<div class="wv-loader">Error: Video data is incomplete. Cannot play video or show comments.</div>`;
                // Handle animation cleanup for error state
                if (oldPage) {
                    oldPage.classList.remove('active');
                    oldPage.classList.add('animate-out');
                     oldPage.addEventListener('transitionend', () => oldPage.remove(), { once: true });
                }
                if(pageContainer) pageContainer.appendChild(newPage);
                 newPage.classList.remove('animate-in'); // Remove animation class if no content rendered

                 // Add a basic back button for the error state
                const backBtnTemp = document.createElement('button');
                backBtnTemp.className = 'wv-back-button';
                backBtnTemp.innerHTML = "← Go Back";
                backBtnTemp.style.cssText = "color: var(--text-dark); margin: 20px; font-size: 1.5rem; background: none; border: none; cursor: pointer;";
                 newPage.insertBefore(backBtnTemp, newPage.firstChild);
                backBtnTemp.addEventListener('click', goBackFromVideoPlayer); // Attach click handler
                wvIsAnimating = false; // Reset flag
                return;
            }

            const videoSrc = `https://www.youtube.com/embed/${video.videoId}?enablejsapi=1&autoplay=1&controls=1&rel=0&showinfo=0&modestbranding=1&playsinline=1&origin=${window.location.origin}`;
            newPage.innerHTML = `
                <div class="wv-video-player-wrapper">
                   <div class="wv-video-overlay"></div>
                   <!-- <div class="wv-corner-patch">Full Screen</div> --> <!-- Removed as YouTube controls handle this -->
                   <iframe class="wv-player-iframe" src="${videoSrc}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>
                <div class="wv-video-details">
                    <!-- This back button uses goBackFromVideoPlayer -->
                    <button class="wv-back-button" style="color: var(--text-dark); margin: 0 0 15px -5px; font-size: 2rem; background: none; border: none; cursor: pointer;">← Go Back</button>
                    <h2>${video.title}</h2><p>Teacher: ${video.teacher || 'N/A'}</p>
                </div>
                <div class="wv-actions-bar" style="padding: 15px 5px;">
                    <!-- Use window.openCommentsPage to ensure global access -->
                    <button class="btn btn-primary" onclick="window.openCommentsPage('${video.videoId}', '${video.title.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-comments"></i> View Comments
                    </button>
                </div>
            `;

             // Handle animation cleanup for successful state
            if (oldPage) {
                 oldPage.classList.remove('active');
                 oldPage.classList.add('animate-out');
                 oldPage.addEventListener('transitionend', () => oldPage.remove(), { once: true });
            }
            if(pageContainer) pageContainer.appendChild(newPage);

             // Add transitionend listener to the *new* page for its specific animation class cleanup
             const onNewPageTransitionEnd = () => {
                 newPage.classList.remove('animate-in');
                 newPage.removeEventListener('transitionend', onNewPageTransitionEnd);
                 wvIsAnimating = false; // Reset flag after new page animation
                 console.log("DEBUG_MERGE: New page animation ended, wvIsAnimating is false.");
             };
             newPage.addEventListener('transitionend', onNewPageTransitionEnd);

              // Fallback timeout
              setTimeout(() => {
                   if (wvIsAnimating) {
                       console.warn("DEBUG_MERGE: Transitionend fallback timeout for new page triggered.");
                       newPage.classList.remove('animate-in');
                       wvIsAnimating = false;
                   }
              }, 600);


            // Removed corner patch as standard controls usually handle full screen now
            // const cornerPatch = newPage.querySelector('.wv-corner-patch');
            // if (cornerPatch) cornerPatch.addEventListener('click', showPopup);

            const videoPlayerBackBtn = newPage.querySelector('.wv-back-button');
            if (videoPlayerBackBtn) videoPlayerBackBtn.addEventListener('click', goBackFromVideoPlayer);

            const playerElement = newPage.querySelector('.wv-player-iframe');
            // Check if YT IFrame API is loaded before creating player
            if (playerElement && typeof YT !== 'undefined' && YT.Player) {
                wvYtPlayer = new YT.Player(playerElement, {
                    events: {
                        'onStateChange': onPlayerStateChange,
                         'onError': onPlayerError // Add error handling
                    }
                });
                console.log("DEBUG_MERGE: YouTube Player initialized.");
            } else {
                console.warn("DEBUG_MERGE: YouTube IFrame API not loaded yet or player element not found. Player events might not work.");
                 // Attempt to load API if not present? (More complex, maybe skip for merge simplicity)
            }
        }

         // Add YT Player Error Handling
         function onPlayerError(event) {
             let errorMessage = "An error occurred with the video player.";
             switch(event.data) {
                 case 2: errorMessage = "The video ID is invalid or the video does not exist."; break;
                 case 5: errorMessage = "The requested content cannot be played in an HTML5 player or at this size."; break;
                 case 100: errorMessage = "The video was not found."; break;
                 case 101: // fallthrough
                 case 105: errorMessage = "The owner of the requested video does not allow it to be played in embedded players."; break;
                 case 150: errorMessage = "This video is unavailable. Please try again later."; break;
             }
             console.error("DEBUG_MERGE: YouTube Player Error:", event.data, errorMessage);
             const playerWrapper = document.querySelector('.wv-video-player-wrapper');
             if(playerWrapper) {
                  playerWrapper.innerHTML = `<p style="color: var(--color-red); text-align:center; padding: 20px;">${errorMessage}</p>`;
             } else {
                 alert(errorMessage);
             }
         }


        function onPlayerStateChange(event) {
            console.log("DEBUG_MERGE: YT Player State Change:", event.data);
            const overlay = document.querySelector('#watch-video-screen .wv-video-overlay');
            const cornerPatch = document.querySelector('#watch-video-screen .wv-corner-patch');

            if (event.data == YT.PlayerState.PLAYING) {
                // Hide overlay and corner patch shortly after playing starts
                if (overlay) overlay.classList.add('hidden');
                if (cornerPatch) cornerPatch.classList.add('hidden');

            } else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.BUFFERING) {
                 // Show overlay (maybe semi-transparent) and corner patch when paused/buffering
                 if (overlay) overlay.classList.remove('hidden');
                 // if (cornerPatch) cornerPatch.classList.remove('hidden'); // Decide if you want patch visible on pause
            } else { // State like CUED, ENDED
                 if (overlay) overlay.classList.remove('hidden');
                 // if (cornerPatch) cornerPatch.classList.remove('hidden');
            }
        }

        function showPopup() { if(popupOverlay) popupOverlay.classList.add('visible'); }
        function hidePopup() { if(popupOverlay) popupOverlay.classList.remove('visible'); }

        // Modified goBackWV for general navigation within Watch Video feature
        window.goBackWV = function() { // Make globally accessible for back button onclick
            console.log("DEBUG_MERGE: goBackWV called. Stack size:", wvNavigationStack.length);
            if (wvIsAnimating) {
                 console.log("DEBUG_MERGE: Animation in progress, skipping goBackWV.");
                 return;
            }

            const lastState = wvNavigationStack.pop();
            if (lastState) {
                 console.log(`DEBUG_MERGE: Popped state: Path=[${lastState.path.join(', ')}], Title="${lastState.title}". Rendering...`);
                 renderVideoPage(lastState.path, lastState.title, lastState.path.length === 0 && lastState.title === "Explore Videos", 'backward');
            } else {
                 console.log("DEBUG_MERGE: Navigation stack is empty. Going back to home.");
                showScreen('home-screen', true); // Go back to home if stack is empty
            }
        }

        // Specific goBack function when coming FROM the video player
        function goBackFromVideoPlayer() {
            console.log("DEBUG_MERGE: goBackFromVideoPlayer called. Stack size before pop:", wvNavigationStack.length);
            if (wvIsAnimating) {
                 console.log("DEBUG_MERGE: Animation in progress, skipping goBackFromVideoPlayer.");
                 return;
            }

             // Destroy YouTube player instance to free up resources
            if (wvYtPlayer && typeof wvYtPlayer.destroy === 'function') {
                try {
                     console.log("DEBUG_MERGE: Destroying YouTube player.");
                    wvYtPlayer.destroy();
                } catch (e) {
                    console.warn("DEBUG_MERGE: Error destroying YouTube player:", e);
                }
                wvYtPlayer = null; // Clear player reference
            }

            const lastState = wvNavigationStack.pop();
            if (lastState) {
                 console.log(`DEBUG_MERGE: Popped state for player back: Path=[${lastState.path.join(', ')}], Title="${lastState.title}". Rendering...`);
                // Determine if the state we are going back to is the top-level "Explore Videos" page
                 const isTopLevel = lastState.path.length === 0 && lastState.title === "Explore Videos";
                renderVideoPage(lastState.path, lastState.title, isTopLevel, 'backward');
            } else {
                // This case should ideally not happen if player page was pushed correctly
                console.error("DEBUG_MERGE: Navigation stack empty when going back from player. Unexpected state. Redirecting to home.");
                showScreen('home-screen', true);
            }
             console.log("DEBUG_MERGE: After goBackFromVideoPlayer. Stack size:", wvNavigationStack.length);
        }


        function setupEventListeners() {
            console.log("DEBUG_MERGE: Watch Video: Setting up event listeners.");
            // Ensure backButton element exists before adding listener
            const headerBackButton = screen.querySelector('.wv-header .wv-back-button');
            if(headerBackButton) {
                headerBackButton.addEventListener('click', window.goBackWV); // Use the general goBackWV
                 console.log("DEBUG_MERGE: Attached listener to header back button.");
            } else {
                console.warn("DEBUG_MERGE: Watch Video header back button not found.");
            }

             // Ensure popupCloseBtn element exists before adding listener
            if(popupCloseBtn) {
                popupCloseBtn.addEventListener('click', hidePopup);
                 console.log("DEBUG_MERGE: Attached listener to popup close button.");
            } else {
                 console.warn("DEBUG_MERGE: Watch Video popup close button not found.");
            }
             // Listener for the popup overlay itself to close when clicked outside content
            if(popupOverlay) {
                popupOverlay.addEventListener('click', function(event) {
                     // Check if the click was directly on the overlay, not its content
                    if (event.target === popupOverlay) {
                        hidePopup();
                    }
                });
                 console.log("DEBUG_MERGE: Attached listener to popup overlay.");
            } else {
                console.warn("DEBUG_MERGE: Watch Video popup overlay not found.");
            }
        }

        function showLoader() {
             console.log("DEBUG_MERGE: Showing Watch Video loader.");
            if(pageContainer) pageContainer.innerHTML = `<div class="wv-loader">Loading your library...</div>`;
        }
        function hideLoader() {
             console.log("DEBUG_MERGE: Hiding Watch Video loader.");
            const wvLoaderElement = screen.querySelector('.wv-loader');
            if (wvLoaderElement) wvLoaderElement.remove();
        }

        // Initial call to fetch data and render the first page
        fetchData();
        setupEventListeners();
        console.log("DEBUG_MERGE: initWatchVideoFeature finished.");
    }

    // --- VIDEO COMMENTS FEATURE (FROM New File.js) ---
    // Uses Firestore collections structured under video_comments/{videoId}/comments/{commentId}/replies
     window.openCommentsPage = async function(videoId, videoTitle) { // Make globally accessible
         console.log(`DEBUG_MERGE: openCommentsPage called for Video ID: ${videoId}, Title: "${videoTitle}"`);
         currentOpenVideoIdForComments = videoId;
         currentOpenVideoTitleForComments = videoTitle; // Store for later use (e.g., submitting comments)

         const commentsScreen = document.getElementById('comments-screen');
         if (!commentsScreen) {
             console.error("DEBUG_MERGE: Comments screen div not found!");return;
         }

         // Save current screen state to go back
         const prevPageId = activePage; // The screen *before* comments (e.g., watch-video-screen)
         wvNavigationStack.push({ customBackFunction: 'goBackFromComments', args: [prevPageId] }); // Use a custom back handler

         commentsScreen.innerHTML = `
             <header class="app-header">
                 <!-- Use the specific back function for comments -->
                 <div class="header-icon" onclick="window.goBackFromComments()"><i class="fa-solid fa-arrow-left"></i></div>
                 <h1 class="app-title">Comments for ${videoTitle}</h1>
             </header>
             <main class="main-content">
                 <div id="comments-list-container" style="margin-bottom: 20px; max-height: 60vh; overflow-y: auto; padding-right: 5px;"> <!-- Added padding-right for scrollbar -->
                     <p style="text-align:center; color: var(--text-muted-color);">Loading comments...</p>
                 </div>
                 <div class="new-comment-section" style="padding:10px; background-color: var(--surface); border-radius: 8px; border: 1px solid var(--border-color);">
                     <textarea id="new-comment-input" placeholder="Add a comment..." style="width: 100%; min-height: 80px; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 10px; font-family: 'Poppins', sans-serif; box-sizing: border-box; resize: vertical;"></textarea>
                     <!-- Use window.submitNewComment -->
                     <button class="btn btn-primary" style="width: 100%;" onclick="window.submitNewComment()">Post Comment</button>
                 </div>
             </main>
         `;
         // Use the main app's showScreen function
         showScreen('comments-screen');
         // Load and render comments after the screen transition starts
          setTimeout(() => {
              renderCommentsView(videoId);
         }, 50); // Small delay to allow screen to become active
         console.log("DEBUG_MERGE: Comments screen displayed.");
     }

     // Specific back function for comments screen
     window.goBackFromComments = function() { // Make globally accessible
         console.log("DEBUG_MERGE: goBackFromComments called.");
         // This function assumes the previous screen was 'watch-video-screen' or similar.
         // We should just go back to the 'watch-video-screen' as the standard practice
         // within this feature, regardless of the stack state before comments.
          showScreen('watch-video-screen', true); // Go back to the video list/player screen
         // Note: The commented out stack logic in the original file was complex and might not be needed here.
         // A simple transition back to the parent feature screen is usually sufficient.
         // If more complex back navigation *within* the video feature is needed, the wvNavigationStack
         // handling would need to be adjusted. For now, the simplest approach is to go back to the feature root.
     }


    async function renderCommentsView(videoId) {
        console.log(`DEBUG_MERGE: renderCommentsView called for Video ID: ${videoId}`);
        const commentsListContainer = document.getElementById('comments-list-container');
        if (!commentsListContainer) {
             console.error("DEBUG_MERGE: Comments list container not found!");
             return;
        }
        commentsListContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">Loading comments...</p>';

        try {
            // Use the globally managed db object
            const commentsCol = collection(db, `video_comments/${videoId}/comments`);
            const q = query(commentsCol, orderBy("timestamp", "asc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                commentsListContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No comments yet. Be the first to comment!</p>';
                console.log("DEBUG_MERGE: No comments found.");
                return;
            }

            let commentsHtml = '';
            for (const commentDoc of querySnapshot.docs) {
                const comment = commentDoc.data();
                comment.id = commentDoc.id;
                 console.log("DEBUG_MERGE: Rendering comment:", comment.id, comment.text);

                // Fetch replies for each comment
                const repliesCol = collection(db, `video_comments/${videoId}/comments/${comment.id}/replies`);
                const repliesQuery = query(repliesCol, orderBy("timestamp", "asc"));
                const repliesSnapshot = await getDocs(repliesQuery);
                let repliesHtml = '<div class="replies-container" style="margin-left: 20px; margin-top:10px; border-left: 2px solid var(--border-color); padding-left: 10px;">'; // Added styling for replies container
                repliesSnapshot.forEach(replyDoc => {
                    const reply = replyDoc.data();
                    reply.id = replyDoc.id;
                     console.log("DEBUG_MERGE: Rendering reply:", reply.id, reply.text);
                    // Render each reply
                    repliesHtml += renderSingleCommentOrReply(reply, videoId, comment.id, true);
                });
                repliesHtml += '</div>';

                // Render the main comment including its replies HTML
                commentsHtml += renderSingleCommentOrReply(comment, videoId, null, false, repliesHtml);
            }
            commentsListContainer.innerHTML = commentsHtml;
             // Scroll to the bottom after rendering all comments
             setTimeout(() => { // Use timeout to ensure DOM is updated and rendered
                 commentsListContainer.scrollTop = commentsListContainer.scrollHeight;
                 console.log("DEBUG_MERGE: Scrolled comments to bottom.");
             }, 100); // Small delay

             console.log(`DEBUG_MERGE: Rendered ${querySnapshot.size} comments.`);

        } catch (error) {
            console.error("DEBUG_MERGE: Error fetching comments: ", error);
            commentsListContainer.innerHTML = '<p style="color: var(--color-red); text-align:center;">Could not load comments. Please try again later.</p>';
        }
    }

    function renderSingleCommentOrReply(item, videoId, parentCommentId = null, isReply = false, repliesHtmlContent = '') {
        // Get the current user's UID using the global auth object
        const currentUserForComment = auth.currentUser;
        let currentUserId = currentUserForComment ? currentUserForComment.uid : null; // Use null if not logged in
        // Fallback to legacy/guest ID for display purposes if needed, but deletion check should use Firebase UID

        const itemDate = item.timestamp instanceof Timestamp ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date()); // Handle both Timestamp and potential number/string timestamps
        const formattedDate = itemDate.toLocaleString();

        let html = `
            <div class="${isReply ? 'reply-item' : 'comment-item'}" id="${isReply ? 'reply-' : 'comment-'}${item.id}" style="padding: 10px; margin-bottom: 10px; background-color: var(--surface); border-radius: 8px; border: 1px solid var(--border-color);">
                <div class="comment-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 0.9em;">
                    <strong style="color: var(--primary);">${item.userName || 'User'}</strong>
                    <small style="color: var(--text-muted-color);">${formattedDate}</small>
                </div>
                <p class="comment-text" style="white-space: pre-wrap; word-break: break-word; margin-bottom: 8px;">${item.text}</p>
                <div class="comment-actions" style="display flex; gap: 10px; font-size: 0.9em;">`;

        // Add Reply button only for main comments if not a reply itself
        if (!isReply) {
            html += `<button class="btn-link" onclick="window.showReplyInputForm('${item.id}', '${videoId}')" style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 0; font-size: inherit;">Reply</button>`; // Use window.
        }

        // Add Delete button only if the current logged-in user is the author
        if (currentUserId && currentUserId === item.userId) {
             // Use window.deleteCommentOrReply and pass parentCommentId if it's a reply
            html += `<button class="btn-link-danger" onclick="window.deleteCommentOrReply('${item.id}', '${videoId}', ${isReply ? `'${parentCommentId}'` : 'null'})" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 0; font-size: inherit;">Delete</button>`; // Use window.
        }

        html += `   </div>
                <div id="reply-form-${item.id}" class="reply-form-container" style="display:none; margin-top:10px;"></div>
                ${isReply ? '' : repliesHtmlContent} <!-- Insert replies HTML only for the main comment -->
            </div>`;
        return html;
    }

    // Show reply input form (FROM New File.js)
    window.showReplyInputForm = function(commentId, videoId) { // Make globally accessible
         console.log(`DEBUG_MERGE: showReplyInputForm called for comment ID: ${commentId}`);
        // Hide all other reply forms
        const allReplyForms = document.querySelectorAll('.reply-form-container');
        allReplyForms.forEach(form => {
            if (form.id !== `reply-form-${commentId}`) {
                form.style.display = 'none';
                form.innerHTML = ''; // Clear content when hiding
            }
        });

        const replyFormContainer = document.getElementById(`reply-form-${commentId}`);
        if (replyFormContainer) {
            if (replyFormContainer.style.display === 'none') {
                 console.log("DEBUG_MERGE: Showing reply form.");
                replyFormContainer.style.display = 'block';
                replyFormContainer.innerHTML = `
                    <textarea id="reply-input-${commentId}" placeholder="Write a reply..." style="width: 100%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 8px; font-family: 'Poppins', sans-serif; box-sizing: border-box; resize: vertical;"></textarea>
                    <div style="text-align: right;">
                        <!-- Use window.hideReplyInputForm and window.submitReply -->
                        <button class="btn btn-secondary" style="width: auto; padding: 5px 10px; font-size: 0.9em; margin-left: 5px;" onclick="window.hideReplyInputForm('${commentId}')">Cancel</button>
                        <button class="btn btn-primary" style="width: auto; padding: 5px 10px; font-size: 0.9em;" onclick="window.submitReply('${commentId}', '${videoId}')">Post Reply</button>
                    </div>
                `;
                // Focus the textarea after showing
                const input = document.getElementById(`reply-input-${commentId}`);
                if (input) input.focus();
            } else {
                 console.log("DEBUG_MERGE: Hiding reply form.");
                replyFormContainer.style.display = 'none';
                replyFormContainer.innerHTML = ''; // Clear content when hiding
            }
        } else {
             console.error(`DEBUG_MERGE: Reply form container for comment ID ${commentId} not found.`);
        }
    }

    // Hide reply input form (FROM New File.js)
    window.hideReplyInputForm = function(commentId) { // Make globally accessible
        console.log(`DEBUG_MERGE: hideReplyInputForm called for comment ID: ${commentId}`);
         const replyFormContainer = document.getElementById(`reply-form-${commentId}`);
         if(replyFormContainer) {
             replyFormContainer.style.display = 'none';
             replyFormContainer.innerHTML = '';
              console.log("DEBUG_MERGE: Reply form hidden.");
         } else {
             console.warn(`DEBUG_MERGE: Reply form container for comment ID ${commentId} not found when trying to hide.`);
         }
    }

    // Submit new main comment (FROM New File.js)
    window.submitNewComment = async function() { // Make globally accessible
        console.log("DEBUG_MERGE: submitNewComment called.");
        const commentInput = document.getElementById('new-comment-input');
        if (!commentInput) {
             console.error("DEBUG_MERGE: New comment input element not found.");
             return;
        }
        const text = commentInput.value.trim();
        // Check if currentOpenVideoIdForComments is set
        if (!text || !currentOpenVideoIdForComments) {
            console.log("DEBUG_MERGE: Comment text is empty or video ID is not set. Aborting.");
            return;
        }

        // Use the globally managed auth object
        const currentUserForComment = auth.currentUser;
        if (!currentUserForComment) {
            console.log("DEBUG_MERGE: User not logged in. Redirecting to login.");
            alert("Please log in to comment.");
            isLoginMode = true; // Set to login mode
            if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                 window.toggleAuthMode(isLoginMode);
                 window.showScreen('login-screen');
            }
            return;
        }

        try {
            console.log(`DEBUG_MERGE: Adding new comment to video ${currentOpenVideoIdForComments}...`);
            // Use the globally managed db object
            const commentsCol = collection(db, `video_comments/${currentOpenVideoIdForComments}/comments`);
            await addDoc(commentsCol, {
                userId: currentUserForComment.uid,
                userName: currentUserForComment.displayName || 'Conceptra User', // Use display name or default
                text: text,
                timestamp: serverTimestamp() // Use server timestamp
            });
            console.log("DEBUG_MERGE: New comment added successfully.");
            commentInput.value = ''; // Clear the input field
            await renderCommentsView(currentOpenVideoIdForComments); // Refresh comments list
        } catch (error) {
            console.error("DEBUG_MERGE: Error posting comment: ", error);
            alert("Failed to post comment.");
        }
    }

    // Submit reply to a comment (FROM New File.js)
    window.submitReply = async function(parentCommentId, videoId) { // Make globally accessible
        console.log(`DEBUG_MERGE: submitReply called for parent comment ID: ${parentCommentId}, Video ID: ${videoId}`);
        const replyInput = document.getElementById(`reply-input-${parentCommentId}`);
        if (!replyInput) {
             console.error(`DEBUG_MERGE: Reply input element for comment ID ${parentCommentId} not found.`);
             return;
        }
        const text = replyInput.value.trim();
        if (!text) {
             console.log("DEBUG_MERGE: Reply text is empty. Aborting.");
             return;
        }

        // Use the globally managed auth object
        const currentUserForReply = auth.currentUser;
        if (!currentUserForReply) {
             console.log("DEBUG_MERGE: User not logged in. Redirecting to login.");
             alert("Please log in to reply.");
             isLoginMode = true; // Set to login mode
             if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                  window.toggleAuthMode(isLoginMode);
                  window.showScreen('login-screen');
             }
             return;
        }

        try {
            console.log(`DEBUG_MERGE: Adding reply to comment ${parentCommentId} for video ${videoId}...`);
            // Use the globally managed db object
            const repliesCol = collection(db, `video_comments/${videoId}/comments/${parentCommentId}/replies`);
            await addDoc(repliesCol, {
                userId: currentUserForReply.uid,
                userName: currentUserForReply.displayName || 'Conceptra User', // Use display name or default
                text: text,
                timestamp: serverTimestamp() // Use server timestamp
            });
             console.log("DEBUG_MERGE: Reply added successfully.");
            // No need to hide form manually, renderCommentsView will rebuild HTML
            await renderCommentsView(videoId); // Refresh comments list (includes replies)
        } catch (error) {
            console.error("DEBUG_MERGE: Error posting reply: ", error);
            alert("Failed to post reply.");
        }
    }

    // Delete comment or reply (FROM New File.js)
    window.deleteCommentOrReply = async function(itemId, videoId, parentCommentId = null) { // Make globally accessible
        console.log(`DEBUG_MERGE: deleteCommentOrReply called for Item ID: ${itemId}, Video ID: ${videoId}, Parent ID: ${parentCommentId}`);
        if (!confirm("Are you sure you want to delete this?")) {
            console.log("DEBUG_MERGE: Deletion cancelled by user.");
            return;
        }

        // Use the globally managed auth object
        const currentUserForDelete = auth.currentUser;
        if (!currentUserForDelete) {
             console.log("DEBUG_MERGE: User not logged in. Cannot delete.");
            alert("You must be logged in to delete.");
            isLoginMode = true; // Set to login mode
            if (typeof window.showScreen === 'function' && typeof window.toggleAuthMode === 'function') {
                 window.toggleAuthMode(isLoginMode);
                 window.showScreen('login-screen');
            }
            return;
        }

        let itemRef;
        // Use the globally managed db object
        if (parentCommentId) {
            // Reference to a reply document
            itemRef = doc(db, `video_comments/${videoId}/comments/${parentCommentId}/replies/${itemId}`);
        } else {
            // Reference to a main comment document
            itemRef = doc(db, `video_comments/${videoId}/comments/${itemId}`);
        }

        try {
            console.log(`DEBUG_MERGE: Checking ownership for deletion of item ${itemId}...`);
            const itemDoc = await getDoc(itemRef);
            // Check if document exists AND if the current user is the author
            if (!itemDoc.exists()) {
                 console.warn("DEBUG_MERGE: Item not found for deletion:", itemId);
                 alert("Item not found or already deleted.");
                 await renderCommentsView(videoId); // Refresh in case it was deleted
                 return;
            }
             if (itemDoc.data().userId !== currentUserForDelete.uid) {
                 console.warn(`DEBUG_MERGE: User ${currentUserForDelete.uid} attempted to delete item ${itemId} owned by ${itemDoc.data().userId}. Permission denied.`);
                alert("You can only delete your own contributions.");
                return;
            }

            console.log(`DEBUG_MERGE: User ${currentUserForDelete.uid} is the owner. Proceeding with deletion.`);

            // If deleting a main comment, delete its replies first using a batch write
            if (!parentCommentId) {
                 console.log(`DEBUG_MERGE: Deleting replies for main comment ${itemId}...`);
                const repliesCol = collection(db, `video_comments/${videoId}/comments/${itemId}/replies`);
                const repliesSnapshot = await getDocs(repliesCol);
                const batch = writeBatch(db);
                repliesSnapshot.forEach(replyDoc => {
                    batch.delete(replyDoc.ref);
                     console.log(`DEBUG_MERGE: Added reply ${replyDoc.id} to batch delete.`);
                });
                 if (!repliesSnapshot.empty) {
                      await batch.commit();
                      console.log(`DEBUG_MERGE: Batch delete of ${repliesSnapshot.size} replies committed.`);
                 } else {
                     console.log("DEBUG_MERGE: No replies to delete.");
                 }
            }

            // Delete the main comment or reply document
            console.log(`DEBUG_MERGE: Deleting item ${itemId}...`);
            await deleteDoc(itemRef);
            console.log(`DEBUG_MERGE: Item ${itemId} deleted successfully.`);

            // Refresh the comments view to show the updated list
            await renderCommentsView(videoId);

        } catch (error) {
            console.error("DEBUG_MERGE: Error deleting item: ", error);
            alert("Failed to delete.");
        }
    }
    // --- END VIDEO COMMENTS FEATURE ---


    // --- OTHER FEATURES (FROM New File.js - Keep all their logic) ---
    // Initialize other features that might need DOM access or event listeners set up on DOMContentLoaded
    initFlashcardFeature();
    initStickyNoteFeature();
    initStudyPlannerFeature();
    initSelfProgressFeature();
    initWatchVideoFeature(); // Already called via fetchData -> renderVideoPage in its own init
    initOmrPracticeFeature();
    initBrainGamesFeature();
    initCompetitiveExamFeature();
    initImageSlider();

    // These functions are called by the main app's navigation and should be accessible globally
    window.showStudyPlanner = () => showScreen('study-planner-screen');
    window.showFlashcards = () => showScreen('flashcard-screen');
    window.showStickyNotes = () => showScreen('sticky-note-screen');
    window.showWatchVideo = () => {
        showScreen('watch-video-screen');
         // Reset WV navigation stack when entering from home
         wvNavigationStack = [];
         // Re-render the root level of watch video just in case
         const watchVideoScreen = document.getElementById('watch-video-screen');
         if(watchVideoScreen && watchVideoScreen.showVideoPlayerPage) { // Check if feature is initialized
             // This is a bit tricky. The initWatchVideoFeature already fetches and renders.
             // Calling renderVideoPage([]) here might double-fetch or interfere.
             // The safest is just to show the screen and let the feature manage its own state.
             // If entering from home always means going to the root,
             // modify goBackWV to specifically detect the root page and stop there,
             // and ensure initWatchVideoFeature always starts at the root.
             // For simplicity, just showing the screen. The init takes care of the rest.
         } else {
             console.warn("DEBUG_MERGE: Watch Video feature not initialized when trying to showScreen.");
         }
    }
    window.showSelfProgress = () => showScreen('self-progress-screen');
    window.showCompetitiveExamPage = () => {
        showScreen('competitive-exam-page');
         // Ensure Competitive Exam feature is initialized and render its root content
        initCompetitiveExamFeature(); // Call init just in case
        renderExamContent([], "Competitive Exams"); // Use the global render function
    };

    window.showTeacherSection = () => {
        showTeacherListPage(); // This calls showScreen('teacher-list-page') internally
    };

    window.showFeedbackPage = () => {
        showScreen('feedback-page'); // This calls renderFeedbackPage() internally
    };

    window.showOmrPractice = () => {
        showScreen('omr-practice-page');
         // Ensure OMR feature is initialized and manage its internal screens
        initOmrPracticeFeature(); // Call init just in case
        showOmrScreen('omr-splash-screen');
        setTimeout(() => showOmrScreen('omr-home-screen'), 3000); // Assuming splash screen duration
    };

    window.showBrainGames = function() {
        showScreen('brain-games-page');
        // Ensure Brain Games feature is initialized and manage its internal screens
        initBrainGamesFeature(); // Call init just in case
        const page = document.getElementById('brain-games-page');
         if(page) {
            // The observer logic in the original init handles showing the splash/menu screens
            // after the main screen becomes active. Just ensure the page is shown.
             const loaderBar = page.querySelector('.loading-bar-inner');
             if (loaderBar) {
                 loaderBar.style.animation = 'none';
                 void loaderBar.offsetWidth; // Trigger reflow
                 loaderBar.style.animation = 'loading-bar-animation 3.5s linear infinite'; // Restart animation
             }
             // The observer should handle showing the screen flow
             showGameScreen('game-splash-screen');
             setTimeout(() => { showGameScreen('menu-screen'); }, 3500); // Manual fallback/trigger
         } else {
             console.warn("DEBUG_MERGE: Brain Games page not found when trying to showScreen.");
         }
    };

    // --- showInsightAI function (MODIFIED for direct integration) ---
    window.showInsightAI = function() {
        console.log("DEBUG_MERGE: showInsightAI called (modified for direct integration).");
        // Simply show the screen containing the AI UI elements
        showScreen('insight-ai-screen');

        // Optional: Show a temporary loading state or intro message within the screen
        // This assumes the initial HTML for the AI screen includes a container for this message
        const aiScreenContent = document.querySelector('#insight-ai-screen .main-content'); // Or a dedicated AI intro div
         if(aiScreenContent) {
              // Check if it's the first time showing this or if it should always show intro
              // For simplicity, let's assume the static HTML has an intro section,
              // and we just ensure it's potentially visible or replaced by feature UI.
              // If specific AI feature UI needs to be activated, do it here.
              // Example: show the "Ask Doubt" section by default.
              const askDoubtSection = document.getElementById('ask-doubt-section'); // Assuming IDs for sections
              const notesSection = document.getElementById('generate-notes-section');
              // ... other sections

              // Hide all AI feature sections initially, show Ask Doubt
             document.querySelectorAll('#insight-ai-screen .ai-feature-section').forEach(section => {
                 if (section) section.style.display = 'none';
             });
             if (askDoubtSection) askDoubtSection.style.display = 'block';

             // Add a small loader or message while the screen appears (optional)
             // This is less critical now that Firebase Auth is handled globally.
             // The individual feature handlers (like handleAskDoubt) will show their own loading states.
         } else {
             console.warn("DEBUG_MERGE: AI screen main content area not found.");
         }

         // Note: The AI button event listeners are attached ONCE in DOMContentLoaded,
         // assuming the AI feature HTML elements exist from the start.
         // When showScreen('insight-ai-screen') is called, these elements become visible,
         // and the listeners will work correctly.
    }

     // Helper function to toggle between different AI feature sections within Insight AI screen
     // Assume you have buttons or links in the Insight AI screen HTML like:
     // <button onclick="window.showAiFeatureSection('ask-doubt-section')">Ask Doubt</button>
     window.showAiFeatureSection = function(sectionId) {
         console.log(`DEBUG_MERGE: showAiFeatureSection called for ID: ${sectionId}`);
         document.querySelectorAll('#insight-ai-screen .ai-feature-section').forEach(section => {
             if (section) section.style.display = 'none';
         });
         const targetSection = document.getElementById(sectionId);
         if (targetSection) {
             targetSection.style.display = 'block';
             // Clear previous output when changing sections (optional but good UX)
             const outputContainer = targetSection.querySelector('.ai-response-container, .notes-output-container, .quiz-output-container, etc.'); // Find output div within section
              if (outputContainer) {
                  outputContainer.innerHTML = ''; // Clear output
                  outputContainer.style.display = 'none'; // Hide output container
              }
              // Clear input fields (optional)
              const inputField = targetSection.querySelector('input[type="text"], textarea');
              if (inputField) inputField.value = '';
              const fileInput = targetSection.querySelector('input[type="file"]');
              if (fileInput) fileInput.value = '';
              const fileNameDisplay = targetSection.querySelector('#file-name-display');
               if(fileNameDisplay) fileNameDisplay.textContent = '';

             console.log(`DEBUG_MERGE: Displaying AI feature section: ${sectionId}`);
         } else {
             console.error(`DEBUG_MERGE: AI feature section with ID ${sectionId} not found.`);
         }
     }
    // --- END showInsightAI function ---


    // Feedback Page Logic (FROM New File.js)
    async function renderFeedbackPage() {
         console.log("DEBUG_MERGE: renderFeedbackPage called.");
        const page = document.getElementById('feedback-page');
        if (!page) { console.error("DEBUG_MERGE: Feedback page element not found."); return; }

        // Check if HTML structure already exists (to avoid re-rendering if only navigating back)
         // A more robust check might be needed if content is dynamic
        if (page.querySelector('main.main-content')?.children.length > 0) {
             console.log("DEBUG_MERGE: Feedback page content already exists. Skipping render.");
             loadFeedback(); // Just reload the list if page is already structured
             return;
        }

        page.innerHTML = `
            <header class="app-header">
                <div class="header-icon" onclick="showScreen('home-screen', true)"><i class="fa-solid fa-arrow-left"></i></div>
                <h1 class="app-title"><i class="fa-solid fa-comment-dots"></i> Feedback</h1>
            </header>
            <main class="main-content">
                <div class="info-form" style="margin-bottom: 30px;">
                    <h2>Submit Your Feedback</h2>
                    <!-- Use window.submitFeedback -->
                    <form id="feedback-form" onsubmit="window.submitFeedback(event)">
                        <div class="input-group">
                            <i class="fa-solid fa-user"></i>
                            <!-- Name input will be pre-filled/ignored if logged in -->
                            <input type="text" id="feedback-name" placeholder="Your Name (Uses profile name if logged in)">
                        </div>
                        <div class="input-group">
                             <i class="fa-solid fa-star"></i>
                             <select id="feedback-rating" required>
                                 <option value="">-- Select Rating --</option>
                                 <option value="5">⭐⭐⭐⭐⭐ (Excellent)</option>
                                 <option value="4">⭐⭐⭐⭐ (Good)</option>
                                 <option value="3">⭐⭐⭐ (Average)</option>
                                 <option value="2">⭐⭐ (Poor)</option>
                                 <option value="1">⭐ (Very Poor)</option>
                             </select>
                        </div>
                        <div class="input-group">
                            <i class="fa-solid fa-comment"></i>
                            <textarea id="feedback-comment" placeholder="Your comments..." rows="4" required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%;">Submit Feedback</button>
                    </form>
                </div>

                <h2>What Others Are Saying</h2>
                <div id="feedback-list" class="content-list" style="margin-top:15px;">
                    <p style="text-align:center; color: var(--text-muted-color);">Loading feedback...</p>
                </div>
            </main>
        `;

         // Pre-fill name if user is logged in
         const currentUserForFeedbackUI = auth.currentUser;
         const feedbackNameInput = document.getElementById('feedback-name');
         if (feedbackNameInput && currentUserForFeedbackUI && currentUserForFeedbackUI.displayName) {
              feedbackNameInput.value = currentUserForFeedbackUI.displayName;
              feedbackNameInput.disabled = true; // Optionally disable editing if pre-filled
              feedbackNameInput.placeholder = currentUserForFeedbackUI.displayName; // Keep name visible
         } else if (feedbackNameInput) {
             feedbackNameInput.disabled = false; // Ensure enabled if not logged in
         }


        loadFeedback(); // Load existing feedback after rendering structure
         console.log("DEBUG_MERGE: Feedback page rendered.");
    }

    async function loadFeedback() {
         console.log("DEBUG_MERGE: loadFeedback called.");
        const feedbackList = document.getElementById('feedback-list');
        if (!feedbackList) { console.error("DEBUG_MERGE: Feedback list element not found."); return; }
        feedbackList.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">Loading feedback...</p>';
        try {
            // Use the globally managed db object
            const feedbackCol = collection(db, "feedback");
            // Order by timestamp descending to show latest first
            const q = query(feedbackCol, orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                feedbackList.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No feedback submitted yet. Be the first!</p>';
                 console.log("DEBUG_MERGE: No feedback documents found.");
                return;
            }
            let feedbackHTML = '';
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Default to Anonymous if name is not provided
                const name = data.name || 'Anonymous';
                // Repeat star character based on rating number
                const ratingStars = '⭐'.repeat(data.rating);
                // Format timestamp nicely, handle potential non-Timestamp data
                const date = data.timestamp instanceof Timestamp ? data.timestamp.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : (data.timestamp ? new Date(data.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A');

                feedbackHTML += `
                    <div class="content-list-item" style="flex-direction: column; align-items: flex-start;">
                        <div style="font-weight: 600; display: flex; justify-content: space-between; width: 100%; font-size: 0.9em;">
                            <span>${name} rated: ${ratingStars}</span>
                            <span style="font-size: 0.9em; color: var(--text-muted-color);">${date}</span>
                        </div>
                        <p style="margin-top: 8px; color: var(--text-muted-color); font-size: 0.9em;">${data.comment}</p>
                    </div>
                `;
            });
            feedbackList.innerHTML = feedbackHTML;
            console.log(`DEBUG_MERGE: Loaded and rendered ${querySnapshot.size} feedback items.`);
        } catch (error) {
            console.error("DEBUG_MERGE: Error loading feedback: ", error);
            feedbackList.innerHTML = '<p style="color: var(--color-red); text-align:center;">Could not load feedback. Please try again later.</p>';
        }
    }

    window.submitFeedback = async function(event) { // Make globally accessible
        event.preventDefault();
         console.log("DEBUG_MERGE: submitFeedback called.");

        // Get the current user using the global auth object
        const currentUserForFeedback = auth.currentUser;
        const nameInputEl = document.getElementById('feedback-name');
        const nameInput = nameInputEl ? nameInputEl.value.trim() : '';

        let nameToSubmit = 'Anonymous';
        let userIdToSubmit = 'anonymous_feedback_user_' + Date.now(); // Default anonymous ID

        // Use Firebase user info if logged in
        if (currentUserForFeedback) {
            nameToSubmit = currentUserForFeedback.displayName || nameInput || 'Conceptra User'; // Prefer display name, fallback to input, then default
            userIdToSubmit = currentUserForFeedback.uid;
            console.log("DEBUG_MERGE submitFeedback: Using Firebase user - Name:", nameToSubmit, "UID:", userIdToSubmit);
        } else {
             // Fallback for non-Firebase users (might not be needed if feedback requires login)
            const legacyUser = getCurrentUser(); // Uses localStorage if Firebase is null
             // Check if getCurrentUser returned a valid non-anonymous user from localStorage
            if (!legacyUser.isFirebaseUser && legacyUser.id && !legacyUser.id.startsWith('anonymous_')) {
                 nameToSubmit = legacyUser.name || nameInput || 'Legacy User';
                 userIdToSubmit = legacyUser.id;
                 console.log("DEBUG_MERGE submitFeedback: Using legacy LS user - Name:", nameToSubmit, "ID:", userIdToSubmit);
            } else {
                 nameToSubmit = nameInput || 'Anonymous Guest'; // Use input name or default anonymous
                 // userIdToSubmit remains the default anonymous_feedback_user_...
                 console.log("DEBUG_MERGE submitFeedback: Using anonymous guest - Name:", nameToSubmit, "Generated ID:", userIdToSubmit);
            }
        }

        const ratingInputEl = document.getElementById('feedback-rating');
        const commentInputEl = document.getElementById('feedback-comment');

        if (!ratingInputEl || !commentInputEl) {
             console.error("DEBUG_MERGE: Feedback rating or comment input element not found.");
             alert("Form elements missing. Cannot submit feedback.");
             return;
        }

        const rating = ratingInputEl.value;
        const comment = commentInputEl.value.trim();

        // Validate input
        if (!rating || comment === '') {
            alert('Please provide a rating and a comment.');
            console.log("DEBUG_MERGE: Feedback validation failed: rating or comment empty.");
            return;
        }

        const submitButton = event.target.querySelector('button[type="submit"]');
         if (!submitButton) { console.error("DEBUG_MERGE: Submit button not found."); return; }
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        try {
            console.log("DEBUG_MERGE submitFeedback: Submitting feedback data...");
            // Use the globally managed db object
            await addDoc(collection(db, "feedback"), {
                name: nameToSubmit,
                userId: userIdToSubmit, // Store the determined user ID
                rating: parseInt(rating), // Store rating as a number
                comment: comment,
                timestamp: serverTimestamp() // Use server timestamp
            });
            console.log("DEBUG_MERGE: Feedback document added successfully.");
            alert('Thank you for your feedback!');
            // Reset the form fields
            const feedbackForm = document.getElementById('feedback-form');
            if(feedbackForm) feedbackForm.reset();
            // Reload the feedback list to include the new submission
            loadFeedback();
        } catch (error) {
            console.error("DEBUG_MERGE: Error adding feedback document: ", error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Feedback';
            console.log("DEBUG_MERGE: submitFeedback finally block executed.");
        }
    }


    // Countdown Feature (FROM New File.js)
    window.showCountdown = function() { // Make globally accessible
         console.log("DEBUG_MERGE: showCountdown called.");
        // Clear any existing timer interval
        clearInterval(eventCountdownInterval);

        const container = document.getElementById('countdown-screen');
         if (!container) { console.error("DEBUG_MERGE: Countdown screen element not found."); return; }

         // Check if HTML structure already exists (to avoid re-rendering if only navigating back)
         if (container.querySelector('main.main-content')?.children.length > 0) {
             console.log("DEBUG_MERGE: Countdown page content already exists. Skipping render, just updating.");
             renderEventCountdown(); // Just update the display
         } else {
             // Render the initial HTML structure
             container.innerHTML = `
                 <header class="app-header transparent-header">
                     <div class="header-icon" onclick="showScreen('home-screen', true)"><i class="fa-solid fa-arrow-left"></i></div>
                     <h1 class="app-title" style="color:white; -webkit-text-fill-color: white;">Event Countdown</h1>
                     <!-- Use window.openEventSettingsModal -->
                     <div class="header-icon" onclick="window.openEventSettingsModal()"><i class="fa-solid fa-cog"></i></div>
                 </header>
                 <main class="main-content"></main>`;
             renderEventCountdown(); // Render content based on saved data
         }
        showScreen('countdown-screen'); // Show the countdown screen
         console.log("DEBUG_MERGE: Countdown screen displayed.");
    }

    function renderEventCountdown() {
         console.log("DEBUG_MERGE: renderEventCountdown called.");
        const mainContent = document.querySelector('#countdown-screen .main-content');
         if (!mainContent) { console.error("DEBUG_MERGE: Countdown main content element not found."); return; }
        const targetData = loadFromStorage('conceptra-event-countdown');

        // Check if valid future event data exists
        if (targetData && targetData.date && new Date(targetData.date) > new Date()) {
             console.log("DEBUG_MERGE: Valid event data found. Rendering countdown.");
            mainContent.innerHTML = `
                <div class="event-display-wrapper">
                    <div class="event-info">
                        <h2 id="event-title-display">${targetData.name || 'Unnamed Event'}</h2>
                        <p>${new Date(targetData.date).toLocaleString()}</p>
                    </div>
                    <div class="circular-timer-container">
                        <svg class="circular-timer-svg" viewBox="0 0 100 100">
                            <circle class="timer-ring-bg" cx="50" cy="50" r="45"></circle>
                            <!-- pathLength="100" is needed for stroke-dashoffset calculation -->
                            <circle id="event-progress-ring" class="timer-ring-progress" cx="50" cy="50" r="45" pathLength="100"></circle>
                        </svg>
                        <div class="circular-timer-grid">
                            <div class="timer-unit"><div id="countdown-days" class="value">00</div><div class="label">Days</div></div>
                            <div class="timer-unit"><div id="countdown-hours" class="value">00</div><div class="label">Hours</div></div>
                            <div class="timer-unit"><div id="countdown-minutes" class="value">00</div><div class="label">Minutes</div></div>
                            <div class="timer-unit"><div id="countdown-seconds" class="value">00</div><div class="label">Seconds</div></div>
                        </div>
                    </div>
                </div>`;
            startEventCountdownTimer(targetData.date, targetData.startDate); // Start the timer
        } else {
             console.log("DEBUG_MERGE: No valid future event data found. Rendering set event prompt.");
            mainContent.innerHTML = `<div style="text-align:center;"><p style="color: var(--text-muted-color);">No event set.</p><button class="btn btn-primary" style="margin-top:20px;" onclick="window.openEventSettingsModal()">Set an Event</button></div>`; // Use window.
        }
    }

    window.openEventSettingsModal = function() { // Make globally accessible
         console.log("DEBUG_MERGE: openEventSettingsModal called.");
        const modal = document.getElementById('event-settings-modal');
         if (!modal) { console.error("DEBUG_MERGE: Event settings modal element not found."); return; }

         // Render modal HTML
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <!-- Use window.closeSettingsModal or a specific close function if needed -->
                    <i class="fa-solid fa-times header-icon" style="width:auto;" onclick="document.getElementById('event-settings-modal').classList.remove('show')"></i>
                    <h3>Set Event</h3>
                </div>
                <div class="modal-body" style="text-align:left;">
                    <!-- Use window.setEventCountdown -->
                    <form id="countdown-form" onsubmit="window.setEventCountdown(event)">
                        <div class="input-group"><i class="fa-solid fa-calendar-star"></i><input type="text" id="event-name" placeholder="Event Name" required></div>
                        <div class="input-group"><i class="fa-solid fa-clock"></i><input type="datetime-local" id="event-date" required></div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Start Countdown</button>
                    </form>
                </div>
            </div>`;
        modal.classList.add('show'); // Show the modal
         console.log("DEBUG_MERGE: Event settings modal displayed.");
    }

    window.setEventCountdown = function(event) { // Make globally accessible
        event.preventDefault();
         console.log("DEBUG_MERGE: setEventCountdown called.");
        const nameInput = document.getElementById('event-name');
        const dateInput = document.getElementById('event-date');
         const modal = document.getElementById('event-settings-modal');

         if (!nameInput || !dateInput || !modal) {
             console.error("DEBUG_MERGE: Event settings form elements or modal not found.");
             alert("Error setting event.");
             return;
         }

        const name = nameInput.value.trim();
        const date = dateInput.value; // Value is in 'YYYY-MM-DDTHH:mm' format
        const selectedDate = new Date(date);

        // Validate input
        if (name === '' || date === '' || selectedDate <= new Date()) {
            alert("Please enter a valid name and a future date.");
            console.log("DEBUG_MERGE: Event input validation failed.");
            return;
        }

         console.log(`DEBUG_MERGE: Saving event: Name="${name}", Date="${date}", StartDate="${new Date().toISOString()}"`);
        // Save the event data to localStorage
        saveToStorage('conceptra-event-countdown', {
            name,
            date, // Store as string for simpler parsing later
            startDate: new Date().toISOString() // Store start date for progress calculation
        });

        modal.classList.remove('show'); // Hide the modal
        showCountdown(); // Render and start the countdown on the main page
         console.log("DEBUG_MERGE: Event set and countdown displayed.");
    }


    function startEventCountdownTimer(targetDateStr, startDateStr) {
        console.log("DEBUG_MERGE: startEventCountdownTimer called.");
        // Clear any existing interval before starting a new one
        clearInterval(eventCountdownInterval);

        const targetDate = new Date(targetDateStr).getTime();
        const startDate = new Date(startDateStr).getTime();
        const totalDuration = targetDate - startDate; // Total duration in milliseconds

        const ring = document.getElementById('event-progress-ring');
        // Ensure ring exists before setting attributes/styles
         if(ring) {
             ring.style.strokeDasharray = "100"; // Needs pathLength="100" on SVG element
         }


        eventCountdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate - now; // Remaining distance in milliseconds

            // Stop the timer if the event date is reached or passed
            if (distance < 0) {
                clearInterval(eventCountdownInterval);
                 console.log("DEBUG_MERGE: Countdown finished.");
                const mainContent = document.querySelector('#countdown-screen .main-content');
                 if (mainContent) {
                     mainContent.innerHTML = `<div style="text-align:center;"><h2>The event "${loadFromStorage('conceptra-event-countdown')?.name || 'Your Event'}" has started!</h2><button class="btn btn-primary" style="margin-top:20px;" onclick="window.openEventSettingsModal()">Set New Event</button></div>`; // Use window.
                 }
                 return;
            }

            // Calculate progress for the circular ring
            const elapsed = now - startDate;
            // Ensure progress is between 0 and 100%
            const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
             if(ring) {
                 // Update stroke-dashoffset for progress animation (100 - progress %)
                ring.style.strokeDashoffset = 100 - progress;
             }


            // Calculate remaining time units
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // Update DOM elements, padding with leading zeros
            const daysEl = document.getElementById('countdown-days');
            const hoursEl = document.getElementById('countdown-hours');
            const minutesEl = document.getElementById('countdown-minutes');
            const secondsEl = document.getElementById('countdown-seconds');

            if(daysEl) daysEl.textContent = String(days).padStart(2, '0');
            if(hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if(minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
            if(secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');

        }, 1000); // Update every second
         console.log("DEBUG_MERGE: Countdown timer interval started.");
    }


    // Self Quiz Feature (FROM New File.js)
    let selfQuizData = { // Default data structure
        predefined: [
            { id: "phy01", title: "Laws of Motion", subject: "Physics", questions: [ { id: "q1", text: "What is Newton's First Law also known as?", options: ["Law of Inertia", "Law of Action-Reaction", "Law of Acceleration", "Law of Gravity"], correctAnswer: "Law of Inertia" }, { id: "q2", text: "F = ma represents which law?", options: ["First Law", "Second Law", "Third Law", "Zeroth Law"], correctAnswer: "Second Law" } ] },
            { id: "gk01", title: "World Capitals", subject: "General Knowledge", questions: [ { id: "q1", text: "What is the capital of Japan?", options: ["Beijing", "Seoul", "Tokyo", "Bangkok"], correctAnswer: "Tokyo" }, { id: "q2", text: "What is the capital of Canada?", options: ["Toronto", "Vancouver", "Montreal", "Ottawa"], correctAnswer: "Ottawa" } ] }
        ],
        user: [], // User-created quizzes
        stats: {} // Placeholder for future stats
    };
    let currentQuizState = {}; // State for the currently active quiz

    window.showSelfQuiz = function() { // Make globally accessible
         console.log("DEBUG_MERGE: showSelfQuiz called.");
         // Load data from storage when feature is accessed
         const savedData = loadFromStorage('conceptra_self_quiz');
         if(savedData) {
             // Simple merge: keep predefined, load user and stats
             selfQuizData.user = savedData.user || [];
             selfQuizData.stats = savedData.stats || {};
             console.log("DEBUG_MERGE: Self Quiz data loaded from storage.");
         } else {
              console.log("DEBUG_MERGE: No Self Quiz data found in storage. Using defaults.");
             // If no saved data, stick with predefined and empty user/stats
         }

        renderQuizLobby(); // Render the main quiz lobby page
        showScreen('self-quiz-screen'); // Navigate to the screen
         console.log("DEBUG_MERGE: Self Quiz screen displayed.");
    };


    function renderQuizLobby() {
         console.log("DEBUG_MERGE: renderQuizLobby called.");
        const page = document.getElementById('self-quiz-screen');
        if (!page) { console.error("DEBUG_MERGE: Self Quiz screen element not found for lobby."); return; }

         // Generate HTML for the lobby view
         page.innerHTML = `
             <header class="app-header"><div class="header-icon" onclick="showScreen('home-screen', true)"><i class="fa-solid fa-arrow-left"></i></div><h1 class="app-title"><i class="fa-solid fa-question-circle"></i> Self Quiz</h1><div class="header-icon"></div></header>
             <main class="main-content">
                 <div class="quiz-lobby-grid">
                     <div class="quiz-creator-card">
                         <h3>Create Your Own Quiz</h3>
                         <p style="font-size: 0.9rem; color: #777; margin: 10px 0 20px;">Personalize your learning by creating custom quizzes.</p>
                         <!-- Use window.renderQuizCreator -->
                         <button class="btn btn-primary" onclick="window.renderQuizCreator()"><i class="fa-solid fa-plus"></i> Create New Quiz</button>
                     </div>
                     <h3 style="margin-top: 20px;">Pre-made Quizzes</h3>
                     ${selfQuizData.predefined && selfQuizData.predefined.length > 0 ? selfQuizData.predefined.map(quiz => `
                         <div class="quiz-card" onclick="window.startQuiz('${quiz.id}', 'predefined')"> <!-- Use window.startQuiz -->
                             <h3>${quiz.title}</h3>
                             <p class="quiz-meta">${quiz.subject} • ${quiz.questions.length} Qs</p>
                             <button class="btn">Start</button>
                         </div>
                     `).join('') : '<p style="color: #777; text-align: center;">No pre-made quizzes available.</p>'}
                     <h3 style="margin-top: 20px;">Your Quizzes</h3>
                     ${selfQuizData.user && selfQuizData.user.length > 0 ? selfQuizData.user.map(quiz => `
                         <div class="quiz-card">
                             <h3>${quiz.title}</h3>
                             <p class="quiz-meta">${quiz.subject} • ${quiz.questions.length} Qs</p>
                             <!-- Use window.startQuiz and window.deleteUserQuiz -->
                             <button class="btn" onclick="window.startQuiz('${quiz.id}', 'user')">Start</button>
                             <button class="btn" style="background:var(--danger); color:white; margin-left: 10px;" onclick="window.deleteUserQuiz('${quiz.id}', event)"><i class="fa-solid fa-trash"></i></button>
                         </div>
                     `).join('') : '<p style="color: #777; text-align: center;">No quizzes created yet.</p>'}
                 </div>
             </main>`;
         console.log("DEBUG_MERGE: Quiz lobby rendered.");
    }


    window.deleteUserQuiz = function(quizId, event) { // Make globally accessible
        console.log(`DEBUG_MERGE: deleteUserQuiz called for ID: ${quizId}`);
        event.stopPropagation(); // Prevent card click from firing
        if (confirm('Are you sure you want to delete this quiz?')) {
            // Filter out the quiz to delete
            selfQuizData.user = selfQuizData.user.filter(q => q.id !== quizId);
            saveToStorage('conceptra_self_quiz', selfQuizData); // Save changes
            renderQuizLobby(); // Re-render the lobby
             console.log(`DEBUG_MERGE: User quiz ${quizId} deleted.`);
        } else {
             console.log("DEBUG_MERGE: User quiz deletion cancelled.");
        }
    };

    window.renderQuizCreator = function() { // Make globally accessible
         console.log("DEBUG_MERGE: renderQuizCreator called.");
        const page = document.getElementById('self-quiz-screen');
        if (!page) { console.error("DEBUG_MERGE: Self Quiz screen element not found for creator."); return; }
         // Render the quiz creator form
         page.innerHTML = `
             <header class="app-header"><div class="header-icon" onclick="window.showSelfQuiz(true)"><i class="fa-solid fa-arrow-left"></i></div><h1 class="app-title">Quiz Creator</h1><div class="header-icon"></div></header>
             <main class="main-content">
                 <!-- Use window.saveUserQuiz -->
                 <form class="info-form" id="quiz-creator-form" onsubmit="window.saveUserQuiz(event)">
                     <div class="input-group"><i class="fa-solid fa-heading"></i><input type="text" id="quiz-title" placeholder="Quiz Title" required></div>
                     <div class="input-group"><i class="fa-solid fa-tag"></i><input type="text" id="quiz-subject" placeholder="Subject" required></div>
                     <hr style="margin: 25px 0; border-color: var(--border-color);">
                     <h4>Questions</h4>
                     <div id="questions-container"></div>
                     <!-- Use window.addQuestionField -->
                     <button type="button" class="btn" style="background: var(--surface); color: var(--text-dark); border: 1px solid var(--border-color); width:100%;" onclick="window.addQuestionField()">
                         <i class="fa-solid fa-plus-circle"></i> Add Question
                     </button>
                     <button type="submit" class="btn btn-primary" style="width:100%; margin-top: 20px;">Save Quiz</button>
                 </form>
             </main>`;
         addQuestionField(); // Add the first question field automatically
         console.log("DEBUG_MERGE: Quiz creator rendered.");
    };


    window.addQuestionField = function() { // Make globally accessible
         console.log("DEBUG_MERGE: addQuestionField called.");
        const container = document.getElementById('questions-container');
        if (!container) { console.error("DEBUG_MERGE: Questions container not found."); return; }
        const questionIndex = container.children.length; // Get the number of existing question fields
        const questionDiv = document.createElement('div');
        questionDiv.style.cssText = 'border: 1px solid var(--border-color); border-radius: 10px; padding: 15px; margin-bottom: 15px;';
         // Render the HTML for a single question field
        questionDiv.innerHTML = `
             <h5>Question ${questionIndex + 1} <button type="button" class="delete-q-btn" onclick="window.deleteQuestionField(this)" style="float:right; background:none; border:none; color:var(--danger); cursor:pointer;">🗑️</button></h5>
             <div class="input-group"><textarea class="question-text" placeholder="Question text..." rows="2" required></textarea></div>
             <div class="input-group"><input type="text" class="option" placeholder="Option 1 (Correct Answer)" required></div>
             <div class="input-group"><input type="text" class="option" placeholder="Option 2" required></div>
             <div class="input-group"><input type="text" class="option" placeholder="Option 3"></div>
             <div class="input-group"><input type="text" class="option" placeholder="Option 4"></div>
         `;
        container.appendChild(questionDiv);
         console.log(`DEBUG_MERGE: Added question field ${questionIndex + 1}.`);
    };

     window.deleteQuestionField = function(button) { // Make globally accessible
         console.log("DEBUG_MERGE: deleteQuestionField called.");
         const questionDiv = button.closest('.question-field-group');
         if (questionDiv) {
             questionDiv.remove();
             console.log("DEBUG_MERGE: Question field deleted.");
             // Re-number remaining questions (optional but good for UI)
             const container = document.getElementById('questions-container');
             if (container) {
                 Array.from(container.children).forEach((qDiv, index) => {
                     const h5 = qDiv.querySelector('h5');
                      if (h5) h5.innerHTML = `Question ${index + 1} <button type="button" class="delete-q-btn" onclick="window.deleteQuestionField(this)" style="float:right; background:none; border:none; color:var(--danger); cursor:pointer;">🗑️</button>`;
                 });
             }
         } else {
             console.warn("DEBUG_MERGE: Could not find question field div to delete.");
         }
     }


    window.saveUserQuiz = function(event) { // Make globally accessible
        event.preventDefault();
         console.log("DEBUG_MERGE: saveUserQuiz called.");
         const titleInput = document.getElementById('quiz-title');
         const subjectInput = document.getElementById('quiz-subject');
         const questionsContainer = document.getElementById('questions-container');

         if (!titleInput || !subjectInput || !questionsContainer) {
             console.error("DEBUG_MERGE: Quiz creator form elements not found.");
             alert("Error saving quiz. Form elements missing.");
             return;
         }

         // Create the new quiz object
        const newQuiz = {
            id: 'user_' + Date.now(), // Generate a unique ID
            title: titleInput.value.trim(),
            subject: subjectInput.value.trim(),
            questions: []
        };

        // Loop through question fields and extract data
        const questionDivs = questionsContainer.querySelectorAll('.question-field-group');
        if (questionDivs.length === 0) {
             alert("Please add at least one question.");
             console.log("DEBUG_MERGE: No questions added. Save aborted.");
             return;
        }

        let hasInvalidQuestion = false;
        questionDivs.forEach((qDiv, index) => {
            const textEl = qDiv.querySelector('.question-text');
            const optionEls = qDiv.querySelectorAll('.option');

            const text = textEl ? textEl.value.trim() : '';
            // Get all option values, filter out empty ones
            const options = Array.from(optionEls).map(opt => opt.value.trim()).filter(Boolean);

            // Validate that text is not empty and at least 2 options are provided
            if (text && options.length >= 2) {
                 // The first option in the creator is designated as the correct answer
                newQuiz.questions.push({
                    id: `q${index}`, // Unique ID for the question within the quiz
                    text,
                    options,
                    correctAnswer: options[0] // Correct answer is the first option entered
                });
            } else {
                console.warn(`DEBUG_MERGE: Skipping question ${index + 1} due to missing text or insufficient options.`);
                hasInvalidQuestion = true;
            }
        });

         // Check if any valid questions were added
        if (newQuiz.questions.length > 0) {
            selfQuizData.user.push(newQuiz); // Add the new quiz to the user's list
            saveToStorage('conceptra_self_quiz', selfQuizData); // Save updated data to storage
            console.log(`DEBUG_MERGE: User quiz "${newQuiz.title}" saved successfully.`);
            if (hasInvalidQuestion) {
                 alert("Some questions were skipped because they were incomplete. The quiz has been saved with valid questions.");
            } else {
                 alert("Quiz saved successfully!");
            }
            showSelfQuiz(); // Go back to the quiz lobby
        } else {
             // If no valid questions were created
            alert("Please add at least one valid question with text and at least two options.");
            console.log("DEBUG_MERGE: No valid questions created. Save aborted.");
        }
    };


    window.startQuiz = function(quizId, type) { // Make globally accessible
         console.log(`DEBUG_MERGE: startQuiz called for ID: ${quizId}, Type: ${type}`);
        const quiz = selfQuizData[type]?.find(q => q.id === quizId);
        if (!quiz) {
             console.error(`DEBUG_MERGE: Quiz with ID ${quizId} (${type}) not found.`);
             alert("Quiz not found.");
             return;
        }

         // Deep copy the quiz data and shuffle questions/options for the session
        const shuffledQuiz = JSON.parse(JSON.stringify(quiz));
        if (shuffledQuiz.questions) {
             shuffledQuiz.questions.sort(() => Math.random() - 0.5); // Shuffle questions
             shuffledQuiz.questions.forEach(q => {
                  if (q.options) q.options.sort(() => Math.random() - 0.5); // Shuffle options within each question
             });
        } else {
             console.warn("DEBUG_MERGE: Quiz has no questions:", quiz);
             alert("This quiz has no questions.");
             return;
        }


        // Initialize the state for this quiz session
        currentQuizState = {
            quiz: shuffledQuiz,
            currentQuestionIndex: 0,
            score: 0,
            userAnswers: [] // To store user answers and correctness for review/analysis
        };
        console.log(`DEBUG_MERGE: Quiz "${quiz.title}" started.`);
        renderQuizPlayer(); // Render the first question
    };

    function renderQuizPlayer() {
         console.log(`DEBUG_MERGE: renderQuizPlayer called. Current question index: ${currentQuizState.currentQuestionIndex}`);
        const page = document.getElementById('self-quiz-screen');
        if (!page) { console.error("DEBUG_MERGE: Self Quiz screen element not found for player."); return; }

        const question = currentQuizState.quiz.questions[currentQuizState.currentQuestionIndex];
        if (!question) {
             console.log("DEBUG_MERGE: No more questions. Rendering result.");
            renderQuizResult(); // If no question exists, the quiz is finished
            return;
        }

         // Generate HTML for the quiz player
         page.innerHTML = `
             <div class="quiz-player-container">
                 <div class="quiz-header">
                     <h3>${currentQuizState.quiz.title}</h3>
                     <p>Question ${currentQuizState.currentQuestionIndex + 1} of ${currentQuizState.quiz.questions.length}</p>
                     <div class="quiz-progress-bar"><div style="width: ${((currentQuizState.currentQuestionIndex + 1) / currentQuizState.quiz.questions.length) * 100}%; height:100%; background:var(--gradient); transition: width 0.3s;"></div></div>
                 </div>
                 <div class="quiz-question-area">
                     <p class="quiz-question-text">${question.text}</p>
                     <div class="quiz-options">
                         ${question.options && question.options.length > 0 ? question.options.map((opt, i) =>
                             // Use window.selectQuizOption
                             `<div class="quiz-option" onclick="window.selectQuizOption(this, \`${opt.replace(/'/g, "\\'")}\`)"><span class="option-letter">${String.fromCharCode(65 + i)}</span> ${opt}</div>` // Added option letter
                         ).join('') : '<p style="color: var(--text-muted-color);">No options available.</p>'}
                     </div>
                 </div>
                 <div class="quiz-footer">
                     <!-- Button initially disabled until an option is selected -->
                     <!-- Use window.nextQuestion -->
                     <button id="next-quiz-btn" class="btn btn-primary" disabled onclick="window.nextQuestion()">Next</button>
                 </div>
             </div>`;
         console.log("DEBUG_MERGE: Quiz player rendered question", currentQuizState.currentQuestionIndex + 1);
    }


    window.selectQuizOption = function(optionEl, answer) { // Make globally accessible
        console.log(`DEBUG_MERGE: selectQuizOption called. Answer: "${answer}"`);
         const quizOptions = document.querySelectorAll('.quiz-option');
         if (!quizOptions || quizOptions.length === 0) {
             console.warn("DEBUG_MERGE: Quiz options not found.");
             return;
         }

         // Disable all option buttons after one is selected
        quizOptions.forEach(opt => {
             opt.onclick = null; // Remove click handlers
             opt.style.pointerEvents = 'none'; // Disable clicks via CSS
        });

        const nextButton = document.getElementById('next-quiz-btn');
         if (nextButton) {
             nextButton.disabled = false; // Enable the Next button
         } else {
              console.warn("DEBUG_MERGE: Next button not found.");
         }


        const question = currentQuizState.quiz.questions[currentQuizState.currentQuestionIndex];
        if (!question) {
             console.error("DEBUG_MERGE: Current question data is missing.");
             return;
        }

        const isCorrect = (answer === question.correctAnswer); // Check if selected answer is correct

        // Store the user's answer and correctness status
        currentQuizState.userAnswers[currentQuizState.currentQuestionIndex] = {
            question: question.text, // Store question text
            userAnswer: answer, // Store user's chosen answer
            correctAnswer: question.correctAnswer, // Store correct answer
            isCorrect: isCorrect,
            conceptTag: question.conceptTag || 'General' // Store concept tag
        };

        // Add CSS classes to indicate correct/incorrect answer visually
        if (isCorrect) {
            currentQuizState.score++; // Increment score if correct
            optionEl.classList.add('correct'); // Mark selected option as correct
             console.log("DEBUG_MERGE: Answer is correct. Score:", currentQuizState.score);
        } else {
            optionEl.classList.add('incorrect'); // Mark selected option as incorrect
             console.log("DEBUG_MERGE: Answer is incorrect.");
            // Find and mark the correct answer
            quizOptions.forEach(opt => {
                 // Check if the option text matches the correct answer
                 // Need to get the actual text content including the span for the letter
                 const optionTextContent = opt.textContent.trim().substring(2).trim(); // Remove letter like "A "
                 if (optionTextContent === question.correctAnswer) {
                     opt.classList.add('correct'); // Mark the correct option
                 }
            });
        }
    };


    window.nextQuestion = function() { // Make globally accessible
         console.log("DEBUG_MERGE: nextQuestion called.");
        // Ensure an answer was recorded before proceeding (should be guaranteed by button state)
        if (currentQuizState.userAnswers[currentQuizState.currentQuestionIndex] === undefined) {
             // This case shouldn't happen if Next button is disabled until selection,
             // but as a fallback, mark as skipped.
             console.warn("DEBUG_MERGE: Next called before selection. Marking as skipped.");
             const question = currentQuizState.quiz.questions[currentQuizState.currentQuestionIndex];
             if(question) {
                 currentQuizState.userAnswers[currentQuizState.currentQuestionIndex] = {
                      question: question.text,
                      userAnswer: 'Not Answered',
                      correctAnswer: question.correctAnswer,
                      isCorrect: false,
                      conceptTag: question.conceptTag || 'General'
                 };
             }
        }

        currentQuizState.currentQuestionIndex++; // Move to the next question
        renderQuizPlayer(); // Render the next question or result screen
         console.log("DEBUG_MERGE: Moving to next question.");
    };


    function renderQuizResult() {
         console.log("DEBUG_MERGE: renderQuizResult called.");
        const page = document.getElementById('self-quiz-screen');
        if (!page) { console.error("DEBUG_MERGE: Self Quiz screen element not found for result."); return; }

         // Get necessary data from currentQuizState
        const { score, quiz, userAnswers } = currentQuizState;
        const questions = quiz?.questions || []; // Ensure questions array exists

        const accuracy = questions.length > 0 ? ((score / questions.length) * 100).toFixed(0) : 0;

        // Show confetti animation for high score (e.g., >= 90%)
        if (accuracy >= 90 && typeof window.confetti === 'function') { // Check if confetti library is loaded
             console.log("DEBUG_MERGE: High score achieved, showing confetti!");
            window.confetti();
        }


         // Generate HTML for the result screen
        page.innerHTML = `
             <header class="app-header"><div class="header-icon" onclick="window.showSelfQuiz(true)"><i class="fa-solid fa-arrow-left"></i></div><h1 class="app-title">Quiz Result</h1><div class="header-icon"></div></header>
             <main class="main-content">
                 <div class="quiz-result-card" style="text-align:center;">
                     <h3>Completed!</h3>
                     <p style="font-size: 3rem; font-weight: 700; color: var(--primary);">${accuracy}%</p>
                     <div style="display:flex;justify-content:space-around;margin:20px 0;">
                         <div><p style="font-weight:600;">${score}/${questions.length}</p><p>Score</p></div>
                         <div><p style="font-weight:600;">${questions.length - score}</p><p>Wrong</p></div> <!-- Assuming questions.length - score is total wrong/skipped -->
                         <!-- You might want to calculate correct, wrong, skipped explicitly from userAnswers -->
                     </div>
                     <!-- Use window.showSelfQuiz -->
                     <button class="btn btn-primary" style="width:100%" onclick="window.showSelfQuiz()">Back to Menu</button>
                 </div>
                 <h3 style="margin: 30px 0 15px;">Review Answers</h3>
                 ${userAnswers && userAnswers.length > 0 ? userAnswers.map(ans => `
                     <div class="quiz-review-question ${ans.isCorrect ? 'correct-review' : (ans.userAnswer === 'Not Answered' ? '' : 'incorrect-review')}"> <!-- Added class for skipped/not answered -->
                         <p><b>Q:</b> ${ans.question}</p>
                         <p><b>Your Answer:</b> <span style="color: ${ans.isCorrect ? 'var(--success)' : (ans.userAnswer === 'Not Answered' ? 'var(--text-muted-color)' : 'var(--danger)')};">${ans.userAnswer}</span></p>
                         ${!ans.isCorrect && ans.userAnswer !== 'Not Answered' ? `<p style="color: var(--success);"><b>Correct:</b> ${ans.correctAnswer}</p>` : ''}
                          ${ans.userAnswer === 'Not Answered' ? `<p style="color: var(--success);"><b>Correct:</b> ${ans.correctAnswer}</p>` : ''} <!-- Show correct if skipped -->
                         <p style="font-size: 0.9em; color: var(--text-muted-color);"><b>Concept Tag:</b> ${ans.conceptTag}</p> <!-- Show concept tag -->
                     </div>
                 `).join('') : '<p style="color: var(--text-muted-color);">No answers to review.</p>'}
             </main>`;
         console.log("DEBUG_MERGE: Quiz result screen rendered.");
    }


    // OMR Practice Feature (FROM New File.js)
    function initOmrPracticeFeature() {
         console.log("DEBUG_MERGE: initOmrPracticeFeature called.");
        const omrPracticePageElement = document.getElementById('omr-practice-page');
        if (!omrPracticePageElement || omrPracticePageElement.dataset.initialized === 'true') {
             console.log("DEBUG_MERGE: OMR feature already initialized or screen not found.");
             return;
        }
        omrPracticePageElement.dataset.initialized = 'true';
        console.log("DEBUG_MERGE: OMR Practice feature initializing...");


        let currentTestConfig = {};
        let userAnswers = [],
            answerKey = [];
        let timerInterval, resultChartInstance, performanceChartInstance;
        const optionChars = ['A', 'B', 'C', 'D', 'E']; // Standard OMR options

        // showOmrScreen function (Scoped locally but called globally via window.)
        window.showOmrScreen = function(screenId) {
             console.log(`DEBUG_MERGE: showOmrScreen called for ID: ${screenId}`);
             const omrPage = document.getElementById('omr-practice-page');
             if (!omrPage) { console.error("DEBUG_MERGE: OMR practice page not found."); return; }

            document.querySelectorAll('#omr-practice-page .screen').forEach(screen => screen.classList.remove('active'));
            const screenToShow = document.getElementById(screenId);
            if (screenToShow) {
                screenToShow.classList.add('active');
                 console.log(`DEBUG_MERGE: OMR screen '${screenId}' activated.`);
                 // Specific actions when showing certain OMR screens
                 if (screenId === 'omr-history-screen') {
                     loadHistoryScreen(); // Load history data when showing history screen
                 } else if (screenId === 'omr-setup-screen') {
                      toggleTimerMinutes(); // Ensure timer input visibility is correct
                 }
            } else {
                console.error("DEBUG_MERGE: OMR screen not found:", screenId);
            }
        }

        // Get DOM elements
        const omrSetupFormElement = document.getElementById('omr-setup-form');
        const omrGoToSetupElement = document.getElementById('omr-go-to-setup');
        const omrGoToHistoryElement = document.getElementById('omr-go-to-history');
        const omrSubmitAnswersBtnElement = document.getElementById('omr-submit-answers-btn');
        const omrGenerateResultBtnElement = document.getElementById('omr-generate-result-btn');
        const omrTimerTypeRadios = document.querySelectorAll('input[name="omr-timer-type"]');
        const omrSetTimeContainerElement = document.getElementById('omr-set-time-container');


        // Add event listeners
        if (omrSetupFormElement) {
            omrSetupFormElement.addEventListener('submit', handleSetupFormSubmit);
             console.log("DEBUG_MERGE: OMR Setup form listener attached.");
        } else { console.warn("DEBUG_MERGE: OMR Setup form not found."); }

        if (omrTimerTypeRadios) {
            omrTimerTypeRadios.forEach(radio => radio.addEventListener('change', toggleTimerMinutes));
            toggleTimerMinutes(); // Initial call to set visibility
             console.log("DEBUG_MERGE: OMR Timer type radio listeners attached.");
        } else { console.warn("DEBUG_MERGE: OMR Timer type radios not found."); }


        if(omrGoToSetupElement) omrGoToSetupElement.addEventListener('click', () => showOmrScreen('omr-setup-screen'));
        else console.warn("DEBUG_MERGE: OMR GoToSetup button not found.");

        if(omrGoToHistoryElement) omrGoToHistoryElement.addEventListener('click', loadHistoryScreen); // loadHistoryScreen calls showOmrScreen
        else console.warn("DEBUG_MERGE: OMR GoToHistory button not found.");


        if(omrSubmitAnswersBtnElement) omrSubmitAnswersBtnElement.addEventListener('click', handleSubmitAnswers);
        else console.warn("DEBUG_MERGE: OMR Submit Answers button not found.");

        if(omrGenerateResultBtnElement) omrGenerateResultBtnElement.addEventListener('click', handleGenerateResult);
        else console.warn("DEBUG_MERGE: OMR Generate Result button not found.");


        function toggleTimerMinutes() {
             console.log("DEBUG_MERGE: toggleTimerMinutes called.");
             const timerTypeRadio = document.querySelector('input[name="omr-timer-type"]:checked');
            const timerType = timerTypeRadio ? timerTypeRadio.value : 'none';
            if (omrSetTimeContainerElement) {
                 // Show time input only if 'set' is selected
                omrSetTimeContainerElement.style.display = timerType === 'set' ? 'block' : 'none';
                 console.log(`DEBUG_MERGE: Timer type set to '${timerType}'. Time input display: ${omrSetTimeContainerElement.style.display}`);
            } else {
                 console.warn("DEBUG_MERGE: OMR Set Time Container not found.");
            }
        }


        function handleSetupFormSubmit(event) {
            event.preventDefault();
            console.log("DEBUG_MERGE: OMR Setup form submitted.");

            // Get input values
            const examNameInput = document.getElementById('omr-exam-name');
            const chapterNameInput = document.getElementById('omr-chapter-name');
            const numQuestionsInput = document.getElementById('omr-num-questions');
            const numOptionsRadio = document.querySelector('input[name="omr-num-options"]:checked');
            const correctMarksInput = document.getElementById('omr-correct-marks');
            const negativeMarksInput = document.getElementById('omr-negative-marks');
            const timerTypeRadioChecked = document.querySelector('input[name="omr-timer-type"]:checked');
            const timerHoursInput = document.getElementById('omr-timer-hours');
            const timerMinutesInput = document.getElementById('omr-timer-minutes');
            const timerSecondsInput = document.getElementById('omr-timer-seconds');

             if (!examNameInput || !chapterNameInput || !numQuestionsInput || !numOptionsRadio || !correctMarksInput || !negativeMarksInput || !timerTypeRadioChecked || !timerHoursInput || !timerMinutesInput || !timerSecondsInput) {
                  console.error("DEBUG_MERGE: One or more OMR setup form elements not found.");
                  alert("Error submitting form. Please refresh.");
                  return;
             }

            const hours = parseInt(timerHoursInput.value) || 0;
            const minutes = parseInt(timerMinutesInput.value) || 0;
            const seconds = parseInt(timerSecondsInput.value) || 0;

            // Store test configuration
            currentTestConfig = {
                examName: examNameInput.value.trim() || 'Untitled Exam', // Default name
                chapterName: chapterNameInput.value.trim() || 'Untitled Chapter', // Default name
                numQuestions: parseInt(numQuestionsInput.value),
                numOptions: parseInt(numOptionsRadio.value),
                correctMarks: parseFloat(correctMarksInput.value),
                negativeMarks: parseFloat(negativeMarksInput.value),
                timerType: timerTypeRadioChecked.value,
                timerTotalSeconds: (hours * 3600) + (minutes * 60) + seconds,
            };

             console.log("DEBUG_MERGE: OMR Test Config:", currentTestConfig);

             // Basic validation for numbers
             if (isNaN(currentTestConfig.numQuestions) || currentTestConfig.numQuestions <= 0) {
                 alert("Please enter a valid number of questions.");
                 console.log("DEBUG_MERGE: OMR validation failed: numQuestions.");
                 return;
             }
             if (isNaN(currentTestConfig.correctMarks) || currentTestConfig.correctMarks < 0) {
                  alert("Please enter valid marks for correct answers.");
                  console.log("DEBUG_MERGE: OMR validation failed: correctMarks.");
                  return;
             }
             if (isNaN(currentTestConfig.negativeMarks) || currentTestConfig.negativeMarks < 0) {
                  alert("Please enter valid marks for negative answers.");
                  console.log("DEBUG_MERGE: OMR validation failed: negativeMarks.");
                  return;
             }
             if (currentTestConfig.timerType === 'set' && (isNaN(currentTestConfig.timerTotalSeconds) || currentTestConfig.timerTotalSeconds <= 0)) {
                  alert("Please set a valid timer duration greater than 0.");
                   console.log("DEBUG_MERGE: OMR validation failed: timerTotalSeconds.");
                   return;
             }
             if (currentTestConfig.numOptions < 2 || currentTestConfig.numOptions > optionChars.length) {
                 alert(`Number of options must be between 2 and ${optionChars.length}.`);
                 console.log("DEBUG_MERGE: OMR validation failed: numOptions.");
                 return;
             }


            const omrPracticeExamNameElement = document.getElementById('omr-practice-exam-name');
            if (omrPracticeExamNameElement) {
                 omrPracticeExamNameElement.textContent = `${currentTestConfig.examName} - ${currentTestConfig.chapterName}`; // Show both exam and chapter
            } else {
                 console.warn("DEBUG_MERGE: OMR practice exam name element not found.");
            }

            generateOMRSheet('omr-sheet-container', 'omr-user-q'); // Generate the sheet for user answers
            startOmrTimer(); // Start the timer
            showOmrScreen('omr-practice-screen'); // Navigate to the practice screen
             console.log("DEBUG_MERGE: OMR practice screen started.");
        }


        function startOmrTimer() {
            console.log("DEBUG_MERGE: startOmrTimer called.");
            clearInterval(timerInterval); // Clear any existing timer

            const timerEl = document.getElementById('omr-timer');
            if (!timerEl) {
                 console.warn("DEBUG_MERGE: OMR timer element not found.");
                 return;
            }

            let seconds;
            // Hide timer if type is 'none'
            if (currentTestConfig.timerType === 'none') {
                timerEl.style.display = 'none';
                console.log("DEBUG_MERGE: Timer type is 'none', hiding timer.");
                return;
            }

            timerEl.style.display = 'block'; // Show timer
            // Set initial time based on timer type
            seconds = currentTestConfig.timerType === 'set' ? currentTestConfig.timerTotalSeconds : 0;
            console.log(`DEBUG_MERGE: Starting OMR timer. Type: ${currentTestConfig.timerType}, Initial Seconds: ${seconds}`);

            timerInterval = setInterval(() => {
                 // Decrement for set time, increment for stopwatch
                if (currentTestConfig.timerType === 'set') {
                    seconds--;
                    // Stop timer and submit if time runs out
                    if (seconds < 0) {
                        clearInterval(timerInterval);
                        console.log("DEBUG_MERGE: OMR Timer finished.");
                        alert('Time is up! Submitting your answers.');
                        handleSubmitAnswers(); // Automatically submit answers
                        return;
                    }
                } else { // Stopwatch mode
                    seconds++;
                }
                 // Format and display time (HH:MM:SS)
                const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
                const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
                const s = (seconds % 60).toString().padStart(2, '0');
                timerEl.textContent = `${h}:${m}:${s}`;

            }, 1000); // Update every 1000ms (1 second)
             console.log("DEBUG_MERGE: OMR timer interval started.");
        }


        // Click handler for OMR options to allow deselecting
        // Attached to the page element itself for event delegation
        if(omrPracticePageElement) {
            omrPracticePageElement.addEventListener('click', (event) => {
                 // Check if the clicked element is a radio input within an options container
                if (event.target.type === 'radio' && event.target.closest('.options-container')) {
                     console.log(`DEBUG_MERGE: OMR radio clicked: ${event.target.name}, value: ${event.target.value}`);
                     // Check if this radio was the last one checked in this group
                    if (lastCheckedRadio === event.target) {
                        event.target.checked = false; // Deselect it
                        lastCheckedRadio = null; // Clear the last checked reference
                         console.log("DEBUG_MERGE: Radio unchecked (deselected).");
                    } else {
                         // If a different radio in the group or a new group, update lastCheckedRadio
                        lastCheckedRadio = event.target;
                         console.log("DEBUG_MERGE: Radio checked.");
                    }
                }
            });
             console.log("DEBUG_MERGE: OMR radio deselect listener attached to page.");
        } else { console.warn("DEBUG_MERGE: OMR practice page element not found for radio listener."); }


        function generateOMRSheet(containerId, namePrefix) {
             console.log(`DEBUG_MERGE: generateOMRSheet called for container: ${containerId}, prefix: ${namePrefix}`);
            const container = document.getElementById(containerId);
            if (!container) {
                 console.error(`DEBUG_MERGE: OMR container element not found: ${containerId}.`);
                 return;
            }
            container.innerHTML = ''; // Clear existing content

            if (currentTestConfig.numQuestions <= 0) {
                 container.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No questions configured.</p>';
                 console.warn("DEBUG_MERGE: Cannot generate OMR sheet, numQuestions is 0 or less.");
                 return;
            }

            let html = '';
            // Loop through the number of questions specified in config
            for (let i = 1; i <= currentTestConfig.numQuestions; i++) {
                html += `<div class="question-row"><span class="q-number">${i}.</span><div class="options-container">`;
                 // Loop through the number of options specified in config
                for (let j = 0; j < currentTestConfig.numOptions; j++) {
                    const option = optionChars[j]; // Get option character (A, B, C...)
                     // Create radio button and label for each option
                    html += `<input type="radio" id="${namePrefix}-${i}-${option}" name="${namePrefix}-${i}" value="${option}"><label for="${namePrefix}-${i}-${option}">${option}</label>`;
                }
                html += `</div></div>`;
            }
            container.innerHTML = html;
            console.log(`DEBUG_MERGE: OMR sheet generated with ${currentTestConfig.numQuestions} questions and ${currentTestConfig.numOptions} options per question.`);
        }


        function handleSubmitAnswers() {
            console.log("DEBUG_MERGE: handleSubmitAnswers called.");
            clearInterval(timerInterval); // Stop the timer

            userAnswers = []; // Reset user answers array
            // Collect user's selected answer for each question
            for (let i = 1; i <= currentTestConfig.numQuestions; i++) {
                 // Find the selected radio button for question 'i'
                const selected = document.querySelector(`input[name="omr-user-q-${i}"]:checked`);
                 // Store the value of the selected option, or 'NA' if none is selected
                userAnswers.push(selected ? selected.value : 'NA');
            }
            console.log("DEBUG_MERGE: User Answers Collected:", userAnswers);

            // Generate the OMR sheet for entering the answer key
            generateOMRSheet('omr-key-sheet-container', 'omr-key-q');
            showOmrScreen('omr-key-entry-screen'); // Navigate to the key entry screen
             console.log("DEBUG_MERGE: Answers submitted, moving to key entry screen.");
        }


        function handleGenerateResult() {
            console.log("DEBUG_MERGE: handleGenerateResult called.");
            answerKey = []; // Reset answer key array
            // Collect the answer key entered by the user
            for (let i = 1; i <= currentTestConfig.numQuestions; i++) {
                 // Find the selected radio button for the key of question 'i'
                const selected = document.querySelector(`input[name="omr-key-q-${i}"]:checked`);
                 // Store the value of the selected key option, or 'NA' if none is selected
                answerKey.push(selected ? selected.value : 'NA');
            }
            console.log("DEBUG_MERGE: Answer Key Collected:", answerKey);

            // Calculate and display the results
            calculateAndDisplayOmrResults(); // This function handles calculation and display HTML
            showOmrScreen('omr-result-screen'); // Navigate to the result screen
             console.log("DEBUG_MERGE: Answer key submitted, calculating and displaying results.");
        }

        // calculateAndDisplayOmrResults function (Scoped locally but called globally via window.)
        window.calculateAndDisplayOmrResults = function(resultData = null, originScreen = 'omr-home-screen') { // Make globally accessible for history view
             console.log("DEBUG_MERGE: calculateAndDisplayOmrResults called.");
             // Use provided resultData (from history) or current session data
            const data = resultData || {
                config: currentTestConfig,
                answers: userAnswers,
                key: answerKey,
                date: new Date().toISOString() // Record date for history
            };
            const {
                config,
                answers,
                key,
                date
            } = data;

            // Check for inconsistent data length (e.g., key entered for different number of questions)
             if (answers.length !== key.length || answers.length !== config.numQuestions) {
                  console.error("DEBUG_MERGE: Inconsistent data length for OMR result calculation.", {answersLength: answers.length, keyLength: key.length, configNumQuestions: config.numQuestions});
                  alert("Error calculating results. Data is inconsistent.");
                   const resultScreen = document.getElementById('omr-result-screen');
                   if(resultScreen) resultScreen.innerHTML = '<main class="main-content"><p style="color: var(--danger); text-align: center;">Error calculating results. Inconsistent data.</p></main>';
                  return;
             }


            let correct = 0,
                wrong = 0,
                skipped = 0,
                score = 0;
            const attempted = answers.filter(ans => ans !== 'NA').length; // Count questions where user marked an option

            // Calculate score based on config and answers vs key
            for (let i = 0; i < config.numQuestions; i++) {
                if (answers[i] === 'NA') { // User skipped the question
                     skipped++;
                } else if (answers[i] === key[i]) { // User's answer matches the key
                    correct++;
                    score += config.correctMarks;
                } else { // User's answer does not match the key, and it wasn't skipped
                    wrong++;
                    score -= config.negativeMarks;
                }
            }

            const totalMarks = config.numQuestions * config.correctMarks; // Maximum possible score
            // Calculate accuracy (percentage of attempted questions that were correct)
            const accuracy = attempted > 0 ? (correct / attempted * 100).toFixed(2) : '0.00';
            // Calculate overall percentage (score out of total possible marks)
            const percentage = totalMarks > 0 ? (score / totalMarks * 100).toFixed(2) : '0.00';

            // Display the score board summary
            const omrScoreBoardElement = document.getElementById('omr-score-board');
            if (omrScoreBoardElement) {
                 omrScoreBoardElement.innerHTML = `<tr><td>Result</td><td><b>${score.toFixed(2)} / ${totalMarks.toFixed(2)}</b></td></tr><tr><td>Correct Answers</td><td>${correct}</td></tr><tr><td>Wrong Answers</td><td>${wrong}</td></tr><tr><td>Not Attempted</td><td>${skipped}</td></tr><tr><td>Accuracy (of attempted)</td><td>${accuracy}%</td></tr><tr><td>Overall Percentage</td><td>${percentage}%</td></tr><tr><td>Exam Date</td><td>${new Date(date).toLocaleString()}</td></tr>`; // Updated Accuracy/Percentage labels
                 console.log("DEBUG_MERGE: OMR Score board rendered.");
            } else { console.warn("DEBUG_MERGE: OMR score board element not found."); }


            renderOmrResultChart([correct, wrong, skipped]); // Render the doughnut chart

            // Generate the detailed analysis table
            let tableHtml = `<thead><tr><th>Q.No.</th><th>Your Ans</th><th>Correct Ans</th><th>Status</th><th>Tag Error</th></tr></thead><tbody>`;
            for (let i = 0; i < config.numQuestions; i++) {
                let status, statusClass, statusIcon;
                const userAnswer = answers[i];
                const correctAnswer = key[i];

                if (userAnswer === 'NA') {
                    status = 'Skipped';
                    statusClass = 'status-skipped';
                    statusIcon = 'icon-skipped';
                } else if (userAnswer === correctAnswer) {
                    status = 'Correct';
                    statusClass = 'status-correct';
                    statusIcon = 'icon-correct';
                } else {
                    status = 'Wrong';
                    statusClass = 'status-wrong';
                    statusIcon = 'icon-wrong';
                }
                 // Render each row in the table
                tableHtml += `<tr class="${statusClass}"><td>${i + 1}</td><td>${userAnswer}</td><td>${correctAnswer}</td><td><span class="status-icon ${statusIcon}"></span> ${status}</td><td>${status === 'Wrong' ? `<select class="error-tag-select"><option value="">Tag Error Type</option><option value="silly">Silly Mistake</option><option value="concept">Conceptual Gap</option><option value="time">Time Pressure</option><option value="misread">Misread Question</option><option value="calculation">Calculation Error</option></select>` : '—'}</td></tr>`; // Added more options and Status text
            }
            const omrDetailedAnalysisTableElement = document.getElementById('omr-detailed-analysis-table');
            if (omrDetailedAnalysisTableElement) {
                omrDetailedAnalysisTableElement.innerHTML = tableHtml + `</tbody>`;
                 console.log("DEBUG_MERGE: OMR Detailed analysis table rendered.");
            } else { console.warn("DEBUG_MERGE: OMR detailed analysis table element not found."); }


             // Set the back button's onclick handler based on where the result was viewed from (practice or history)
            const omrResultScreenBackButton = document.querySelector('#omr-result-screen .btn-secondary');
            if (omrResultScreenBackButton) {
                 // Use window.showOmrScreen for navigation
                 omrResultScreenBackButton.setAttribute('onclick', `window.showOmrScreen('${originScreen}')`);
                 console.log(`DEBUG_MERGE: OMR Result screen back button set to go to '${originScreen}'.`);
            } else { console.warn("DEBUG_MERGE: OMR Result screen back button not found."); }


            // Open the summary tab by default
            openOmrTab(null, 'omr-summary'); // Pass null for event, 'omr-summary' tab ID
             console.log("DEBUG_MERGE: OMR Summary tab opened.");

            // Save the test result to history if it's a new result (not loaded from history)
            if (!resultData) {
                saveTestToHistory(data);
                 console.log("DEBUG_MERGE: OMR Result saved to history.");
            }
             console.log("DEBUG_MERGE: calculateAndDisplayOmrResults finished.");
        }


        function renderOmrResultChart(data) {
             console.log("DEBUG_MERGE: renderOmrResultChart called with data:", data);
            const ctx = document.getElementById('omr-result-chart')?.getContext('2d'); // Use optional chaining
            if (!ctx) {
                 console.warn("DEBUG_MERGE: OMR result chart canvas not found.");
                 return;
            }

            const omrPage = document.getElementById('omr-practice-page');
            if (!omrPage) { console.error("DEBUG_MERGE: OMR practice page not found for chart styling."); return; }
            const style = getComputedStyle(document.body); // Get computed styles from body

            // Get colors from CSS variables
            const correctColor = style.getPropertyValue('--success').trim();
            const wrongColor = style.getPropertyValue('--danger').trim();
            const skippedColor = style.getPropertyValue('--neutral-gray').trim();
            const containerBg = style.getPropertyValue('--surface').trim(); // Background color for border
            const textColor = style.getPropertyValue('--text-muted-color').trim(); // Text color for labels

             // Destroy previous chart instance if it exists
            if (resultChartInstance) resultChartInstance.destroy();
             console.log("DEBUG_MERGE: Rendering new OMR doughnut chart.");
            resultChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Correct', 'Wrong', 'Skipped'],
                    datasets: [{
                        data: data, // [correct, wrong, skipped] counts
                        backgroundColor: [correctColor, wrongColor, skippedColor],
                        borderColor: containerBg, // Border color around slices
                        borderWidth: 5
                    }]
                },
                options: {
                    responsive: true, // Make chart responsive
                    maintainAspectRatio: false, // Allow height to be controlled by CSS
                    cutout: '70%', // Size of the inner hole
                    plugins: {
                        legend: { // Legend position and styling
                            position: 'bottom',
                            labels: {
                                color: textColor,
                                font: {
                                    family: "'Poppins', sans-serif" // Use app font
                                }
                            }
                        },
                        tooltip: { // Tooltip styling
                             callbacks: {
                                 label: function(context) {
                                     let label = context.label || '';
                                     if (label) {
                                         label += ': ';
                                     }
                                     if (context.raw !== undefined) {
                                         label += context.raw;
                                     }
                                     return label;
                                 }
                             },
                             bodyFont: { family: "'Poppins', sans-serif" },
                             titleFont: { family: "'Poppins', sans-serif" }
                        }
                    }
                }
            });
             console.log("DEBUG_MERGE: OMR doughnut chart rendered.");
        }


        // openOmrTab function (Scoped locally but called globally via window.)
        window.openOmrTab = function(evt, tabName) { // Make globally accessible for button clicks
             console.log(`DEBUG_MERGE: openOmrTab called for tab: ${tabName}`);
             const omrPage = document.getElementById('omr-practice-page');
             if (!omrPage) { console.error("DEBUG_MERGE: OMR practice page not found for tabs."); return; }

            // Remove 'active' class from all tabs and buttons
            document.querySelectorAll('#omr-practice-page .tab-content, #omr-practice-page .tab-btn').forEach(el => el?.classList.remove('active'));

            // Add 'active' class to the selected tab content
            const tabContentElement = document.getElementById(tabName);
            if (tabContentElement) {
                 tabContentElement.classList.add('active');
                 console.log(`DEBUG_MERGE: Tab content '${tabName}' activated.`);
            } else {
                 console.warn(`DEBUG_MERGE: Tab content element '${tabName}' not found.`);
            }


            // Add 'active' class to the clicked button
            const activeBtn = evt ? evt.currentTarget : document.querySelector(`#omr-practice-page .tab-btn[onclick*="'${tabName}'"]`);
            if (activeBtn) {
                 activeBtn.classList.add('active');
                 console.log(`DEBUG_MERGE: Tab button for '${tabName}' activated.`);
            } else {
                 console.warn(`DEBUG_MERGE: Tab button for '${tabName}' not found.`);
            }
        }

        function saveTestToHistory(resultData) {
             console.log("DEBUG_MERGE: saveTestToHistory called.");
            // Load existing history or initialize an empty array
            let history = JSON.parse(localStorage.getItem('conceptra-omr-history') || '[]');
            // Add the new result to the beginning of the array
            history.unshift(resultData);
            // Limit history size (optional, e.g., keep last 20)
             // if (history.length > 20) {
             //     history = history.slice(0, 20);
             // }
            // Save the updated history back to localStorage
            saveToStorage('conceptra-omr-history', history);
             console.log(`DEBUG_MERGE: Test result saved to history. History size: ${history.length}`);
        }


        function loadHistoryScreen() {
             console.log("DEBUG_MERGE: loadHistoryScreen called.");
            // Show the history screen first
            showOmrScreen('omr-history-screen');

            // Load history from localStorage
            let history = JSON.parse(localStorage.getItem('conceptra-omr-history') || '[]');
             // Ensure history is an array
            if (!Array.isArray(history)) {
                 history = [];
                 console.warn("DEBUG_MERGE: OMR History data in localStorage is not an array. Resetting.");
                 saveToStorage('conceptra-omr-history', []); // Save an empty array if invalid data found
            }

            const listEl = document.getElementById('omr-history-list');
            const omrPerformanceGraphContainerElement = document.getElementById('omr-performance-graph-container');

            if (!listEl) { console.error("DEBUG_MERGE: OMR history list element not found."); return; }

            listEl.innerHTML = ''; // Clear current list display

            // Hide graph container initially
            if (omrPerformanceGraphContainerElement) omrPerformanceGraphContainerElement.style.display = 'none';


            if (history.length === 0) {
                listEl.innerHTML = '<li style="text-align:center; color: var(--text-muted-color);">No test history found.</li>';
                console.log("DEBUG_MERGE: No OMR history found to display.");
                return;
            }

             console.log(`DEBUG_MERGE: Loading ${history.length} OMR history items.`);
            // Sort history by date descending (newest first)
            history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            history.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'history-item';
                 // Generate HTML for each history item
                li.innerHTML = `
                    <div class="history-item-info">
                        <div class="history-item-name">${item.config?.examName || 'Untitled Test'}</div> <!-- Use optional chaining -->
                        <div class="history-item-date">${item.date ? new Date(item.date).toLocaleString() : 'N/A'}</div>
                    </div>
                    <button class="delete-btn" title="Delete this entry">🗑️</button>
                `;
                 // Add click listener to the info area to view result
                li.querySelector('.history-item-info')?.addEventListener('click', () => { // Use optional chaining
                     console.log(`DEBUG_MERGE: Viewing history item index ${index}.`);
                     // Calculate and display result for this item, indicating origin is history
                    calculateAndDisplayOmrResults(item, 'omr-history-screen');
                     // Navigate to the result screen
                    showOmrScreen('omr-result-screen');
                });
                 // Add click listener to the delete button
                li.querySelector('.delete-btn')?.addEventListener('click', (e) => { // Use optional chaining
                    e.stopPropagation(); // Prevent the parent li's click from firing
                     console.log(`DEBUG_MERGE: Attempting to delete history item index ${index}.`);
                    deleteHistoryItem(index); // Call delete function
                });
                listEl.appendChild(li); // Add item to the list
            });

            // Render the performance graph using the loaded history data
            renderPerformanceGraph(history);
             console.log("DEBUG_MERGE: OMR history displayed.");
        }

        // deleteHistoryItem function (Scoped locally but called globally via window.)
        window.deleteHistoryItem = function(index) { // Make globally accessible
             console.log(`DEBUG_MERGE: deleteHistoryItem called for index: ${index}.`);
            if (confirm('Are you sure you want to delete this test history?')) {
                 console.log("DEBUG_MERGE: User confirmed deletion.");
                let history = JSON.parse(localStorage.getItem('conceptra-omr-history') || '[]');
                 // Ensure history is an array and index is valid
                if (!Array.isArray(history) || index < 0 || index >= history.length) {
                     console.error("DEBUG_MERGE: Invalid history data or index for deletion.");
                     alert("Error deleting history item.");
                     return;
                }
                // Remove the item at the specified index
                history.splice(index, 1);
                saveToStorage('conceptra-omr-history', history); // Save the updated history
                loadHistoryScreen(); // Reload and re-render the history screen
                 console.log(`DEBUG_MERGE: OMR history item at index ${index} deleted.`);
            } else {
                 console.log("DEBUG_MERGE: OMR history deletion cancelled by user.");
            }
        }


        function renderPerformanceGraph(history) {
             console.log("DEBUG_MERGE: renderPerformanceGraph called.");
            const graphContainer = document.getElementById('omr-performance-graph-container');
            const ctx = document.getElementById('omr-performance-chart')?.getContext('2d'); // Use optional chaining
            if (!ctx || !graphContainer) {
                 console.warn("DEBUG_MERGE: OMR performance chart canvas or container not found.");
                 // Ensure container is hidden if elements are missing
                 if (graphContainer) graphContainer.style.display = 'none';
                 return;
            }

             // Group tests by exam name to find the most frequently taken test series
            const testGroups = history.reduce((acc, test) => {
                const name = test.config?.examName || 'Untitled'; // Use optional chaining
                if (!acc[name]) acc[name] = [];
                acc[name].push(test);
                return acc;
            }, {});

            // Find the group with the most tests
            let largestGroup = Object.values(testGroups).sort((a, b) => b.length - a.length)[0];

             // If there's no group with at least 2 tests, hide the graph
            if (!largestGroup || largestGroup.length < 2) {
                graphContainer.style.display = 'none';
                 console.log("DEBUG_MERGE: Not enough data (need at least 2 tests in a series) to render performance graph. Hiding graph.");
                return;
            }

             // Show the graph container
            graphContainer.style.display = 'block';
            largestGroup.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest to newest for graph trend
            const labels = largestGroup.map((_, i) => `Test ${i+1}`); // Labels for the X-axis (Test 1, Test 2, ...)

             // Calculate the score percentage for each test in the series
            const dataPoints = largestGroup.map(test => {
                const {
                    config,
                    answers,
                    key
                } = test;
                let score = 0;
                 // Recalculate score based on stored config/answers/key
                 if (config && Array.isArray(answers) && Array.isArray(key) && answers.length === key.length && answers.length === config.numQuestions) {
                      for (let i = 0; i < config.numQuestions; i++) {
                          if (answers[i] === key[i]) score += config.correctMarks;
                          else if (answers[i] !== 'NA') score -= config.negativeMarks;
                      }
                      const totalMarks = config.numQuestions * config.correctMarks;
                      // Return percentage, defaulting to 0 if total marks is 0
                      return totalMarks > 0 ? parseFloat(((score / totalMarks) * 100).toFixed(2)) : 0; // Ensure it's a number
                 } else {
                     console.warn("DEBUG_MERGE: Skipping inconsistent history item for performance graph:", test);
                     return 0; // Return 0 for inconsistent data
                 }
            });

            const style = getComputedStyle(document.body); // Get computed styles
            // Get colors from CSS variables
            const primaryColor = style.getPropertyValue('--primary').trim();
            // Generate a transparent version of the primary color for the fill area
            const primaryColorTransparent = `color-mix(in srgb, ${primaryColor} 20%, transparent)`;
            const textColor = style.getPropertyValue('--text-muted-color').trim(); // Text color for labels/grid lines
            const gridColor = style.getPropertyValue('--border-color').trim(); // Grid line color


             // Destroy previous chart instance if it exists
            if (performanceChartInstance) performanceChartInstance.destroy();

             console.log(`DEBUG_MERGE: Rendering OMR performance graph for "${largestGroup[0].config?.examName}".`);
            performanceChartInstance = new Chart(ctx, {
                type: 'line', // Line chart for trend
                data: {
                    labels: labels, // Test numbers
                    datasets: [{
                        label: `Performance for "${largestGroup[0].config?.examName || 'Untitled Test'}"`, // Label for the line
                        data: dataPoints, // Score percentages
                        fill: true, // Fill area below the line
                        backgroundColor: primaryColorTransparent, // Fill color
                        borderColor: primaryColor, // Line color
                        tension: 0.1 // Smoothness of the line (0 = straight lines)
                    }]
                },
                options: {
                    responsive: true, // Make chart responsive
                    maintainAspectRatio: false, // Allow height to be controlled by CSS
                    plugins: {
                        legend: {
                            labels: {
                                color: textColor, // Legend text color
                                font: { family: "'Poppins', sans-serif" }
                            }
                        },
                        tooltip: { // Tooltip styling and format
                             callbacks: {
                                 label: function(context) {
                                     // Display percentage in tooltip
                                     return `${context.raw}%`;
                                 }
                             },
                              bodyFont: { family: "'Poppins', sans-serif" },
                              titleFont: { family: "'Poppins', sans-serif" }
                        }
                    },
                    scales: {
                        y: { // Y-axis (Percentage Score)
                            beginAtZero: true, // Start at 0
                            max: 100, // Max is 100%
                            ticks: {
                                color: textColor, // Tick mark color
                                font: { family: "'Poppins', sans-serif" },
                                callback: function(value) { return value + '%'; } // Add '%' to ticks
                            },
                            grid: {
                                color: gridColor // Grid line color
                            }
                        },
                        x: { // X-axis (Test Number)
                            ticks: {
                                color: textColor, // Tick mark color
                                font: { family: "'Poppins', sans-serif" }
                            },
                            grid: {
                                color: 'transparent' // Hide vertical grid lines
                            }
                        }
                    }
                }
            });
             console.log("DEBUG_MERGE: OMR performance graph rendered.");
        }
         console.log("DEBUG_MERGE: initOmrPracticeFeature finished.");
    }
    // --- END OMR Practice Feature ---


    // --- Flashcard Feature (FROM New File.js) ---
    // Note: This uses a simple in-memory object model, not Firebase/Firestore yet.
    function initFlashcardFeature() {
        console.log("DEBUG_MERGE: initFlashcardFeature called.");
        const flashcardScreen = document.getElementById('flashcard-screen');
        if (!flashcardScreen || flashcardScreen.dataset.initialized) {
             console.log("DEBUG_MERGE: Flashcard feature already initialized or screen not found.");
             return;
        }
        flashcardScreen.dataset.initialized = 'true';
         console.log("DEBUG_MERGE: Flashcard feature initializing...");

        // Initial dummy data (replace with localStorage loading if persistence is needed)
        let appData = {
            decks: [{
                id: 1,
                name: "Biology Basics",
                cards: [{
                    id: 1,
                    q: "What is the powerhouse of the cell?",
                    a: "Mitochondria",
                    status: "good" // Spaced Repetition System status: 'again', 'hard', 'good', 'easy'
                }, {
                    id: 2,
                    q: "What is the process plants use to make food?",
                    a: "Photosynthesis",
                    status: "hard"
                }, {
                    id: 3,
                    q: "What are the building blocks of proteins?",
                    a: "Amino Acids",
                    status: "again"
                }, ]
            }, {
                id: 2,
                name: "World Capitals",
                cards: [{
                    id: 4,
                    q: "What is the capital of Japan?",
                    a: "Tokyo",
                    status: "easy"
                }, {
                    id: 5,
                    q: "What is the capital of Canada?",
                    a: "Ottawa",
                    status: "good"
                }, ]
            }],
            currentDeckId: null, // ID of the currently viewed deck
            currentCardIndex: 0, // Index of the current card in the deck's cards array
            nextCardId: 6, // Counter for new card IDs
            nextDeckId: 3, // Counter for new deck IDs
        };

        // Load data from localStorage if available
         const savedFlashcards = loadFromStorage('conceptra_flashcards');
         if (savedFlashcards) {
             appData = savedFlashcards;
              console.log("DEBUG_MERGE: Flashcard data loaded from storage.");
              // Ensure counters are correct based on loaded data
              const maxCardId = appData.decks.reduce((max, deck) =>
                  Math.max(max, ...deck.cards.map(card => card.id || 0)), 0);
              appData.nextCardId = maxCardId + 1;

              const maxDeckId = appData.decks.reduce((max, deck) => Math.max(max, deck.id || 0), 0);
              appData.nextDeckId = maxDeckId + 1;

         } else {
              console.log("DEBUG_MERGE: No Flashcard data found in storage. Using default data.");
         }


        // Get DOM elements related to the flashcard feature screen
        const subScreens = flashcardScreen.querySelectorAll('.flash-sub-screen'); // All sub-screens within flashcards
        const decksNavButton = flashcardScreen.querySelector('.bottom-nav .nav-btn[data-screen="deckHubScreen"]'); // Nav button for the deck hub (if it exists)

        const deckGrid = flashcardScreen.querySelector('#deckGrid'); // Container for deck cards
        const backToDecksBtn = flashcardScreen.querySelector('#backToDecksBtn'); // Button to go back to deck hub
        const deckNameHeader = flashcardScreen.querySelector('#deckNameHeader'); // Header showing current deck name
        const questionInput = flashcardScreen.querySelector('#questionInput'); // Input for new card question
        const answerInput = flashcardScreen.querySelector('#answerInput'); // Input for new card answer
        const addFlashcardBtn = flashcardScreen.querySelector('#addFlashcardBtn'); // Button to add new card

        const flashcardNav = flashcardScreen.querySelector('.flashcard-nav'); // Container for card navigation buttons (prev/next)
        const prevCardBtn = flashcardScreen.querySelector('#prevCardBtn'); // Previous card button
        const nextCardBtn = flashcardScreen.querySelector('#nextCardBtn'); // Next card button
        const flashcardContainer = flashcardScreen.querySelector('#flashcardContainer'); // Container for the current flashcard display
        const cardActions = flashcardScreen.querySelector('#cardActions'); // Container for actions like "Show Answer" / SRS buttons


        // Function to show a specific sub-screen within the flashcard feature
        function showFlashcardSubScreen(screenId) {
             console.log(`DEBUG_MERGE: showFlashcardSubScreen called for ID: ${screenId}`);
            subScreens.forEach(screen => {
                if (screen) { // Ensure screen element exists
                     if (screen.id === screenId) {
                         screen.classList.add('active'); // Activate the target screen
                     } else {
                         screen.classList.remove('active'); // Deactivate other screens
                     }
                }
            });

            // Update the state of the bottom navigation button if applicable
            if(decksNavButton) {
                 decksNavButton.classList.toggle('active', screenId === 'deckHubScreen');
            }

            // Specific actions when showing the deck hub
            if (screenId === 'deckHubScreen') {
                 renderDeckHub(); // Re-render the deck list
                 console.log("DEBUG_MERGE: Deck Hub screen activated.");
            } else if (screenId === 'deckViewScreen') {
                console.log("DEBUG_MERGE: Deck View screen activated.");
                 // Ensure the flashcard is rendered when entering deck view
                 renderFlashcard();
            } else if (screenId === 'addCardScreen') {
                 console.log("DEBUG_MERGE: Add Card screen activated.");
                 // Reset add card form inputs (optional)
                 if (questionInput) questionInput.value = '';
                 if (answerInput) answerInput.value = '';
                 if (addFlashcardBtn) addFlashcardBtn.disabled = true; // Disable button initially
            }
        }

        // Add event listeners to the sub-screen navigation buttons (if they exist)
        if(decksNavButton) {
             decksNavButton.addEventListener('click', () => showFlashcardSubScreen('deckHubScreen'));
             console.log("DEBUG_MERGE: Flashcard Decks Nav Button listener attached.");
        }

        if(backToDecksBtn) {
             backToDecksBtn.addEventListener('click', () => showFlashcardSubScreen('deckHubScreen'));
             console.log("DEBUG_MERGE: Flashcard Back to Decks Button listener attached.");
        }

         // Function to save appData to localStorage
         function saveFlashcardData() {
             saveToStorage('conceptra_flashcards', appData);
              console.log("DEBUG_MERGE: Flashcard data saved to storage.");
         }


        // Function to render the list of decks in the deck hub
        function renderDeckHub() {
             console.log("DEBUG_MERGE: renderDeckHub called.");
            if (!deckGrid) { console.error("DEBUG_MERGE: Deck grid container not found."); return; }
            deckGrid.innerHTML = ''; // Clear existing deck elements

             // Render each existing deck card
            appData.decks.forEach(deck => {
                const deckEl = document.createElement('div');
                deckEl.className = 'deck-card';
                deckEl.dataset.deckId = deck.id;
                deckEl.innerHTML = `
                    <div class="deck-card-name">${deck.name}</div>
                    <div class="deck-card-count">${deck.cards.length} cards</div>
                    <div class="deck-actions">
                       <button class="delete-deck-btn" title="Delete Deck" onclick="window.deleteDeck(${deck.id}, event)">🗑️</button>
                    </div>`; // Added delete button
                 // Add click listener to open the deck (excluding the delete button click)
                deckEl.addEventListener('click', (e) => {
                     // Only open deck if click target is NOT the delete button or its icon
                     if (!e.target.closest('.delete-deck-btn')) {
                         console.log(`DEBUG_MERGE: Deck card clicked, opening deck ID: ${deck.id}`);
                         openDeck(deck.id);
                     }
                });
                deckGrid.appendChild(deckEl); // Add deck card to the grid
            });

             // Render the "Add New Deck" card
            const addDeckEl = document.createElement('div');
            addDeckEl.className = 'add-deck-card';
            addDeckEl.innerHTML = `<span class="plus-icon">+</span><div>New Deck</div>`;
            addDeckEl.addEventListener('click', createNewDeck); // Add click listener to create new deck
            deckGrid.appendChild(addDeckEl); // Add "Add Deck" card to the grid
             console.log("DEBUG_MERGE: Deck hub rendered.");
        }

        // Function to create a new deck
        function createNewDeck() {
             console.log("DEBUG_MERGE: createNewDeck called.");
             // Prompt user for the new deck name
            const name = prompt("Enter the name for your new deck:");
             // Validate name input
            if (name && name.trim() !== '') {
                const newDeck = {
                    id: appData.nextDeckId++, // Assign unique ID and increment counter
                    name: name.trim(), // Use trimmed name
                    cards: [] // New deck starts with no cards
                };
                appData.decks.push(newDeck); // Add the new deck to the data
                saveFlashcardData(); // Save changes to storage
                renderDeckHub(); // Re-render the deck hub to show the new deck
                 console.log(`DEBUG_MERGE: New deck "${newDeck.name}" created with ID ${newDeck.id}.`);
                // Optionally open the new deck immediately
                openDeck(newDeck.id);
            } else {
                 console.log("DEBUG_MERGE: New deck creation cancelled or name was empty.");
            }
        }

         // Function to delete a deck
        window.deleteDeck = function(deckId, event) { // Make globally accessible
             console.log(`DEBUG_MERGE: deleteDeck called for ID: ${deckId}.`);
             if (event) event.stopPropagation(); // Prevent click on parent card

            if (confirm("Are you sure you want to delete this deck and all its cards?")) {
                // Filter out the deck to delete
                appData.decks = appData.decks.filter(deck => deck.id !== deckId);
                saveFlashcardData(); // Save changes
                renderDeckHub(); // Re-render the deck hub
                 // If the deleted deck was the currently viewed one, navigate back to the hub
                 if (appData.currentDeckId === deckId) {
                     appData.currentDeckId = null; // Clear current deck state
                     showFlashcardSubScreen('deckHubScreen');
                 }
                 console.log(`DEBUG_MERGE: Deck with ID ${deckId} deleted.`);
            } else {
                 console.log("DEBUG_MERGE: Deck deletion cancelled.");
            }
        }


        // Function to open a specific deck and show the card view
        function openDeck(deckId) {
             console.log(`DEBUG_MERGE: openDeck called for ID: ${deckId}.`);
            appData.currentDeckId = deckId; // Set the current deck ID
             // Find the deck data
            const deck = appData.decks.find(d => d.id === deckId);
            if (deck) {
                 // Update the header with the deck name
                if (deckNameHeader) deckNameHeader.textContent = deck.name;
                appData.currentCardIndex = 0; // Start from the first card
                renderFlashcard(); // Render the current card
                showFlashcardSubScreen('deckViewScreen'); // Navigate to the deck view screen
                 console.log(`DEBUG_MERGE: Deck "${deck.name}" opened.`);
            } else {
                 console.error(`DEBUG_MERGE: Deck with ID ${deckId} not found.`);
                 appData.currentDeckId = null; // Reset state if deck not found
                 showFlashcardSubScreen('deckHubScreen'); // Go back to hub if deck not found
            }
        }

        // Function to render the currently active flashcard
        function renderFlashcard() {
            console.log(`DEBUG_MERGE: renderFlashcard called. Current card index: ${appData.currentCardIndex}.`);
            if (!flashcardContainer || !cardActions) {
                 console.error("DEBUG_MERGE: Flashcard container or card actions element not found.");
                 return;
            }

            flashcardContainer.innerHTML = ''; // Clear previous card content
            cardActions.innerHTML = ''; // Clear previous action buttons

            // Find the current deck and card
            const deck = appData.decks.find(d => d.id === appData.currentDeckId);

            // Handle case where deck is empty or not found
            if (!deck || !deck.cards || deck.cards.length === 0) {
                 console.log("DEBUG_MERGE: Current deck is empty or not found.");
                flashcardContainer.innerHTML = `<div class="flashcard-face" style="text-align:center; color: var(--flash-text-secondary); display:flex; align-items:center; justify-content:center; height: 100%;">Add a card to get started!</div>`;
                if(flashcardNav) flashcardNav.style.display = 'none'; // Hide navigation buttons
                // Optionally show a button to go to the add card screen
                 if(cardActions) cardActions.innerHTML = `<button class="btn btn-primary" onclick="showFlashcardSubScreen('addCardScreen')">Add First Card</button>`; // Assume an add card sub-screen ID exists
                 return; // Exit the function
            }

            if(flashcardNav) flashcardNav.style.display = 'flex'; // Show navigation buttons

            // Ensure the current card index is within bounds
            if (appData.currentCardIndex >= deck.cards.length) appData.currentCardIndex = 0;
            if (appData.currentCardIndex < 0) appData.currentCardIndex = deck.cards.length - 1;

            const card = deck.cards[appData.currentCardIndex];
            if (!card) {
                 console.error(`DEBUG_MERGE: Card at index ${appData.currentCardIndex} not found in deck ${appData.currentDeckId}.`);
                 flashcardContainer.innerHTML = `<div class="flashcard-face" style="text-align:center; color: var(--color-red); height: 100%;">Error loading card.</div>`;
                 if(flashcardNav) flashcardNav.style.display = 'none';
                 if(cardActions) cardActions.innerHTML = '';
                 return; // Exit on error
            }


            // Create the flashcard element
            const flashcardEl = document.createElement('div');
            flashcardEl.className = 'flashcard';
            flashcardEl.id = 'currentFlashcard'; // Assign ID for easier access


            // HTML for Spaced Repetition System (SRS) buttons on the back face
            const srsButtonsHTML = `
                <div class="srs-buttons">
                    <button class="btn btn-again" data-status="again">Again</button>
                    <button class="btn btn-hard" data-status="hard">Hard</button>
                    <button class="btn btn-good" data-status="good">Good</button>
                    <button class="btn btn-easy" data-status="easy">Easy</button>
                </div>`;

            // Structure of the flashcard element
            flashcardEl.innerHTML = `
                <div class="flashcard-inner">
                    <div class="flashcard-face flashcard-front">${card.q}</div>
                    <div class="flashcard-face flashcard-back">
                        <div class="flashcard-answer-text">${card.a}</div>
                        ${srsButtonsHTML}
                    </div>
                </div>
                 <div class="card-controls">
                    <!-- Use window.deleteCurrentCard -->
                    <button class="card-control-btn delete-btn" title="Delete Card" onclick="window.deleteCurrentCard()"><i class="fa-solid fa-trash"></i></button>
                 </div>`; // Added trash icon


            flashcardContainer.appendChild(flashcardEl); // Add the card to the container

            // Add click listener to the flashcard element to flip it (exclude button clicks)
            flashcardEl.addEventListener('click', (e) => {
                // Check if the click target or any parent up to flashcardEl is an SRS button or delete button
                if (!e.target.closest('.srs-buttons') && !e.target.closest('.delete-btn')) {
                     console.log("DEBUG_MERGE: Flashcard clicked, flipping.");
                    flipCard(); // Flip the card
                } else {
                     console.log("DEBUG_MERGE: Button within flashcard clicked, not flipping.");
                }
            });


            // Add click listener to SRS buttons (event delegation on the srs-buttons container)
            const srsContainerOnCard = flashcardEl.querySelector('.srs-buttons');
            if (srsContainerOnCard) {
                srsContainerOnCard.addEventListener('click', (e) => {
                    const statusBtn = e.target.closest('.btn'); // Find the clicked button
                    if (statusBtn && statusBtn.dataset.status) {
                        e.stopPropagation(); // Stop click event propagation
                         console.log(`DEBUG_MERGE: SRS button clicked: ${statusBtn.dataset.status}`);
                        // Update card status
                        deck.cards[appData.currentCardIndex].status = statusBtn.dataset.status;
                        saveFlashcardData(); // Save data after updating status
                        nextCard(); // Move to the next card
                    }
                });
                 console.log("DEBUG_MERGE: SRS buttons listener attached.");
            } else { console.warn("DEBUG_MERGE: SRS buttons container not found."); }


            // Add the "Show Answer" button to the cardActions container
            const showAnswerBtn = document.createElement('button');
            showAnswerBtn.id = 'showAnswerBtn'; // Assign ID
            showAnswerBtn.className = 'btn btn-primary';
            showAnswerBtn.textContent = 'Show Answer';
             // Use window.flipCard (or just flipCard as it's scoped)
            showAnswerBtn.onclick = (e) => {
                e.stopPropagation(); // Stop click event propagation
                 console.log("DEBUG_MERGE: Show Answer button clicked.");
                flipCard(); // Flip the card
            };
             if(cardActions) cardActions.appendChild(showAnswerBtn);
             else console.warn("DEBUG_MERGE: Card actions container not found.");


            // Hide the "Show Answer" button if the card is already flipped (e.g., returning from add card screen)
            // This logic might need adjustment based on how you handle state after adding/editing cards
             if (flashcardEl.classList.contains('is-flipped')) {
                 if(showAnswerBtn) showAnswerBtn.style.display = 'none';
            } else {
                 if(showAnswerBtn) showAnswerBtn.style.display = 'flex'; // Use flex to match button display
            }


            setupSwipe(flashcardContainer); // Add swipe gesture support to the card container
             console.log("DEBUG_MERGE: Flashcard rendered.");
        }

        // Function to flip the currently displayed flashcard
        function flipCard() {
             console.log("DEBUG_MERGE: flipCard called.");
            const currentCardElement = flashcardScreen.querySelector('#currentFlashcard');
            const showAnswerBtn = flashcardScreen.querySelector('#showAnswerBtn');

            if (currentCardElement) {
                currentCardElement.classList.toggle('is-flipped'); // Toggle the 'is-flipped' class

                // Toggle visibility of the "Show Answer" button based on flipped state
                if (showAnswerBtn) {
                     if (currentCardElement.classList.contains('is-flipped')) {
                         showAnswerBtn.style.display = 'none';
                     } else {
                         showAnswerBtn.style.display = 'flex'; // Use flex to show button
                     }
                }
                 console.log("DEBUG_MERGE: Flashcard flipped. is-flipped:", currentCardElement.classList.contains('is-flipped'));
            } else {
                 console.warn("DEBUG_MERGE: Current flashcard element not found for flipping.");
            }
        }

        // Add event listeners for next and previous card buttons (if they exist)
        if(prevCardBtn) {
             prevCardBtn.addEventListener('click', prevCard);
             console.log("DEBUG_MERGE: Flashcard Prev button listener attached.");
        }
        if(nextCardBtn) {
             nextCardBtn.addEventListener('click', nextCard);
              console.log("DEBUG_MERGE: Flashcard Next button listener attached.");
        }


        // Function to navigate to the next card
        function nextCard() {
             console.log("DEBUG_MERGE: nextCard called.");
            const deck = appData.decks.find(d => d.id === appData.currentDeckId);
            if (!deck || !deck.cards || deck.cards.length === 0) {
                 console.log("DEBUG_MERGE: Cannot go next, deck is empty or not found.");
                 renderFlashcard(); // Re-render just in case to show empty state
                 return;
            }

            appData.currentCardIndex++; // Increment index
             // Wrap around to the first card if at the end
            if (appData.currentCardIndex >= deck.cards.length) {
                 appData.currentCardIndex = 0;
                 console.log("DEBUG_MERGE: Reached end of deck, looping to first card.");
            }
            renderFlashcard(); // Render the new current card
             console.log(`DEBUG_MERGE: Moved to next card. New index: ${appData.currentCardIndex}`);
        }

        // Function to navigate to the previous card
        function prevCard() {
             console.log("DEBUG_MERGE: prevCard called.");
            const deck = appData.decks.find(d => d.id === appData.currentDeckId);
            if (!deck || !deck.cards || deck.cards.length === 0) {
                 console.log("DEBUG_MERGE: Cannot go prev, deck is empty or not found.");
                 renderFlashcard(); // Re-render just in case
                 return;
            }

            appData.currentCardIndex--; // Decrement index
             // Wrap around to the last card if at the beginning
            if (appData.currentCardIndex < 0) {
                appData.currentCardIndex = deck.cards.length - 1;
                 console.log("DEBUG_MERGE: Reached start of deck, looping to last card.");
            }
            renderFlashcard(); // Render the new current card
             console.log(`DEBUG_MERGE: Moved to previous card. New index: ${appData.currentCardIndex}`);
        }


        // Function to delete the currently displayed card
        window.deleteCurrentCard = function() { // Make globally accessible
             console.log("DEBUG_MERGE: deleteCurrentCard called.");
            const deck = appData.decks.find(d => d.id === appData.currentDeckId);
            if (!deck || !deck.cards || deck.cards.length === 0) {
                 console.warn("DEBUG_MERGE: No current card or deck found to delete.");
                 return;
            }

            if (confirm("Are you sure you want to delete this card permanently?")) {
                 console.log(`DEBUG_MERGE: User confirmed deletion of card index ${appData.currentCardIndex} in deck ${deck.id}.`);
                // Remove the card at the current index
                deck.cards.splice(appData.currentCardIndex, 1);
                saveFlashcardData(); // Save changes

                // Adjust currentCardIndex if the last card was deleted
                if (appData.currentCardIndex >= deck.cards.length && deck.cards.length > 0) {
                    appData.currentCardIndex = deck.cards.length - 1; // Stay on the new last card
                } else if (deck.cards.length === 0) {
                     appData.currentCardIndex = 0; // Reset index if deck is now empty
                }
                renderFlashcard(); // Render the updated state (either next card or empty message)

                 console.log("DEBUG_MERGE: Flashcard deleted.");

                // Update card count display in the deck hub if visible
                const deckGridInHub = document.getElementById('deckGrid'); // Get the deck grid (might not be visible)
                if (deckGridInHub) {
                     const deckCardInHub = deckGridInHub.querySelector(`.deck-card[data-deck-id="${deck.id}"] .deck-card-count`);
                     if(deckCardInHub) deckCardInHub.textContent = `${deck.cards.length} cards`;
                     console.log("DEBUG_MERGE: Updated card count in Deck Hub.");
                }

            } else {
                 console.log("DEBUG_MERGE: Flashcard deletion cancelled.");
            }
        }

        // Event listeners and logic for adding a new flashcard (assuming HTML elements exist)
         // Check if all necessary elements for adding cards exist
        if (questionInput && answerInput && addFlashcardBtn) {
            console.log("DEBUG_MERGE: Flashcard add card elements found, setting up listeners.");
            // Add input listeners to enable/disable the add button
            [questionInput, answerInput].forEach(input => {
                input.addEventListener('input', () => {
                     // Enable button only if both inputs have content
                    addFlashcardBtn.disabled = !(questionInput.value.trim() && answerInput.value.trim());
                });
            });

            // Add click listener to the add flashcard button
            addFlashcardBtn.addEventListener('click', () => {
                 console.log("DEBUG_MERGE: Add Flashcard button clicked.");
                const deck = appData.decks.find(d => d.id === appData.currentDeckId);
                // Ensure a deck is selected and inputs are valid
                if (!deck || !questionInput.value.trim() || !answerInput.value.trim()) {
                     console.warn("DEBUG_MERGE: Cannot add card: No deck selected or input fields empty.");
                     alert("Please select a deck and fill in both question and answer.");
                     return;
                }

                 // Create the new card object
                const newCard = {
                    id: appData.nextCardId++, // Assign unique ID and increment counter
                    q: questionInput.value.trim(),
                    a: answerInput.value.trim(),
                    status: 'again' // Default SRS status for new cards
                };
                deck.cards.push(newCard); // Add the new card to the current deck
                saveFlashcardData(); // Save changes

                // Clear input fields and disable button
                questionInput.value = '';
                answerInput.value = '';
                addFlashcardBtn.disabled = true;

                // If this was the first card added, set current index to 0
                if (deck.cards.length === 1) {
                    appData.currentCardIndex = 0;
                }
                renderFlashcard(); // Re-render to show the updated deck (might show the new card)
                alert('Flashcard added!'); // Provide feedback

                 console.log(`DEBUG_MERGE: New card added to deck ${deck.id}. Card ID: ${newCard.id}.`);

                // Update card count display in the deck hub if visible
                const deckGridInHub = document.getElementById('deckGrid'); // Get the deck grid (might not be visible)
                if (deckGridInHub) {
                     const deckCardInHub = deckGridInHub.querySelector(`.deck-card[data-deck-id="${deck.id}"] .deck-card-count`);
                     if(deckCardInHub) deckCardInHub.textContent = `${deck.cards.length} cards`;
                     console.log("DEBUG_MERGE: Updated card count in Deck Hub.");
                }
                 // Navigate back to deck view after adding a card (optional)
                 // showFlashcardSubScreen('deckViewScreen');
            });
        } else {
            console.warn("DEBUG_MERGE: Flashcard add card form elements not found. Add card functionality will be disabled.");
        }


        // Function to set up swipe gestures for navigating cards
        function setupSwipe(element) {
            console.log("DEBUG_MERGE: Setting up swipe gesture for flashcard.");
            if (!element) {
                 console.warn("DEBUG_MERGE: Swipe target element not found.");
                 return;
            }

            let startX = 0;
            let endX = 0;
            const minSwipeDistance = 50; // Minimum distance for a swipe

            // Touch start listener
            element.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX; // Record start X position
            }, { passive: true }); // Use passive listener for better scrolling performance

            // Touch end listener
            element.addEventListener('touchend', (e) => {
                endX = e.changedTouches[0].clientX; // Record end X position
                const deltaX = startX - endX; // Calculate horizontal distance

                // Check if it's a significant horizontal swipe
                if (Math.abs(deltaX) > minSwipeDistance) {
                     // Check if the card is flipped. Only navigate with swipes if showing the answer.
                     const currentCardElement = flashcardScreen.querySelector('#currentFlashcard');
                     if (currentCardElement && currentCardElement.classList.contains('is-flipped')) {
                          if (deltaX > 0) { // Swipe left (startX > endX)
                              console.log("DEBUG_MERGE: Swipe left detected, navigating to next card.");
                             nextCard(); // Go to next card
                          } else { // Swipe right (startX < endX)
                              console.log("DEBUG_MERGE: Swipe right detected, navigating to previous card.");
                             prevCard(); // Go to previous card
                          }
                     } else {
                          console.log("DEBUG_MERGE: Swipe detected but card is not flipped. Not navigating.");
                     }
                }
            }, { passive: true }); // Use passive listener
             console.log("DEBUG_MERGE: Swipe listeners attached.");
        }

        // Initial call to render the deck hub when the flashcard feature is opened
        showFlashcardSubScreen('deckHubScreen');
         console.log("DEBUG_MERGE: initFlashcardFeature finished.");
    }
    // --- END Flashcard Feature ---


    // --- Sticky Note Feature (FROM New File.js) ---
    function initStickyNoteFeature() {
        console.log("DEBUG_MERGE: initStickyNoteFeature called.");
        const stickyNoteScreen = document.getElementById('sticky-note-screen');
        if (!stickyNoteScreen || stickyNoteScreen.dataset.initialized) {
             console.log("DEBUG_MERGE: Sticky Note feature already initialized or screen not found.");
             return;
        }
        stickyNoteScreen.dataset.initialized = 'true';
         console.log("DEBUG_MERGE: Sticky Note feature initializing...");


         // Get DOM elements related to the sticky note feature
        const app = {
            noteEditor: stickyNoteScreen.querySelector('#note-editor'), // The whole editor modal/panel
            notesGrid: stickyNoteScreen.querySelector('#notes-grid'), // Container for note cards
            createNoteFab: stickyNoteScreen.querySelector('#create-note-fab'), // Button to open editor for new note
            closeEditorBtn: stickyNoteScreen.querySelector('#close-editor-btn'), // Button to close editor
            saveNoteBtn: stickyNoteScreen.querySelector('#save-note-btn'), // Button to save/update note
            editorTitle: stickyNoteScreen.querySelector('#editor-title'), // Title in the editor header
            newCategoryInput: stickyNoteScreen.querySelector('#new-category-input'), // Input for new category name
            categorySelect: stickyNoteScreen.querySelector('#category-select'), // Select dropdown for categories
            noteContent: stickyNoteScreen.querySelector('#note-content'), // Textarea for note content
            searchInput: stickyNoteScreen.querySelector('#search-input'), // Input for searching notes
            searchBtn: stickyNoteScreen.querySelector('#search-btn'), // Button to trigger search
            categoryFilterContainer: stickyNoteScreen.querySelector('#category-filter-container'), // Container for category filter pills
            colorPicker: stickyNoteScreen.querySelector('#color-picker'), // Container for color selection dots
            checklistToggle: stickyNoteScreen.querySelector('#checklist-toggle'), // Button to toggle checklist mode
            autoDeleteToggle: stickyNoteScreen.querySelector('#auto-delete-toggle'), // Checkbox for auto-delete
            autoDeleteTime: stickyNoteScreen.querySelector('#auto-delete-time'), // Datetime-local input for auto-delete time
            deleteTimerDisplay: stickyNoteScreen.querySelector('#delete-timer-display'), // Element to show delete timer
            notes: [], // Array to hold note objects
            categories: ['General', 'Work', 'Personal'], // Array to hold category names
            editingNoteId: null, // ID of the note being edited (null for new note)
            selectedColor: 'var(--surface)', // Currently selected background color for the note
            isChecklist: false, // Whether the current note is treated as a checklist
             // Available colors for notes (mapping to CSS variables or direct hex/rgba)
            colors: ['var(--surface)', '#574b90', '#f78fb3', '#00a8ff', '#f19066', '#e74c3c', '#27ae60']
        };

        // Initial setup function
        function init() {
             console.log("DEBUG_MERGE: Sticky Note init called.");
            loadData(); // Load notes and categories from storage
            setupEventListeners(); // Set up DOM event listeners
            renderNotes(); // Render the initial list of notes
            renderCategories(); // Render the category filter pills and select options
            setupColorPicker(); // Set up the color picker dots
            // Start interval to check for auto-deleting notes every minute
            setInterval(checkAutoDelete, 60000); // 60000 ms = 1 minute
             console.log("DEBUG_MERGE: Sticky Note init finished.");
        }

        // Function to set up all event listeners
        function setupEventListeners() {
             console.log("DEBUG_MERGE: Setting up Sticky Note event listeners.");
            // FAB button to create a new note
            if (app.createNoteFab) app.createNoteFab.addEventListener('click', openEditorForNewNote);
            else console.warn("DEBUG_MERGE: Create note FAB not found.");

            // Button to close the editor
            if (app.closeEditorBtn) app.closeEditorBtn.addEventListener('click', closeEditor);
            else console.warn("DEBUG_MERGE: Close editor button not found.");

            // Button to save the note (handles both new and existing)
            if (app.saveNoteBtn) app.saveNoteBtn.addEventListener('click', saveNote);
            else console.warn("DEBUG_MERGE: Save note button not found.");

            // Search button click listener
            if (app.searchBtn) app.searchBtn.addEventListener('click', () => renderNotes());
            else console.warn("DEBUG_MERGE: Search button not found.");

            // Search input keyup listener (trigger search on Enter key)
            if (app.searchInput) {
                 app.searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') renderNotes();
                });
                 console.log("DEBUG_MERGE: Search input listener attached.");
            } else { console.warn("DEBUG_MERGE: Search input not found."); }

            // Event delegation for category filter pills
            if (app.categoryFilterContainer) app.categoryFilterContainer.addEventListener('click', handleCategoryFilter);
            else console.warn("DEBUG_MERGE: Category filter container not found.");

            // Event delegation for color picker dots
            if (app.colorPicker) app.colorPicker.addEventListener('click', handleColorSelection);
            else console.warn("DEBUG_MERGE: Color picker not found.");

            // Toggle checklist mode button
            if (app.checklistToggle) app.checklistToggle.addEventListener('click', toggleChecklistMode);
            else console.warn("DEBUG_MERGE: Checklist toggle button not found.");

            // Auto-delete checkbox change listener
            if (app.autoDeleteToggle) app.autoDeleteToggle.addEventListener('change', toggleAutoDeleteInput);
            else console.warn("DEBUG_MERGE: Auto-delete toggle not found.");
        }

        // Function to open the note editor (for a new note or editing an existing one)
        function openEditor(note = null) {
             console.log("DEBUG_MERGE: openEditor called. Note:", note ? note.id : 'New');
             // Check if all necessary editor elements exist
            if (!app.noteEditor || !app.editorTitle || !app.noteContent || !app.autoDeleteToggle || !app.autoDeleteTime || !app.deleteTimerDisplay || !app.newCategoryInput || !app.categorySelect || !app.colorPicker || !app.checklistToggle) {
                 console.error("DEBUG_MERGE: One or more Sticky Note editor elements not found.");
                 // Optionally alert user or disable feature
                 return;
            }

            app.editingNoteId = note ? note.id : null; // Set the ID of the note being edited (or null for new)

            // Determine the note number for the title (sequential number for new notes, ID for existing)
            const noteNumber = note ? note.id : (app.notes.length > 0 ? Math.max(...app.notes.map(n => n.id)) + 1 : 1);
            app.editorTitle.textContent = note ? `Edit Note #${note.id}` : `Create Note #${noteNumber}`;

            // Populate editor fields with note data or defaults
            app.noteContent.value = note ? note.content : '';
            app.selectedColor = note ? note.color : 'var(--surface)'; // Default color if new note
            app.isChecklist = note ? note.isChecklist : false; // Default to false if new note

            // Update category dropdown and color picker UI based on note data
            updateCategorySelect(note ? note.category : 'General'); // Default category
            updateColorPickerSelection();
            updateChecklistToggleUI();

            // Setup auto-delete fields
            app.autoDeleteToggle.checked = !!(note && note.deleteAt); // Check if note has a deleteAt timestamp
            toggleAutoDeleteInput(); // Show/hide the datetime input
            if (note && note.deleteAt) {
                 // Format timestamp for the datetime input (YYYY-MM-DDTHH:mm)
                 try {
                      const d = new Date(note.deleteAt);
                      // Ensure date is valid before setting value
                      if (!isNaN(d.getTime())) {
                           app.autoDeleteTime.value = d.toISOString().slice(0, 16);
                           displayDeleteTimer(note.id, note.deleteAt); // Display timer text
                      } else {
                           console.warn("DEBUG_MERGE: Invalid deleteAt date found:", note.deleteAt, "for note", note.id);
                           app.autoDeleteTime.value = ''; // Clear invalid date
                           app.deleteTimerDisplay.innerHTML = ''; // Clear timer display
                      }
                 } catch (e) {
                      console.error("DEBUG_MERGE: Error processing deleteAt date:", note.deleteAt, e);
                       app.autoDeleteTime.value = '';
                       app.deleteTimerDisplay.innerHTML = '';
                 }

            } else {
                app.autoDeleteTime.value = ''; // Clear input if no auto-delete set
                app.deleteTimerDisplay.innerHTML = ''; // Clear timer display
            }
            app.newCategoryInput.value = ''; // Clear new category input when opening editor

            app.noteEditor.classList.add('active'); // Show the editor
             console.log("DEBUG_MERGE: Note editor opened.");
        }

        // Helper to open editor specifically for a new note
        function openEditorForNewNote() {
             console.log("DEBUG_MERGE: openEditorForNewNote called.");
            openEditor(null); // Call openEditor with no note data
        }

        // Function to close the note editor
        function closeEditor() {
             console.log("DEBUG_MERGE: closeEditor called.");
            if (app.noteEditor) app.noteEditor.classList.remove('active'); // Hide the editor
            app.editingNoteId = null; // Clear the editing state
            // Clear input fields when closing (good practice)
            if (app.noteContent) app.noteContent.value = '';
            if (app.newCategoryInput) app.newCategoryInput.value = '';
            if (app.autoDeleteToggle) app.autoDeleteToggle.checked = false;
            if (app.autoDeleteTime) app.autoDeleteTime.value = '';
            if (app.deleteTimerDisplay) app.deleteTimerDisplay.innerHTML = '';
             console.log("DEBUG_MERGE: Note editor closed.");
        }

        // Function to save the current note
        function saveNote() {
             console.log("DEBUG_MERGE: saveNote called.");
             // Check if necessary elements exist
            if (!app.noteContent || !app.newCategoryInput || !app.categorySelect || !app.autoDeleteToggle || !app.autoDeleteTime) {
                 console.error("DEBUG_MERGE: One or more Sticky Note save elements not found.");
                 alert("Error saving note.");
                 return;
            }

            const content = app.noteContent.value.trim();
            if (!content) {
                alert("Note content cannot be empty.");
                 console.log("DEBUG_MERGE: Note content is empty, save aborted.");
                return;
            }

            // Determine the category: use new input if filled, otherwise use select value
            let category = app.newCategoryInput.value.trim() || app.categorySelect.value;
             // Default to 'General' if no category is selected or entered
             if (!category) category = 'General';

             // Add new category to the list if it doesn't exist
            if (category && !app.categories.includes(category)) {
                 app.categories.push(category);
                 console.log(`DEBUG_MERGE: New category "${category}" added.`);
            }

            // Determine the auto-delete timestamp
             // Check if toggle is checked AND datetime input has a value
            const deleteAt = app.autoDeleteToggle.checked && app.autoDeleteTime.value ? new Date(app.autoDeleteTime.value).getTime() : null;

            // Check if the delete date is in the past
             if (deleteAt !== null && deleteAt <= Date.now()) {
                  alert("Auto-delete time must be in the future. Please select a valid time.");
                  console.log("DEBUG_MERGE: Auto-delete time in past, save aborted.");
                  return; // Abort save if time is invalid
             }


            // Logic for updating an existing note vs creating a new one
            if (app.editingNoteId) {
                 console.log(`DEBUG_MERGE: Saving existing note with ID: ${app.editingNoteId}`);
                const note = app.notes.find(n => n.id === app.editingNoteId);
                if (note) {
                     // Update note properties
                    Object.assign(note, {
                        content,
                        category,
                        updatedAt: Date.now(), // Update timestamp
                        color: app.selectedColor,
                        isChecklist: app.isChecklist,
                        deleteAt // Save the determined deleteAt timestamp (can be null)
                    });
                     console.log("DEBUG_MERGE: Existing note updated:", note);
                } else {
                     console.error(`DEBUG_MERGE: Note with ID ${app.editingNoteId} not found while trying to save.`);
                     alert("Error: Note not found for saving.");
                     // Treat as a new note creation instead? Or just return? Returning for now.
                     return;
                }
            } else {
                 console.log("DEBUG_MERGE: Creating new note.");
                 // Generate a new unique ID (using timestamp or sequence)
                const newId = app.notes.length > 0 ? Math.max(...app.notes.map(n => n.id || 0)) + 1 : 1; // Ensure max works with potential nulls/undefined
                const newNote = {
                    id: newId,
                    content,
                    category,
                    color: app.selectedColor,
                    isChecklist: app.isChecklist,
                    createdAt: Date.now(), // Creation timestamp
                    updatedAt: Date.now(), // Update timestamp
                    pinned: false, // Default to not pinned
                    deleteAt // Save the determined deleteAt timestamp (can be null)
                };
                app.notes.push(newNote); // Add the new note to the array
                 console.log("DEBUG_MERGE: New note created:", newNote);
            }

            saveFlashcardData(); // Save the updated notes and categories data (reusing flashcard save func name for storage!) - FIX: Should be saveStickyNoteData
             // Let's rename the save function to be specific to sticky notes
             saveStickyNoteData(); // Save notes data
             // Categories are saved implicitly with notes for now, could save categories separately

            renderNotes(); // Re-render the notes grid to show changes
            renderCategories(); // Re-render categories filter/select
            closeEditor(); // Close the editor after saving
             console.log("DEBUG_MERGE: Note saved successfully.");
        }

         // FIX: Rename save/load data functions to be specific to sticky notes
         function saveStickyNoteData() {
             try {
                 localStorage.setItem('stickyNotesData', JSON.stringify({ notes: app.notes, categories: app.categories }));
                 console.log("DEBUG_MERGE: Sticky note data saved to storage.");
             } catch (e) {
                 console.error("DEBUG_MERGE: Failed to save sticky note data:", e);
             }
         }

         function loadData() {
             try {
                 const savedData = localStorage.getItem('stickyNotesData');
                 if (savedData) {
                     const parsed = JSON.parse(savedData);
                     if (parsed) {
                         if (Array.isArray(parsed.notes)) {
                             app.notes = parsed.notes;
                             // Ensure IDs are numbers and add missing timestamps if old format
                             app.notes = app.notes.map(note => ({
                                 ...note,
                                 id: parseInt(note.id) || Date.now(), // Ensure ID is a number
                                 createdAt: note.createdAt || Date.now(),
                                 updatedAt: note.updatedAt || Date.now(),
                                 pinned: note.pinned === undefined ? false : note.pinned,
                                 isChecklist: note.isChecklist === undefined ? false : note.isChecklist,
                                 color: note.color || 'var(--surface)',
                                 category: note.category || 'General',
                                 deleteAt: note.deleteAt || null
                             }));
                             // Re-sort notes after loading/fixing
                              app.notes.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
                         } else {
                              console.warn("DEBUG_MERGE: Loaded sticky note data notes is not an array. Resetting notes.");
                             app.notes = [];
                         }
                         if (Array.isArray(parsed.categories)) {
                             // Merge loaded categories with defaults, removing duplicates
                              app.categories = [...new Set([...app.categories, ...parsed.categories.filter(Boolean)])].sort();
                         } else {
                              console.warn("DEBUG_MERGE: Loaded sticky note data categories is not an array. Using default categories.");
                             // Keep default categories
                         }
                          console.log("DEBUG_MERGE: Sticky note data loaded from storage.");
                     } else {
                         console.warn("DEBUG_MERGE: Loaded sticky note data is null or invalid. Using defaults.");
                     }
                 } else {
                      console.log("DEBUG_MERGE: No sticky note data found in storage. Using defaults.");
                 }
             } catch (e) {
                 console.error("DEBUG_MERGE: Failed to parse sticky note data from storage:", e);
                  console.warn("DEBUG_MERGE: Resetting sticky note data due to parse error.");
                 app.notes = [];
                 app.categories = ['General', 'Work', 'Personal']; // Reset to defaults
             }
         }


        // Function to render the notes grid based on current filters and search query
        function renderNotes() {
             console.log("DEBUG_MERGE: renderNotes called.");
            if (!app.notesGrid || !app.searchInput || !app.categoryFilterContainer) {
                 console.error("DEBUG_MERGE: Sticky Note notes grid, search input, or category filter container not found.");
                 return;
            }

            app.notesGrid.innerHTML = ''; // Clear current grid content
            const searchQuery = app.searchInput.value.toLowerCase(); // Get search query
             // Find the currently active category pill
            const activeCategoryPill = app.categoryFilterContainer.querySelector('.category-pill.active');
            const activeCategory = activeCategoryPill ? activeCategoryPill.dataset.category : 'All'; // Get the selected category or 'All'

             console.log(`DEBUG_MERGE: Filtering notes. Search: "${searchQuery}", Category: "${activeCategory}".`);

            // Filter notes based on selected category and search query
            const filteredNotes = app.notes
                .filter(note =>
                     // Filter by category (if not 'All')
                    (!activeCategory || activeCategory === 'All' || note.category === activeCategory)
                )
                .filter(note =>
                     // Filter by search query (match content or #tags)
                    note.content.toLowerCase().includes(searchQuery) || (note.content.toLowerCase().match(/#\w+/g) || []).some(tag => tag.includes(searchQuery)) // Ensure match result is an array
                )
                 // Sort notes: pinned notes first, then by latest update time
                .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

             console.log(`DEBUG_MERGE: Found ${filteredNotes.length} filtered notes.`);

            // Display message if no notes found after filtering
            if (filteredNotes.length === 0) {
                app.notesGrid.innerHTML = `<p style="color: var(--sn-text-secondary); grid-column: 1 / -1; text-align: center; padding: 40px 0;">No notes found.</p>`;
                 // Optionally show "Create one!" button if filter is 'All' and no notes exist at all
                 if ((!activeCategory || activeCategory === 'All') && app.notes.length === 0) {
                      app.notesGrid.innerHTML = `<p style="color: var(--sn-text-secondary); grid-column: 1 / -1; text-align: center; padding: 20px 0;">No notes yet. Create one!</p><button class="btn btn-primary" style="grid-column: 1 / -1; margin: 0 auto;" onclick="openEditorForNewNote()">Create Note</button>`;
                 }

            }

            // Render each filtered note as a card
            filteredNotes.forEach(note => {
                const card = document.createElement('div');
                let textColor = 'var(--text-dark)'; // Default text color

                 // Determine text color based on background color for readability
                 // A simple check: if luminance is low, use light text
                 // Note: Requires a helper function to calculate luminance or contrast,
                 // or just use a predefined list for known bright colors.
                 // For simplicity, sticking to default unless color is one of the 'neon' bright ones or user explicitly sets light text color.
                 // Example: Basic heuristic - check if color variable is 'var(--surface)' (light by default)
                 if (note.color !== 'var(--surface)') { // Assume other colors are darker
                     textColor = 'var(--text-light)'; // Use light text for darker backgrounds
                 }


                card.className = 'note-card';
                // Set background color using CSS variable or hex code
                card.style.setProperty('background-color', note.color);
                // Set text color
                card.style.color = textColor;
                // Set border color (can be same as background or a darker/lighter version)
                card.style.borderColor = note.color === 'var(--surface)' ? 'var(--sn-border-color)' : note.color; // Use specific border for default color
                card.dataset.id = note.id; // Store note ID


                // Format content for preview (handle checklist items)
                const contentPreview = note.isChecklist ? formatChecklistPreview(note.content) : `<p>${note.content.split('\n')[0]}</p>`; // Show only first line for text notes

                // HTML for the note card
                card.innerHTML = `
                    <div class="note-card-header">
                        <span class="note-category" style="color: var(--sn-primary-accent); opacity: 0.9; font-size: 0.8em;">${note.category}</span>
                        <div class="note-actions" style="color: ${textColor};">
                            <button class="note-pin ${note.pinned ? 'pinned' : ''}" data-action="pin" title="${note.pinned ? 'Unpin' : 'Pin'} Note" style="color: inherit;">${note.pinned ? '📍' : '📌'}</button> <!-- Use different icon for pinned -->
                            <button class="note-delete" data-action="delete" title="Delete Note" style="color: inherit;"><i class="fa-solid fa-trash"></i></button> <!-- Use trash icon -->
                        </div>
                    </div>
                    <div class="note-content-preview">${contentPreview}</div>`;

                // Add click listener to the card (event delegation for actions vs editing)
                card.addEventListener('click', (e) => {
                    const action = e.target.dataset.action; // Get the data-action attribute
                    if (action) {
                        e.stopPropagation(); // Stop click from triggering edit if action button clicked
                        if (action === 'delete') deleteNote(note.id); // Call delete function
                        if (action === 'pin') togglePin(note.id); // Call toggle pin function
                    } else {
                         console.log(`DEBUG_MERGE: Note card clicked, opening editor for note ID: ${note.id}.`);
                        openEditor(note); // Open editor for this note
                    }
                });
                app.notesGrid.appendChild(card); // Add the card to the grid
            });
             console.log("DEBUG_MERGE: Notes grid rendered.");
        }


        // Function to delete a note
        function deleteNote(id) {
             console.log(`DEBUG_MERGE: deleteNote called for ID: ${id}.`);
            if (confirm("Are you sure you want to delete this note?")) {
                 console.log("DEBUG_MERGE: User confirmed deletion.");
                // Filter out the note to delete
                app.notes = app.notes.filter(note => note.id !== id);
                saveStickyNoteData(); // Save changes
                renderNotes(); // Re-render the notes grid
                 // If the deleted note was being edited, close the editor
                 if (app.editingNoteId === id) {
                     closeEditor();
                 }
                 console.log(`DEBUG_MERGE: Note with ID ${id} deleted.`);
            } else {
                 console.log("DEBUG_MERGE: Note deletion cancelled.");
            }
        }


        // Function to toggle the pinned status of a note
        function togglePin(id) {
             console.log(`DEBUG_MERGE: togglePin called for ID: ${id}.`);
             // Find the note
            const note = app.notes.find(n => n.id === id);
            if (note) {
                note.pinned = !note.pinned; // Toggle the pinned status
                saveStickyNoteData(); // Save changes
                renderNotes(); // Re-render notes to apply sorting (pinned notes first)
                 console.log(`DEBUG_MERGE: Pinned status for note ${id} toggled to ${note.pinned}.`);
            } else {
                 console.warn(`DEBUG_MERGE: Note with ID ${id} not found while trying to toggle pin.`);
            }
        }


        // Function to render the category filter pills and update the category select dropdown
        function renderCategories() {
             console.log("DEBUG_MERGE: renderCategories called.");
            if (!app.categoryFilterContainer || !app.categorySelect) {
                 console.error("DEBUG_MERGE: Sticky Note category filter container or select not found.");
                 return;
            }

             // Get the category of the currently active pill (if any)
            const currentActivePill = app.categoryFilterContainer.querySelector('.category-pill.active');
            const currentActive = currentActivePill ? currentActivePill.dataset.category : 'All'; // Default to 'All'

             // Clear existing category pills
            app.categoryFilterContainer.innerHTML = '';
             // Add 'All' pill first, then pills for each unique category
             ['All', ...app.categories.filter(Boolean)].forEach(cat => { // Filter out any empty strings in categories
                 const pill = document.createElement('div');
                 pill.className = 'category-pill';
                 // Add 'active' class if this pill is the currently selected category
                 if (cat === currentActive) pill.classList.add('active');
                 pill.dataset.category = cat; // Store category name in data attribute
                 pill.textContent = cat; // Display category name
                 app.categoryFilterContainer.appendChild(pill); // Add pill to container
             });
             console.log("DEBUG_MERGE: Category filter pills rendered.");

            // Update options in the category select dropdown (used in the editor)
            updateCategorySelect(app.categorySelect.value || 'General'); // Keep current selection or default
        }


        // Event delegation handler for clicking on category filter pills
        function handleCategoryFilter(e) {
             console.log("DEBUG_MERGE: handleCategoryFilter called.");
             // Find the clicked element that is or is inside a .category-pill
            const pill = e.target.closest('.category-pill');
            if (pill) {
                 console.log(`DEBUG_MERGE: Category pill clicked: ${pill.dataset.category}`);
                // Remove 'active' class from all pills
                const categoryPills = stickyNoteScreen.querySelectorAll('.category-pill');
                if (categoryPills) categoryPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active'); // Add 'active' class to the clicked pill
                renderNotes(); // Re-render notes based on the new category filter
            }
        }


        // Function to populate the category select dropdown (used in the editor)
        function updateCategorySelect(selectedCategory) {
             console.log(`DEBUG_MERGE: updateCategorySelect called. Selected: "${selectedCategory}"`);
            if (!app.categorySelect) { console.error("DEBUG_MERGE: Sticky Note category select element not found."); return; }

            app.categorySelect.innerHTML = ''; // Clear existing options

             // Add options for each unique category
            app.categories.filter(Boolean).forEach(cat => { // Filter out empty strings
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                 // Select the option that matches the provided selectedCategory
                if (cat === selectedCategory) option.selected = true;
                app.categorySelect.appendChild(option); // Add option to select
            });
             console.log("DEBUG_MERGE: Category select dropdown updated.");
        }


        // Function to set up the color picker dots
        function setupColorPicker() {
             console.log("DEBUG_MERGE: setupColorPicker called.");
            if (!app.colorPicker) { console.error("DEBUG_MERGE: Sticky Note color picker element not found."); return; }

            app.colorPicker.innerHTML = ''; // Clear existing dots

             // Create a dot for each available color
            app.colors.forEach(color => {
                const dot = document.createElement('div');
                dot.className = 'color-dot';
                dot.dataset.color = color; // Store color value in data attribute
                 // Set background color, resolving CSS variables if needed
                dot.style.backgroundColor = color.startsWith('var(') ? getComputedStyle(stickyNoteScreen).getPropertyValue(color.slice(4, -1)) : color;
                app.colorPicker.appendChild(dot); // Add dot to the picker
            });
             console.log("DEBUG_MERGE: Color picker dots rendered.");
        }


        // Event delegation handler for clicking on color dots
        function handleColorSelection(e) {
             console.log("DEBUG_MERGE: handleColorSelection called.");
             // Find the clicked element that is or is inside a .color-dot
            const dot = e.target.closest('.color-dot');
            if (dot) {
                 console.log(`DEBUG_MERGE: Color dot clicked: ${dot.dataset.color}`);
                app.selectedColor = dot.dataset.color; // Set the selected color
                updateColorPickerSelection(); // Update the UI to highlight the selected dot
            }
        }


        // Function to update the UI of the color picker to show which color is selected
        function updateColorPickerSelection() {
             console.log("DEBUG_MERGE: updateColorPickerSelection called.");
            const colorDots = stickyNoteScreen.querySelectorAll('.color-dot');
            if (colorDots) {
                 // Remove 'selected' class from all dots, then add it to the currently selected one
                 colorDots.forEach(d => {
                    d.classList.toggle('selected', d.dataset.color === app.selectedColor);
                });
                 console.log(`DEBUG_MERGE: Color dot matching ${app.selectedColor} highlighted.`);
            } else {
                 console.warn("DEBUG_MERGE: Color dots not found for updating selection UI.");
            }
        }


        // Function to toggle checklist mode for the note being edited
        function toggleChecklistMode() {
             console.log("DEBUG_MERGE: toggleChecklistMode called.");
            app.isChecklist = !app.isChecklist; // Toggle the boolean state
            updateChecklistToggleUI(); // Update the button's appearance
             console.log(`DEBUG_MERGE: Checklist mode toggled to ${app.isChecklist}.`);
        }

        // Function to update the appearance of the checklist toggle button
        function updateChecklistToggleUI() {
             console.log("DEBUG_MERGE: updateChecklistToggleUI called.");
             if (app.checklistToggle) {
                 // Add/remove 'active' class based on the isChecklist state
                 app.checklistToggle.classList.toggle('active', app.isChecklist);
                  // Update text or icon based on state (optional)
                  // app.checklistToggle.textContent = app.isChecklist ? 'Checklist ON' : 'Checklist OFF';
                 console.log("DEBUG_MERGE: Checklist toggle UI updated.");
             } else {
                 console.warn("DEBUG_MERGE: Checklist toggle button not found for UI update.");
             }
        }

        // Function to format note content for checklist preview (showing checkboxes/status)
        function formatChecklistPreview(content) {
            if (!content) return ''; // Return empty string if no content
             console.log("DEBUG_MERGE: formatChecklistPreview called.");
             // Split content by lines
            return content.split('\n').map(line => {
                // Check if the line starts with [x] or [ ] (case-insensitive, trimmed)
                const trimmedLine = line.trim();
                const isChecked = trimmedLine.toLowerCase().startsWith('[x]');
                // Remove the checkbox marker from the text
                const text = trimmedLine.replace(/^\[[x ]\]\s*/i, ''); // Use i for case-insensitivity

                 // If the line looks like a checklist item, render with status icon
                 if (trimmedLine.toLowerCase().startsWith('[') && trimmedLine.includes(']')) {
                    return `<div class="checklist-item ${isChecked ? 'checked' : ''}">
                                <span>${isChecked ? '✓' : '☐'}</span> <!-- Use checkmark or empty box icon -->
                                <span>${text}</span> <!-- Display the text without the marker -->
                            </div>`;
                }
                 // Otherwise, render as a standard text line
                return `<div>${line}</div>`;
            }).join(''); // Join formatted lines back into a single string
             console.log("DEBUG_MERGE: Checklist preview formatted.");
        }


        // Function to toggle visibility of the auto-delete datetime input
        function toggleAutoDeleteInput() {
             console.log("DEBUG_MERGE: toggleAutoDeleteInput called.");
            if (app.autoDeleteTime && app.autoDeleteToggle) {
                 // Show the input if the auto-delete toggle is checked
                 app.autoDeleteTime.style.display = app.autoDeleteToggle.checked ? 'inline-block' : 'none';
                 console.log(`DEBUG_MERGE: Auto-delete input display set to: ${app.autoDeleteTime.style.display}`);
            } else {
                 console.warn("DEBUG_MERGE: Sticky Note auto-delete time input or toggle not found.");
            }
        }


        // Function to display the remaining time or date for auto-deletion
        function displayDeleteTimer(noteId, deleteAt) {
             console.log(`DEBUG_MERGE: displayDeleteTimer called for note ${noteId}, timestamp ${deleteAt}.`);
            // Only display if deleteAt is a valid future timestamp
            if (deleteAt > Date.now() && app.deleteTimerDisplay) {
                const d = new Date(deleteAt);
                 // Format date and time nicely
                const dateString = d.toLocaleDateString();
                const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // e.g., "10:30 AM"

                 // Use window.cancelAutoDelete
                app.deleteTimerDisplay.innerHTML = `Deletes on ${dateString} at ${timeString}. <button class="btn-link" onclick="window.cancelAutoDelete(event)" data-id="${noteId}" style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 0 5px;">Cancel</button>`;
                 console.log(`DEBUG_MERGE: Auto-delete timer display set for note ${noteId}.`);
            } else {
                 // Clear display if no valid timer is set
                 if (app.deleteTimerDisplay) app.deleteTimerDisplay.innerHTML = '';
                 console.log("DEBUG_MERGE: No valid auto-delete time to display.");
            }
        }


        // Function to cancel the auto-delete timer for a specific note
        window.cancelAutoDelete = function(event) { // Make globally accessible
             console.log("DEBUG_MERGE: cancelAutoDelete called.");
            // Get the note ID from the button's data attribute
            const noteId = parseInt(event.target.dataset.id);
            if (isNaN(noteId)) {
                 console.error("DEBUG_MERGE: Invalid note ID for cancelling auto-delete.");
                 alert("Error cancelling timer.");
                 return;
            }

             // Find the note by ID
            const note = app.notes.find(n => n.id === noteId);
            if (note) {
                note.deleteAt = null; // Remove the deleteAt timestamp
                saveStickyNoteData(); // Save changes
                 console.log(`DEBUG_MERGE: Auto-delete cancelled for note ${noteId}.`);
                // Update editor UI if this is the note currently being edited
                if (app.editingNoteId === noteId) {
                     if (app.autoDeleteToggle) app.autoDeleteToggle.checked = false;
                     toggleAutoDeleteInput(); // Hide the datetime input
                     if (app.deleteTimerDisplay) app.deleteTimerDisplay.innerHTML = ''; // Clear the timer display
                }
                 alert('Auto-delete timer cancelled.'); // Provide feedback
                renderNotes(); // Re-render notes (in case the timer was displayed on the card preview, though not implemented currently)
            } else {
                 console.warn(`DEBUG_MERGE: Note with ID ${noteId} not found while trying to cancel auto-delete.`);
            }
        }


        // Function that runs periodically to check and delete expired notes
        function checkAutoDelete() {
             console.log("DEBUG_MERGE: checkAutoDelete running.");
            const now = Date.now();
            // Filter notes that have deleteAt set and are in the past or now
            const notesToDelete = app.notes.filter(note => note.deleteAt && note.deleteAt <= now);

            if (notesToDelete.length > 0) {
                 console.log(`DEBUG_MERGE: Found ${notesToDelete.length} notes to auto-delete.`);
                // Keep only the notes that DO NOT have deleteAt or whose deleteAt is in the future
                app.notes = app.notes.filter(note => !note.deleteAt || note.deleteAt > now);
                saveStickyNoteData(); // Save the modified list
                renderNotes(); // Re-render the notes grid
                 console.log("DEBUG_MERGE: Auto-deleted notes processed.");
                 // Optionally alert the user that notes were auto-deleted
                 // alert(`${notesToDelete.length} note(s) were auto-deleted.`);
            } else {
                 console.log("DEBUG_MERGE: No notes found for auto-deletion.");
            }
        }


        // Initial call to start the sticky note feature
        init();
         console.log("DEBUG_MERGE: initStickyNoteFeature finished.");
    }
    // --- END Sticky Note Feature ---


    // --- Study Planner Feature (FROM New File.js) ---
    function initStudyPlannerFeature() {
         console.log("DEBUG_MERGE: initStudyPlannerFeature called.");
        const screen = document.getElementById('study-planner-screen');
        if (!screen || screen.dataset.initialized) {
             console.log("DEBUG_MERGE: Study Planner feature already initialized or screen not found.");
             return;
        }
        screen.dataset.initialized = 'true';
         console.log("DEBUG_MERGE: Study Planner feature initializing...");


        // Get DOM elements for the study planner
        const taskList = screen.querySelector('#taskList'); // Container for task cards
        const emptyState = screen.querySelector('#emptyState'); // Message shown when task list is empty
        const addTaskBtn = screen.querySelector('#addTaskBtn'); // Button to open the add task modal
        const taskModal = screen.querySelector('#taskModal'); // The modal for adding/editing tasks
        const cancelTaskBtn = screen.querySelector('#cancelTaskBtn'); // Button to cancel the modal
        const taskForm = screen.querySelector('#taskForm'); // The form within the modal
        const quoteEl = screen.querySelector('#quote'); // Element for motivational quote
        const dateEl = screen.querySelector('#date'); // Element for current date display
        const timeSelectorBtn = screen.querySelector('#timeSelectorBtn'); // Button to open the time picker modal
        const taskTimeInSeconds = screen.querySelector('#taskTimeInSeconds'); // Hidden input to store time goal in seconds
        const timerPickerModal = screen.querySelector('#timerPickerModal'); // The time picker modal (HH:MM:SS selects)
        const hoursSelect = screen.querySelector('#hoursSelect'); // Select for hours
        const minutesSelect = screen.querySelector('#minutesSelect'); // Select for minutes
        const secondsSelect = screen.querySelector('#secondsSelect'); // Select for seconds
        const setTimerBtn = screen.querySelector('#setTimerBtn'); // Button in time picker to set the time
        const notificationPopup = screen.querySelector('#notificationPopup'); // Popup for task completion notification
        const popupIcon = screen.querySelector('#popupIcon'); // Icon in the notification popup
        const popupTitle = screen.querySelector('#popupTitle'); // Title in the notification popup
        const popupMessage = screen.querySelector('#popupMessage'); // Message in the notification popup
        const popupOkBtn = screen.querySelector('#popupOkBtn'); // OK button in the notification popup


        let tasks = []; // Array to hold task objects
        let timers = {}; // Object to hold interval IDs for running timers ({taskId: intervalId})

        // List of motivational quotes
        const quotes = [
            "The only way to do great work is to love what you do.",
            "Success is not final, failure is not fatal: it is the courage to continue that counts.",
            "Believe you can and you're halfway there.",
            "The future belongs to those who believe in the beauty of their dreams.",
            "Strive for progress, not perfection.",
             "Your only limit is you.",
             "The best way to predict the future is to create it.",
             "Don't wait for opportunity. Create it."
        ];
        // localStorage key for tasks
        const STORAGE_KEY = 'studyPlannerTasksV2'; // Using V2 to distinguish from potential older formats

        // Function to load tasks from localStorage
        const loadTasks = () => {
             console.log("DEBUG_MERGE: Study Planner: loadTasks called.");
            const storedTasks = localStorage.getItem(STORAGE_KEY);
            try {
                tasks = storedTasks ? JSON.parse(storedTasks) : [];
                 // Ensure tasks is an array and handle potential old data format or errors
                if (!Array.isArray(tasks)) {
                     console.warn("DEBUG_MERGE: Loaded tasks data is not an array. Resetting tasks.");
                     tasks = [];
                }
                 // On load, set any 'active' timers to 'paused' because intervals aren't persisted
                tasks.forEach(task => {
                     if (task.status === 'active') {
                         task.status = 'paused';
                          console.log(`DEBUG_MERGE: Task ${task.id} status reset from 'active' to 'paused' on load.`);
                     }
                     // Ensure elapsed time is a number
                     task.elapsed = parseInt(task.elapsed) || 0;
                      // Ensure goal time is a number
                     task.goalInSeconds = parseInt(task.goalInSeconds) || 0;
                      // Ensure status is valid
                     if (!['idle', 'active', 'paused', 'completed'].includes(task.status)) {
                          task.status = 'idle'; // Reset invalid status
                     }
                });
                 console.log(`DEBUG_MERGE: Loaded ${tasks.length} Study Planner tasks.`);
            } catch (e) {
                 console.error("DEBUG_MERGE: Failed to parse tasks from storage:", e);
                 console.warn("DEBUG_MERGE: Resetting tasks due to parse error.");
                 tasks = []; // Reset tasks on parse error
            }

            renderTasks(); // Render tasks after loading
        };

        // Function to save tasks to localStorage
        const saveTasks = () => {
             console.log("DEBUG_MERGE: Study Planner: saveTasks called.");
             try {
                 localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
                 console.log("DEBUG_MERGE: Study Planner tasks saved to storage.");
             } catch (e) {
                 console.error("DEBUG_MERGE: Failed to save tasks to storage:", e);
             }
        };

        // Function to render the list of tasks
        const renderTasks = () => {
             console.log("DEBUG_MERGE: Study Planner: renderTasks called.");
            if (!taskList || !emptyState) {
                 console.error("DEBUG_MERGE: Study Planner task list or empty state element not found.");
                 return;
            }

            taskList.innerHTML = ''; // Clear existing task list
            // Show empty state message if no tasks exist
            emptyState.style.display = tasks.length === 0 ? 'block' : 'none';


            // Sort tasks: active/paused first, then by completion status (incomplete first), then by ID
             tasks.sort((a, b) => {
                 const statusOrder = { 'active': 0, 'paused': 1, 'idle': 2, 'completed': 3 };
                 const statusComparison = statusOrder[a.status] - statusOrder[b.status];
                 if (statusComparison !== 0) return statusComparison;

                 // For incomplete tasks (active, paused, idle), sort by ID (or maybe goal time/creation time?)
                 // Sorting by ID (approx creation time) is simple
                 if (a.status !== 'completed' && b.status !== 'completed') {
                      return (a.id || 0) - (b.id || 0); // Use ID as a secondary sort key
                 }

                 // For completed tasks, sort by completion time if you store it, or just by ID
                  return (a.id || 0) - (b.id || 0); // Default sort by ID for consistency
             });


            // Render each task card
            tasks.forEach(task => {
                const taskCard = document.createElement('div');
                // Add class for completed tasks
                taskCard.className = `task-card ${task.status === 'completed' ? 'task-completed' : ''}`;
                taskCard.dataset.id = task.id; // Store task ID

                const timeRemaining = task.goalInSeconds - task.elapsed; // Calculate remaining time
                const isOvertime = timeRemaining < 0; // Check if elapsed time exceeds goal
                // Determine class for timer display (active timer state and overtime status)
                const timerDisplayClass = (task.status === 'active' || task.status === 'paused') ? `active ${isOvertime ? 'overtime' : ''}` : '';
                // Format the time display string (show '+' for overtime)
                const displayTime = isOvertime ? `+${formatTime(Math.abs(timeRemaining))}` : formatTime(timeRemaining);

                 // Determine which action buttons to show based on task status
                let actionButtonsHTML;
                if (task.status === 'idle') {
                     // Use window.startTask
                    actionButtonsHTML = `<button class="btn btn-primary btn-start" onclick="window.startTask(${task.id})">Start</button>`;
                } else if (task.status === 'active') {
                     // Use window.pauseTask
                    actionButtonsHTML = `<button class="btn btn-secondary btn-pause" onclick="window.pauseTask(${task.id})">Pause</button>`;
                } else if (task.status === 'paused') {
                     // Use window.startTask (Resume)
                    actionButtonsHTML = `<button class="btn btn-primary btn-start" onclick="window.startTask(${task.id})">Resume</button>`;
                } else {
                     // Completed tasks have a status icon instead of buttons
                    actionButtonsHTML = `<div class="task-status-icon">✅</div>`; // Use a checkmark icon
                }
                 // "Mark as Done" button only for incomplete tasks that are started/paused
                 let doneButtonHTML = (task.status === 'active' || task.status === 'paused') ? `<button class="btn btn-primary btn-done" onclick="window.completeTask(${task.id})">Mark as Done</button>` : ''; // Use window.completeTask

                 // Calculate progress percentage for the progress bar
                const progressPercent = task.goalInSeconds > 0 ? Math.min(100, (task.elapsed / task.goalInSeconds) * 100) : 0; // Prevent division by zero

                // Generate HTML for the task card
                taskCard.innerHTML = `<div class="task-info"><div class="task-subject">${task.subject}</div><div class="task-topic">${task.topic}</div></div>
                 <div class="task-timer-display ${timerDisplayClass}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>${task.status === 'completed' ? `Goal: ${formatGoalTime(task.goalInSeconds)}` : displayTime}</span>
                 </div>
                 <div class="task-actions">
                     ${actionButtonsHTML}
                     <!-- Use window.deleteTask -->
                     <button class="icon-btn btn-delete" onclick="window.deleteTask(${task.id})">
                         <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                     </button>
                 </div>
                 ${task.status !== 'completed' ? `<div class="progress-bar"><div class="progress-bar-inner" style="width: ${progressPercent}%"></div></div>${doneButtonHTML}` : ''}`;

                taskList.appendChild(taskCard); // Add task card to the list
            });
             console.log(`DEBUG_MERGE: Rendered ${tasks.length} Study Planner tasks.`);
        };


        // Function to update the timer display for a running task
        const updateTimer = (taskId) => {
             // Find the task by ID
            const task = tasks.find(t => t.id == taskId);
            // Only update if the task exists and is active
            if (!task || task.status !== 'active') {
                 // Clear the interval if task is no longer active (safety)
                 if (timers[taskId]) {
                     clearInterval(timers[taskId]);
                     delete timers[taskId];
                      console.log(`DEBUG_MERGE: Study Planner: Timer for task ${taskId} stopped (task not active).`);
                 }
                 return;
            }
            task.elapsed++; // Increment elapsed time

            const taskCard = screen.querySelector(`.task-card[data-id='${taskId}']`);
            if (taskCard) {
                 const timerEl = taskCard.querySelector('.task-timer-display span');
                 const progressBar = taskCard.querySelector('.progress-bar-inner');
                 const timeRemaining = task.goalInSeconds - task.elapsed; // Recalculate remaining time

                 // Update timer display text and overtime class
                 if (timerEl) {
                     timerEl.parentElement.classList.toggle('overtime', timeRemaining < 0); // Add 'overtime' class if time remaining is negative
                     timerEl.textContent = timeRemaining < 0 ? `+${formatTime(Math.abs(timeRemaining))}` : formatTime(timeRemaining); // Display time
                 }

                 // Update progress bar width (cap at 100%)
                 if (progressBar) {
                     const progressPercent = task.goalInSeconds > 0 ? Math.min(100, (task.elapsed / task.goalInSeconds) * 100) : 0;
                     progressBar.style.width = `${progressPercent}%`;
                 }

                 // Auto-complete task if goal is reached (optional, can be removed if manual completion is preferred)
                 // if (task.elapsed >= task.goalInSeconds && task.status === 'active' && task.goalInSeconds > 0) {
                 //      completeTask(taskId);
                 //      console.log(`DEBUG_MERGE: Task ${taskId} auto-completed upon reaching goal.`);
                 // }

            } else {
                 console.warn(`DEBUG_MERGE: Study Planner: Task card element not found for task ${taskId} during timer update.`);
                 // If card not found, stop the timer for safety
                 if (timers[taskId]) {
                     clearInterval(timers[taskId]);
                     delete timers[taskId];
                      console.log(`DEBUG_MERGE: Study Planner: Timer for task ${taskId} stopped (card element not found).`);
                 }
            }

            saveTasks(); // Save tasks after each second update
        };

        // Function to start a task timer
        window.startTask = (taskId) => { // Make globally accessible for button clicks
             console.log(`DEBUG_MERGE: Study Planner: startTask called for ID: ${taskId}.`);
            const task = tasks.find(t => t.id == taskId);
            if (!task) {
                 console.error(`DEBUG_MERGE: Study Planner: Task with ID ${taskId} not found.`);
                 return;
            }

             // Pause any other currently active task before starting this one
             tasks.filter(t => t.status === 'active' && t.id !== taskId).forEach(t => pauseTask(t.id));

            task.status = 'active'; // Set task status to active
             // Start the timer interval if it's not already running
            if (!timers[taskId]) {
                 timers[taskId] = setInterval(() => updateTimer(taskId), 1000);
                 console.log(`DEBUG_MERGE: Study Planner: Timer started for task ${taskId}.`);
            }

            renderTasks(); // Re-render task list to update UI (button state, timer display)
        };

        // Function to pause a task timer
        window.pauseTask = (taskId) => { // Make globally accessible for button clicks
             console.log(`DEBUG_MERGE: Study Planner: pauseTask called for ID: ${taskId}.`);
            const task = tasks.find(t => t.id == taskId);
            if (!task) {
                 console.error(`DEBUG_MERGE: Study Planner: Task with ID ${taskId} not found.`);
                 return;
            }
            task.status = 'paused'; // Set task status to paused
            // Clear the timer interval
            clearInterval(timers[taskId]);
            delete timers[taskId]; // Remove interval ID from the timers object
             console.log(`DEBUG_MERGE: Study Planner: Timer paused for task ${taskId}.`);
            saveTasks(); // Save tasks after pausing
            renderTasks(); // Re-render task list to update UI
        };

        // Function to mark a task as completed
        window.completeTask = (taskId) => { // Make globally accessible for button clicks
             console.log(`DEBUG_MERGE: Study Planner: completeTask called for ID: ${taskId}.`);
            const task = tasks.find(t => t.id == taskId);
            if (!task) {
                 console.error(`DEBUG_MERGE: Study Planner: Task with ID ${taskId} not found.`);
                 return;
            }
             // Clear the timer interval if it's running
            clearInterval(timers[taskId]);
            delete timers[taskId];
             console.log(`DEBUG_MERGE: Study Planner: Timer stopped for completed task ${taskId}.`);

            const wasEarly = task.elapsed < task.goalInSeconds && task.goalInSeconds > 0; // Check if goal was met early
            task.status = 'completed'; // Set task status to completed
            // Optionally record completion time/date here

            // Show notification based on whether goal was met
             showNotification(
                wasEarly ? 'success' : 'info', // Notification type
                wasEarly ? 'Congratulations!' : 'Task Complete!', // Title
                wasEarly ? `Incredible focus! You finished "${task.topic}" early.` : `You pushed through and finished "${task.topic}". Every minute counts!`, // Message
                wasEarly ? '🎉' : '💪' // Icon
            );
             console.log(`DEBUG_MERGE: Study Planner: Task ${taskId} marked as completed.`);
            saveTasks(); // Save tasks after completion
            renderTasks(); // Re-render task list
        };

        // Function to delete a task
        window.deleteTask = (taskId) => { // Make globally accessible for button clicks
             console.log(`DEBUG_MERGE: Study Planner: deleteTask called for ID: ${taskId}.`);
            if (confirm('Are you sure you want to delete this task?')) {
                 console.log("DEBUG_MERGE: Study Planner: User confirmed deletion.");
                 // Filter out the task to delete
                tasks = tasks.filter(t => t.id != taskId);
                 // Clear the timer interval if it was running for this task
                clearInterval(timers[taskId]);
                delete timers[taskId];
                 console.log(`DEBUG_MERGE: Study Planner: Task ${taskId} deleted.`);
                saveTasks(); // Save changes
                renderTasks(); // Re-render task list
            } else {
                 console.log("DEBUG_MERGE: Study Planner: Task deletion cancelled.");
            }
        };

        // Helper function to pad numbers with leading zeros (for time display)
        const pad = (num) => String(num).padStart(2, '0');

        // Helper function to format total seconds into MM:SS string
        const formatTime = (totalSeconds) => `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;

        // Helper function to format total seconds into HHh MMm SSs string (for goal display)
        const formatGoalTime = (totalSeconds) => {
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
             // Build string only including units that are greater than 0
            return [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : '', s > 0 ? `${s}s` : ''].filter(Boolean).join(' ') || '0s'; // Join with space, default to '0s' if 0 total
        };

        // Function to update the header info (quote and date)
        const updateHeaderInfo = () => {
             console.log("DEBUG_MERGE: Study Planner: updateHeaderInfo called.");
             // Set a random quote
            if (quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
            else console.warn("DEBUG_MERGE: Study Planner quote element not found.");
             // Format and set the current date
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, options);
            else console.warn("DEBUG_MERGE: Study Planner date element not found.");
             console.log("DEBUG_MERGE: Study Planner header info updated.");
        };

        // Function to show the task completion notification popup
        const showNotification = (type, title, message, icon) => {
             console.log(`DEBUG_MERGE: Study Planner: showNotification called. Type: ${type}, Title: "${title}"`);
            if (!notificationPopup || !popupIcon || !popupTitle || !popupMessage) {
                 console.error("DEBUG_MERGE: Study Planner notification popup elements not found.");
                 alert(`${title}: ${message}`); // Fallback to alert
                 return;
            }
            // Set content of the popup
            popupIcon.textContent = icon;
            popupTitle.textContent = title;
            popupMessage.innerHTML = message;
            // Add class to show the popup (assumes CSS handles transitions)
            notificationPopup.classList.add('active');
             console.log("DEBUG_MERGE: Study Planner notification popup shown.");
        };

        // Function to populate the hour, minute, and second dropdowns in the time picker modal
        const populateTimeSelectors = () => {
             console.log("DEBUG_MERGE: Study Planner: populateTimeSelectors called.");
            if (!hoursSelect || !minutesSelect || !secondsSelect) {
                 console.error("DEBUG_MERGE: Study Planner time selector elements not found.");
                 return;
            }
            // Add options 00-23 for hours
            for (let i = 0; i <= 23; i++) hoursSelect.innerHTML += `<option value="${i}">${pad(i)}</option>`;
            // Add options 00-59 for minutes and seconds
            for (let i = 0; i <= 59; i++) minutesSelect.innerHTML += `<option value="${i}">${pad(i)}</option>`;
            for (let i = 0; i <= 59; i++) secondsSelect.innerHTML += `<option value="${i}">${pad(i)}</option>`;
             console.log("DEBUG_MERGE: Study Planner time selectors populated.");
        };


        // Add event listeners to Study Planner buttons and form
        // Add Task FAB click listener
        if (addTaskBtn) addTaskBtn.addEventListener('click', () => {
             console.log("DEBUG_MERGE: Study Planner: Add Task FAB clicked.");
            if (taskForm) taskForm.reset(); // Reset the form
            if (timeSelectorBtn) timeSelectorBtn.textContent = 'Set Time'; // Reset time selector button text
            if (taskTimeInSeconds) taskTimeInSeconds.value = '0'; // Reset hidden time value
            if (taskModal) taskModal.classList.add('active'); // Show the modal
        });
        else console.warn("DEBUG_MERGE: Study Planner Add Task FAB not found.");

        // Cancel button in the task modal
        if (cancelTaskBtn && taskModal) cancelTaskBtn.addEventListener('click', () => {
             console.log("DEBUG_MERGE: Study Planner: Cancel Task button clicked.");
            taskModal.classList.remove('active'); // Hide the modal
        });
        else console.warn("DEBUG_MERGE: Study Planner Cancel Task button or modal not found.");


        // Task form submission listener
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                 console.log("DEBUG_MERGE: Study Planner: Task form submitted.");
                if (!taskTimeInSeconds) {
                     console.error("DEBUG_MERGE: Study Planner taskTimeInSeconds input not found.");
                     alert("Error saving task.");
                     return;
                }
                const totalSeconds = parseInt(taskTimeInSeconds.value, 10);
                 // Validate time goal
                if (isNaN(totalSeconds) || totalSeconds <= 0) {
                    alert('Please set a time goal greater than 0 seconds.');
                     console.log("DEBUG_MERGE: Study Planner: Invalid time goal.");
                    return;
                }

                const taskSubjectElement = screen.querySelector('#taskSubject');
                const taskTopicElement = screen.querySelector('#taskTopic');
                 if (!taskSubjectElement || !taskTopicElement) {
                      console.error("DEBUG_MERGE: Study Planner task subject or topic input not found.");
                      alert("Error saving task. Form elements missing.");
                      return;
                 }

                 // Create the new task object
                const newTask = {
                    id: Date.now(), // Unique ID using timestamp
                    subject: taskSubjectElement.value.trim(), // Use trimmed value
                    topic: taskTopicElement.value.trim(), // Use trimmed value
                    goalInSeconds: totalSeconds,
                    elapsed: 0, // Start with 0 elapsed time
                    status: 'idle' // Initial status is idle
                };

                tasks.push(newTask); // Add new task to the array
                 console.log("DEBUG_MERGE: Study Planner: New task created:", newTask);
                saveTasks(); // Save tasks
                renderTasks(); // Re-render task list
                if (taskModal) taskModal.classList.remove('active'); // Hide the modal
                 console.log("DEBUG_MERGE: Study Planner: Task saved and modal closed.");
            });
             console.log("DEBUG_MERGE: Study Planner Task form listener attached.");
        } else { console.warn("DEBUG_MERGE: Study Planner Task form not found."); }


        // Time selector button click listener (opens time picker modal)
        if (timeSelectorBtn && timerPickerModal) timeSelectorBtn.addEventListener('click', () => {
             console.log("DEBUG_MERGE: Study Planner: Time Selector button clicked.");
            timerPickerModal.classList.add('active'); // Show the time picker modal
        });
        else console.warn("DEBUG_MERGE: Study Planner Time Selector button or timer picker modal not found.");


        // Set Timer button listener in the time picker modal
        if (setTimerBtn && timerPickerModal && hoursSelect && minutesSelect && secondsSelect && taskTimeInSeconds && timeSelectorBtn) {
            setTimerBtn.addEventListener('click', () => {
                 console.log("DEBUG_MERGE: Study Planner: Set Timer button clicked.");
                 // Get selected hours, minutes, and seconds values
                const h = parseInt(hoursSelect.value, 10);
                const m = parseInt(minutesSelect.value, 10);
                const s = parseInt(secondsSelect.value, 10);
                 // Calculate total seconds
                const totalSeconds = (h * 3600) + (m * 60) + s;

                 // Update hidden input and time selector button text
                taskTimeInSeconds.value = totalSeconds;
                timeSelectorBtn.textContent = `${pad(h)}h ${pad(m)}m ${pad(s)}s`; // Display formatted time
                timerPickerModal.classList.remove('active'); // Hide the modal
                 console.log(`DEBUG_MERGE: Study Planner: Time goal set to ${totalSeconds} seconds.`);
            });
             console.log("DEBUG_MERGE: Study Planner Set Timer button listener attached.");
        } else { console.warn("DEBUG_MERGE: Study Planner Set Timer button or related elements not found."); }


        // Event delegation listener for clicks within the task list (Start, Pause, Done, Delete buttons)
        if (taskList) {
            taskList.addEventListener('click', (e) => {
                const target = e.target; // The clicked element
                const taskCard = target.closest('.task-card'); // Find the closest parent task card

                if (!taskCard) {
                     console.log("DEBUG_MERGE: Click in task list, but not on a task card or button.");
                    return; // If click wasn't on a task card, do nothing
                }

                const taskId = taskCard.dataset.id; // Get the task ID from the data attribute
                 console.log(`DEBUG_MERGE: Study Planner: Task card interaction detected for task ID: ${taskId}.`);

                // Check which button was clicked and call the corresponding function
                if (target.classList.contains('btn-start')) {
                     console.log("DEBUG_MERGE: 'Start' button clicked.");
                    window.startTask(taskId); // Use window.
                } else if (target.classList.contains('btn-pause')) {
                     console.log("DEBUG_MERGE: 'Pause' button clicked.");
                    window.pauseTask(taskId); // Use window.
                } else if (target.classList.contains('btn-done')) {
                     console.log("DEBUG_MERGE: 'Mark as Done' button clicked.");
                    window.completeTask(taskId); // Use window.
                } else if (target.closest('.btn-delete')) { // Use closest in case click is on icon inside button
                     console.log("DEBUG_MERGE: 'Delete' button clicked.");
                    window.deleteTask(taskId); // Use window.
                } else {
                     console.log("DEBUG_MERGE: Click on task card, but not a specific button.");
                     // Optionally implement editing task on clicking the card itself
                     // openTaskEditor(taskId); // You would need an openTaskEditor function
                }
            });
             console.log("DEBUG_MERGE: Study Planner Task list delegation listener attached.");
        } else { console.warn("DEBUG_MERGE: Study Planner Task list element not found."); }

        // OK button in the notification popup
        if (popupOkBtn && notificationPopup) popupOkBtn.addEventListener('click', () => {
             console.log("DEBUG_MERGE: Study Planner: Notification OK button clicked.");
            notificationPopup.classList.remove('active'); // Hide the popup
        });
        else console.warn("DEBUG_MERGE: Study Planner Notification OK button or popup not found.");


        // Initial calls when the feature is initialized
        populateTimeSelectors(); // Fill time picker dropdowns
        updateHeaderInfo(); // Set initial quote and date
        loadTasks(); // Load tasks from storage
         console.log("DEBUG_MERGE: initStudyPlannerFeature finished.");
    }
    // --- END Study Planner Feature ---


    // --- Self Progress Feature (FROM New File.js) ---
    function initSelfProgressFeature() {
         console.log("DEBUG_MERGE: initSelfProgressFeature called.");
        const screen = document.getElementById('self-progress-screen');
        if (!screen || screen.dataset.initialized) {
             console.log("DEBUG_MERGE: Self Progress feature already initialized or screen not found.");
             return;
        }
        screen.dataset.initialized = 'true';
         console.log("DEBUG_MERGE: Self Progress feature initializing...");


        let iconSwiper; // Swiper instance for focus icons

        let focusSessions = []; // Array to store completed focus sessions

        // State for the current timer session
        let timerState = {
            intervalId: null, // ID of the setInterval timer
            secondsElapsedThisSession: 0, // Time elapsed in the current active/paused session
            isPaused: true // Whether the timer is currently paused
        };

        // State for the analytics view
        let analyticsState = {
            swiper: null, // Swiper instance for analytics charts
            currentFrame: 'day', // Current timeframe for analytics ('day', 'week', 'month', 'year')
            currentDate: new Date() // Date currently displayed in analytics view
        };

        // Get DOM elements for the Self Progress feature
        const focusHubPage = screen.querySelector('#focus-hub-page'); // The main timer/focus page
        const analyticsPage = screen.querySelector('#analytics-page'); // The analytics/graph page
        const backBtn = screen.querySelector('#back-btn'); // Back button on the analytics page
        const analyticsNavBtn = screen.querySelector('#analytics-nav-btn'); // Button to navigate to analytics from hub
        const timerDisplay = screen.querySelector('#timer-display'); // Element displaying the timer MM:SS
        const instructionText = screen.querySelector('#instruction-text'); // Instruction text under the timer
        const iconSwiperContainer = screen.querySelector('#icon-swiper-container'); // Container holding the icon swiper
        const swiperBtnPrev = screen.querySelector('#swiper-btn-prev'); // Previous button for icon swiper
        const swiperBtnNext = screen.querySelector('#swiper-btn-next'); // Next button for icon swiper
        const timeframeNav = screen.querySelector('#timeframe-nav'); // Navigation for selecting timeframe (Day, Week, etc.)
        const analyticsSwiperWrapper = screen.querySelector('#analytics-swiper-wrapper'); // Wrapper for analytics chart slides


        // Function to save focus session data to localStorage
        const saveData = () => {
             console.log("DEBUG_MERGE: Self Progress: saveData called.");
             try {
                 // Store an object containing sessions
                 localStorage.setItem('conceptra_focus_data_v2', JSON.stringify({
                     sessions: focusSessions.map(s => ({
                         ...s,
                         startTime: s.startTime.toISOString() // Store Date objects as ISO strings
                     }))
                 }));
                 console.log("DEBUG_MERGE: Self Progress data saved to storage.");
             } catch (e) {
                 console.error("DEBUG_MERGE: Failed to save self progress data:", e);
             }
        };


        // Function to load focus session data from localStorage
        const loadData = () => {
             console.log("DEBUG_MERGE: Self Progress: loadData called.");
             try {
                 const data = JSON.parse(localStorage.getItem('conceptra_focus_data_v2'));
                 if (data && Array.isArray(data.sessions)) {
                     // Map loaded sessions, converting startTime strings back to Date objects
                     focusSessions = data.sessions.map(s => ({
                         ...s,
                         startTime: new Date(s.startTime), // Convert string to Date
                         durationInSeconds: parseInt(s.durationInSeconds) || 0 // Ensure duration is number
                     })) || [];
                      console.log(`DEBUG_MERGE: Loaded ${focusSessions.length} Self Progress sessions from storage.`);
                 } else {
                      console.log("DEBUG_MERGE: No Self Progress data found or invalid data. Using empty sessions.");
                     focusSessions = []; // Use empty array if no data or invalid
                 }
             } catch (e) {
                 console.error("DEBUG_MERGE: Failed to parse self progress data from storage:", e);
                 console.warn("DEBUG_MERGE: Resetting self progress data due to parse error.");
                 focusSessions = []; // Reset sessions on parse error
             }
        };


        // Function to show a specific sub-page within Self Progress (Focus Hub or Analytics)
        const showSubPage = (pageToShow) => {
             console.log(`DEBUG_MERGE: Self Progress: showSubPage called for: ${pageToShow}.`);
            if (!focusHubPage || !analyticsPage) {
                 console.error("DEBUG_MERGE: Self Progress sub-page elements not found.");
                 return;
            }

            // Remove 'active' and 'hidden' classes from both pages
            focusHubPage.classList.remove('active', 'hidden');
            analyticsPage.classList.remove('active', 'hidden');

            // Activate the target page and hide the other
            if (pageToShow === 'analytics') {
                analyticsPage.classList.add('active');
                focusHubPage.classList.add('hidden');
                renderAnalyticsView(); // Render analytics view when switching to it
                 console.log("DEBUG_MERGE: Showing Self Progress Analytics page.");
            } else { // Assuming 'hub' or any other value defaults to hub
                focusHubPage.classList.add('active');
                analyticsPage.classList.add('hidden');
                 console.log("DEBUG_MERGE: Showing Self Progress Focus Hub page.");
                 // Ensure timer state display is correct when returning to hub
                 updateTimerUI();
            }
        };


        // Function to initialize the Swiper for focus icons
        const initIconSwiper = () => {
             console.log("DEBUG_MERGE: Self Progress: initIconSwiper called.");
            const iconSwiperElement = screen.querySelector('.icon-swiper');
            // Check if Swiper exists and the element is found, and it hasn't been initialized yet
            if (typeof Swiper !== 'undefined' && iconSwiperElement && !iconSwiper) {
                 console.log("DEBUG_MERGE: Initializing icon Swiper.");
                iconSwiper = new Swiper(iconSwiperElement, {
                    loop: true, // Enable loop mode for endless icons
                    effect: 'coverflow', // Optional: add an effect
                    centeredSlides: true, // Center the active slide
                    slidesPerView: 3, // Show multiple slides
                     coverflowEffect: { // Coverflow specific options
                         rotate: 50,
                         stretch: 0,
                         depth: 100,
                         modifier: 1,
                         slideShadows: true,
                     },
                    navigation: { // Enable navigation using provided buttons
                         prevEl: swiperBtnPrev,
                         nextEl: swiperBtnNext,
                    },
                     // Disable touch move initially if timer is not paused
                     allowTouchMove: timerState.isPaused,
                });
                 console.log("DEBUG_MERGE: Icon Swiper initialized.");
            } else if (iconSwiper) {
                 console.log("DEBUG_MERGE: Icon Swiper already initialized.");
                 // Update allowTouchMove state based on timer state if already initialized
                 iconSwiper.allowTouchMove = timerState.isPaused;
            } else {
                 console.warn("DEBUG_MERGE: Swiper library not loaded or icon swiper element not found. Icon swiper will not work.");
            }
        };


        // Function to update the timer display and progress circle UI
        const updateTimerUI = () => {
             console.log("DEBUG_MERGE: Self Progress: updateTimerUI called.");
            if (!timerDisplay) {
                 console.warn("DEBUG_MERGE: Self Progress timer display element not found.");
                 return;
            }

            const totalSeconds = timerState.secondsElapsedThisSession;
            // Format seconds into MM:SS string and update display
            timerDisplay.textContent = `${Math.floor(totalSeconds/60).toString().padStart(2,'0')}:${(totalSeconds%60).toString().padStart(2,'0')}`;

            const progressCircle = screen.querySelector('.progress-ring__circle');
            if (!progressCircle) {
                 console.warn("DEBUG_MERGE: Self Progress progress circle element not found.");
                 return;
            }
            // Get the radius of the circle from its SVG attribute
            const radius = progressCircle.r.baseVal.value;
            // Calculate the circumference
            const circumference = 2 * Math.PI * radius;

            // Set the stroke-dasharray to the circumference for a full circle
            progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;

            // Calculate the progress relative to a goal (e.g., 1 hour = 3600 seconds)
            // Here, let's make the circle represent progress towards 1 hour.
            const goalInSeconds = 3600; // 1 hour
            const progress = totalSeconds / goalInSeconds; // Progress as a fraction (e.g., 0.5 for 30 mins)

            // Calculate the stroke-dashoffset
            // When progress is 0, offset is circumference (circle not drawn)
            // When progress is 1, offset is 0 (circle fully drawn)
            progressCircle.style.strokeDashoffset = String(circumference * (1 - Math.min(progress, 1))); // Cap progress at 1 (100%)

             console.log(`DEBUG_MERGE: Self Progress timer UI updated. Time: ${totalSeconds}s, Progress: ${Math.min(progress * 100, 100).toFixed(1)}%.`);

        };


        // Function to start the focus timer
        const startTimer = () => {
             console.log("DEBUG_MERGE: Self Progress: startTimer called.");
             // If timer is already running, do nothing
            if (timerState.intervalId) {
                 console.log("DEBUG_MERGE: Timer is already running.");
                 return;
            }

            timerState.isPaused = false; // Set state to not paused

            // Hide instruction text
            if (instructionText) instructionText.style.opacity = '0';
             else console.warn("DEBUG_MERGE: Self Progress instruction text not found.");

             // Add visual class to icon container (optional)
            if (iconSwiperContainer) iconSwiperContainer.classList.add('in-session');
            else console.warn("DEBUG_MERGE: Self Progress icon swiper container not found.");

             // Disable swiper touch interaction while timer is active
            if (iconSwiper) iconSwiper.allowTouchMove = false;
            else console.warn("DEBUG_MERGE: Icon Swiper not found or initialized.");

             // Disable swiper navigation buttons
            if (swiperBtnPrev) swiperBtnPrev.disabled = true;
            else console.warn("DEBUG_MERGE: Swiper Prev button not found.");
            if (swiperBtnNext) swiperBtnNext.disabled = true;
             else console.warn("DEBUG_MERGE: Swiper Next button not found.");


            // Record the start time for analytics (or use Date.now() and calculate duration later)
            // Using Date.now() and elapsed time is simpler for live update and saving duration
             const sessionStartTime = new Date(Date.now() - timerState.secondsElapsedThisSession * 1000); // Estimate start time based on current elapsed time


            // Start the interval timer
            timerState.intervalId = setInterval(() => {
                timerState.secondsElapsedThisSession++; // Increment elapsed time

                 // Optional: Check if 1 hour (3600s) is reached to auto-pause or notify
                 if (timerState.secondsElapsedThisSession % 60 === 0) { // Log every minute
                     console.log(`DEBUG_MERGE: Self Progress: Timer running. Elapsed: ${timerState.secondsElapsedThisSession}s.`);
                 }
                 if (timerState.secondsElapsedThisSession >= 3600) {
                     // You can add a notification or auto-pause here after 1 hour
                     // Example: Auto-pause after 1 hour
                     if (timerState.secondsElapsedThisSession === 3600) {
                         console.log("DEBUG_MERGE: Self Progress: 1 hour reached. Auto-pausing.");
                         pauseTimer(); // Pause the timer
                         // Show a notification that 1 hour goal is met (optional)
                          showNotification('info', 'Focus Goal Reached!', 'You focused for a full hour! Take a break.', '⏱️');
                     } else if (timerState.secondsElapsedThisSession > 3600 && timerState.secondsElapsedThisSession % 60 === 0) {
                          // Log overtime every minute after 1 hour
                         console.log(`DEBUG_MERGE: Self Progress: Overtime. Elapsed: ${timerState.secondsElapsedThisSession}s.`);
                     }
                     // Continue updating UI and analytics even in overtime
                     updateTimerUI();
                     updateLiveAnalyticsBar(sessionStartTime, timerState.secondsElapsedThisSession);
                     return; // Stop this interval tick if auto-paused
                 }


                updateTimerUI(); // Update the timer display and progress circle
                updateLiveAnalyticsBar(sessionStartTime, timerState.secondsElapsedThisSession); // Update the analytics graph live (if visible)

            }, 1000); // Interval of 1000ms (1 second)

             console.log("DEBUG_MERGE: Self Progress: Timer interval started.");
        };


        // Function to pause the focus timer
        const pauseTimer = () => {
             console.log("DEBUG_MERGE: Self Progress: pauseTimer called.");
             // If timer is not running or already paused, do nothing
            if (!timerState.intervalId && timerState.isPaused) {
                 console.log("DEBUG_MERGE: Timer is not running or already paused.");
                 return;
            }

             // Clear the interval timer
            clearInterval(timerState.intervalId);
            timerState.intervalId = null; // Clear the interval ID reference

            timerState.isPaused = true; // Set state to paused

            // Show instruction text
            if(instructionText) instructionText.style.opacity = '1';

             // Remove visual class from icon container
            if(iconSwiperContainer) iconSwiperContainer.classList.remove('in-session');

             // Enable swiper touch interaction
            if (iconSwiper) iconSwiper.allowTouchMove = true;

             // Enable swiper navigation buttons
            if (swiperBtnPrev) swiperBtnPrev.disabled = false;
            if (swiperBtnNext) swiperBtnNext.disabled = false;


            // If elapsed time is more than a minimum threshold (e.g., 10 seconds), save the session
            const minSessionDuration = 10; // seconds
            if (timerState.secondsElapsedThisSession >= minSessionDuration) {
                 console.log(`DEBUG_MERGE: Self Progress: Session duration ${timerState.secondsElapsedThisSession}s >= minimum ${minSessionDuration}s. Saving session.`);
                 // Estimate session start time
                 const sessionStartTime = new Date(Date.now() - timerState.secondsElapsedThisSession * 1000);
                 // Add the completed session to the focusSessions array
                 focusSessions.push({
                    startTime: sessionStartTime, // Date object
                    durationInSeconds: timerState.secondsElapsedThisSession // Number of seconds
                });
                saveData(); // Save the updated sessions data
                // If analytics is currently visible and showing today's data, re-render it
                 if (analyticsPage && analyticsPage.classList.contains('active') && analyticsState.currentFrame === 'day' && isToday(analyticsState.currentDate)) {
                     console.log("DEBUG_MERGE: Self Progress: Analytics page visible and showing today. Re-rendering after save.");
                    renderAnalyticsView();
                }
            } else {
                 console.log(`DEBUG_MERGE: Self Progress: Session duration ${timerState.secondsElapsedThisSession}s < minimum ${minSessionDuration}s. Not saving session.`);
            }


            // Reset elapsed time after saving (for the next session)
            timerState.secondsElapsedThisSession = 0;
             // Update UI immediately after reset (with a slight delay for smooth transition)
            setTimeout(updateTimerUI, 100);

             console.log("DEBUG_MERGE: Self Progress: Timer paused.");
        };


        // Helper function to check if a given Date object is today
        const isToday = (someDate) => {
            if (!someDate || !(someDate instanceof Date) || isNaN(someDate.getTime())) {
                 return false; // Return false for invalid dates
            }
            const today = new Date();
            return someDate.getDate() === today.getDate() &&
                   someDate.getMonth() === today.getMonth() &&
                   someDate.getFullYear() === today.getFullYear();
        };


        // Function to render the analytics view (graphs/charts)
        const renderAnalyticsView = () => {
             console.log("DEBUG_MERGE: Self Progress: renderAnalyticsView called.");
             // Ensure necessary elements exist
             if (!analyticsPage || !timeframeNav || !analyticsSwiperWrapper) {
                  console.error("DEBUG_MERGE: Self Progress analytics page or related elements not found.");
                  return;
             }

             // Update timeframe buttons active state
             timeframeNav.querySelectorAll('.timeframe-btn').forEach(btn => {
                 if (btn) btn.classList.toggle('active', btn.dataset.frame === analyticsState.currentFrame);
             });

            renderAnalyticsSwiperSlides(); // Render the chart slides based on current timeframe and date

             // Highlight the bar for the current hour if viewing today's daily data
             if (analyticsState.currentFrame === 'day' && isToday(analyticsState.currentDate)) {
                 setTimeout(() => { // Use timeout to ensure elements are rendered
                     const currentHour = new Date().getHours();
                     const barItem = screen.querySelector(`#day-bar-item-${currentHour}`);
                     if (barItem) {
                         barItem.style.backgroundColor = 'var(--sp-highlight-color, rgba(0,180,155,0.2))'; // Highlight color
                         setTimeout(() => { // Remove highlight after a few seconds
                             if (barItem) barItem.style.backgroundColor = '';
                         }, 2500);
                          console.log(`DEBUG_MERGE: Self Progress: Highlighted bar for current hour (${currentHour}).`);
                     } else {
                          console.warn(`DEBUG_MERGE: Self Progress: Bar item for current hour (${currentHour}) not found.`);
                     }
                 }, 300); // Small delay after rendering slides
             }
             console.log("DEBUG_MERGE: Self Progress Analytics view rendered.");
        };


        // Function to render the Swiper slides containing the charts for different time periods
        const renderAnalyticsSwiperSlides = () => {
             console.log("DEBUG_MERGE: Self Progress: renderAnalyticsSwiperSlides called.");
            if (!analyticsSwiperWrapper) {
                 console.error("DEBUG_MERGE: Self Progress analytics swiper wrapper not found.");
                 return;
            }

            const frame = analyticsState.currentFrame; // Current timeframe
            const currentDate = new Date(analyticsState.currentDate); // Current date for the middle slide

            // Calculate dates for the previous and next slides based on the current frame
            const prevDate = new Date(currentDate);
            const nextDate = new Date(currentDate);

            if (frame === 'day') {
                prevDate.setDate(currentDate.getDate() - 1);
                nextDate.setDate(currentDate.getDate() + 1);
            } else if (frame === 'week') {
                prevDate.setDate(currentDate.getDate() - 7);
                nextDate.setDate(currentDate.getDate() + 7);
            } else if (frame === 'month') {
                prevDate.setMonth(currentDate.getMonth() - 1);
                nextDate.setMonth(currentDate.getMonth() + 1);
            } else if (frame === 'year') {
                prevDate.setFullYear(currentDate.getFullYear() - 1);
                nextDate.setFullYear(currentDate.getFullYear() + 1);
            }

             console.log(`DEBUG_MERGE: Rendering slides for: Prev=${prevDate.toDateString()}, Current=${currentDate.toDateString()}, Next=${nextDate.toDateString()} (Frame: ${frame})`);

            // Generate HTML for the three slides (Previous, Current, Next)
            analyticsSwiperWrapper.innerHTML = `
                <div class="swiper-slide">${generateChartHTML(getFormattedDate(prevDate, frame), getDataForFrame(prevDate, frame), frame)}</div>
                <div class="swiper-slide">${generateChartHTML(getFormattedDate(currentDate, frame), getDataForFrame(currentDate, frame), frame)}</div>
                <div class="swiper-slide">${generateChartHTML(getFormattedDate(nextDate, frame), getDataForFrame(nextDate, frame), frame)}</div>
            `;

            const analyticsSwiperElement = screen.querySelector('.analytics-swiper');
            // Check if Swiper exists and the element is found, and if we need to re-initialize
            if (typeof Swiper !== 'undefined' && analyticsSwiperElement) {
                // Destroy previous swiper instance if it exists before creating a new one
                if (analyticsState.swiper) {
                    analyticsState.swiper.destroy(true, true); // Destroy with removeSlides=true and cleanupStyles=true
                     console.log("DEBUG_MERGE: Destroyed previous analytics Swiper.");
                }
                 console.log("DEBUG_MERGE: Initializing analytics Swiper.");
                analyticsState.swiper = new Swiper(analyticsSwiperElement, {
                    initialSlide: 1, // Start on the middle slide (current period)
                    loop: false, // Don't loop, we manually update content on slide change
                    on: {
                         // Event handler for when the slide changes
                        slideChange: function() {
                             console.log(`DEBUG_MERGE: Analytics Swiper slide changed. New active index: ${this.activeIndex}.`);
                             // Determine the new current date based on the slide index
                            if (this.activeIndex === 0) { // Swiped to the previous period
                                analyticsState.currentDate = new Date(prevDate);
                            } else if (this.activeIndex === 2) { // Swiped to the next period
                                analyticsState.currentDate = new Date(nextDate);
                            } else { // Returned to the middle slide
                                analyticsState.currentDate = new Date(currentDate);
                            }
                            // After updating the date state, re-render the view to load data for the new period
                            // Use setTimeout to allow Swiper's internal slide change to complete visually
                            setTimeout(() => renderAnalyticsView(), 50);
                        }
                    }
                });
                 console.log("DEBUG_MERGE: Analytics Swiper initialized.");
            } else {
                 console.warn("DEBUG_MERGE: Swiper library not loaded or analytics swiper element not found. Analytics Swiper will not work.");
            }
             console.log("DEBUG_MERGE: Analytics Swiper slides rendered.");
        };


        // Helper function to format a Date object based on the timeframe
        const getFormattedDate = (d, f) => {
            if (!d || !(d instanceof Date) || isNaN(d.getTime())) return 'Invalid Date';
            if (f === 'day') return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            if (f === 'week') {
                 // Find the first day of the week (Monday)
                const firstDayOfWeek = new Date(d);
                firstDayOfWeek.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); // Adjust for Sunday being 0
                const lastDayOfWeek = new Date(firstDayOfWeek);
                lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // Add 6 days to get Sunday
                 // Format as "Start Date - End Date Year"
                return `${firstDayOfWeek.toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${lastDayOfWeek.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
            }
            if (f === 'month') return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
            if (f === 'year') return d.getFullYear().toString(); // Just the year number
            return d.toLocaleDateString(); // Default format
        };

        // Helper function to generate HTML for a chart slide (either day bars or general bars)
        const generateChartHTML = (title, data, frameType) => {
            const containerClass = frameType === 'day' ? 'chart-container day-view' : 'chart-container'; // Specific class for day view layout
            let barsHTML;

            if (frameType === 'day') {
                 // For day view, split into AM (0-11) and PM (12-23) hours
                const amData = data.slice(0, 12);
                const pmData = data.slice(12, 24);

                 // Generate list items for AM hours
                const amList = amData.map((item, i) =>
                    // Use id="day-bar-item-${i}" for live updates/highlighting
                    `<li class="data-bar-item" id="day-bar-item-${i}"><span class="bar-label">${item.label}</span><div class="bar-container"><div class="bar-fill" style="width:${item.percentage}%;" title="${item.tooltip}"></div></div></li>`
                ).join('');
                 // Generate list items for PM hours
                const pmList = pmData.map((item, i) =>
                    // Use id="day-bar-item-${i + 12}" for live updates/highlighting
                    `<li class="data-bar-item" id="day-bar-item-${i + 12}"><span class="bar-label">${item.label}</span><div class="bar-container"><div class="bar-fill" style="width:${item.percentage}%;" title="${item.tooltip}"></div></div></li>`
                ).join('');

                 // Structure for day view grid (two columns for AM/PM)
                barsHTML = `<div class="day-view-grid"><ul class="data-bar-list">${amList}</ul><ul class="data-bar-list">${pmList}</ul></div>`;
            } else {
                 // For week, month, year views, generate a single list of bars
                let listItems = data.map((item, i) =>
                    `<li class="data-bar-item"><span class="bar-label">${item.label}</span><div class="bar-container"><div class="bar-fill" style="width:${item.percentage}%;" title="${item.tooltip}"></div></div></li>`
                ).join('');
                 // Show a message if there is no data
                if (data.length === 0) {
                    listItems = `<li class='data-bar-item'><span style='color: var(--sp-text-muted-color, #888); width: 100%; text-align: center;'>No data for this period.</span></li>`;
                }
                 // Structure for general list view
                barsHTML = `<ul class="data-bar-list">${listItems}</ul>`;
            }

             // Return the complete HTML structure for a swiper slide
            return `<div class="${containerClass}"><h3 class="chart-title">${title}</h3>${barsHTML}</div>`;
        };


        // Helper function to get session data aggregated for a specific timeframe and date
        const getDataForFrame = (date, frame) => {
             console.log(`DEBUG_MERGE: Self Progress: getDataForFrame called for date: ${date.toDateString()}, frame: ${frame}.`);
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                 console.error("DEBUG_MERGE: Self Progress: Invalid date provided to getDataForFrame.");
                 return []; // Return empty array for invalid date
            }

            const sessionsInFrame = focusSessions.filter(session => {
                 // Filter sessions whose start or end time falls within the frame defined by 'date' and 'frame'
                 const sessionStart = session.startTime;
                 const sessionEnd = new Date(session.startTime.getTime() + session.durationInSeconds * 1000);

                 if (frame === 'day') {
                      // Check if session overlaps with the specific day
                      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
                      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
                      return sessionEnd > dayStart && sessionStart < dayEnd;
                 }
                 if (frame === 'week') {
                      // Check if session overlaps with the specific week (Monday to Sunday)
                      const dayOfWeek = date.getDay();
                      const weekStart = new Date(date);
                      weekStart.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Adjust for Sunday
                      weekStart.setHours(0, 0, 0, 0);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6);
                      weekEnd.setHours(23, 59, 59, 999);
                       return sessionEnd > weekStart && sessionStart < weekEnd;
                 }
                 if (frame === 'month') {
                      // Check if session overlaps with the specific month
                      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of month
                       return sessionEnd > monthStart && sessionStart < monthEnd;
                 }
                 if (frame === 'year') {
                      // Check if session overlaps with the specific year
                      const yearStart = new Date(date.getFullYear(), 0, 1);
                      const yearEnd = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
                       return sessionEnd > yearStart && sessionStart < yearEnd;
                 }
                 return false; // Should not happen
            });

            // Aggregate session durations within the specific frame parts
            if (frame === 'day') {
                 // Aggregate seconds per hour
                const hourlyData = Array(24).fill(0); // Array for 24 hours
                sessionsInFrame.forEach(session => {
                     const sessionStart = session.startTime;
                     const sessionEnd = new Date(session.startTime.getTime() + session.durationInSeconds * 1000);
                     const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);

                     // Iterate through the hours of the day
                     for (let hour = 0; hour < 24; hour++) {
                          const hourStart = new Date(dayStart); hourStart.setHours(hour);
                          const hourEnd = new Date(dayStart); hourEnd.setHours(hour, 59, 59, 999);

                          // Check overlap between session and hour
                          const overlapStart = Math.max(sessionStart.getTime(), hourStart.getTime());
                          const overlapEnd = Math.min(sessionEnd.getTime(), hourEnd.getTime());

                          // If there's an overlap, add the duration of the overlap to the hour's total
                          if (overlapEnd > overlapStart) {
                              hourlyData[hour] += (overlapEnd - overlapStart) / 1000; // Add overlap duration in seconds
                          }
                     }
                });
                 // Map hourly seconds to data points (label, percentage, tooltip)
                 const maxSecondsInDayHour = 3600; // Max possible in an hour is 3600 seconds
                return hourlyData.map((seconds, i) => ({
                    label: `${i.toString().padStart(2, '0')}:00`, // Hour label (00:00, 01:00, ...)
                    percentage: Math.min((seconds / maxSecondsInDayHour) * 100, 100), // Percentage of an hour, capped at 100%
                    tooltip: `${Math.round(seconds / 60)} min` // Tooltip in minutes
                }));
            }
            if (frame === 'week') {
                 // Aggregate seconds per day of the week
                const dailyData = Array(7).fill(0); // Array for 7 days (Mon-Sun)
                const dayOfWeek = date.getDay();
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Adjust for Sunday
                weekStart.setHours(0, 0, 0, 0);

                sessionsInFrame.forEach(session => {
                     const sessionStart = session.startTime;
                     const sessionEnd = new Date(session.startTime.getTime() + session.durationInSeconds * 1000);

                     // Iterate through the days of the week
                     for (let i = 0; i < 7; i++) {
                         const dayStart = new Date(weekStart); dayStart.setDate(weekStart.getDate() + i); dayStart.setHours(0,0,0,0);
                         const dayEnd = new Date(weekStart); dayEnd.setDate(weekStart.getDate() + i); dayEnd.setHours(23,59,59,999);

                         // Check overlap between session and day
                         const overlapStart = Math.max(sessionStart.getTime(), dayStart.getTime());
                         const overlapEnd = Math.min(sessionEnd.getTime(), dayEnd.getTime());

                         if (overlapEnd > overlapStart) {
                              dailyData[i] += (overlapEnd - overlapStart) / 1000; // Add overlap duration in seconds
                         }
                     }
                });

                 // Map daily seconds to data points
                const maxSecondsInWeekDay = Math.max(...dailyData, 1); // Max seconds in any day of this week (use 1 to avoid division by zero if all are zero)
                const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                return dailyData.map((seconds, i) => ({
                    label: dayLabels[i], // Day label
                    percentage: (seconds / maxSecondsInWeekDay) * 100, // Percentage relative to the busiest day
                    tooltip: `${Math.round(seconds / 60)} min` // Tooltip in minutes
                }));
            }
            if (frame === 'month') {
                 // Aggregate seconds per week of the month
                const year = date.getFullYear();
                const month = date.getMonth();
                const firstDayOfMonth = new Date(year, month, 1);
                const daysInMonth = new Date(year, month + 1, 0).getDate(); // Number of days in the month
                const firstDayOfWeekOfMonth = (firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1); // Day of week for 1st day (Mon=0)
                const numWeeks = Math.ceil((daysInMonth + firstDayOfWeekOfMonth) / 7); // Total number of weeks shown in the month grid

                const weeklyData = Array(numWeeks).fill(0); // Array for weeks

                sessionsInFrame.forEach(session => {
                     const sessionStart = session.startTime;
                     const sessionEnd = new Date(session.startTime.getTime() + session.durationInSeconds * 1000);

                     // Iterate through the days of the month that the session overlaps with
                     const startDayOfMonth = Math.max(1, sessionStart.getDate());
                     const endDayOfMonth = Math.min(daysInMonth, sessionEnd.getDate() + (sessionEnd.getMonth() === month ? 0 : -1)); // Adjust end day if session crosses month boundary

                     for (let day = 1; day <= daysInMonth; day++) { // Iterate through all days to capture overlaps
                         const currentDateIterator = new Date(year, month, day);
                         const dayStart = new Date(currentDateIterator); dayStart.setHours(0,0,0,0);
                         const dayEnd = new Date(currentDateIterator); dayEnd.setHours(23,59,59,999);

                          // Check overlap between session and day
                          const overlapStart = Math.max(sessionStart.getTime(), dayStart.getTime());
                          const overlapEnd = Math.min(sessionEnd.getTime(), dayEnd.getTime());

                          if (overlapEnd > overlapStart) {
                             // Calculate the week index for this day
                             const dayIndexOverall = day - 1 + firstDayOfWeekOfMonth; // 0-indexed day including leading empty days
                             const weekIndex = Math.floor(dayIndexOverall / 7);

                              if (weeklyData[weekIndex] !== undefined) {
                                   weeklyData[weekIndex] += (overlapEnd - overlapStart) / 1000; // Add overlap duration in seconds
                              } else {
                                   console.warn(`DEBUG_MERGE: Unexpected week index ${weekIndex} for day ${day} in month view.`);
                              }
                         }
                     }
                });


                 // Map weekly seconds to data points
                const maxSecondsInMonthWeek = Math.max(...weeklyData, 1); // Max seconds in any week of this month
                return weeklyData.map((seconds, i) => ({
                    label: `Week ${i + 1}`, // Week label
                    percentage: (seconds / maxSecondsInMonthWeek) * 100, // Percentage relative to the busiest week
                    tooltip: `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m` // Tooltip in hours and minutes
                }));
            }
            if (frame === 'year') {
                 // Aggregate seconds per month of the year
                const monthlyData = Array(12).fill(0); // Array for 12 months
                const year = date.getFullYear();

                sessionsInFrame.forEach(session => {
                     const sessionStart = session.startTime;
                     const sessionEnd = new Date(session.startTime.getTime() + session.durationInSeconds * 1000);

                      // Iterate through the months of the year that the session overlaps with
                     const startMonth = Math.max(0, sessionStart.getMonth());
                     const endMonth = Math.min(11, sessionEnd.getMonth() + (sessionEnd.getFullYear() === year ? 0 : -1)); // Adjust end month if session crosses year boundary

                     for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                         const monthStart = new Date(year, monthIndex, 1);
                         const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

                          // Check overlap between session and month
                         const overlapStart = Math.max(sessionStart.getTime(), monthStart.getTime());
                         const overlapEnd = Math.min(sessionEnd.getTime(), monthEnd.getTime());

                         if (overlapEnd > overlapStart) {
                             monthlyData[monthIndex] += (overlapEnd - overlapStart) / 1000; // Add overlap duration in seconds
                         }
                     }
                });

                 // Map monthly seconds to data points
                const maxSecondsInYearMonth = Math.max(...monthlyData, 1); // Max seconds in any month of this year
                const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return monthlyData.map((seconds, i) => ({
                    label: monthLabels[i], // Month label
                    percentage: (seconds / maxSecondsInYearMonth) * 100, // Percentage relative to the busiest month
                    tooltip: `${Math.round(seconds / 3600)} hrs` // Tooltip in hours
                }));
            }
             console.log("DEBUG_MERGE: Self Progress data aggregated:", data);
            return []; // Return empty array if frame type is unknown
        };


        // Function to update the analytics bar for the current hour live while timer is running
        const updateLiveAnalyticsBar = (sessionStartTime, elapsedSecondsInCurrentSession) => {
            // Only update live bar if on analytics page, viewing day view, and showing today's data
            if (!analyticsPage || !analyticsPage.classList.contains('active') || analyticsState.currentFrame !== 'day' || !isToday(analyticsState.currentDate)) {
                 return;
            }

            // Get the hour corresponding to the session start time
            const currentHour = sessionStartTime.getHours();
            // Find the specific bar item element for this hour
            const barItem = screen.querySelector(`#day-bar-item-${currentHour}`);
            if (!barItem) {
                 console.warn(`DEBUG_MERGE: Self Progress: Bar item for live update hour ${currentHour} not found.`);
                 return;
            }

            const barFill = barItem.querySelector('.bar-fill'); // Get the fill element within the bar item
            if (!barFill) {
                 console.warn("DEBUG_MERGE: Self Progress: Bar fill element not found for live update.");
                 return;
            }

            // Recalculate the total seconds for this hour including completed sessions and the current live session
            let totalSecondsForHour = 0;
            const dayStart = new Date(analyticsState.currentDate); dayStart.setHours(0,0,0,0);

             // Aggregate completed sessions that overlap with this hour
            focusSessions.filter(s => {
                 const sStart = s.startTime;
                 const sEnd = new Date(s.startTime.getTime() + s.durationInSeconds * 1000);
                 const hourStart = new Date(dayStart); hourStart.setHours(currentHour);
                 const hourEnd = new Date(dayStart); hourEnd.setHours(currentHour, 59, 59, 999);
                 // Check overlap between completed session and the target hour
                 return sEnd > hourStart && sStart < hourEnd;
            }).forEach(s => {
                 // Calculate the duration of the overlap within this hour
                 const sessionStart = s.startTime;
                 const sessionEnd = new Date(s.startTime.getTime() + s.durationInSeconds * 1000);
                 const hourStart = new Date(dayStart); hourStart.setHours(currentHour);
                 const hourEnd = new Date(dayStart); hourEnd.setHours(currentHour, 59, 59, 999);

                 const overlapStart = Math.max(sessionStart.getTime(), hourStart.getTime());
                 const overlapEnd = Math.min(sessionEnd.getTime(), hourEnd.getTime());

                 if (overlapEnd > overlapStart) {
                     totalSecondsForHour += (overlapEnd - overlapStart) / 1000; // Add overlap in seconds
                 }
            });


            // Add the elapsed time from the *current* session if it started in this hour
             // Only add current session elapsed time if the current hour matches the session start hour
            if (sessionStartTime.getHours() === currentHour) {
                 totalSecondsForHour += elapsedSecondsInCurrentSession;
            } else {
                 // If the session started in a previous hour and spans into this one,
                 // the 'elapsedSecondsInCurrentSession' isn't just the duration *in this hour*.
                 // This live update logic is simplified. A more complex version would track
                 // elapsed time within each hour the session spans.
                 // For simplicity here, if the session started in a previous hour and is still running,
                 // we assume the entire current hour (up to 'now') contributes if the session covers it.
                 // However, given the 1-hour auto-pause, this simple approach might be sufficient.
                 // A better approach: re-calculate total seconds for *this specific hour* every second.
                 // Let's recalculate total for this hour by getting completed sessions IN this hour
                 // + the overlap of the CURRENT running session in this hour.
                 const hourStart = new Date(dayStart); hourStart.setHours(currentHour);
                 const hourEnd = new Date(dayStart); hourEnd.setHours(currentHour, 59, 59, 999);
                 const now = Date.now();

                  // Calculate overlap of the currently running session with this specific hour
                 const currentSessionOverlapStart = Math.max(sessionStartTime.getTime(), hourStart.getTime());
                 const currentSessionOverlapEnd = Math.min(now, hourEnd.getTime()); // Use 'now' as end time for running session

                  let currentSessionContribution = 0;
                  if (currentSessionOverlapEnd > currentSessionOverlapStart) {
                      currentSessionContribution = (currentSessionOverlapEnd - currentSessionOverlapStart) / 1000;
                  }

                 // Sum completed sessions' contributions and current session's contribution in this hour
                 totalSecondsForHour = totalSecondsForHour + currentSessionContribution; // totalSecondsForHour already has completed sessions


            }


            const totalMinutes = totalSecondsForHour / 60; // Convert total seconds to minutes
            const percentage = Math.min((totalMinutes / 60) * 100, 100); // Percentage of an hour, capped at 100%

             // Update the width of the fill bar and the tooltip
            barFill.style.width = `${percentage}%`;
            barFill.title = `${Math.round(totalMinutes)} min studied`; // Round minutes for tooltip

             // console.log(`DEBUG_MERGE: Self Progress: Live update for hour ${currentHour}. Total seconds: ${totalSecondsForHour}. Percentage: ${percentage.toFixed(1)}%.`); // Too chatty

        };


        // Initial calls when the feature is initialized
        loadData(); // Load saved session data
        initIconSwiper(); // Initialize the focus icon swiper
        updateTimerUI(); // Update the timer display with initial 00:00

        // Add event listeners
        // Click listener on the icon swiper container to start/pause timer
        if (iconSwiperContainer) {
            iconSwiperContainer.addEventListener('click', () => {
                 // If timer is paused, start it; otherwise, pause it
                timerState.isPaused ? startTimer() : pauseTimer();
            });
             console.log("DEBUG_MERGE: Self Progress Icon swiper container click listener attached.");
        } else { console.warn("DEBUG_MERGE: Self Progress icon swiper container not found."); }

        // Click listener on the analytics navigation button
        if (analyticsNavBtn) analyticsNavBtn.addEventListener('click', () => showSubPage('analytics'));
        else console.warn("DEBUG_MERGE: Self Progress Analytics nav button not found.");

        // Click listener on the back button in the analytics page
        if (backBtn) backBtn.addEventListener('click', () => showSubPage('hub')); // Go back to the focus hub page
        else console.warn("DEBUG_MERGE: Self Progress Analytics back button not found.");

        // Event delegation listener for timeframe navigation buttons
        if (timeframeNav) {
            timeframeNav.addEventListener('click', (e) => {
                const button = e.target.closest('.timeframe-btn'); // Find the clicked timeframe button
                // If a button was clicked and it's not already active
                if (button && !button.classList.contains('active')) {

                     console.log(`DEBUG_MERGE: Self Progress: Timeframe button clicked: ${button.dataset.frame}.`);
                     // Remove 'active' class from the currently active button
                    const activeTimeframeBtn = timeframeNav.querySelector('.timeframe-btn.active');
                    if (activeTimeframeBtn) activeTimeframeBtn.classList.remove('active');

                    button.classList.add('active'); // Add 'active' class to the clicked button

                    // Update the analytics state
                    analyticsState.currentFrame = button.dataset.frame; // Set the new timeframe
                    analyticsState.currentDate = new Date(); // Reset date to today when changing timeframe (common behavior)
                    // Re-render the analytics view with the new timeframe and date
                    renderAnalyticsView();
                } else if (button) {
                    console.log(`DEBUG_MERGE: Self Progress: Timeframe button "${button.dataset.frame}" clicked but already active.`);
                } else {
                    console.log("DEBUG_MERGE: Self Progress: Click in timeframe nav, but not on a button.");
                }
            });
             console.log("DEBUG_MERGE: Self Progress Timeframe nav delegation listener attached.");
        } else { console.warn("DEBUG_MERGE: Self Progress Timeframe nav not found."); }
         console.log("DEBUG_MERGE: initSelfProgressFeature finished.");
    }
    // --- END Self Progress Feature ---


    // --- Brain Games Feature (FROM New File.js) ---
    function initBrainGamesFeature() {
        console.log("DEBUG_MERGE: initBrainGamesFeature called.");
        const page = document.getElementById('brain-games-page');
        if (!page || page.dataset.initialized) {
             console.log("DEBUG_MERGE: Brain Games feature already initialized or page not found.");
             return;
        }
        page.dataset.initialized = 'true';
         console.log("DEBUG_MERGE: Brain Games feature initializing...");

        // State variables for each game
        let clashState = {};
        let pulseState = {};
        let shiftState = {};
        let mathState = {};
        let spatialState = {};


        // Get DOM elements for Brain Games
        const menuPattis = page.querySelectorAll('.menu-patti'); // Buttons on the main menu
        const backBtns = page.querySelectorAll('.game-screen .back-btn'); // Back buttons on game screens


        // Add event listeners to menu buttons to launch games
        menuPattis.forEach(patti => {
             if (!patti) return; // Ensure patti exists
            patti.addEventListener('click', () => {
                const gameId = patti.dataset.game; // Get game ID from data attribute
                 console.log(`DEBUG_MERGE: Brain Games: Menu patti clicked, attempting to start game: ${gameId}.`);
                // Navigate to the specific game screen
                showGameScreen(`${gameId}-game-screen`);
                // Start the corresponding game logic
                if (gameId === 'clash') startColorClash();
                else if (gameId === 'pulse') startPatternPulse();
                else if (gameId === 'shift') startShapeShift();
                else if (gameId === 'math') startMathRush();
                else if (gameId === 'spatial') startSpatialSpin();
                else console.warn(`DEBUG_MERGE: Brain Games: Unknown game ID clicked: ${gameId}.`);
            });
        });
         console.log(`DEBUG_MERGE: Attached listeners to ${menuPattis.length} Brain Games menu pattis.`);


        // Add event listeners to back buttons to return to the menu
        backBtns.forEach(btn => {
             if (!btn) return; // Ensure btn exists
            btn.addEventListener('click', () => {
                 console.log("DEBUG_MERGE: Brain Games: Back button clicked, returning to menu.");
                showGameScreen('menu-screen'); // Navigate back to the main menu screen
            });
        });
         console.log(`DEBUG_MERGE: Attached listeners to ${backBtns.length} Brain Games back buttons.`);


        // Game data (colors, shapes, etc.)
        const gameData = {
            clash: { colors: ['#ff2a6d', '#05d9e8', '#aeff00', '#ffb800', '#ad62ff', '#ffffff'], names: ['red', 'blue', 'green', 'yellow', 'purple', 'white'] },
            shift: ['❤️', '⭐', '🔷', '🟢', '🔺', '💡', '🔔', '🏀', '🍎', '🚗', '✈️', '🏠', '🔑', '⏰', '🎉', '🎁', '🎈', '🤖', '👑', '💎'],
            spatial: ['⬆️', '➡️', '⬇️', '⬅️', '⏏️', '▶️', '⏬', '◀️', '↪️', '↩️', '⤴️', '⤵️', 'L', 'J', 'F', 'T'] // Added more shapes
        };

        // --- Color Clash Game Logic ---
        function startColorClash() {
             console.log("DEBUG_MERGE: Brain Games: Starting Color Clash.");
            clashState = { score: 0, correctColor: '' }; // Reset game state
            const clashScoreElement = page.querySelector('#clash-score');
            if (clashScoreElement) clashScoreElement.textContent = `Score: ${clashState.score}`;
            else console.warn("DEBUG_MERGE: Color Clash score element not found.");
            loadNextClash(); // Load the first round
        }

        function loadNextClash() {
             console.log("DEBUG_MERGE: Brain Games: Loading next Color Clash round.");
            const numColors = gameData.clash.colors.length;
            if (numColors === 0) {
                 console.error("DEBUG_MERGE: Color Clash gameData missing colors.");
                 return;
            }

            const wordIndex = Math.floor(Math.random() * numColors); // Index for the color NAME (e.g., 'red')
            let colorIndex = Math.floor(Math.random() * numColors); // Index for the actual color CODE (e.g., '#ff2a6d')

             // Decide if the word and color should match (e.g., 'RED' shown in red color) - adjust probability
            if (Math.random() < 0.4) { // 40% chance to match
                 colorIndex = wordIndex;
            } else { // 60% chance NOT to match
                // Ensure the color index is different from the word index
                while (wordIndex === colorIndex) {
                    colorIndex = Math.floor(Math.random() * numColors);
                }
            }

            clashState.correctColor = gameData.clash.colors[colorIndex]; // The correct answer is the color CODE

            const clashWordEl = page.querySelector('#clash-word');
            if (clashWordEl) {
                 // Display the color NAME as the text
                clashWordEl.textContent = gameData.clash.names[wordIndex].toUpperCase();
                // Set the color STYLE of the text to the color CODE
                clashWordEl.style.color = clashState.correctColor;
                 console.log(`DEBUG_MERGE: Color Clash: Word "${clashWordEl.textContent}" shown in color "${clashState.correctColor}". Correct answer is COLOR code.`);
            } else { console.warn("DEBUG_MERGE: Color Clash word element not found."); }


            const clashOptionsEl = page.querySelector('#clash-options');
            if (clashOptionsEl) {
                clashOptionsEl.innerHTML = ''; // Clear previous options

                 // Create a set to hold unique color options for the buttons
                let options = new Set([clashState.correctColor]); // Always include the correct color
                 // Add random incorrect colors until we have enough options (e.g., 3 options)
                while(options.size < 3) {
                     const randomColor = gameData.clash.colors[Math.floor(Math.random() * numColors)];
                     options.add(randomColor);
                }

                 // Convert set to array, shuffle, and create buttons
                Array.from(options).sort(() => 0.5 - Math.random()).forEach(color => {
                    const btn = document.createElement('button');
                    btn.className = 'clash-btn';
                    btn.style.backgroundColor = color; // Set button background to the color code
                    // Add click listener, checking if the button's color matches the correct color code
                    // Use window.handleClashAnswer
                    btn.onclick = () => window.handleClashAnswer(color === clashState.correctColor);
                    clashOptionsEl.appendChild(btn); // Add button to options container
                });
                 console.log("DEBUG_MERGE: Color Clash options rendered.");
            } else { console.warn("DEBUG_MERGE: Color Clash options element not found."); }
        }

        // Handle user's answer click in Color Clash
        window.handleClashAnswer = function(isCorrect) { // Make globally accessible
             console.log(`DEBUG_MERGE: Brain Games: Color Clash answer clicked. Is Correct: ${isCorrect}.`);
            const clashWordEl = page.querySelector('#clash-word');
            const clashOptionsEl = page.querySelector('#clash-options');
            const clashScoreEl = page.querySelector('#clash-score');


            if(isCorrect) {
                clashState.score++; // Increment score
                if (clashScoreEl) clashScoreEl.textContent = `Score: ${clashState.score}`; // Update score display
                loadNextClash(); // Load the next round
            } else {
                 // Game Over
                 console.log("DEBUG_MERGE: Color Clash Game Over.");
                 if (clashWordEl) {
                     clashWordEl.textContent = 'GAME OVER'; // Show game over message
                     clashWordEl.style.color = 'var(--danger)'; // Change text color to indicate failure
                 }
                 if (clashOptionsEl) clashOptionsEl.innerHTML = ''; // Clear options buttons
                 // Optionally add a "Play Again" button
                 if (clashOptionsEl) { // Re-use options container for "Play Again" button
                     const playAgainBtn = document.createElement('button');
                     playAgainBtn.className = 'btn btn-primary'; // Use a standard button style
                     playAgainBtn.textContent = 'Play Again';
                     playAgainBtn.style.cssText = 'margin-top: 20px; width: 100%;';
                     playAgainBtn.onclick = () => startColorClash(); // Restart the game
                     clashOptionsEl.appendChild(playAgainBtn);
                 }
            }
        }
        // --- End Color Clash Game Logic ---


        // --- Pattern Pulse Game Logic ---
        const pulseGridEl = page.querySelector('#pulse-grid'); // The 3x3 grid container
         // Create the 3x3 grid squares dynamically if the container exists
         if (pulseGridEl) {
             pulseGridEl.innerHTML = ''; // Clear existing content
             for(let i=0; i<9; i++) {
                 const square = document.createElement('div');
                 square.className = 'pulse-square';
                 square.dataset.index = i; // Store index (0-8)
                 // Use window.handlePulseClick
                 square.onclick = () => window.handlePulseClick(square); // Pass the element itself to the handler
                 pulseGridEl.appendChild(square);
             }
             console.log("DEBUG_MERGE: Pattern Pulse grid squares created.");
         } else { console.warn("DEBUG_MERGE: Pattern Pulse grid element not found."); }


        function startPatternPulse() {
             console.log("DEBUG_MERGE: Brain Games: Starting Pattern Pulse.");
             // Reset game state
            pulseState = { level: 0, sequence: [], userSequence: [], phase: 'playingSequence' }; // Initial phase is playing sequence
            const pulseScoreEl = page.querySelector('#pulse-score');
            if(pulseScoreEl) pulseScoreEl.textContent = `Level: ${pulseState.level}`;
             else console.warn("DEBUG_MERGE: Pattern Pulse score element not found.");

            // Disable grid interaction while sequence is playing
            if(pulseGridEl) pulseGridEl.style.pointerEvents = 'none';
             else console.warn("DEBUG_MERGE: Pattern Pulse grid element not found.");

            nextPulseLevel(); // Start the first level
        }

        function nextPulseLevel() {
             console.log("DEBUG_MERGE: Brain Games: Starting next Pattern Pulse level.");
            pulseState.level++; // Increment level
            // Add a new random square index (0-8) to the sequence
            pulseState.sequence.push(Math.floor(Math.random() * 9));
            pulseState.userSequence = []; // Reset user's input sequence for the new level

            const pulseScoreEl = page.querySelector('#pulse-score');
            if(pulseScoreEl) pulseScoreEl.textContent = `Level: ${pulseState.level}`; // Update level display

            // Indicate the phase change
             pulseState.phase = 'playingSequence';
              console.log(`DEBUG_MERGE: Pattern Pulse: Level ${pulseState.level}. Sequence: [${pulseState.sequence.join(', ')}]`);
             // Delay playing the sequence slightly
            setTimeout(playPulseSequence, 500); // Small delay before sequence starts
        }

        function playPulseSequence() {
             console.log("DEBUG_MERGE: Brain Games: Playing Pattern Pulse sequence.");
            if(!pulseGridEl) {
                 console.error("DEBUG_MERGE: Pattern Pulse grid element not found to play sequence.");
                 return;
            }
            pulseGridEl.style.pointerEvents = 'none'; // Disable interaction
            const squares = pulseGridEl.children; // Get the square elements

            let i = 0;
            const interval = setInterval(() => {
                // Stop interval if sequence is finished
                if (i >= pulseState.sequence.length) {
                    clearInterval(interval);
                    // Re-enable grid interaction after sequence finishes
                    pulseGridEl.style.pointerEvents = 'auto';
                     pulseState.phase = 'userInput'; // Change phase to user input
                      console.log("DEBUG_MERGE: Pattern Pulse: Sequence finished. Enabling user input.");
                    return;
                }
                const squareIndex = pulseState.sequence[i];
                const square = squares[squareIndex]; // Get the square element by index
                if (square) {
                     // Add 'active' class to highlight the square
                    square.classList.add('active');
                    // Remove 'active' class after a delay
                    setTimeout(() => square.classList.remove('active'), 400); // Highlight duration
                } else {
                     console.warn(`DEBUG_MERGE: Pattern Pulse: Square element at index ${squareIndex} not found.`);
                }
                i++;
            }, 600); // Delay between square highlights
        }


        // Handle user click on a square during the input phase
        window.handlePulseClick = function(squareEl) { // Make globally accessible, receive element
             console.log("DEBUG_MERGE: Brain Games: Pattern Pulse square clicked.");
            if (pulseState.phase !== 'userInput') {
                 console.log("DEBUG_MERGE: Pattern Pulse: Not in user input phase, ignoring click.");
                 return; // Ignore clicks if not in user input phase
            }

            const index = parseInt(squareEl.dataset.index); // Get the index of the clicked square

            // Add visual feedback for the user's click
            squareEl.classList.add('player-active');
            setTimeout(() => squareEl.classList.remove('player-active'), 200); // Remove highlight quickly

            pulseState.userSequence.push(index); // Add the clicked index to the user's sequence
            const currentStep = pulseState.userSequence.length - 1; // Current position in the user's sequence

             console.log(`DEBUG_MERGE: Pattern Pulse: User clicked index ${index}. User sequence: [${pulseState.userSequence.join(', ')}].`);


            // Check if the clicked square matches the sequence at the current step
            if(pulseState.userSequence[currentStep] !== pulseState.sequence[currentStep]) {
                 // Game Over if the clicked square is incorrect
                 console.log("DEBUG_MERGE: Pattern Pulse: Incorrect input. Game Over.");
                const pulseScoreEl = page.querySelector('#pulse-score');
                if (pulseScoreEl) pulseScoreEl.textContent = `Game Over! Level ${pulseState.level}`; // Show game over message
                // Disable grid interaction
                if (pulseGridEl) pulseGridEl.style.pointerEvents = 'none';
                 // Optionally add a "Play Again" button
                 if (pulseGridEl) { // Re-use grid container or add to parent
                     const playAgainBtn = document.createElement('button');
                     playAgainBtn.className = 'btn btn-primary';
                     playAgainBtn.textContent = 'Play Again';
                     playAgainBtn.style.cssText = 'grid-column: 1 / -1; margin: 20px auto;'; // Center the button in the grid area
                     // Use window.startPatternPulse
                     playAgainBtn.onclick = () => startPatternPulse(); // Restart the game
                     // Clear the grid and add the button
                     pulseGridEl.innerHTML = '';
                     pulseGridEl.appendChild(playAgainBtn);
                     pulseGridEl.style.display = 'grid'; // Ensure grid display
                 }
                pulseState.phase = 'gameOver'; // Set phase to game over
                return; // Stop processing if game over
            }

            // If the user sequence matches the full sequence for this level
            if(pulseState.userSequence.length === pulseState.sequence.length) {
                 console.log("DEBUG_MERGE: Pattern Pulse: Level complete! Moving to next level.");
                // Disable interaction temporarily after successful completion
                if (pulseGridEl) pulseGridEl.style.pointerEvents = 'none';
                 // Indicate the phase change
                 pulseState.phase = 'levelComplete';
                // Start the next level after a short delay
                setTimeout(nextPulseLevel, 1000); // Delay before starting next sequence
            }
        }
        // --- End Pattern Pulse Game Logic ---


        // --- Shape Shift Game Logic ---
        const shape1El = page.querySelector('#shape1'); // Element for the first shape
        const shape2El = page.querySelector('#shape2'); // Element for the second shape
        const shapeSameBtnEl = page.querySelector('#shape-same-btn'); // "Same" button
        const shapeDifferentBtnEl = page.querySelector('#shape-different-btn'); // "Different" button
        const shiftContainerEl = page.querySelector('#shift-container'); // Container to show game over message

         // Add event listeners to buttons if they exist
        if (shapeSameBtnEl) shapeSameBtnEl.onclick = () => window.handleShiftAnswer(true); // Use window.
        else console.warn("DEBUG_MERGE: Shape Shift 'Same' button not found.");
        if (shapeDifferentBtnEl) shapeDifferentBtnEl.onclick = () => window.handleShiftAnswer(false); // Use window.
        else console.warn("DEBUG_MERGE: Shape Shift 'Different' button not found.");


        function startShapeShift() {
             console.log("DEBUG_MERGE: Brain Games: Starting Shape Shift.");
            shiftState = { score: 0, isSame: false }; // Reset game state
            const shiftScoreEl = page.querySelector('#shift-score');
            if (shiftScoreEl) shiftScoreEl.textContent = `Score: ${shiftState.score}`;
             else console.warn("DEBUG_MERGE: Shape Shift score element not found.");

             // Ensure game elements are visible and ready for the first round
             if (shape1El) shape1El.style.display = ''; // Reset display if it was hidden on game over
             if (shape2El) shape2El.style.display = '';
             if (shapeSameBtnEl) shapeSameBtnEl.style.display = '';
             if (shapeDifferentBtnEl) shapeDifferentBtnEl.style.display = '';
             if (shiftContainerEl) shiftContainerEl.textContent = ''; // Clear game over text


            loadNextShift(); // Load the first round
        }

        function loadNextShift() {
             console.log("DEBUG_MERGE: Brain Games: Loading next Shape Shift round.");
            const shapes = gameData.shift; // Array of shapes
            if (!shapes || shapes.length === 0) {
                 console.error("DEBUG_MERGE: Shape Shift gameData missing shapes.");
                 // Optionally show error message and stop game
                 if (shiftContainerEl) shiftContainerEl.textContent = 'Error loading shapes!';
                 return;
            }

            // Decide randomly if the shapes should be the same
            shiftState.isSame = Math.random() > 0.5; // true or false

            const s1 = shapes[Math.floor(Math.random() * shapes.length)]; // Select the first shape

            let s2;
            if (shiftState.isSame) {
                s2 = s1; // If they should be same, second shape is same as first
            } else {
                 // If they should be different, keep selecting until a different shape is found
                do {
                    s2 = shapes[Math.floor(Math.random() * shapes.length)];
                } while (s1 === s2);
            }

            // Update the DOM elements with the selected shapes
            if (shape1El) shape1El.textContent = s1;
            else console.warn("DEBUG_MERGE: Shape Shift shape1 element not found.");
            if (shape2El) shape2El.textContent = s2;
            else console.warn("DEBUG_MERGE: Shape Shift shape2 element not found.");

             console.log(`DEBUG_MERGE: Shape Shift: Shapes loaded. Is Same: ${shiftState.isSame}. Shapes: "${s1}", "${s2}".`);
        }


        // Handle user's answer click in Shape Shift
        window.handleShiftAnswer = function(userChoice) { // Make globally accessible (true for "Same", false for "Different")
             console.log(`DEBUG_MERGE: Brain Games: Shape Shift answer clicked. User chose ${userChoice ? 'Same' : 'Different'}. Correct answer is ${shiftState.isSame ? 'Same' : 'Different'}.`);
            const shiftContainerEl = page.querySelector('#shift-container');
            const shiftScoreEl = page.querySelector('#shift-score');

            // Check if user's choice matches the actual state
            if (userChoice === shiftState.isSame) {
                shiftState.score++; // Increment score
                if (shiftScoreEl) shiftScoreEl.textContent = `Score: ${shiftState.score}`; // Update score display
                loadNextShift(); // Load the next round
            } else {
                 // Game Over
                 console.log("DEBUG_MERGE: Shape Shift Game Over.");
                 if (shiftContainerEl) shiftContainerEl.textContent = 'GAME OVER ❌'; // Show game over message directly in container
                 // Hide shape elements and buttons on game over
                 if (shape1El) shape1El.style.display = 'none';
                 if (shape2El) shape2El.style.display = 'none';
                 if (shapeSameBtnEl) shapeSameBtnEl.style.display = 'none';
                 if (shapeDifferentBtnEl) shapeDifferentBtnEl.style.display = 'none';
                  // Optionally add a "Play Again" button (could add it to shiftContainerEl or a dedicated area)
                 const playAgainBtn = document.createElement('button');
                 playAgainBtn.className = 'btn btn-primary';
                 playAgainBtn.textContent = 'Play Again';
                 playAgainBtn.style.cssText = 'margin-top: 20px;';
                 // Use window.startShapeShift
                 playAgainBtn.onclick = () => startShapeShift(); // Restart the game
                 if (shiftContainerEl) shiftContainerEl.appendChild(playAgainBtn);
            }
        }
        // --- End Shape Shift Game Logic ---


        // --- Math Rush Game Logic ---
        function startMathRush() {
             console.log("DEBUG_MERGE: Brain Games: Starting Math Rush.");
            mathState = { score: 0, answer: 0 }; // Reset game state
            const mathScoreEl = page.querySelector('#math-score');
            if (mathScoreEl) mathScoreEl.textContent = `Score: ${mathState.score}`;
            else console.warn("DEBUG_MERGE: Math Rush score element not found.");
            loadNextMath(); // Load the first question
        }

        function loadNextMath() {
             console.log("DEBUG_MERGE: Brain Games: Loading next Math Rush question.");
             // Generate two random numbers for addition
             // Adjusted range to prevent negative answers easily
            const n1 = Math.ceil(Math.random() * 20) + 5; // Number between 6 and 25
            const n2 = Math.ceil(Math.random() * 20) + 5; // Number between 6 and 25
            mathState.answer = n1 + n2; // Calculate the correct answer

            const mathQuestionEl = page.querySelector('#math-question');
            if (mathQuestionEl) mathQuestionEl.textContent = `${n1} + ${n2}`; // Display the question
            else console.warn("DEBUG_MERGE: Math Rush question element not found.");

            let options = new Set([mathState.answer]); // Start options with the correct answer
             // Add incorrect options until we have 4 unique options
            while(options.size < 4) {
                 // Generate incorrect options by adding a small random number (-5 to +5, excluding 0)
                 const incorrectOption = mathState.answer + (Math.floor(Math.random() * 10) - 5); // Range: answer - 5 to answer + 5
                 if (incorrectOption !== mathState.answer) { // Ensure it's actually incorrect
                      options.add(incorrectOption);
                 } else {
                      // If random difference was 0, try adding/subtracting a small constant if possible
                      if (!options.has(mathState.answer + 1)) options.add(mathState.answer + 1);
                      else if (!options.has(mathState.answer - 1)) options.add(mathState.answer - 1);
                      // If still stuck, generate a completely different random number (larger range)
                      else options.add(Math.ceil(Math.random() * 50) + 1);
                 }
            }

            const mathOptionsEl = page.querySelector('#math-options');
            if (mathOptionsEl) {
                mathOptionsEl.innerHTML = ''; // Clear previous options

                 // Convert set to array, shuffle, and create buttons
                Array.from(options).sort(() => 0.5 - Math.random()).forEach(opt => {
                    const btn = document.createElement('button');
                    btn.className = 'math-btn';
                    btn.textContent = opt; // Display the option number
                    // Add click listener, checking if the button's text matches the correct answer
                    // Use window.handleMathAnswer
                    btn.onclick = () => window.handleMathAnswer(opt); // Pass the option value
                    mathOptionsEl.appendChild(btn); // Add button to options container
                });
                 console.log(`DEBUG_MERGE: Math Rush: Question: "${mathQuestionEl.textContent}". Answer: ${mathState.answer}. Options: [${Array.from(options).join(', ')}].`);
            } else { console.warn("DEBUG_MERGE: Math Rush options element not found."); }
        }

        // Handle user's answer click in Math Rush
        window.handleMathAnswer = function(choice) { // Make globally accessible (the number user clicked)
             console.log(`DEBUG_MERGE: Brain Games: Math Rush answer clicked. User chose: ${choice}. Correct answer: ${mathState.answer}.`);
            const mathQuestionEl = page.querySelector('#math-question');
            const mathOptionsEl = page.querySelector('#math-options');
            const mathScoreEl = page.querySelector('#math-score');

            // Compare the user's choice (converted to number) with the correct answer
            if (parseInt(choice) === mathState.answer) {
                mathState.score++; // Increment score
                if (mathScoreEl) mathScoreEl.textContent = `Score: ${mathState.score}`; // Update score display
                loadNextMath(); // Load the next question
            } else {
                 // Game Over
                 console.log("DEBUG_MERGE: Math Rush Game Over.");
                 if (mathQuestionEl) mathQuestionEl.textContent = 'GAME OVER'; // Show game over message
                 if (mathOptionsEl) mathOptionsEl.innerHTML = ''; // Clear options buttons
                 // Optionally add a "Play Again" button
                 if (mathOptionsEl) { // Re-use options container
                     const playAgainBtn = document.createElement('button');
                     playAgainBtn.className = 'btn btn-primary';
                     playAgainBtn.textContent = 'Play Again';
                     playAgainBtn.style.cssText = 'margin-top: 20px; width: 100%;';
                     // Use window.startMathRush
                     playAgainBtn.onclick = () => startMathRush(); // Restart the game
                     mathOptionsEl.appendChild(playAgainBtn);
                 }
            }
        }
        // --- End Math Rush Game Logic ---


        // --- Spatial Spin Game Logic ---
        function startSpatialSpin() {
             console.log("DEBUG_MERGE: Brain Games: Starting Spatial Spin.");
            spatialState = { score: 0, correctOptionHTML: '' }; // Reset game state
            const spatialScoreEl = page.querySelector('#spatial-score');
            if (spatialScoreEl) spatialScoreEl.textContent = `Score: ${spatialState.score}`;
            else console.warn("DEBUG_MERGE: Spatial Spin score element not found.");
            loadNextSpatial(); // Load the first round
        }

        function loadNextSpatial() {
             console.log("DEBUG_MERGE: Brain Games: Loading next Spatial Spin round.");
            const shapes = gameData.spatial; // Array of shapes
             if (!shapes || shapes.length === 0) {
                  console.error("DEBUG_MERGE: Spatial Spin gameData missing shapes.");
                  // Optionally show error message and stop game
                  const spatialBaseShapeEl = page.querySelector('#spatial-base-shape');
                  if(spatialBaseShapeEl) spatialBaseShapeEl.textContent = 'Error loading shapes!';
                  return;
             }

            const baseShape = shapes[Math.floor(Math.random() * shapes.length)]; // Select a random base shape
            const spatialBaseShapeEl = page.querySelector('#spatial-base-shape');
            if (spatialBaseShapeEl) spatialBaseShapeEl.textContent = baseShape; // Display the base shape
            else console.warn("DEBUG_MERGE: Spatial Spin base shape element not found.");

            // Select a random rotation angle (90, 180, 270 degrees)
            const rotation = 90 * (Math.floor(Math.random() * 3) + 1); // 1 to 3 * 90 = 90, 180, or 270
             // The correct answer is the base shape with this specific rotation applied
            spatialState.correctOptionHTML = `<div style="transform: rotate(${rotation}deg);">${baseShape}</div>`;


            let optionsHTML = new Set([spatialState.correctOptionHTML]); // Start options with the correct one
             // Add incorrect options until we have 4 unique options
            while(optionsHTML.size < 4) {
                 const wrongShape = shapes[Math.floor(Math.random() * shapes.length)]; // Random shape
                 const wrongRotation = 90 * (Math.floor(Math.random() * 4)); // Random rotation (0, 90, 180, 270)
                 const incorrectOptionHTML = `<div style="transform: rotate(${wrongRotation}deg);">${wrongShape}</div>`;

                 // Add if it's not the correct shape+rotation combination
                 if (incorrectOptionHTML !== spatialState.correctOptionHTML) {
                      optionsHTML.add(incorrectOptionHTML);
                 } else {
                     // If accidentally generated the correct one again, try a different random rotation for the same shape
                     const altRotation = (rotation + 90) % 360; // Rotate 90 degrees further
                     const altOptionHTML = `<div style="transform: rotate(${altRotation}deg);">${baseShape}</div>`;
                     if (altOptionHTML !== spatialState.correctOptionHTML) {
                          optionsHTML.add(altOptionHTML);
                     } else {
                         // Fallback: add a completely different shape with random rotation
                         const completelyDifferentShape = shapes.find(s => s !== baseShape) || '✨'; // Find a different shape or use a fallback
                         optionsHTML.add(`<div style="transform: rotate(${wrongRotation}deg);">${completelyDifferentShape}</div>`);
                     }
                 }
            }

            const spatialOptionsEl = page.querySelector('#spatial-options');
            if (spatialOptionsEl) {
                spatialOptionsEl.innerHTML = ''; // Clear previous options

                 // Convert set to array, shuffle, and create option divs
                Array.from(optionsHTML).sort(() => 0.5 - Math.random()).forEach(optHTML => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'spatial-option';
                    optionDiv.innerHTML = optHTML; // Insert the generated HTML (shape with rotation)
                    // Add click listener, checking if the clicked option's HTML matches the correct HTML
                    // Use window.handleSpatialAnswer
                    optionDiv.onclick = () => window.handleSpatialAnswer(optHTML); // Pass the option's inner HTML
                    spatialOptionsEl.appendChild(optionDiv); // Add option to container
                });
                 console.log(`DEBUG_MERGE: Spatial Spin: Base Shape: "${baseShape}". Correct Rotation: ${rotation}deg.`);
            } else { console.warn("DEBUG_MERGE: Spatial Spin options element not found."); }
        }


        // Handle user's answer click in Spatial Spin
        window.handleSpatialAnswer = function(choiceHTML) { // Make globally accessible (the inner HTML of the clicked option)
             console.log(`DEBUG_MERGE: Brain Games: Spatial Spin answer clicked.`); // Log the HTML is too verbose/risky
            const spatialBaseShapeEl = page.querySelector('#spatial-base-shape');
            const spatialOptionsEl = page.querySelector('#spatial-options');
            const spatialScoreEl = page.querySelector('#spatial-score');

            // Compare the user's choice HTML with the correct option HTML
            if (choiceHTML === spatialState.correctOptionHTML) {
                spatialState.score++; // Increment score
                if (spatialScoreEl) spatialScoreEl.textContent = `Score: ${spatialState.score}`; // Update score display
                loadNextSpatial(); // Load the next round
            } else {
                 // Game Over
                 console.log("DEBUG_MERGE: Spatial Spin Game Over.");
                 if (spatialBaseShapeEl) spatialBaseShapeEl.textContent = '❌'; // Show game over indicator
                 if (spatialOptionsEl) spatialOptionsEl.innerHTML = ''; // Clear options buttons
                 // Optionally add a "Play Again" button
                 if (spatialOptionsEl) { // Re-use options container
                     const playAgainBtn = document.createElement('button');
                     playAgainBtn.className = 'btn btn-primary';
                     playAgainBtn.textContent = 'Play Again';
                     playAgainBtn.style.cssText = 'margin-top: 20px; width: 100%;';
                     // Use window.startSpatialSpin
                     playAgainBtn.onclick = () => startSpatialSpin(); // Restart the game
                     spatialOptionsEl.appendChild(playAgainBtn);
                 }
            }
        }
         console.log("DEBUG_MERGE: initBrainGamesFeature finished.");
    }
    // --- End Brain Games Feature ---


    // --- Image Slider Feature (FROM New File.js) ---
    function initImageSlider() {
         console.log("DEBUG_MERGE: initImageSlider called.");
        const sliderContainer = document.querySelector('.slider-container');
        if (!sliderContainer) {
             console.warn("DEBUG_MERGE: Image slider container not found.");
             return;
        }

        const sliderWrapper = sliderContainer.querySelector('.slider-wrapper');
        const paginationContainer = sliderContainer.querySelector('.slider-pagination');

        if (!sliderWrapper || !paginationContainer) {
             console.warn("DEBUG_MERGE: Image slider wrapper or pagination container not found.");
             return;
        }
         console.log("DEBUG_MERGE: Image slider elements found, initializing.");

        const sliderImages = [
            'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop', // Workplace
            'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop', // Students collaborating
            'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1974&auto=format&fit=crop', // Books on shelf
            'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?q=80&w=1974&auto=format&fit=crop', // Chemistry class
            'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1974&auto=format&fit=crop' // Person coding/studying
        ];

        if (sliderImages.length === 0) {
             console.warn("DEBUG_MERGE: No slider images provided. Skipping initialization.");
             return;
        }

         // Create slide elements and pagination dots HTML
        sliderWrapper.innerHTML = sliderImages.map(src =>
            `<div class="slide"><img src="${src}" alt="Banner Image"></div>`
        ).join('');

        paginationContainer.innerHTML = sliderImages.map((_, index) =>
            `<div class="dot" data-index="${index}"></div>`
        ).join('');

        // Get the created slide and dot elements
        const slides = sliderWrapper.querySelectorAll('.slide');
        const dots = paginationContainer.querySelectorAll('.dot');

         // Add clones for infinite looping effect
        if (slides.length > 0) { // Ensure there's at least one image
            const firstClone = slides[0].cloneNode(true);
            const lastClone = slides[slides.length - 1].cloneNode(true);
            sliderWrapper.appendChild(firstClone); // Add clone of first slide at the end
            sliderWrapper.insertBefore(lastClone, slides[0]); // Add clone of last slide at the beginning
        }


        let currentIndex = 1; // Start at the first actual slide (index 1, after the last clone)
        let slideInterval; // Variable to hold the interval timer ID

        // Function to update the slider's CSS transform to show the correct slide
        const updateSliderPosition = (withTransition = true) => {
             // Apply or remove transition based on the flag
            sliderWrapper.style.transition = withTransition ? 'transform 0.5s ease-in-out' : 'none';
             // Calculate the translateX value: -100% for the first slide, -200% for the second, etc.
            sliderWrapper.style.transform = `translateX(-${currentIndex * 100}%)`;
             console.log(`DEBUG_MERGE: Slider position updated. Current Index: ${currentIndex}. Transform: ${sliderWrapper.style.transform}.`);
        };

        // Function to update the active state of the pagination dots
        const updatePagination = () => {
             // Calculate the index of the dot corresponding to the current *actual* slide
            let dotIndex = currentIndex - 1;
             // Handle dot index for cloned slides
            if (dotIndex < 0) dotIndex = sliderImages.length - 1; // If on the last clone, highlight the last dot
            if (dotIndex >= sliderImages.length) dotIndex = 0; // If on the first clone, highlight the first dot

             // Remove 'active' class from all dots
            dots.forEach(dot => dot.classList.remove('active'));
             // Add 'active' class to the correct dot
            if(dots[dotIndex]) dots[dotIndex].classList.add('active');
             console.log(`DEBUG_MERGE: Slider pagination updated. Active dot index: ${dotIndex}.`);
        };

        // Function to move to the next slide automatically
        const moveToNextSlide = () => {
             // Don't move if the page is hidden (browser tab not active)
            if (document.hidden) return;
            currentIndex++; // Increment the current index
            updateSliderPosition(); // Update the visual position
            updatePagination(); // Update the active dot
             console.log("DEBUG_MERGE: Moving to next slide (auto).");
        };

        // Listener for the end of the CSS transition
        sliderWrapper.addEventListener('transitionend', () => {
             // Get all slides, including clones
            const allSlides = sliderWrapper.querySelectorAll('.slide');
            if (allSlides.length === 0) return;

             // If we are on the first clone (which looks like the last slide)
            if (currentIndex >= allSlides.length - 1) {
                 currentIndex = 1; // Jump back to the first actual slide (index 1)
                 updateSliderPosition(false); // Update position WITHOUT transition
                 console.log("DEBUG_MERGE: Slider transitioned to first clone, jumping back to start.");
            }
             // If we are on the last clone (which looks like the first slide)
            else if (currentIndex <= 0) {
                 currentIndex = allSlides.length - 2; // Jump forward to the last actual slide
                 updateSliderPosition(false); // Update position WITHOUT transition
                 console.log("DEBUG_MERGE: Slider transitioned to last clone, jumping forward to end.");
            }
        });
         console.log("DEBUG_MERGE: Slider transitionend listener attached.");


        // Function to start the auto-slide interval
        const startSlider = () => {
             console.log("DEBUG_MERGE: Starting slider auto-play.");
            stopSlider(); // Clear any existing interval first
            slideInterval = setInterval(moveToNextSlide, 3000); // Change slide every 3000ms (3 seconds)
        };

        // Function to stop the auto-slide interval
        const stopSlider = () => {
            if (slideInterval) {
                clearInterval(slideInterval);
                 console.log("DEBUG_MERGE: Stopping slider auto-play.");
                slideInterval = null; // Clear the interval ID
            }
        };


        // Add click listeners to pagination dots for manual navigation
        dots.forEach(dot => {
             if (!dot) return; // Ensure dot exists
            dot.addEventListener('click', (e) => {
                 // Get the index of the clicked dot
                const clickedIndex = parseInt(e.target.dataset.index);
                // Set the current index to the corresponding actual slide index (+1 because of the last clone at the start)
                currentIndex = clickedIndex + 1;
                updateSliderPosition(); // Update visual position
                updatePagination(); // Update active dot (redundant here but good for clarity)
                stopSlider(); // Stop auto-play on manual interaction
                startSlider(); // Restart auto-play after a delay
                 console.log(`DEBUG_MERGE: Slider dot clicked. Navigating to slide ${clickedIndex + 1}.`);
            });
        });
         console.log(`DEBUG_MERGE: Attached listeners to ${dots.length} slider pagination dots.`);


        // Add mouse listeners to pause/resume on hover (for desktop)
        sliderContainer.addEventListener('mouseenter', stopSlider);
        sliderContainer.addEventListener('mouseleave', startSlider);
         console.log("DEBUG_MERGE: Slider mouseenter/mouseleave listeners attached.");


        // Add listener for browser tab visibility changes to pause/resume
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                 console.log("DEBUG_MERGE: Tab hidden, pausing slider.");
                stopSlider();
            } else {
                 console.log("DEBUG_MERGE: Tab visible, resuming slider.");
                startSlider();
            }
        });
         console.log("DEBUG_MERGE: Slider visibilitychange listener attached.");


        // Initial setup calls
        updateSliderPosition(false); // Set initial position without animation
        updatePagination(); // Set initial active dot
        startSlider(); // Start the auto-play
         console.log("DEBUG_MERGE: initImageSlider finished.");
    }
    // --- End Image Slider Feature ---


    // --- Mock Data (Teachers, Exams, etc.) (FROM New File.js) ---
    const examDB = {
        exams: [
            { id: 'neet', name: 'NEET', image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=250&h=250&auto=format&fit=crop' },
            { id: 'jee', name: 'JEE (Main & Advanced)', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726a?q=80&w=250&h=250&auto=format&fit=crop' },
            { id: 'upsc', name: 'UPSC Civil Services', image: 'https://images.unsplash.com/photo-1607739587841-dad65e533e14?q=80&w=250&h=250&auto=format&fit=crop' },
            { id: 'nda', name: 'NDA & NA', image: 'https://images.unsplash.com/photo-1568283661131-221de4920257?q=80&w=250&h=250&auto=format&fit=crop' },
            { id: 'ssc', name: 'SSC CGL', image: 'https://images.unsplash.com/photo-1596496181848-3091d49974ee?q=80&w=250&h=250&auto=format&fit=crop' },
            { id: 'gate', name: 'GATE', image: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?q=80&w=250&h=250&auto=format&fit=crop' },
            { id: 'cat', name: 'CAT', image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=250&h=250&auto=format&fit=crop' },
        ],
        // chapters data is included but seems unused in the provided code snippets
        chapters: {
            bio: {
                class11: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals", "Cell - The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division", "Transport in Plants", "Mineral Nutrition", "Photosynthesis in Higher Plants", "Respiration in Plants", "Plant Growth and Development", "Digestion and Absorption", "Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products and Their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration"],
                class12: ["Reproduction in Organisms", "Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Principles of Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Strategies for Enhancement in Food Production", "Microbes in Human Welfare", "Biotechnology: Principles and Processes", "Biotechnology and Its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation", "Environmental Issues"]
            },
            phy: {
                class11: ["Physical World", "Units and Measurements", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion", "Work, Energy and Power", "System of Particles and Rotational Motion", "Gravitation", "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"],
                class12: ["Electric Charges and Fields", "Electrostatic Potential and Capacitance", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics: Materials, Devices and Simple Circuits"]
            },
            che: {
                class11: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties", "Chemical Bonding and Molecular Structure", "States of Matter: Gases and Liquids", "Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrogen", "The s-Block Element", "Some p-Block Elements", "Organic Chemistry - Some Basic Principles and Techniques", "Hydrocarbons", "Environmental Chemistry"],
                class12: ["The Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "The p-Block Element", "The d- and f-Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Organic Compounds Containing Nitrogen", "Biomolecules"]
            }
        },
        // Sample test data for practice
        sampleTest: [
            { q: "What is the dimensional formula for gravitational constant G?", o: ["[MLT⁻²]", "[M⁻¹L³T⁻²]", "[ML²T⁻²]", "[M⁻¹L²T⁻¹]"], a: "[M⁻¹L³T⁻²]", s: 'phy' },
            { q: "Sound waves in air are:", o: ["Transverse", "Longitudinal", "Electromagnetic", "Both A and B"], a: "Longitudinal", s: 'phy' },
            { q: "Which gas is known as laughing gas?", o: ["Methane", "Nitrous Oxide", "Carbon Dioxide", "Hydrogen Sulfide"], a: "Nitrous Oxide", s: 'che' },
            { q: "The pH of a neutral solution is:", o: ["0", "7", "14", "1"], a: "7", s: 'che' },
            { q: "What is the powerhouse of the cell?", o: ["Nucleus", "Ribosome", "Mitochondrion", "Lysosome"], a: "Mitochondrion", s: 'bio' },
            { q: "Which blood type is the universal donor?", o: ["A+", "B+", "AB+", "O-"], a: "O-", s: 'bio' },
        ],
        userAnswersForSampleTest: {} // Object to store answers for the current sample test session
    };


    const teachersDB = {
        teachers: [
            {
                id: 'teacher-01',
                name: 'Dr. R.K. Verma',
                specialty: 'Physics Guru',
                image: 'https://randomuser.me/api/portraits/men/75.jpg'
            },
            {
                id: 'teacher-02',
                name: 'Anjali Sharma',
                specialty: 'Chemistry Maestro',
                image: 'https://randomuser.me/api/portraits/women/75.jpg'
            },
            {
                id: 'teacher-03',
                name: 'S.K. Singh',
                specialty: 'Biology Expert',
                image: 'https://randomuser.me/api/portraits/men/76.jpg'
            }
        ]
    };

    // --- END Mock Data ---


    // --- Teacher/Test Feature (FROM New File.js) ---
    // Note: This feature interacts with Firestore collections "Tests" and "TestResults"
    window.examNavStack = []; // Navigation stack for Competitive Exams feature


    // Function to go back within the Competitive Exam feature navigation
    window.goBackExam = () => { // Make globally accessible for back button
         console.log("DEBUG_MERGE: goBackExam called. Stack size:", window.examNavStack.length);
         // If the stack is not empty, pop the last state and render it
        if (window.examNavStack.length > 0) {
            const prevState = window.examNavStack.pop();
             console.log(`DEBUG_MERGE: Popped exam state: Path=[${prevState.path.join(', ')}], Title="${prevState.title}". Rendering...`);
            renderExamContent(prevState.path, prevState.title);
        } else {
             console.log("DEBUG_MERGE: Exam nav stack empty. Going back to home.");
            showScreen('home-screen', true); // Go back to home if stack is empty
        }
    };


    // Function to render content within the Competitive Exam page based on path
    window.renderExamContent = function(path, title) { // Make globally accessible
         console.log(`DEBUG_MERGE: renderExamContent called. Path: [${path.join(', ')}], Title: "${title}".`);
        const page = document.getElementById('competitive-exam-page');
        if (!page) { console.error("DEBUG_MERGE: Competitive Exam page element not found."); return; }
        const mainContent = page.querySelector('.main-content');
        const header = page.querySelector('.app-header');

        if (!mainContent || !header) {
             console.error("DEBUG_MERGE: Competitive Exam main content or header not found.");
             return;
        }

        const backButton = header.querySelector('.header-icon');
        const appTitleElement = header.querySelector('.app-title');

        if (appTitleElement) appTitleElement.textContent = title; // Set the header title

        // Set the back button's onclick handler
        if (backButton) {
            if (path.length === 0) {
                 // If on the root level (exam list), back goes to home
                backButton.setAttribute('onclick', "showScreen('home-screen', true)");
                 console.log("DEBUG_MERGE: Exam back button set to go to home.");
            } else {
                 // If deeper in navigation, back uses the exam nav stack
                backButton.setAttribute('onclick', 'window.goBackExam()'); // Use window.
                 console.log("DEBUG_MERGE: Exam back button set to go back within exam nav.");
            }
             backButton.style.display = 'block'; // Ensure back button is visible
        }


        mainContent.innerHTML = ''; // Clear current content


        // Render content based on the length and values in the path array
        if (path.length === 0) {
             // Rendering the root level: List of exams (NEET, JEE, etc.)
             console.log("DEBUG_MERGE: Rendering Exam root level (exam list).");
             window.examNavStack = []; // Clear stack when returning to root
            mainContent.innerHTML = `<div class="exam-list-container"></div>`; // Container for exam cards
            const examListContainer = mainContent.querySelector('.exam-list-container');
            if (examListContainer) {
                 // Loop through examDB.exams and create a card for each
                 if (examDB.exams && examDB.exams.length > 0) {
                     examDB.exams.forEach(exam => {
                         const item = document.createElement('div');
                         item.className = 'exam-list-item';
                         // Add click listener to navigate into the exam
                         item.onclick = () => {
                             // Push current state (root) onto the stack before navigating
                             window.examNavStack.push({path: [], title: "Competitive Exams"}); // Use window.
                             renderExamContent([exam.id], exam.name); // Navigate to exam-specific page
                         };
                          // HTML structure for an exam card
                         item.innerHTML = `
                             <img class="exam-item-img" src="${exam.image}" alt="${exam.name}">
                             <span class="exam-item-name">${exam.name}</span>
                         `;
                         examListContainer.appendChild(item); // Add card to container
                     });
                      console.log(`DEBUG_MERGE: Rendered ${examDB.exams.length} exam items.`);
                 } else {
                      examListContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No exams found.</p>';
                      console.warn("DEBUG_MERGE: examDB.exams is empty or not found.");
                 }
            } else { console.warn("DEBUG_MERGE: Exam list container not found."); }


        } else if (path[0] === 'neet' && path.length === 1) {
             // Rendering the NEET exam specific page
             console.log("DEBUG_MERGE: Rendering NEET specific page.");
             mainContent.innerHTML = `
                 <div style="display: flex; flex-direction: column; gap: 15px;">
                     <!-- PYQ Section -->
                     <div class="section-card" onclick="window.examNavStack.push({path:['neet'], title:'NEET'}); window.renderExamContent(['neet', 'pyq'], 'NEET PYQs')"> <!-- Use window. for stack and render -->
                         <i class="section-card-icon fa-solid fa-file-alt"></i>
                         <div class="section-card-text"><h3>PYQ</h3><p>Previous Year Questions</p></div>
                     </div>
                      <!-- Test Practice Section -->
                      <div class="section-card" onclick="window.examNavStack.push({path:['neet'], title:'NEET'}); window.renderExamContent(['neet', 'test'], 'NEET Test Practice')"> <!-- Use window. for stack and render -->
                         <i class="section-card-icon fa-solid fa-pencil-alt"></i>
                         <div class="section-card-text"><h3>Test Practice</h3><p>Take tests to assess yourself</p></div> <!-- Updated text -->
                      </div>
                     <!-- Books Section (Coming Soon) -->
                     <div class="section-card coming-soon" onclick="alert('Coming Soon!')"> <!-- Added coming-soon class -->
                         <i class="section-card-icon fa-solid fa-book-open"></i>
                         <div class="section-card-text"><h3>Books & Notes</h3><p>Recommended study material</p></div> <!-- Updated text -->
                     </div>
                 </div>
             `;


        } else if (path[0] === 'neet' && path[1] === 'pyq') {
             // Rendering NEET PYQs page
             console.log("DEBUG_MERGE: Rendering NEET PYQs list.");
             mainContent.innerHTML = '<ul class="content-list"></ul>'; // Container for the list of years
             const list = mainContent.querySelector('.content-list');
             if (list) {
                 // Add list items for each year (example range)
                 for (let year = 2025; year >= 2010; year--) {
                     const item = document.createElement('li');
                     item.className = 'content-list-item';
                     // Add click listener - currently just an alert
                     // This would ideally link to a PDF viewer or similar
                     item.onclick = () => alert('PDF for ' + year + ' is coming soon!');
                     item.innerHTML = `<i class="list-item-icon fa-solid fa-calendar-day"></i> PYQ ${year}`;
                     list.appendChild(item);
                 }
                  console.log("DEBUG_MERGE: Rendered NEET PYQ years.");
             } else { console.warn("DEBUG_MERGE: NEET PYQ list container not found."); }


        } else if (path[0] === 'neet' && path[1] === 'test') {
             // Rendering NEET Test Practice page
             console.log("DEBUG_MERGE: Rendering NEET Test Practice options.");
             mainContent.innerHTML = `
                 <div style="display: flex; flex-direction: column; gap: 15px;">
                      <!-- Sample Test -->
                      <div class="section-card" onclick="window.startSampleTest()"> <!-- Use window. -->
                         <i class="section-card-icon fa-solid fa-pencil-alt"></i>
                         <div class="section-card-text"><h3>Start Sample Test</h3><p>A short test with mixed questions</p></div>
                      </div>
                      <!-- More Tests (Coming Soon) -->
                      <div class="section-card coming-soon" onclick="alert('More tests coming soon!')"> <!-- Added coming-soon class -->
                         <i class="section-card-icon fa-solid fa-infinity"></i>
                         <div class="section-card-text"><h3>More Tests</h3><p>Coming Soon</p></div>
                      </div>
                 </div>`;
             console.log("DEBUG_MERGE: Rendered NEET Test Practice options.");

        } else {
             // Handle any other unknown path (likely coming soon sections)
             console.warn("DEBUG_MERGE: Encountered unknown exam path:", path);
             alert('This section is coming soon!');
             // Go back to the previous page in the stack
             window.goBackExam(); // Use window.
        }
         console.log("DEBUG_MERGE: renderExamContent finished.");
    };


    // --- Teacher List Feature (FROM New File.js) ---
    // Displays a list of teachers (educators)
    function showTeacherListPage() {
         console.log("DEBUG_MERGE: showTeacherListPage called.");
        showScreen('teacher-list-page'); // Navigate to the teacher list screen
        const page = document.getElementById('teacher-list-page');

         if (!page) { console.error("DEBUG_MERGE: Teacher List page element not found."); return; }

         // Render the HTML structure for the teacher list page
        page.innerHTML = `
            <header class="app-header">
                <!-- Back button goes back to home -->
                <div class="header-icon" onclick="showScreen('home-screen', true)"><i class="fa-solid fa-arrow-left"></i></div>
                <h1 class="app-title">All India Tests</h1> <!-- Title might reflect this is part of tests -->
                <div class="header-icon"></div> <!-- Placeholder for balance or other icon -->
            </header>
            <main class="main-content">
                <h3 class="content-section-title" style="margin-bottom: 15px;">Choose an Educator</h3>
                <div id="all-teachers-container" class="teacher-list-container">
                     <!-- Teacher list items will be rendered here -->
                     <p style="text-align:center; color: var(--text-muted-color);">Loading educators...</p> <!-- Loading message -->
                </div>
            </main>
        `;

        const container = document.getElementById('all-teachers-container');
        if (!container) { console.error("DEBUG_MERGE: Teacher list container element not found."); return; }

        // Render the list of teachers from the local teachersDB
        if (teachersDB.teachers && teachersDB.teachers.length > 0) {
             console.log(`DEBUG_MERGE: Rendering ${teachersDB.teachers.length} teacher items.`);
            let teachersHTML = '';
            teachersDB.teachers.forEach(teacher => {
                 // Create HTML for each teacher item
                teachersHTML += `
                    <div class="teacher-list-item" onclick="window.showTeacherContentPage('${teacher.id}')"> <!-- Use window. -->
                        <img class="teacher-avatar" src="${teacher.image}" alt="${teacher.name}">
                        <div class="teacher-info">
                            <div class="teacher-name">${teacher.name}</div>
                            <div class="teacher-specialty">${teacher.specialty}</div>
                        </div>
                        <i class="fa-solid fa-chevron-right" style="color: var(--text-muted-color);"></i>
                    </div>
                `;
            });
            container.innerHTML = teachersHTML; // Set the container's HTML
        } else {
             // Show message if no teachers found
            container.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No educators found.</p>';
             console.warn("DEBUG_MERGE: teachersDB.teachers is empty or not found.");
        }
         console.log("DEBUG_MERGE: Teacher list page rendered.");
    }

    // This function is called from the home screen button
    window.showTeacherSection = () => { // Make globally accessible
        showTeacherListPage(); // Simply navigate to the teacher list
    };
    // --- End Teacher List Feature ---


    // --- Teacher Content / Tests Feature (FROM New File.js) ---
    // Displays tests available for a specific teacher, and allows creating tests
    window.showTeacherContentPage = async function(teacherId) { // Make globally accessible
         console.log(`DEBUG_MERGE: showTeacherContentPage called for Teacher ID: ${teacherId}.`);
        showScreen('teacher-content-page'); // Navigate to the teacher content screen
        const teacher = teachersDB.teachers.find(t => t.id === teacherId); // Find teacher details from local DB
        if (!teacher) {
             console.error(`DEBUG_MERGE: Teacher with ID ${teacherId} not found.`);
             const page = document.getElementById('teacher-content-page');
             if(page) page.innerHTML = `<header class="app-header"><div class="header-icon" onclick="showTeacherListPage()"><i class="fa-solid fa-arrow-left"></i></div><h1 class="app-title">Teacher Not Found</h1><div class="header-icon"></div></header><main class="main-content"><p style="text-align:center; color: var(--danger);">Educator details not found.</p></main>`;
             return;
        }

        const page = document.getElementById('teacher-content-page');
        if (!page) { console.error("DEBUG_MERGE: Teacher Content page element not found."); return; }

         // Render the HTML structure for the teacher content page
        page.innerHTML = `
            <header class="app-header">
                <!-- Back button goes back to the teacher list -->
                <div class="header-icon" onclick="window.showTeacherListPage()"><i class="fa-solid fa-arrow-left"></i></div> <!-- Use window. -->
                <h1 class="app-title">${teacher.name}</h1> <!-- Teacher's name in header -->
                <div class="header-icon"></div> <!-- Placeholder -->
            </header>
            <main class="main-content">
                 <!-- Add "Create Test" button if user is logged in and authorized? -->
                 <!-- For now, just show the button. Add auth check later if needed. -->
                 <div style="text-align:center; margin-bottom: 20px;">
                    <button class="btn btn-secondary" onclick="window.showCreateTestPage('${teacherId}')">
                       <i class="fa-solid fa-plus-circle"></i> Create New Test
                    </button>
                 </div>

                <h3 class="content-section-title">Available Tests</h3>
                <div id="teacher-tests-list" class="content-list">
                    <p style="text-align:center; color: var(--text-muted-color);">Loading tests...</p> <!-- Loading message -->
                </div>
            </main>
        `;

        const testsListContainer = document.getElementById('teacher-tests-list');
        if (!testsListContainer) { console.error("DEBUG_MERGE: Teacher tests list container not found."); return; }

        try {
             console.log(`DEBUG_MERGE: Fetching tests from Firestore for teacher: ${teacherId}.`);
            // Use the globally managed db object
            // Query "Tests" collection where teacherId matches the current teacher's ID
            const q = query(collection(db, "Tests"), where("teacherId", "==", teacherId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                testsListContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">This educator has not published any tests yet.</p>';
                 console.log("DEBUG_MERGE: No tests found for this teacher.");
                return;
            }

             console.log(`DEBUG_MERGE: Found ${querySnapshot.size} tests for this teacher.`);
            let testsHTML = '';
            // Loop through test documents and create list items
            querySnapshot.forEach(doc => {
                const test = doc.data();
                 // Ensure test data is valid before rendering
                 if (!test || !test.title || !Array.isArray(test.questions)) {
                     console.warn("DEBUG_MERGE: Skipping malformed test document:", doc.id, test);
                     return;
                 }
                 // Get test duration, default to N/A if not provided
                 const durationDisplay = test.duration ? `${test.duration} mins` : 'N/A';

                 // Create HTML for each test item
                testsHTML += `
                    <div class="content-list-item">
                        <div style="flex-grow: 1;">
                           <div style="font-weight: 600;">${test.title}</div>
                           <div style="font-size: 0.8rem; color: var(--text-muted-color);">${test.subject || 'N/A'} &bull; ${test.questions.length} Qs &bull; ${durationDisplay}</div>
                        </div>
                         <!-- Button to start the test -->
                         <!-- Use window.startTeacherTest and pass the document ID -->
                        <button class="btn-start-mini" onclick="window.startTeacherTest('${doc.id}')">Start</button>
                    </div>
                `;
            });
            testsListContainer.innerHTML = testsHTML; // Set the container's HTML
             console.log("DEBUG_MERGE: Teacher tests list rendered.");

        } catch (error) {
            console.error("DEBUG_MERGE: Error fetching tests: ", error);
            testsListContainer.innerHTML = '<p style="color: var(--danger); text-align:center;">Could not load tests. Please try again later.</p>';
        }
         console.log("DEBUG_MERGE: showTeacherContentPage finished.");
    }


    // Function to show the Create New Test page for a specific teacher
    window.showCreateTestPage = function(teacherId) { // Make globally accessible
         console.log(`DEBUG_MERGE: showCreateTestPage called for Teacher ID: ${teacherId}.`);
         // Check if user is logged in before allowing test creation (optional but recommended)
         const currentUserForCreation = auth.currentUser;
         if (!currentUserForCreation) {
              alert("You must be logged in to create tests.");
              isLoginMode = true;
              window.toggleAuthMode(isLoginMode);
              window.showScreen('login-screen');
              return;
         }
         // Optional: Add a check here to see if the logged-in user is authorized as a teacher (e.g., check user document role)
         // If not authorized, alert and return.

        showScreen('create-test-page'); // Navigate to the create test screen
        const page = document.getElementById('create-test-page');
        if (!page) { console.error("DEBUG_MERGE: Create Test page element not found."); return; }

         // Render the HTML structure for the create test page
        page.innerHTML = `
            <header class="app-header">
                <!-- Back button goes back to the specific teacher's content page -->
                <div class="header-icon" onclick="window.showTeacherContentPage('${teacherId}')"><i class="fa-solid fa-arrow-left"></i></div> <!-- Use window. -->
                <h1 class="app-title">Create New Test</h1>
                <div class="header-icon"></div> <!-- Placeholder -->
            </header>
            <main class="main-content">
                 <!-- Use window.publishTest -->
                <form class="info-form" id="create-test-form" onsubmit="window.publishTest(event)">
                    <input type="hidden" id="teacherId" value="${teacherId}"> <!-- Store teacher ID -->
                    <div class="input-group"><i class="fa-solid fa-heading"></i><input type="text" id="test-title" placeholder="Test Title" required></div>
                    <div class="input-group"><i class="fa-solid fa-book"></i>
                        <select id="test-subject" required>
                            <option value="">Select Subject</option>
                            <option value="Physics">Physics</option>
                            <option value="Chemistry">Chemistry</option>
                            <option value="Biology">Biology</option>
                            <option value="Mathematics">Mathematics</option> <!-- Added Math -->
                             <option value="General Knowledge">General Knowledge</option> <!-- Added GK -->
                        </select>
                    </div>
                    <div class="input-group"><i class="fa-solid fa-clock"></i><input type="number" id="test-duration" placeholder="Duration (in minutes)" required min="1"></div> <!-- Added min attribute -->

                    <h3 style="margin-top: 30px; margin-bottom: 15px;">Questions</h3>
                    <div id="questions-container"></div> <!-- Container for question fields -->

                    <!-- Button to add another question field -->
                    <!-- Use window.addTestQuestionField -->
                    <button type="button" class="btn" style="background: var(--surface); color: var(--text-dark); border: 1px solid var(--border-color); width:100%; margin-bottom: 15px;" onclick="window.addTestQuestionField()">
                        <i class="fa-solid fa-plus-circle"></i> Add Question
                    </button>
                    <!-- Button to publish the test -->
                    <button type="submit" class="btn btn-primary" style="width:100%;">Publish Test</button>
                </form>
            </main>
        `;
        addTestQuestionField(); // Add the first question field automatically
         console.log("DEBUG_MERGE: Create Test page rendered.");
    }


    // Function to add a question field to the Create Test form
    window.addTestQuestionField = function() { // Make globally accessible
         console.log("DEBUG_MERGE: addTestQuestionField called.");
        const container = document.getElementById('questions-container');
        if (!container) { console.error("DEBUG_MERGE: Create Test questions container not found."); return; }
        const qIndex = container.children.length; // Get the index for the new question
        const qDiv = document.createElement('div');
        qDiv.className = 'question-field-group'; // Class for styling/grouping
        qDiv.innerHTML = `
            <h5>Question ${qIndex + 1} <button type="button" class="delete-q-btn" onclick="window.deleteTestQuestionField(this)" style="float:right; background:none; border:none; color:var(--danger); cursor:pointer;">🗑️</button></h5> <!-- Added delete button -->
            <div class="input-group"><textarea class="test-question-text" placeholder="Question Text..." rows="2" required></textarea></div>
            <div class="input-group"><input type="text" class="test-option" placeholder="Option 1" required></div>
            <div class="input-group"><input type="text" class="test-option" placeholder="Option 2" required></div>
            <div class="input-group"><input type="text" class="test-option" placeholder="Option 3" required></div> <!-- Changed to required -->
            <div class="input-group"><input type="text" class="test-option" placeholder="Option 4" required></div> <!-- Changed to required -->
            <div class="input-group">
                <select class="test-correct-answer" required>
                    <option value="">-- Correct Answer --</option>
                    <option value="0">Option 1</option>
                    <option value="1">Option 2</option>
                    <option value="2">Option 3</option>
                    <option value="3">Option 4</option>
                </select>
            </div>
            <div class="input-group"><i class="fa-solid fa-tags"></i><input type="text" class="test-concept-tag" placeholder="Concept Tag (e.g., Newton's Laws)" required></div> <!-- Concept tag required -->
        `;
        container.appendChild(qDiv); // Add the new question field div
         console.log(`DEBUG_MERGE: Added question field ${qIndex + 1} to Create Test form.`);
    }

     // Function to delete a question field from the Create Test form
     window.deleteTestQuestionField = function(button) { // Make globally accessible
         console.log("DEBUG_MERGE: deleteTestQuestionField called.");
         const questionDiv = button.closest('.question-field-group'); // Find the parent question div
         if (questionDiv) {
             questionDiv.remove(); // Remove the div
              console.log("DEBUG_MERGE: Test question field deleted.");
             // Re-number remaining questions for correct display
             const container = document.getElementById('questions-container');
             if (container) {
                 Array.from(container.children).forEach((qDiv, index) => {
                     const h5 = qDiv.querySelector('h5');
                     if (h5) {
                          h5.innerHTML = `Question ${index + 1} <button type="button" class="delete-q-btn" onclick="window.deleteTestQuestionField(this)" style="float:right; background:none; border:none; color:var(--danger); cursor:pointer;">🗑️</button>`;
                     }
                 });
                 console.log("DEBUG_MERGE: Test question fields re-numbered.");
             }
         } else {
             console.warn("DEBUG_MERGE: Could not find test question field div to delete.");
         }
     }


    // Function to publish the new test to Firestore
    window.publishTest = async function(event) { // Make globally accessible
        event.preventDefault();
         console.log("DEBUG_MERGE: publishTest called.");
        const submitButton = event.target.querySelector('button[type="submit"]');
        if (!submitButton) { console.error("DEBUG_MERGE: Publish Test submit button not found."); return; }

        submitButton.disabled = true; // Disable button during submission
        submitButton.textContent = 'Publishing...'; // Change button text

        // Get form element values
        const teacherIdElement = document.getElementById('teacherId');
        const testTitleElement = document.getElementById('test-title');
        const testSubjectElement = document.getElementById('test-subject');
        const testDurationElement = document.getElementById('test-duration');

         if (!teacherIdElement || !testTitleElement || !testSubjectElement || !testDurationElement) {
             console.error("DEBUG_MERGE: One or more Create Test form elements not found.");
             alert("Error submitting form. Please refresh.");
             submitButton.disabled = false;
             submitButton.textContent = 'Publish Test';
             return;
         }

        const teacherId = teacherIdElement.value;
        const duration = parseInt(testDurationElement.value);

        // Validate duration
        if (isNaN(duration) || duration <= 0) {
             alert("Please enter a valid test duration in minutes (greater than 0).");
             console.log("DEBUG_MERGE: Invalid test duration.");
             submitButton.disabled = false;
             submitButton.textContent = 'Publish Test';
             return;
        }


        const testData = {
            teacherId: teacherId,
            title: testTitleElement.value.trim(),
            subject: testSubjectElement.value, // Value from select dropdown
            duration: duration,
            createdAt: serverTimestamp(), // Use server timestamp for creation time
            questions: [] // Array to store question objects
        };

         // Collect question data from each question field div
        const questionDivs = document.querySelectorAll('.question-field-group');
        if (questionDivs.length === 0) {
            alert('Please add at least one question to the test.');
            console.log("DEBUG_MERGE: No questions added. Publish aborted.");
            submitButton.disabled = false;
            submitButton.textContent = 'Publish Test';
            return;
        }

        let hasIncompleteQuestion = false;
        questionDivs.forEach(qDiv => {
            const optionsEls = qDiv.querySelectorAll('.test-option');
            const questionTextElement = qDiv.querySelector('.test-question-text');
            const correctAnswerSelectElement = qDiv.querySelector('.test-correct-answer');
            const conceptTagElement = qDiv.querySelector('.test-concept-tag');

             // Extract values and trim whitespace
             const questionText = questionTextElement ? questionTextElement.value.trim() : '';
             const options = Array.from(optionsEls).map(opt => opt.value.trim());
             const correctAnswerIndex = correctAnswerSelectElement ? parseInt(correctAnswerSelectElement.value) : NaN;
             const conceptTag = conceptTagElement ? conceptTagElement.value.trim() : '';


             // Validate question data
            if (questionText && options.every(opt => opt !== '') && options.length === 4 && !isNaN(correctAnswerIndex) && correctAnswerIndex >= 0 && correctAnswerIndex < 4 && conceptTag) {
                 // Create question object if valid
                const question = {
                    text: questionText,
                    options: options, // Store all 4 options
                    correctAnswer: options[correctAnswerIndex], // Store the correct answer text
                    conceptTag: conceptTag
                };
                testData.questions.push(question); // Add valid question to the test data
            } else {
                 console.warn("DEBUG_MERGE: Skipping incomplete or invalid question:", {
                     text: questionText, options: options, correctAnswerIndex: correctAnswerIndex, conceptTag: conceptTag
                 });
                hasIncompleteQuestion = true; // Flag that some questions were skipped
            }
        });

         // Check if any valid questions were collected
        if (testData.questions.length === 0) {
             alert('No valid questions were added. Please ensure question text, all options, correct answer, and concept tag are filled for at least one question.');
             console.log("DEBUG_MERGE: No valid questions collected for publishing.");
             submitButton.disabled = false;
             submitButton.textContent = 'Publish Test';
             return;
        }

        try {
             console.log("DEBUG_MERGE: Attempting to add test document to Firestore:", testData);
            // Use the globally managed db object
            await addDoc(collection(db, "Tests"), testData);
            console.log("DEBUG_MERGE: Test published successfully!");
             alert('Test published successfully!');
            // Navigate back to the teacher's content page
            window.showTeacherContentPage(teacherId); // Use window.
             // Optionally show warning about skipped questions
             if (hasIncompleteQuestion) {
                  alert("Note: Some question fields were not complete and were not included in the test.");
             }
        } catch (error) {
            console.error("DEBUG_MERGE: Error publishing test: ", error);
            alert('Failed to publish test. Please check console for errors.');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = 'Publish Test';
             console.log("DEBUG_MERGE: publishTest finally block executed.");
        }
    }


    // Function to get AI analysis for a test (Mock/Placeholder)
    window.getAiAnalysis = async function(testId) { // Make globally accessible
         console.log(`DEBUG_MERGE: getAiAnalysis called for Test ID: ${testId}. (Placeholder Function)`);
        alert(`Fetching AI analysis for Test ID: ${testId}... (This is a placeholder)`);
        try {
            console.log("DEBUG_MERGE: Pretending to fetch AI analysis for testId:", testId);
            // Mocking a fake report
            const fakeReport = {
                weakestConcepts: [
                    { concept: "Newton's Laws", errorRate: 67, students: ["Amit", "Sunita"] },
                    { concept: "Friction", errorRate: 50, students: ["Rohan", "Priya"] }
                ],
                actionPlan: "Focus on re-teaching Newton's Laws with practical examples. Assign extra practice problems on Friction."
            };
            console.log("DEBUG_MERGE: Fake AI Report Data:", fakeReport);
            alert("AI Analysis (see console for fake data):\n- Weakest Concept: " + fakeReport.weakestConcepts[0].concept + "\n- Action Plan: " + fakeReport.actionPlan);

             // In a real implementation, you would fetch actual results for this testId from Firestore,
             // aggregate answers by concept tag, calculate error rates, and then potentially
             // use an AI model (like Gemini via your backend) to generate analysis text.

             // Example of fetching results (requires auth and querying TestResults collection)
             /*
             const resultsCol = collection(db, "TestResults");
             const q = query(resultsCol, where("testId", "==", testId));
             const querySnapshot = await getDocs(q);
             let allAnswers = [];
             querySnapshot.forEach(doc => {
                 const result = doc.data();
                 if (Array.isArray(result.answers)) {
                     allAnswers = allAnswers.concat(result.answers); // Combine all student answers
                 }
             });
             console.log("DEBUG_MERGE: All answers for test:", allAnswers);
             // Process allAnswers to find weakest concepts...
             // Then send this data to your backend's AI endpoint for analysis...
             // const analysis = await callAIEndpoint('/analyze-test-performance', { testId: testId, allAnswers: allAnswers }, '#some-display-div');
             */

        } catch (error) {
            console.error("DEBUG_MERGE: Failed to fetch AI analysis (placeholder error):", error);
            alert("Could not retrieve AI analysis. Please try again later.");
        }
    }


    let testTimerInterval = null; // Interval ID for teacher test timer

    // Function to start a teacher-created test
    window.startTeacherTest = async function(testId) { // Make globally accessible
         console.log(`DEBUG_MERGE: startTeacherTest called for Test ID: ${testId}.`);
         // Clear any existing test timer interval
        if (testTimerInterval) clearInterval(testTimerInterval);

        showScreen('exam-quiz-page'); // Navigate to the generic exam quiz page
        const page = document.getElementById('exam-quiz-page');
        if (!page) { console.error("DEBUG_MERGE: Teacher Test exam quiz page element not found."); return; }

        // Display loading message
        page.innerHTML = `<main class="main-content"><p style="text-align:center; margin-top: 50px; color: var(--text-muted-color);">Loading test...</p></main>`;

        try {
             console.log(`DEBUG_MERGE: Fetching test data for ID: ${testId}.`);
            // Use the globally managed db object
            const testDocRef = doc(db, "Tests", testId);
            const testDoc = await getDoc(testDocRef);

            if (!testDoc.exists()) {
                throw new Error("Test not found!"); // Throw error if document doesn't exist
            }

            const testData = testDoc.data(); // Get the test data
             console.log("DEBUG_MERGE: Test data loaded:", testData);

             // Validate test data structure
             if (!testData || !Array.isArray(testData.questions) || testData.questions.length === 0) {
                  throw new Error("Test data is incomplete or has no questions.");
             }


            let currentQuestionIndex = 0; // State for the current question index
            let userAnswers = {}; // Object to store user answers {qIndex: {answer: "user choice", isCorrect: boolean}}


            // Function to jump to a specific question number
            window.jumpToTeacherTestQuestion = (index) => { // Make globally accessible
                 console.log(`DEBUG_MERGE: jumpToTeacherTestQuestion called for index: ${index}.`);
                 // Ensure index is valid
                if (index >= 0 && index < testData.questions.length) {
                    currentQuestionIndex = index; // Update current index
                    renderTestQuestion(); // Render the question at the new index
                     console.log(`DEBUG_MERGE: Jumped to question index ${index}.`);
                } else {
                     console.warn(`DEBUG_MERGE: Invalid jump target index: ${index}.`);
                }
            };

            // Function to leave the teacher test (e.g., via back button)
            window.leaveTeacherTest = () => { // Make globally accessible
                 console.log("DEBUG_MERGE: leaveTeacherTest called.");
                 // Clear the timer if it's running
                if(testTimerInterval) clearInterval(testTimerInterval);
                 console.log("DEBUG_MERGE: Test timer cleared.");

                // Optionally confirm if the user wants to leave an unfinished test
                // if (userAnswers.length < testData.questions.length) { // Simple check
                //      if (!confirm("You have not finished the test. Are you sure you want to leave? Your progress will be lost.")) {
                //          // If cancelled, restart the timer and return
                //           startTeacherTestTimer(remainingSeconds); // You'd need to store remaining time
                //           return;
                //      }
                // }

                // Navigate back to the teacher's content page
                window.showTeacherContentPage(testData.teacherId); // Use window.
                 console.log("DEBUG_MERGE: Left teacher test, navigated back to teacher content page.");
            };


            // Function to render the current test question
            function renderTestQuestion() {
                 console.log(`DEBUG_MERGE: renderTestQuestion called for index: ${currentQuestionIndex}.`);
                 // Get the current question data
                const question = testData.questions[currentQuestionIndex];

                if (!question) {
                     console.error(`DEBUG_MERGE: Question data not found at index ${currentQuestionIndex}.`);
                     // Optionally show an error message on the page
                     page.querySelector('.main-content').innerHTML = '<p style="color: var(--danger); text-align:center;">Error loading question.</p>';
                     return;
                }

                 // Generate HTML for the question navigation pills
                let navHTML = '';
                for (let i = 0; i < testData.questions.length; i++) {
                    let pillClass = 'q-nav-pill';
                     // Add 'current' class if this is the active question
                    if (i === currentQuestionIndex) {
                        pillClass += ' current';
                    }
                     // Add 'answered' class if the user has provided an answer for this question
                     // Check if userAnswers object has an entry for this index and the answer is not 'skipped'
                    else if (userAnswers[i] !== undefined && userAnswers[i].answer !== 'skipped') {
                        pillClass += ' answered';
                    } else if (userAnswers[i] !== undefined && userAnswers[i].answer === 'skipped') {
                         pillClass += ' skipped'; // Optional: visual indicator for skipped
                    }
                     // Use window.jumpToTeacherTestQuestion
                    navHTML += `<div class="${pillClass}" onclick="window.jumpToTeacherTestQuestion(${i})">${i + 1}</div>`;
                }


                 // Determine the button HTML (Next or Submit Test)
                const isLastQuestion = currentQuestionIndex === testData.questions.length - 1;
                const buttonHTML = isLastQuestion
                    ? `<button id="submit-test-btn" class="btn btn-primary" onclick="window.finishTeacherTest(true)">Submit Test</button>` // Use window.
                    : `<button id="next-quiz-btn" class="btn btn-primary" onclick="window.nextTeacherTestQuestion()">Next</button>`; // Use window.


                 // Render the full question page HTML
                page.innerHTML = `
                    <header class="app-header">
                         <!-- Back button uses leaveTeacherTest -->
                         <div class="header-icon" onclick="window.leaveTeacherTest()"><i class="fa-solid fa-arrow-left"></i></div>
                         <h1 class="app-title">${testData.title || 'Teacher Test'}</h1> <!-- Use test title -->
                         <div id="test-timer" class="header-timer">00:00</div> <!-- Timer display -->
                    </header>
                    <div class="question-nav-container" style="padding: 10px 0; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none;"> <!-- Added styles for horizontal scroll -->
                        ${navHTML} <!-- Question navigation pills -->
                    </div>
                    <main class="main-content" style="padding-top: 5px;">
                        <div class="quiz-question-area">
                            <p class="quiz-question-text">${currentQuestionIndex + 1}. ${question.text}</p> <!-- Question text -->
                            <div class="quiz-options">
                                ${question.options && question.options.length > 0 ? question.options.map((opt, i) => {
                                    // Determine if this option was selected by the user for this question
                                    const isSelected = userAnswers[currentQuestionIndex] && userAnswers[currentQuestionIndex].answer === opt;
                                     // Use data-answer to store the option text
                                    return `<div class="quiz-option ${isSelected ? 'selected' : ''}" data-answer="${opt}"><span class="option-letter">${String.fromCharCode(65 + i)}</span> ${opt}</div>`; // Option HTML
                                }).join('') : '<p style="color: var(--text-muted-color);">No options available.</p>'}
                            </div>
                        </div>
                         <div class="quiz-footer" style="padding: 15px; text-align: center;">
                            ${buttonHTML} <!-- Next or Submit button -->
                        </div>
                    </main>
                `;

                 // Scroll the current question pill into view
                const currentPill = page.querySelector('.q-nav-pill.current');
                if (currentPill) {
                    currentPill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                     console.log(`DEBUG_MERGE: Scrolled question pill ${currentQuestionIndex + 1} into view.`);
                } else {
                     console.warn("DEBUG_MERGE: Current question pill not found for scrolling.");
                }


                // Add event listeners to quiz options
                page.querySelectorAll('.quiz-option').forEach(opt => {
                    opt.onclick = (e) => {
                         console.log("DEBUG_MERGE: Quiz option clicked.");
                        const selectedOptionElement = e.target.closest('.quiz-option');
                        if (selectedOptionElement) {
                            const selectedAnswer = selectedOptionElement.dataset.answer; // Get the answer text from data attribute
                             // Find the correct answer for the current question from the testData
                             const correctAnswerForThisQ = testData.questions[currentQuestionIndex]?.correctAnswer;
                             // Store the user's answer and whether it's correct
                             userAnswers[currentQuestionIndex] = {
                                 answer: selectedAnswer,
                                 isCorrect: selectedAnswer === correctAnswerForThisQ
                             };
                             console.log(`DEBUG_MERGE: Answer recorded for Q${currentQuestionIndex + 1}: "${selectedAnswer}". Correct: ${userAnswers[currentQuestionIndex].isCorrect}.`);
                             renderTestQuestion(); // Re-render the question to show the selected option
                        } else {
                             console.warn("DEBUG_MERGE: Clicked element is not a quiz option.");
                        }
                    };
                });
                 console.log(`DEBUG_MERGE: Question ${currentQuestionIndex + 1} rendered with options listeners attached.`);
            }


            // Function to move to the next question
            window.nextTeacherTestQuestion = () => { // Make globally accessible
                 console.log("DEBUG_MERGE: nextTeacherTestQuestion called.");
                 // If no answer was selected for the current question, mark it as skipped
                if (userAnswers[currentQuestionIndex] === undefined) {
                     const currentQ = testData.questions[currentQuestionIndex];
                     userAnswers[currentQuestionIndex] = {
                         answer: 'skipped',
                         isCorrect: false, // Skipped is incorrect
                         question: currentQ.text, // Include question text for result
                         correctAnswer: currentQ.correctAnswer, // Include correct answer for result
                         conceptTag: currentQ.conceptTag // Include concept tag for result
                     };
                     console.log(`DEBUG_MERGE: Q${currentQuestionIndex + 1} was not answered, marked as skipped.`);
                }

                // Move to the next index if not on the last question
                if (currentQuestionIndex < testData.questions.length - 1) {
                    currentQuestionIndex++;
                    renderTestQuestion(); // Render the next question
                     console.log(`DEBUG_MERGE: Moving to next teacher test question: ${currentQuestionIndex + 1}.`);
                } else {
                     // If on the last question, pressing "Next" should ideally finish the test
                     // The UI should show "Submit Test" on the last question, making this path less likely
                     // As a fallback, call finishTest
                     console.warn("DEBUG_MERGE: 'Next' called on last question. Calling finishTeacherTest.");
                     window.finishTeacherTest(true); // Use window.
                }
            };


            // Function to finish the test (either manually or by timer)
            window.finishTeacherTest = async (isManualSubmit = false) => { // Make globally accessible
                 console.log(`DEBUG_MERGE: finishTeacherTest called. Manual Submit: ${isManualSubmit}.`);
                 // Clear the timer if it's running
                if (testTimerInterval) clearInterval(testTimerInterval);
                 console.log("DEBUG_MERGE: Test timer cleared.");


                 // If manually submitting on the last question and it wasn't answered, mark as skipped
                if (isManualSubmit && currentQuestionIndex === testData.questions.length - 1 && userAnswers[currentQuestionIndex] === undefined) {
                     const currentQ = testData.questions[currentQuestionIndex];
                     userAnswers[currentQuestionIndex] = {
                          answer: 'skipped',
                          isCorrect: false,
                          question: currentQ.text,
                          correctAnswer: currentQ.correctAnswer,
                          conceptTag: currentQ.conceptTag
                     };
                     console.log(`DEBUG_MERGE: Last question marked as skipped on manual submit.`);
                }

                // Calculate the final score
                let score = 0;
                let answeredCount = 0; // Count of questions user actually attempted
                // Iterate through all questions to calculate score and build answer review data
                 const answersForReview = [];
                for(let i = 0; i < testData.questions.length; i++) {
                     const questionData = testData.questions[i];
                     const userAnswerEntry = userAnswers[i]; // Get the user's answer entry for this question

                     const userAnswer = userAnswerEntry?.answer || 'skipped'; // Default to 'skipped'
                     const isCorrect = userAnswerEntry?.isCorrect || false; // Default to false if skipped or not in userAnswers

                     if (userAnswer !== 'skipped') {
                         answeredCount++; // Increment attempted count
                         if (isCorrect) {
                             score++; // Increment score if correct
                         }
                     }

                     // Prepare data for review/submission
                     answersForReview.push({
                         question: questionData.text, // Question text
                         userAnswer: userAnswer,
                         correctAnswer: questionData.correctAnswer, // Correct answer text
                         isCorrect: isCorrect,
                         conceptTag: questionData.conceptTag // Concept tag
                     });
                }

                const totalQuestions = testData.questions.length;
                const wrong = answeredCount - score; // Answered incorrectly
                const skipped = totalQuestions - answeredCount; // Not attempted


                // Get current user info for saving results
                const currentUserForTest = auth.currentUser;
                let studentId = currentUserForTest ? currentUserForTest.uid : 'anonymous_test_taker_' + Date.now(); // Use UID if logged in, otherwise generate ID
                let studentName = currentUserForTest ? (currentUserForTest.displayName || 'Conceptra User') : 'Anonymous'; // Use display name or default


                 // Prepare the test result data object to save to Firestore
                const resultData = {
                    studentId: studentId,
                    studentName: studentName,
                    teacherId: testData.teacherId,
                    testId: testId, // The ID of the test taken
                    testTitle: testData.title || 'Unnamed Test',
                    score: score, // Number correct
                    totalQuestions: totalQuestions,
                    submittedAt: serverTimestamp(), // Use server timestamp
                    answers: answersForReview // Array of detailed answers for review/analysis
                };
                 console.log("DEBUG_MERGE: Test result calculated:", {score: score, total: totalQuestions, correct: score, wrong: wrong, skipped: skipped});
                 console.log("DEBUG_MERGE: Prepared result data for submission:", resultData);

                try {
                    console.log("DEBUG_MERGE: Submitting test result to Firestore...");
                    // Use the globally managed db object
                    await addDoc(collection(db, "TestResults"), resultData);
                    console.log("DEBUG_MERGE: Test result saved to Firestore successfully!");
                } catch(e) {
                    console.error("DEBUG_MERGE: Error saving test result to Firestore: ", e);
                     // Optionally alert user about save failure
                     alert("Failed to save test result. Please check your connection.");
                }

                 // Navigate to the result page
                showScreen('exam-result-page'); // Use the generic exam result page ID
                const resultPage = document.getElementById('exam-result-page');
                if (!resultPage) { console.error("DEBUG_MERGE: Exam result page element not found."); return; }


                 // Render the result summary on the result page
                resultPage.innerHTML = `
                    <header class="app-header">
                        <!-- Back button goes back to the teacher list after seeing results -->
                        <div class="header-icon" onclick="window.showTeacherListPage()"><i class="fa-solid fa-arrow-left"></i></div> <!-- Use window. -->
                        <h1 class="app-title">Test Result</h1>
                         <div class="header-icon" style="width: 40px;"></div> <!-- Placeholder -->
                    </header>
                    <main class="main-content">
                        <h2>Your Performance for "${testData.title || 'Unnamed Test'}"</h2>
                         <p style="text-align:center; color: var(--text-muted-color); margin-bottom: 20px;">Subject: ${testData.subject || 'N/A'} &bull; Total Questions: ${totalQuestions}</p>

                        <div class="result-summary-grid">
                            <div class="summary-box correct"><div class="value">${score}</div><div class="label">Correct</div></div>
                            <div class="summary-box wrong"><div class="value">${wrong}</div><div class="label">Wrong</div></div>
                            <div class="summary-box skipped"><div class="value">${skipped}</div><div class="label">Skipped</div></div>
                        </div>

                         <!-- Basic score table -->
                         <table class="result-score-table" style="margin-top: 20px; width: 100%; max-width: 300px; margin-left: auto; margin-right: auto;">
                             <tr><td>Score:</td><td><b>${score}</b></td></tr>
                             <tr><td>Attempted:</td><td>${answeredCount}</td></tr>
                             <tr><td>Accuracy (Attempted):</td><td>${answeredCount > 0 ? ((score / answeredCount) * 100).toFixed(2) : '0.00'}%</td></tr>
                         </table>


                         <!-- Link to AI analysis (Placeholder function) -->
                          <div style="text-align: center; margin-top: 30px;">
                             <button class="btn btn-secondary" onclick="window.getAiAnalysis('${testId}')">
                                <i class="fa-solid fa-brain"></i> Get AI Analysis (Teacher Only)
                             </button>
                          </div>

                        <!-- Review Answers Section (Requires implementation based on answersForReview) -->
                         <h3 style="margin: 30px 0 15px;">Answer Review</h3>
                          <div id="teacher-test-review-container">
                             <p style="text-align:center; color: var(--text-muted-color);">Loading review...</p>
                         </div>
                    </main>
                `;
                 console.log("DEBUG_MERGE: Teacher Test result screen rendered.");

                 // Render the detailed answer review
                 renderTeacherTestReview(answersForReview); // Pass the collected answers for review

                 // Note: The chart rendering function (renderResultChart) and review tab logic (showReviewContent)
                 // were designed for the sample test. They would need modification to work with the structure
                 // of teacher test results saved in `resultData.answers`.
                 // For now, I've created a dedicated renderTeacherTestReview function.
            }

             // Start the test timer if duration is set
            let remainingSeconds = testData.duration * 60;
             const timerElInitial = document.getElementById('test-timer');
             if (timerElInitial) {
                 const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
                 const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
                 timerElInitial.textContent = `${minutes}:${seconds}`;
                 console.log(`DEBUG_MERGE: Initial timer display set to ${minutes}:${seconds}.`);
             } else {
                  console.warn("DEBUG_MERGE: Test timer element not found.");
             }

             if (testData.duration > 0) { // Only start timer if duration is positive
                  testTimerInterval = setInterval(() => {
                      remainingSeconds--;
                      const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
                      const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
                      const timerEl = document.getElementById('test-timer');
                      if (timerEl) {
                          timerEl.textContent = `${minutes}:${seconds}`; // Update display
                          // Optionally change color when time is running low
                          if (remainingSeconds <= 60 && !timerEl.classList.contains('time-low')) {
                              timerEl.classList.add('time-low'); // Add class for styling
                          } else if (remainingSeconds > 60 && timerEl.classList.contains('time-low')) {
                              timerEl.classList.remove('time-low');
                          }
                      } else {
                           console.warn("DEBUG_MERGE: Test timer element not found during interval update.");
                           clearInterval(testTimerInterval); // Stop timer if element is gone
                      }


                      if (remainingSeconds <= 0) {
                          clearInterval(testTimerInterval); // Stop interval
                          console.log("DEBUG_MERGE: Test timer reached 0. Auto-submitting.");
                          alert("Time's up! Submitting your test.");
                          window.finishTeacherTest(false); // Use window., submit automatically (not manual)
                      }
                  }, 1000); // Update every second
                  console.log(`DEBUG_MERGE: Test timer interval started for ${testData.duration} minutes.`);
             } else {
                  console.log("DEBUG_MERGE: Test duration is 0 or less. Timer not started.");
                  if (timerElInitial) timerElInitial.style.display = 'none'; // Hide timer if no duration
             }


            renderTestQuestion(); // Render the first question to start the test flow

        } catch (error) {
            console.error("DEBUG_MERGE: Error starting teacher test: ", error);
             // Show error message on the page
            if (page) page.innerHTML = `<main class="main-content"><p style="color: var(--danger); text-align:center; margin-top: 50px;">Error: Could not load the test.<br>${error.message}</p></main>`;
             // Ensure timer is stopped if there was an error loading
             if(testTimerInterval) clearInterval(testTimerInterval);
        }
         console.log("DEBUG_MERGE: startTeacherTest finished.");
    }

    // Function to render the answer review section for teacher tests
    function renderTeacherTestReview(answersForReview) {
         console.log("DEBUG_MERGE: renderTeacherTestReview called.");
         const reviewContainer = document.getElementById('teacher-test-review-container');
         if (!reviewContainer) {
              console.error("DEBUG_MERGE: Teacher Test review container not found.");
              return;
         }

         if (!Array.isArray(answersForReview) || answersForReview.length === 0) {
             reviewContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No answers recorded for review.</p>';
             console.log("DEBUG_MERGE: No answers provided for review.");
             return;
         }

         let reviewHTML = '';
         answersForReview.forEach((ans, index) => {
             const statusClass = ans.isCorrect ? 'correct-review' : (ans.userAnswer === 'skipped' ? '' : 'incorrect-review'); // Add class for styling

             reviewHTML += `
                 <div class="quiz-review-question ${statusClass}">
                     <p><b>Q${index + 1}:</b> ${ans.question}</p>
                     <p><b>Your Answer:</b> <span style="color: ${ans.isCorrect ? 'var(--success)' : (ans.userAnswer === 'skipped' ? 'var(--text-muted-color)' : 'var(--danger)')};">${ans.userAnswer}</span></p>
                     ${!ans.isCorrect ? `<p style="color: var(--success);"><b>Correct Answer:</b> ${ans.correctAnswer}</p>` : ''} <!-- Show correct answer if wrong or skipped -->
                     <p style="font-size: 0.9em; color: var(--text-muted-color);"><b>Concept Tag:</b> ${ans.conceptTag || 'N/A'}</p> <!-- Show concept tag -->
                 </div>
             `;
         });

         reviewContainer.innerHTML = reviewHTML; // Set the HTML content
         console.log(`DEBUG_MERGE: Rendered review for ${answersForReview.length} teacher test questions.`);
    }
    // --- End Teacher Content / Tests Feature ---


    // --- Sample Test Feature (FROM New File.js) ---
    // This is a simplified, local client-side test feature.
    window.startSampleTest = function() { // Make globally accessible
         console.log("DEBUG_MERGE: startSampleTest called.");
         // Navigate to the exam quiz page
        showScreen('exam-quiz-page', false);
        const page = document.getElementById('exam-quiz-page');
        if (!page) { console.error("DEBUG_MERGE: Sample Test exam quiz page element not found."); return; }

        let currentQuestionIndex = 0; // State for the current question index
        examDB.userAnswersForSampleTest = {}; // Reset user answers for the sample test

        const questions = examDB.sampleTest; // Get sample test questions from local DB

        if (!questions || questions.length === 0) {
             console.error("DEBUG_MERGE: Sample Test questions not found in examDB.");
             page.innerHTML = `<main class="main-content"><p style="color: var(--danger); text-align:center; margin-top: 50px;">Error: Sample test questions not available.</p></main>`;
             return;
        }

         // Function to jump to a specific question number
        window.jumpToSampleTestQuestion = (index) => { // Make globally accessible
             console.log(`DEBUG_MERGE: jumpToSampleTestQuestion called for index: ${index}.`);
             // Ensure index is valid
            if (index >= 0 && index < questions.length) {
                currentQuestionIndex = index; // Update current index
                renderTestQuestion(); // Render the question at the new index
                 console.log(`DEBUG_MERGE: Sample Test: Jumped to question index ${index}.`);
            } else {
                 console.warn(`DEBUG_MERGE: Sample Test: Invalid jump target index: ${index}.`);
            }
        };

         // Function to render the current sample test question
        function renderTestQuestion() {
             console.log(`DEBUG_MERGE: renderTestQuestion called for index: ${currentQuestionIndex}.`);
             // If index is out of bounds, finish the test
            if (currentQuestionIndex >= questions.length) {
                 console.log("DEBUG_MERGE: Sample Test: Index out of bounds, finishing test.");
                window.finishSampleTest(); // Use window.
                return;
            }
            const question = questions[currentQuestionIndex]; // Get the current question data

            if (!question) {
                 console.error(`DEBUG_MERGE: Sample Test: Question data not found at index ${currentQuestionIndex}.`);
                 page.querySelector('.main-content').innerHTML = '<p style="color: var(--danger); text-align:center;">Error loading question.</p>';
                 return;
            }

            // Generate HTML for the question navigation pills
            let navHTML = '';
            for (let i = 0; i < questions.length; i++) {
                let pillClass = 'q-nav-pill';
                 // Add 'current' class if this is the active question
                if (i === currentQuestionIndex) {
                    pillClass += ' current';
                }
                 // Add 'answered' class if the user has provided an answer for this question
                else if (examDB.userAnswersForSampleTest[i] !== undefined) {
                    pillClass += ' answered';
                }
                 // Use window.jumpToSampleTestQuestion
                navHTML += `<div class="${pillClass}" onclick="window.jumpToSampleTestQuestion(${i})">${i + 1}</div>`;
            }

            // Determine the button HTML (Next or Submit Test)
            const isLastQuestion = currentQuestionIndex === questions.length - 1;
            const buttonHTML = isLastQuestion
                ? `<button id="submit-test-btn" class="btn btn-primary" onclick="window.finishSampleTest()">Submit Test</button>` // Use window.
                : `<button id="next-quiz-btn" class="btn btn-primary" onclick="window.nextTestQuestion()">Next</button>`; // Use window.


             // Render the full question page HTML
            page.innerHTML = `
                <header class="app-header">
                     <!-- Back button goes back to NEET Test Practice page -->
                     <div class="header-icon" onclick="window.renderExamContent(['neet', 'test'], 'NEET Test Practice');"><i class="fa-solid fa-arrow-left"></i></div> <!-- Use window. -->
                     <h1 class="app-title">Sample Test</h1>
                      <div class="header-icon" style="width: 40px;"></div> <!-- Placeholder -->
                </header>
                <div class="question-nav-container" style="padding: 10px 0; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
                    ${navHTML} <!-- Question navigation pills -->
                </div>
                <main class="main-content" style="padding-top: 5px;">
                    <div class="quiz-question-area">
                        <p class="quiz-question-text">${currentQuestionIndex + 1}. ${question.q}</p> <!-- Question text -->
                        <div class="quiz-options">
                            ${question.o && question.o.length > 0 ? question.o.map((opt, i) => {
                                // Determine if this option was selected by the user for this question
                                const isSelected = examDB.userAnswersForSampleTest[currentQuestionIndex] === opt;
                                 // Use data-answer to store the option text
                                return `<div class="quiz-option ${isSelected ? 'selected' : ''}" data-answer="${opt}"><span class="option-letter">${String.fromCharCode(65 + i)}</span> ${opt}</div>`; // Option HTML
                            }).join('') : '<p style="color: var(--text-muted-color);">No options available.</p>'}
                        </div>
                    </div>
                     <div class="quiz-footer" style="padding: 15px; text-align: center;">
                        ${buttonHTML} <!-- Next or Submit button -->
                    </div>
                </main>
            `;

             // Scroll the current question pill into view
            const currentPill = page.querySelector('.q-nav-pill.current');
            if (currentPill) {
                currentPill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                 console.log(`DEBUG_MERGE: Sample Test: Scrolled question pill ${currentQuestionIndex + 1} into view.`);
            } else {
                 console.warn("DEBUG_MERGE: Sample Test: Current question pill not found for scrolling.");
            }

            // Add event listeners to quiz options
            page.querySelectorAll('.quiz-option').forEach(opt => {
                opt.onclick = (e) => {
                     console.log("DEBUG_MERGE: Sample Test: Quiz option clicked.");
                    const selectedOptionElement = e.target.closest('.quiz-option');
                    if (selectedOptionElement) {
                         // Store the selected answer text in examDB.userAnswersForSampleTest
                         examDB.userAnswersForSampleTest[currentQuestionIndex] = selectedOptionElement.dataset.answer;
                         console.log(`DEBUG_MERGE: Sample Test: Answer recorded for Q${currentQuestionIndex + 1}: "${examDB.userAnswersForSampleTest[currentQuestionIndex]}".`);
                         renderTestQuestion(); // Re-render the question to show the selected option
                    } else {
                         console.warn("DEBUG_MERGE: Sample Test: Clicked element is not a quiz option.");
                    }
                };
            });
             console.log(`DEBUG_MERGE: Sample Test: Question ${currentQuestionIndex + 1} rendered with options listeners attached.`);
        }


        // Function to move to the next question in Sample Test
        window.nextTestQuestion = () => { // Make globally accessible
             console.log("DEBUG_MERGE: nextTestQuestion called.");
             // If no answer was selected for the current question, mark it as skipped
            if (examDB.userAnswersForSampleTest[currentQuestionIndex] === undefined) {
                examDB.userAnswersForSampleTest[currentQuestionIndex] = 'skipped';
                                  console.log(`DEBUG_MERGE: Sample Test: Q${currentQuestionIndex + 1} was not answered, marked as skipped.`);
            }

            // Move to the next index if not on the last question
            if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                renderTestQuestion(); // Render the next question
                 console.log(`DEBUG_MERGE: Sample Test: Moving to next question: ${currentQuestionIndex + 1}.`);
            } else {
                 // If on the last question, pressing "Next" should ideally finish the test
                 // The UI should show "Submit Test" on the last question, making this path less likely
                 // As a fallback, call finishTest
                 console.warn("DEBUG_MERGE: Sample Test: 'Next' called on last question. Calling finishSampleTest.");
                 window.finishSampleTest(); // Use window.
            }
        };

        // Function to finish the Sample Test and display results
        window.finishSampleTest = () => { // Make globally accessible
            console.log("DEBUG_MERGE: finishSampleTest called.");

            // Ensure the answer for the last question is recorded if it wasn't already
            if (currentQuestionIndex < questions.length && examDB.userAnswersForSampleTest[currentQuestionIndex] === undefined) {
                 examDB.userAnswersForSampleTest[currentQuestionIndex] = 'skipped';
                 console.log(`DEBUG_MERGE: Sample Test: Last question Q${currentQuestionIndex + 1} was not answered, marked as skipped before finishing.`);
            }


            showScreen('exam-result-page', false); // Navigate to the generic exam result page
            const resultPage = document.getElementById('exam-result-page');
            if (!resultPage) { console.error("DEBUG_MERGE: Exam result page element not found."); return; } // <<<--- Add check


            // Calculate score and counts (correct, wrong, skipped)
            let correct = 0, wrong = 0, skipped = 0;

            for(let i = 0; i < questions.length; i++){
                 const userAnswer = examDB.userAnswersForSampleTest[i];
                 const correctAnswer = questions[i].a; // Get correct answer from the test data

                if(userAnswer === 'skipped' || userAnswer === undefined) { // Check for skipped or unanswered
                    skipped++;
                     console.log(`DEBUG_MERGE: Sample Test: Q${i+1} skipped.`);
                } else if (userAnswer === correctAnswer) { // Check if answer is correct
                    correct++;
                     console.log(`DEBUG_MERGE: Sample Test: Q${i+1} correct.`);
                } else { // Answered but wrong
                    wrong++;
                     console.log(`DEBUG_MERGE: Sample Test: Q${i+1} wrong. User: "${userAnswer}", Correct: "${correctAnswer}".`);
                }
            }

             // Calculate score based on a marking scheme (e.g., +4 for correct, -1 for wrong)
             // This scheme is assumed from the original code's comment
            const score = (correct * 4) - (wrong * 1);
            const totalMarks = questions.length * 4; // Total possible marks

             console.log(`DEBUG_MERGE: Sample Test Results: Correct=${correct}, Wrong=${wrong}, Skipped=${skipped}, Score=${score}/${totalMarks}.`);


             // Render the result summary and review sections HTML
            resultPage.innerHTML = `
                <header class="app-header">
                    <!-- Back button goes back to NEET Test Practice page -->
                    <div class="header-icon" onclick="window.renderExamContent(['neet', 'test'], 'NEET Test Practice');"><i class="fa-solid fa-arrow-left"></i></div> <!-- Use window. -->
                    <h1 class="app-title">Sample Test Result</h1> <!-- Updated title -->
                     <div class="header-icon" style="width: 40px;"></div> <!-- Placeholder -->
                </header>
                <main class="main-content">
                    <h2>Your Performance</h2>
                    <div class="result-summary-grid">
                        <div class="summary-box correct"><div class="value">${correct}</div><div class="label">Correct</div></div>
                        <div class="summary-box wrong"><div class="value">${wrong}</div><div class="label">Wrong</div></div>
                        <div class="summary-box skipped"><div class="value">${skipped}</div><div class="label">Skipped</div></div>
                    </div>
                    <table class="result-score-table" style="margin-top: 20px; width: 100%; max-width: 300px; margin-left: auto; margin-right: auto;">
                        <tr><td>Positive Marks:</td><td>+${correct * 4}</td></tr>
                        <tr><td>Negative Marks:</td><td>-${wrong * 1}</td></tr>
                        <tr><td><strong>Final Score:</strong></td><td><strong class="final-score">${score} / ${totalMarks}</strong></td></tr>
                    </table>
                    <div id="exam-result-chart-container" style="margin-top: 20px;"><canvas id="exam-result-chart"></canvas></div> <!-- Container for the chart -->
                    <div class="result-review-tabs" style="margin-top: 20px; text-align: center;"> <!-- Tab buttons for review filtering -->
                         <!-- Use window.showReviewContent -->
                         <button class="btn active" onclick="window.showReviewContent('all')">All (${questions.length})</button> <!-- Added counts -->
                         <button class="btn" onclick="window.showReviewContent('correct')">Correct (${correct})</button>
                         <button class="btn" onclick="window.showReviewContent('wrong')">Wrong (${wrong})</button>
                         <button class="btn" onclick="window.showReviewContent('skipped')">Skipped (${skipped})</button>
                    </div>
                    <div id="review-container" style="margin-top: 15px;"></div> <!-- Container for answer review details -->
                </main>
            `;
             console.log("DEBUG_MERGE: Sample Test result screen rendered.");


            renderResultChart(correct, wrong, skipped); // Render the doughnut chart
            showReviewContent('all'); // Show the review for all questions by default
             console.log("DEBUG_MERGE: Sample Test results displayed.");
        }


        // renderResultChart function (Scoped locally)
        // Renders a doughnut chart showing correct, wrong, and skipped counts.
        let examResultChartInstance; // Variable to hold the chart instance
        function renderResultChart(correct, wrong, skipped) {
            console.log(`DEBUG_MERGE: renderResultChart called with Correct=${correct}, Wrong=${wrong}, Skipped=${skipped}.`);
            const ctx = document.getElementById('exam-result-chart')?.getContext('2d'); // Use optional chaining
            if (!ctx) {
                 console.warn("DEBUG_MERGE: Exam result chart canvas not found.");
                 return;
            }

             // Get computed styles for colors
            const style = getComputedStyle(document.body);
            const correctColor = style.getPropertyValue('--success').trim();
            const wrongColor = style.getPropertyValue('--danger').trim();
            const skippedColor = style.getPropertyValue('--neutral-gray').trim(); // Assuming --neutral-gray is defined
            const containerBg = style.getPropertyValue('--surface').trim(); // Background color for border

             // Destroy previous chart instance if it exists
            if (examResultChartInstance) examResultChartInstance.destroy();
             console.log("DEBUG_MERGE: Rendering new exam result doughnut chart.");
            examResultChartInstance = new Chart(ctx, {
                type: 'doughnut', // Chart type
                data: {
                    labels: ['Correct', 'Wrong', 'Skipped'], // Labels for segments
                    datasets: [{
                        data: [correct, wrong, skipped], // Data values
                        backgroundColor: [correctColor, wrongColor, skippedColor], // Segment colors
                        borderColor: containerBg, // Border color around segments
                        borderWidth: 5 // Border width
                    }]
                },
                options: {
                    responsive: true, // Make chart responsive
                    maintainAspectRatio: false, // Allow height to be controlled by CSS
                    cutout: '70%', // Size of the inner hole
                    plugins: {
                         // Legend is hidden as labels are often shown on the page
                        legend: { display: false },
                        tooltip: { // Tooltip styling and format
                             callbacks: {
                                 label: function(context) {
                                     let label = context.label || '';
                                     if (label) {
                                         label += ': ';
                                     }
                                     if (context.raw !== undefined) {
                                         label += context.raw;
                                     }
                                     return label;
                                 }
                             },
                             bodyFont: { family: "'Poppins', sans-serif" },
                             titleFont: { family: "'Poppins', sans-serif" }
                        }
                    }
                }
            });
             console.log("DEBUG_MERGE: Exam result doughnut chart rendered.");
        }


        // showReviewContent function (Scoped locally but called globally via window.)
        // Displays detailed review of answers filtered by status (all, correct, wrong, skipped)
        window.showReviewContent = (filter) => { // Make globally accessible
             console.log(`DEBUG_MERGE: showReviewContent called for filter: ${filter}.`);
            // Update active state of review tab buttons
            const reviewTabsButtons = document.querySelectorAll('.result-review-tabs button');
            if (reviewTabsButtons) {
                 reviewTabsButtons.forEach(btn => btn.classList.remove('active')); // Remove active from all
                 // Find and add active class to the button matching the filter
                 const activeReviewButton = document.querySelector(`.result-review-tabs button[onclick*="'${filter}'"]`);
                 if (activeReviewButton) activeReviewButton.classList.add('active');
                 console.log(`DEBUG_MERGE: Review tab button for '${filter}' activated.`);
            } else { console.warn("DEBUG_MERGE: Review tabs buttons not found."); }


            const container = document.getElementById('review-container');
            if (!container) { console.error("DEBUG_MERGE: Review container not found."); return; } // <<<--- Add check
            container.innerHTML = ''; // Clear previous review content

             // This function is currently tied to the sample test data (examDB.sampleTest)
            const questions = examDB.sampleTest; // Get sample test questions
             if (!Array.isArray(questions) || questions.length === 0) {
                 container.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">Sample test questions not available for review.</p>';
                  console.warn("DEBUG_MERGE: Sample test questions not available for review.");
                 return;
             }


             // Filter user answers based on the selected filter
            let filteredAnswers = [];
            for(let i = 0; i < questions.length; i++) {
                 const question = questions[i]; // Get question data
                 const userAnswer = examDB.userAnswersForSampleTest[i] ?? 'skipped'; // Get user's answer, default to 'skipped' if undefined
                 const isCorrect = userAnswer === question.a; // Check correctness

                 // Check if this answer should be included based on the filter
                 if(filter === 'all' ||
                    (filter === 'correct' && isCorrect) ||
                    (filter === 'wrong' && !isCorrect && userAnswer !== 'skipped') ||
                    (filter === 'skipped' && userAnswer === 'skipped')) {
                     // Push a minimal object containing necessary info for rendering
                     filteredAnswers.push({
                         qIndex: i, // Original question index
                         questionText: question.q, // Question text
                         userAnswer: userAnswer,
                         correctAnswer: question.a, // Correct answer text
                         isCorrect: isCorrect
                         // Concept tag could be added here if stored in sampleTest
                         // conceptTag: question.s || 'N/A'
                     });
                 }
            }

             // Render each filtered answer review item
            if (filteredAnswers.length === 0) {
                 container.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">No answers match this filter.</p>';
                 console.log(`DEBUG_MERGE: No answers matching filter '${filter}' found.`);
            } else {
                 console.log(`DEBUG_MERGE: Rendering ${filteredAnswers.length} answers for filter '${filter}'.`);
                 filteredAnswers.forEach(ans => {
                     const div = document.createElement('div');
                     // Add class for styling (correct, incorrect, skipped)
                     div.className = `quiz-review-question ${ans.userAnswer === 'skipped' ? '' : (ans.isCorrect ? 'correct-review' : 'incorrect-review')}`; // Use incorrect-review class

                     // HTML structure for an answer review item
                     div.innerHTML = `
                         <p><b>Q${ans.qIndex + 1}:</b> ${ans.questionText}</p> <!-- Display question number and text -->
                         <p><b>Your Answer:</b> <span style="color: ${ans.isCorrect ? 'var(--success)' : (ans.userAnswer === 'skipped' ? 'var(--text-muted-color)' : 'var(--danger)')};">${ans.userAnswer}</span></p> <!-- Display user answer with color -->
                         ${!ans.isCorrect ? `<p style="color: var(--success);"><b>Correct Answer:</b> ${ans.correctAnswer}</p>` : ''} <!-- Show correct answer if wrong or skipped -->
                         <!-- Optional: Add concept tag display here if available -->
                         <!-- <p style="font-size: 0.9em; color: var(--text-muted-color);"><b>Concept Tag:</b> ${ans.conceptTag}</p> -->
                     `;
                     container.appendChild(div); // Add the review item to the container
                 });
                  console.log("DEBUG_MERGE: Sample Test answer review rendered.");
            }
        }
        // --- End Sample Test Feature ---


        // --- Common/Utility Functions (FROM New File.js) ---
        // showPrivacyPolicyPage, showTermsAndConditionsPage, openThemeSettingsFromSideMenu
        // These are simple navigation or alert placeholders, kept as is.
        window.showPrivacyPolicyPage = function() { // Make globally accessible
            console.log("DEBUG_MERGE: showPrivacyPolicyPage called. (Placeholder)");
            toggleMenu(false); // Close side menu
            alert('Privacy Policy: Content will be displayed here soon.');
        }
        window.showTermsAndConditionsPage = function() { // Make globally accessible
             console.log("DEBUG_MERGE: showTermsAndConditionsPage called. (Placeholder)");
            toggleMenu(false); // Close side menu
            alert('Terms and Conditions: Content will be displayed here soon.');
        }
        window.openThemeSettingsFromSideMenu = function() { // Make globally accessible
             console.log("DEBUG_MERGE: openThemeSettingsFromSideMenu called.");
            toggleMenu(false); // Close side menu
            openSettingsModal(); // Open settings modal
        }


        // --- App Initialization ---
        // This function sets up the initial HTML structure for various screens
        // and decides which screen to show first (splash, login, or home)
        function initApp() {
            console.log("DEBUG_MERGE: initApp function started.");

             // Populate state dropdown for auth/signup form
            const indianStates = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
            const stateOptions = indianStates.map(state => `<option value="${state}">${state}</option>`).join('');

            // Render HTML for the Splash Screen
            const splashScreenElement = document.getElementById('splash-screen');
            if (splashScreenElement) {
                 console.log("DEBUG_MERGE: Rendering Splash Screen HTML.");
                 splashScreenElement.innerHTML = `<div id="splash-logo"><i class="fa-solid fa-book-open-reader"></i></div><h1 id="splash-title"></h1><p id="splash-tagline">Learn Bold. Think Clear. Rise with Conceptra.</p><div id="splash-loader"><div id="splash-loader-bar"></div></div><button id="splash-skip-btn" onclick="window.skipSplash()">Skip</button><div id="splash-footer">Made by Udbhav</div>`; // Use window.
                 // Add animated title characters
                 const titleEl = document.getElementById('splash-title');
                 if (titleEl) {
                    "Conceptra".split('').forEach((char, i) => {
                        const span = document.createElement('span');
                        span.textContent = char;
                        span.style.animationDelay = `${0.5 + i * 0.1}s`;
                        titleEl.appendChild(span);
                    });
                     console.log("DEBUG_MERGE: Splash title animation elements added.");
                 } else { console.warn("DEBUG_MERGE: Splash title element not found."); }
            } else { console.warn("DEBUG_MERGE: Splash Screen element not found."); }


            // Render HTML for the Login/Signup Screen (Information Page)
            const loginScreenElement = document.getElementById('login-screen');
            if (loginScreenElement) {
                console.log("DEBUG_MERGE: Rendering Login/Signup Screen HTML.");
                loginScreenElement.innerHTML = `
                    <header class="app-header">
                        <!-- Back button goes back to the previous screen (handled by showScreen back=true logic) -->
                        <!-- Or maybe always go back to home? Let's stick to showScreen('home-screen', true) if it's the entry point -->
                         <!-- If arriving via continueToApp (first visit or logout), there's no "back", header should be hidden or minimal -->
                         <!-- Hiding header on login screen if it's the initial/post-logout screen -->
                         <!-- This header is currently part of the static HTML for login-screen -->
                         <!-- Let's assume the static HTML structure has a header defined with this ID -->
                         <!-- Example: <header class="app-header" id="login-header" style="display:none;"> ... </header> -->
                        <div class="header-icon" onclick="showScreen('home-screen', true)"><i class="fa-solid fa-arrow-left"></i></div> <!-- This back button might only make sense if navigating TO login from elsewhere -->
                        <h1 class="app-title" id="auth-form-title">Create Account</h1>
                    </header>
                    <div class="main-content">
                        <form class="info-form" id="auth-form" onsubmit="window.handleAuthFormSubmit(event)"> <!-- Use window. -->
                            <h2 id="auth-form-greeting">Welcome!</h2>
                            <p id="auth-form-message" style="font-size:0.9em; color:var(--text-muted-color); margin-bottom:15px;">
                                Create an account to save your progress and unlock all features.
                            </p>

                            <div id="auth-error-message" style="color: var(--danger); margin-bottom: 10px; text-align: center; font-weight: bold;"></div>

                            <div class="input-group" id="name-input-group">
                                <i class="fa-solid fa-user"></i>
                                <input type="text" id="auth-name" placeholder="Your Name" required>
                            </div>
                            <div class="input-group">
                                <i class="fa-solid fa-at"></i>
                                <input type="email" id="auth-email" placeholder="Email Address" required>
                            </div>
                            <div class="input-group">
                                <i class="fa-solid fa-lock"></i>
                                <input type="password" id="auth-password" placeholder="Password (min. 6 characters)" required minlength="6"> <!-- Added minlength -->
                            </div>

                            <!-- Additional fields for sign-up, hidden during login -->
                            <div id="signup-fields-container">
                                <div class="input-group">
                                    <i class="fa-solid fa-mobile-screen"></i>
                                    <input type="tel" id="auth-mobile" placeholder="Mobile Number (Optional)">
                                </div>
                                <div class="input-group">
                                    <i class="fa-solid fa-location-dot"></i>
                                    <textarea id="auth-address" placeholder="Address (Optional)" rows="2"></textarea>
                                </div>
                                <div class="input-group">
                                    <i class="fa-solid fa-map"></i>
                                    <select id="auth-state">
                                        <option value="">-- Select State (Optional) --</option>
                                        ${stateOptions}
                                    </select>
                                </div>
                                <div class="input-group">
                                    <i class="fa-solid fa-globe"></i>
                                    <input type="text" id="auth-country" value="India" placeholder="Country (Optional)">
                                </div>
                            </div>

                            <button type="submit" id="auth-submit-button" class="btn btn-primary" style="width:100%; margin-top:15px;">Create Account</button>

                            <div class="login-skip-link" id="auth-mode-toggle" style="margin-top:15px; text-align:center;">
                                Already have an account? <a href="#" onclick="event.preventDefault(); window.toggleAuthMode(true);">Login</a> <!-- Use window. -->
                            </div>
                            <!-- <<<--- CHANGE: "Skip for now" link removed from here ---<<< -->
                        </form>
                    </div>`;
            } else { console.warn("DEBUG_MERGE: Login Screen element not found."); }


            // Render HTML for the Home Screen
            const homeScreenElement = document.getElementById('home-screen');
            if (homeScreenElement) {
                console.log("DEBUG_MERGE: Rendering Home Screen HTML.");
                homeScreenElement.innerHTML = `
                    <header class="app-header">
                        <div class="header-icon" onclick="window.toggleMenu()"><i class="fa-solid fa-bars"></i></div> <!-- Use window. -->
                        <h1 class="app-title">Conceptra</h1>
                        <div class="user-profile-area">
                             <span id="c-coin-balance" style="font-size: 0.9rem; color: var(--text-color); white-space: nowrap;">C-Coins: 0</span>
                             <!-- User profile icon opens menu -->
                             <div class="header-icon" id="user-profile-icon" style="font-size: 1.8rem; padding-bottom: 3px; cursor:pointer;">🧑‍🎓</div>
                        </div>
                    </header>
                    <main class="main-content">
                         <!-- Image Slider -->
                        <div class="slider-container">
                            <div class="slider-wrapper"></div>
                            <div class="slider-pagination"></div>
                        </div>
                         <!-- Main grid cards for features -->
                        <div class="home-grid-container">
                            <div class="home-content-card" onclick="window.showCompetitiveExamPage()"> <!-- Use window. -->
                                <div class="home-card-image"><img src="https://images.unsplash.com/photo-1599409355995-1f654a154854?auto=format&fit=crop&q=60&w=400&h=200" alt="Competitive Exams"></div> <!-- Added w/h -->
                                <div class="home-card-info"><h3>Competitive Exams</h3><button class="btn-start-mini">Start <i class="fa-solid fa-arrow-right"></i></button></div>
                            </div>
                            <div class="home-content-card" onclick="window.showTeacherSection()"> <!-- Use window. -->
                                <div class="home-card-image"><img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=60&w=400&h=200" alt="Test Practice"></div> <!-- Added w/h -->
                                <div class="home-card-info"><h3>All India Tests</h3><p style="font-size:0.8em; color:var(--text-muted-color);">Teacher created tests</p><button class="btn-start-mini">Explore <i class="fa-solid fa-arrow-right"></i></button></div> <!-- Added description -->
                            </div>
                        </div>
                        <div style="text-align:center; padding: 20px 0 0;"><h2 style="color: var(--text-muted-color); font-size: 1rem;">Explore Learning Tools</h2></div> <!-- Updated text -->
                    </main>
                    <nav class="bottom-nav">
                         <!-- Bottom navigation links -->
                         <!-- Use window. for onclick handlers -->
                        <div class="nav-item" onclick="window.showStudyPlanner()"><i class="fa-solid fa-calendar-check icon-planner"></i><span class="nav-text"><span>S</span>tudy Planner</span></div>
                        <div class="nav-item" onclick="window.showFlashcards()"><i class="fa-solid fa-layer-group icon-flashcard"></i><span class="nav-text"><span>F</span>lashcard</span></div>
                        <div class="nav-item" onclick="window.showInsightAI()"><i class="fa-solid fa-brain icon-ai"></i><span class="nav-text"><span>I</span>nsight AI</span></div>
                        <div class="nav-item" onclick="window.showStickyNotes()"><i class="fa-solid fa-note-sticky icon-notes"></i><span class="nav-text"><span>N</span>otes</span></div>
                        <div class="nav-item" onclick="window.showWatchVideo()"><i class="fa-solid fa-circle-play icon-video"></i><span class="nav-text"><span>E</span>xplore Video</span></div>
                    </nav>
                `;
            } else { console.warn("DEBUG_MERGE: Home Screen element not found."); }


            // Render HTML for the Side Menu
            const sideMenuElement = document.getElementById('side-menu');
            if (sideMenuElement) {
                console.log("DEBUG_MERGE: Rendering Side Menu HTML.");
                sideMenuElement.innerHTML = `
                    <div class="menu-header">
                        <div class="header-icon" onclick="window.toggleMenu(false)"><i class="fa-solid fa-arrow-left"></i></div> <!-- Use window. -->
                        <h3>Menu</h3>
                    </div>
                    <ul class="menu-options">
                         <!-- Use window. for onclick handlers -->
                        <li onclick="window.showFeedbackPage()"><i class="fa-solid fa-comment-dots"></i> Feedback</li>
                        <li onclick="window.showCountdown()"><i class="fa-solid fa-stopwatch-20"></i> Countdown</li>
                        <li onclick="window.showSelfQuiz()"><i class="fa-solid fa-question-circle"></i> Self Quiz</li>
                        <li onclick="window.showSelfProgress()"><i class="fa-solid fa-chart-line"></i> Progress</li>
                        <li onclick="window.showOmrPractice()"><i class="fa-solid fa-list-check"></i> OMR Practice</li>
                        <li onclick="window.showBrainGames()"><i class="fa-solid fa-puzzle-piece"></i> Brain Games</li>
                        <li onclick="window.openThemeSettingsFromSideMenu()"><i class="fa-solid fa-palette"></i> Theme</li>
                        <li onclick="window.showPrivacyPolicyPage()"><i class="fa-solid fa-shield-halved"></i> Privacy Policy</li>
                        <li onclick="window.showTermsAndConditionsPage()"><i class="fa-solid fa-file-contract"></i> Terms and Conditions</li>
                    </ul>`;
            } else { console.warn("DEBUG_MERGE: Side Menu element not found."); }


            // Render HTML for the Safety Modal
            const safetyModalElement = document.getElementById('safety-modal');
            if (safetyModalElement) {
                console.log("DEBUG_MERGE: Rendering Safety Modal HTML.");
                safetyModalElement.innerHTML = `<div class="modal-content"><div class="modal-header-deco"><div class="modal-icon"><i class="fa-solid fa-shield-halved"></i></div></div><div class="modal-body"><h3>Your Information is Safe</h3><p style="margin: 10px 0;">We request this information to enhance your app experience and for safety purposes. Sharing is optional, but some features require login.</p><div style="display:flex; gap:10px; margin-top:20px;"><button class="btn" style="flex:1; background-color: #ddd; color:#333;" onclick="window.continueToApp(true)">Skip</button><button class="btn btn-primary" style="flex:1" onclick="window.proceedToLogin()">Login / Sign Up</button></div></div></div>`; // Use window., improved text
            } else { console.warn("DEBUG_MERGE: Safety Modal element not found."); }


            // Render HTML for the Settings Panel (Theme Settings)
            const settingsPanelElement = document.getElementById('settings-panel');
            if (settingsPanelElement) {
                 console.log("DEBUG_MERGE: Rendering Settings Panel HTML.");
                settingsPanelElement.innerHTML = `
                    <div class="settings-content">
                        <div class="modal-header">
                            <i class="fa-solid fa-arrow-left header-icon" style="width:auto;" onclick="window.closeSettingsModal()"></i> <!-- Use window. -->
                            <h3>Theme & Settings</h3>
                        </div>
                        <ul class="settings-list" style="padding:0; margin:0;">
                                <li style="border-top:none;">
                                    <div class="item-content"><i class="fa-solid fa-moon"></i> Dark Mode</div>
                                    <!-- Use window.toggleDarkMode -->
                                    <label class="switch"><input type="checkbox" id="dark-mode-checkbox" onchange="window.toggleDarkMode()"><span class="slider"></span></label>
                                </li>
                            </ul>
                        <div class="theme-section">
                            <h4>Basic Colors</h4><div class="theme-grid" id="basic-colors"></div>
                            <h4>Neon Colors</h4><div class="theme-grid" id="neon-colors"></div>
                             <!-- Use window.setDefaultTheme -->
                            <button class="btn" style="width:100%; margin-top: 15px;" onclick="window.setDefaultTheme()">Reset to Default Theme</button>
                        </div>
                    </div>`;
            } else { console.warn("DEBUG_MERGE: Settings Panel element not found."); }


            // Render HTML for the AI Feature Screen (Insight AI)
            // This structure needs to accommodate all individual AI features (Ask Doubt, Notes, etc.)
            // It should include navigation/tabs to switch between them and containers for their inputs/outputs.
            const insightAiScreenElement = document.getElementById('insight-ai-screen');
             if (insightAiScreenElement) {
                  console.log("DEBUG_MERGE: Rendering Insight AI Screen HTML.");
                  // This is a simplified structure. You'll need to add the full HTML for
                  // Ask Doubt, Notes, MCQ, etc., inputs and output areas within .main-content.
                  // Use IDs like 'ask-doubt-section', 'generate-notes-section', etc.,
                  // and containers like 'ai-response-container', 'notes-output-container' as expected by the handlers.
                  insightAiScreenElement.innerHTML = `
                      <header class="app-header">
                          <div class="header-icon" onclick="showScreen('home-screen', true)"><i class="fa-solid fa-arrow-left"></i></div>
                          <h1 class="app-title"><i class="fa-solid fa-brain"></i> Insight AI</h1>
                          <div class="header-icon"></div> <!-- Placeholder -->
                      </header>
                      <main class="main-content" style="padding: 0;">
                           <!-- AI Feature Navigation/Tabs (Example Structure) -->
                           <div class="ai-feature-nav" style="overflow-x: auto; white-space: nowrap; padding: 10px 15px; border-bottom: 1px solid var(--border-color);">
                                <!-- Use window.showAiFeatureSection -->
                               <button class="btn ai-nav-btn active" onclick="window.showAiFeatureSection('ask-doubt-section')">Ask Doubt</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('generate-notes-section')">Generate Notes</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('mcq-practice-section')">Practice MCQs</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('solved-examples-section')">Solved Examples</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('career-advice-section')">Career Advice</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('study-plan-section')">Study Plan</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('flashcards-section')">Flashcards</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('essay-writer-section')">Write Essay</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('presentation-maker-section')">Presentation Maker</button>
                               <button class="btn ai-nav-btn" onclick="window.showAiFeatureSection('concept-explainer-section')">Explain Concept</button>
                           </div>

                           <!-- Containers for each AI Feature's UI -->
                           <div class="ai-feature-content-area" style="padding: 15px;">

                                <!-- Ask Doubt Section -->
                               <section id="ask-doubt-section" class="ai-feature-section">
                                    <h3 class="section-title">Ask Doubt (Image/Text)</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-question"></i><textarea id="doubt-input" placeholder="Ask your doubt here..." rows="3"></textarea></div>
                                          <div class="input-group file-input-group"><i class="fa-solid fa-image"></i><input type="file" id="doubt-image-input" accept="image/*"><label for="doubt-image-input">Upload Image</label><span id="file-name-display"></span></div>
                                          <button id="ask-doubt-submit" class="btn btn-primary" style="width:100%;">Get Answer</button>
                                     </div>
                                     <!-- Output container for this feature -->
                                     <div id="ai-response-container" class="ai-response-container" style="margin-top: 20px; display: none;">
                                          <div id="ai-response" class="ai-response"></div> <!-- The element where content is rendered -->
                                     </div>
                               </section>

                               <!-- Generate Notes Section -->
                               <section id="generate-notes-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Generate Notes</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-book-open"></i><input type="text" id="notes-topic-input" placeholder="Enter topic..."></div>
                                          <div class="option-selector-group" style="margin-bottom: 15px;">
                                               <label><input type="radio" name="note-length" value="short" checked> Short Notes</label>
                                               <label><input type="radio" name="note-length" value="long"> Detailed Notes</label>
                                          </div>
                                          <button id="generate-notes-submit" class="btn btn-primary" style="width:100%;">Generate Notes</button>
                                     </div>
                                      <!-- Output container for this feature -->
                                     <div id="notes-output-container" class="notes-output-container ai-response-container" style="margin-top: 20px; display: none;"></div>
                               </section>

                               <!-- Practice MCQs Section -->
                               <section id="mcq-practice-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Practice MCQs</h3>
                                     <div id="mcq-setup-view">
                                          <div class="info-form">
                                               <div class="input-group"><i class="fa-solid fa-book-quran"></i><input type="text" id="mcq-topic-input" placeholder="Enter topic..."></div>
                                               <div class="option-selector-group" style="margin-bottom: 15px;">
                                                    <label><input type="radio" name="mcq-count" value="5"> 5 Qs</label>
                                                    <label><input type="radio" name="mcq-count" value="10" checked> 10 Qs</label>
                                                    <label><input type="radio" name="mcq-count" value="custom"> Custom</label>
                                                    <input type="number" id="mcq-custom-count" class="custom-count-input" placeholder="Count" disabled min="1">
                                               </div>
                                               <button id="start-quiz-btn" class="btn btn-primary" style="width:100%;">Start Quiz</button>
                                          </div>
                                     </div>
                                     <div id="mcq-quiz-view" style="display: none;">
                                          <h4 id="quiz-topic-title" style="text-align: center; margin-bottom: 15px;"></h4>
                                          <div id="quiz-container"></div> <!-- Quiz questions rendered here -->
                                          <div style="text-align: center; margin-top: 20px;">
                                               <button id="submit-quiz-btn" class="btn btn-primary" style="display: none;">Submit Quiz</button>
                                               <div id="post-quiz-options" style="display: none;">
                                                    <div id="quiz-result" style="margin-bottom: 15px;"></div>
                                                    <div id="quiz-analysis-report" style="margin-top: 15px;"></div>
                                                    <button id="retake-quiz-btn" class="btn btn-secondary" style="margin-top: 20px;">Retake Quiz</button>
                                               </div>
                                          </div>
                                     </div>
                               </section>

                               <!-- Get Solved Examples Section -->
                               <section id="solved-examples-section" class="ai-feature-section" style="display: none;">
                                   <h3 class="section-title">Get Solved Examples</h3>
                                    <div class="info-form">
                                         <div class="input-group"><i class="fa-solid fa-lightbulb"></i><input type="text" id="solved-notes-topic-input" placeholder="Enter topic (e.g., Quadratic Equations)"></div>
                                         <div class="option-selector-group" style="margin-bottom: 15px;">
                                              <label><input type="radio" name="solved-notes-count" value="1"> 1 Example</label>
                                              <label><input type="radio" name="solved-notes-count" value="3" checked> 3 Examples</label>
                                              <label><input type="radio" name="solved-notes-count" value="5"> 5 Examples</label>
                                              <label><input type="radio" name="solved-notes-count" value="custom"> Custom</label>
                                              <input type="number" id="solved-notes-custom-count" class="custom-count-input" placeholder="Count" disabled min="1">
                                         </div>
                                         <button id="get-solved-notes-btn" class="btn btn-primary" style="width:100%;">Get Examples</button>
                                    </div>
                                    <!-- Output container for this feature -->
                                    <div id="solved-notes-response-container" class="ai-response-container" style="margin-top: 20px; display: none;"></div>
                               </section>

                               <!-- Get Career Advice Section -->
                               <section id="career-advice-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Get Career Advice</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-briefcase"></i><textarea id="career-interests-input" placeholder="Tell me about your interests, skills, and goals..." rows="3"></textarea></div>
                                          <button id="get-career-advice-btn" class="btn btn-primary" style="width:100%;">Get Career Advice</button>
                                     </div>
                                      <!-- Output container for this feature -->
                                     <div id="career-response-container" class="ai-response-container" style="margin-top: 20px; display: none;">
                                          <div id="career-paginated-content"></div> <!-- Content goes here -->
                                          <div id="career-pagination-controls" class="pagination-controls" style="text-align: center; margin-top: 15px;"></div> <!-- Pagination buttons -->
                                     </div>
                               </section>

                               <!-- Generate Study Plan Section -->
                               <section id="study-plan-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Generate Study Plan</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-calendar-day"></i><textarea id="study-plan-details-input" placeholder="Enter details: Topic, time available, learning style, goal (e.g., ace exam)..." rows="3"></textarea></div>
                                          <button id="generate-study-plan-btn" class="btn btn-primary" style="width:100%;">Create My Plan</button>
                                     </div>
                                     <!-- Output container for this feature -->
                                     <div id="study-plan-response-container" class="ai-response-container" style="margin-top: 20px; display: none;">
                                          <div id="study-plan-paginated-content"></div> <!-- Content goes here -->
                                          <div id="study-plan-pagination-controls" class="pagination-controls" style="text-align: center; margin-top: 15px;"></div> <!-- Pagination buttons -->
                                     </div>
                               </section>

                               <!-- Generate Flashcards Section -->
                               <section id="flashcards-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Generate Flashcards</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-layer-group"></i><input type="text" id="flashcard-topic-input" placeholder="Enter topic (e.g., Photosynthesis)"></div>
                                         <div class="option-selector-group" style="margin-bottom: 15px;">
                                              <label><input type="radio" name="flashcard-count" value="5"> 5 Cards</label>
                                              <label><input type="radio" name="flashcard-count" value="10" checked> 10 Cards</label>
                                              <label><input type="radio" name="flashcard-count" value="custom"> Custom</label>
                                              <input type="number" id="flashcard-custom-count" class="custom-count-input" placeholder="Count" disabled min="1">
                                         </div>
                                          <button id="generate-flashcards-btn" class="btn btn-primary" style="width:100%;">Create Flashcards</button>
                                     </div>
                                      <!-- Output container for this feature -->
                                     <div id="flashcard-response-container" class="ai-response-container" style="margin-top: 20px; display: none;"></div>
                               </section>

                               <!-- Write Essay Section -->
                               <section id="essay-writer-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Write Essay</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-file-lines"></i><input type="text" id="essay-topic-input" placeholder="Enter essay topic..."></div>
                                          <button id="write-essay-btn" class="btn btn-primary" style="width:100%;">Write Essay</button>
                                     </div>
                                      <!-- Output container for this feature -->
                                     <div id="essay-writer-response-container" class="ai-response-container" style="margin-top: 20px; display: none;"></div>
                               </section>

                               <!-- Create Presentation Section -->
                               <section id="presentation-maker-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Create Presentation</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-chalkboard"></i><input type="text" id="presentation-topic-input" placeholder="Enter presentation topic..."></div>
                                          <button id="create-presentation-btn" class="btn btn-primary" style="width:100%;">Create Presentation Outline</button>
                                     </div>
                                      <!-- Output container for this feature -->
                                     <div id="presentation-maker-response-container" class="ai-response-container" style="margin-top: 20px; display: none;"></div>
                               </section>

                               <!-- Get Explanation Section -->
                               <section id="concept-explainer-section" class="ai-feature-section" style="display: none;">
                                    <h3 class="section-title">Explain Concept</h3>
                                     <div class="info-form">
                                          <div class="input-group"><i class="fa-solid fa-lightbulb-o"></i><input type="text" id="concept-input" placeholder="Enter concept (e.g., Photosynthesis)"></div>
                                          <button id="get-explanation-btn" class="btn btn-primary" style="width:100%;">Get Explanation</button>
                                     </div>
                                      <!-- Output container for this feature -->
                                     <div id="concept-output-container" class="ai-response-container" style="margin-top: 20px; display: none;"></div>
                               </section>

                           </div>
                      </main>`;
             } else { console.warn("DEBUG_MERGE: Insight AI Screen element not found."); }


            // Render HTML for other static screens if they haven't been rendered by their init functions
            // OMR Practice Screen HTML is rendered within its init function now.
            // Flashcard Screen HTML is assumed to be in index.html and its sub-elements are managed by init.
            // Sticky Note Screen HTML is rendered within its init function now.
            // Study Planner Screen HTML is rendered within its init function now.
            // Self Progress Screen HTML is rendered within its init function now.
            // Watch Video Screen HTML is rendered within its init function now.
            // Competitive Exam Page HTML is rendered within its init function now.
            // Teacher List Page HTML is rendered within its init function now.
            // Teacher Content Page HTML is assumed to be in index.html and content rendered by function.
            // Create Test Page HTML is rendered within its function now.
            // Exam Quiz Page HTML is assumed to be in index.html and content rendered by start test functions.
            // Exam Result Page HTML is assumed to be in index.html and content rendered by finish test functions.
            // Comments Screen HTML is rendered within its openCommentsPage function now.

             // Render Premium Package Screen HTML (if not already in index.html)
             // This was already included in the original New File.js initApp
             const premiumPackageScreenHTML = `
                 <div class="page" id="premium-package-screen">
                     <header class="app-header">
                         <div class="header-icon" onclick="showScreen('home-screen', true)">
                             <i class="fa-solid fa-arrow-left"></i>
                         </div>
                         <h1 class="app-title">Premium Packages</h1>
                         <div class="header-icon" style="width: 40px;"></div>
                     </header>
                     <main class="main-content" style="padding: 10px;">
                         <div id="premium-package-swiper-wrapper" class="premium-package-swiper-wrapper">
                             <!-- Cards will be injected here by renderPremiumPackages -->
                         </div>
                         <div id="premium-package-pagination" class="premium-package-pagination">
                             <!-- Dots will be injected here by renderPremiumPackages -->
                         </div>
                     </main>
                 </div>`;
             if (!document.getElementById('premium-package-screen')) {
                 console.log("DEBUG_MERGE: Injecting Premium Package Screen HTML.");
                 document.body.insertAdjacentHTML('beforeend', premiumPackageScreenHTML);
             } else { console.log("DEBUG_MERGE: Premium Package Screen element found."); }


             // Render User Profile Menu HTML (if not already in index.html)
             // This was also in the original New File.js initApp
             const userProfileMenuHTML = `
                 <div id="user-profile-menu-overlay" class="modal-overlay">
                     <div id="user-profile-menu" class="user-profile-menu-content">
                         <ul class="settings-list" style="margin:0;">
                             <li onclick="window.editUserProfile()"> <!-- Use window. -->
                                 <i class="fa-solid fa-user-pen"></i> Profile Edit
                             </li>
                             <li onclick="window.showPremiumPackagesScreen()"> <!-- Use window. -->
                                 <i class="fa-solid fa-star"></i> Premium Package
                             </li>
                             <li onclick="window.logOutUser()"> <!-- Use window. -->
                                 <i class="fa-solid fa-right-from-bracket"></i> Log Out
                             </li>
                         </ul>
                     </div>
                 </div>`;
             if (!document.getElementById('user-profile-menu-overlay')) {
                 console.log("DEBUG_MERGE: Injecting User Profile Menu HTML.");
                 document.body.insertAdjacentHTML('beforeend', userProfileMenuHTML);
             } else { console.log("DEBUG_MERGE: User Profile Menu element found."); }


            // Add event listeners for global elements (User Profile Icon, Overlays) after HTML is ensured
            const userProfileIcon = document.getElementById('user-profile-icon');
            if (userProfileIcon) {
                 userProfileIcon.addEventListener('click', window.toggleUserProfileMenu); // Use window.
                 console.log("DEBUG_MERGE: User profile icon listener attached.");
            } else { console.warn("DEBUG_MERGE: User profile icon not found."); }
            const userProfileMenuOverlayElement = document.getElementById('user-profile-menu-overlay');
            if (userProfileMenuOverlayElement) {
                userProfileMenuOverlayElement.addEventListener('click', function(event) {
                     // Close menu if clicking directly on the overlay
                    if (event.target === userProfileMenuOverlayElement) {
                        window.closeUserProfileMenu(); // Use window.
                    }
                });
                 console.log("DEBUG_MERGE: User profile menu overlay listener attached.");
            } else { console.warn("DEBUG_MERGE: User profile menu overlay not found."); }

             // Event listener for the main menu overlay
             const menuOverlay = document.getElementById('menu-overlay');
             if (menuOverlay) {
                 menuOverlay.addEventListener('click', function(event) {
                     if (event.target === menuOverlay) {
                          window.toggleMenu(false); // Close menu if clicking directly on the overlay
                     }
                 });
                  console.log("DEBUG_MERGE: Main menu overlay listener attached.");
             } else { console.warn("DEBUG_MERGE: Main menu overlay not found."); }

             // Event listener for the settings overlay
             const settingsOverlay = document.getElementById('settings-overlay');
             if (settingsOverlay) {
                 settingsOverlay.addEventListener('click', function(event) {
                     if (event.target === settingsOverlay) {
                          window.closeSettingsModal(); // Close modal if clicking directly on the overlay
                     }
                 });
                  console.log("DEBUG_MERGE: Settings overlay listener attached.");
             } else { console.warn("DEBUG_MERGE: Settings overlay not found."); }


            // Populate theme swatches and load saved theme/dark mode settings
            populateThemeSwatches(); // Populates the grid with color options
            loadTheme(); // Loads theme/dark mode from localStorage


            // Determine the initial screen to show based on visit history and auth state
            console.log("DEBUG_MERGE: initApp: Checking for 'conceptra-visited' in localStorage.");
            const hasVisited = loadFromStorage('conceptra-visited');
            if (!hasVisited) {
                console.log("DEBUG_MERGE: initApp: First time visit. Showing splash-screen.");
                showScreen('splash-screen'); // This sets the global activePage initially
                // Start the timer to transition from splash
                splashTimer = setTimeout(window.transitionFromSplash, 4500); // 4.5 seconds splash duration, Use window.
            } else {
                console.log("DEBUG_MERGE: initApp: Not a first time visit. Hiding splash, proceeding to continueToApp.");
                 // Hide the splash screen immediately if not first visit
                const splashScreenToHide = document.getElementById('splash-screen');
                if (splashScreenToHide) {
                     splashScreenToHide.style.display = 'none';
                     // Clear any potential residual splash timer if it somehow wasn't cleared
                     clearTimeout(splashTimer);
                }
                // Set activePage conceptually to home for consistency if not showing splash
                activePage = 'home-screen';
                // Proceed to check auth state and show appropriate screen (home or login)
                window.continueToApp(true); // Use window., true means skip safety modal this time
            }

            // Initialize all major features. Their init functions should handle
            // finding their respective DOM elements *after* they've been rendered
            // by the initApp function (or are already in index.html).
            // Calling them here ensures their internal state and listeners are set up
            // regardless of which screen is shown first.
            initFlashcardFeature();
            initStickyNoteFeature();
            initStudyPlannerFeature();
            initSelfProgressFeature();
            initWatchVideoFeature();
            initOmrPracticeFeature();
            initBrainGamesFeature();
            initCompetitiveExamFeature();
            initImageSlider(); // Should initialize the slider on the home screen

            // Set initial auth mode for the login-screen (default to sign-up)
            // This ensures the login screen shows the correct form if/when it's navigated to.
            isLoginMode = false;
            window.toggleAuthMode(isLoginMode); // Use window.
            console.log("DEBUG_MERGE: initApp finished. Initial isLoginMode:", isLoginMode);
        }
        // --- End App Initialization ---

        // --- Splash Screen Transition Logic ---
        // This logic handles transitioning from the splash screen after a delay or skip.
        window.skipSplash = function() { // Make globally accessible
            console.log("DEBUG_MERGE: skipSplash called.");
            clearTimeout(splashTimer); // Clear the auto-transition timer
            window.transitionFromSplash(); // Use window.
        }

        window.transitionFromSplash = function() { // Make globally accessible
            console.log("DEBUG_MERGE: transitionFromSplash called.");
             // Hide the splash screen with a fade out effect
            const splashScreenElement = document.getElementById('splash-screen');
            if (splashScreenElement) {
                splashScreenElement.style.opacity = '0'; // Start fade out
                // Wait for fade out to complete, then hide element and continue
                setTimeout(() => {
                     splashScreenElement.style.display = 'none';
                     // Continue to the main app logic (check auth state, show home/login)
                     window.continueToApp(false); // Use window., false means safety modal might be needed
                }, 500); // Match CSS transition duration
            } else {
                 console.warn("DEBUG_MERGE: Splash screen element not found for transition.");
                 // If splash screen isn't found, just continue to the app directly
                 window.continueToApp(false); // Use window.
            }
        }
        // --- End Splash Screen Transition Logic ---


        // --- Main App Continuation Logic ---
        // This function is called after splash screen to determine the first functional screen.
        window.continueToApp = function(skippedSafety = false) { // Make globally accessible
            console.log(`DEBUG_MERGE: continueToApp called. skippedSafety: ${skippedSafety}, authStateLoaded: ${authStateLoaded}`);
             // Close the safety modal if it's open
            window.closeSafetyModal(); // Use window.

            // Define a function to proceed once auth state is confirmed loaded
            function proceed() {
                console.log("DEBUG_MERGE: continueToApp -> proceed() called. authStateLoaded is TRUE.");
                 // Check if it's genuinely the first visit based on storage flag
                const firstTimeUser = !loadFromStorage('conceptra-visited');
                console.log("DEBUG_MERGE: continueToApp -> proceed(): firstTimeUser:", firstTimeUser);

                // Logic: If first time visit AND safety was not skipped, show safety modal.
                // Otherwise (not first time OR safety was skipped), check login status and show home or login.
                if (firstTimeUser && !skippedSafety) {
                    console.log("DEBUG_MERGE: continueToApp -> proceed(): First time user and safety modal not skipped. Showing safety modal.");
                    window.showSafetyModal(); // Use window.
                    saveToStorage('conceptra-visited', true); // Mark as visited after showing modal
                } else {
                     console.log("DEBUG_MERGE: continueToApp -> proceed(): Not first time OR safety modal skipped. Checking auth.currentUser.");
                     // Use the globally managed auth object
                    if (!auth.currentUser) {
                        console.log("DEBUG_MERGE: continueToApp -> proceed(): No Firebase user (auth.currentUser is null). Showing login-screen.");
                        // Set to Sign Up / Information Collection mode
                        isLoginMode = false;
                        window.toggleAuthMode(isLoginMode); // Use window., Update the auth form UI
                        window.showScreen('login-screen'); // Use window., This sets the global activePage
                    } else {
                        console.log("DEBUG_MERGE: continueToApp -> proceed(): Firebase user exists (UID:", auth.currentUser.uid,"). Showing home-screen.");
                        window.showScreen('home-screen'); // Use window., This sets the global activePage
                    }
                }
            }

            // Wait for the Firebase Auth state to be loaded before proceeding
            // The onAuthStateChanged listener sets authStateLoaded to true.
            if (authStateLoaded) {
                proceed(); // If auth state is already loaded, proceed immediately
            } else {
                // If auth state is not yet loaded, wait for it.
                // Use a small polling mechanism (interval) to check authStateLoaded.
                // This is a fallback in case the onAuthStateChanged listener hasn't fired yet.
                console.warn("DEBUG_MERGE: continueToApp: authStateLoaded is FALSE. Waiting for onAuthStateChanged...");
                let retries = 0;
                const maxRetries = 20; // Max retries (e.g., 20 * 100ms = 2 seconds)
                const intervalId = setInterval(() => {
                    retries++;
                    // Check authStateLoaded again
                    if (authStateLoaded) {
                        console.log(`DEBUG_MERGE: continueToApp: authStateLoaded became TRUE after retry ${retries}. Proceeding.`);
                        clearInterval(intervalId); // Stop polling
                        proceed(); // Proceed now that auth state is known
                    } else if (retries >= maxRetries) {
                        console.error("DEBUG_MERGE: continueToApp: authStateLoaded did NOT become true after max retries. App might be stuck or Firebase Init failed. Forcing proceed (may show login if user is null).");
                        clearInterval(intervalId); // Stop polling
                        proceed(); // Proceed anyway as a fallback, state might be null
                    } else {
                         // console.log(`DEBUG_MERGE: continueToApp: Retry ${retries}/${maxRetries}. Waiting...`); // Too chatty
                    }
                }, 100); // Check every 100 milliseconds
            }
             console.log("DEBUG_MERGE: continueToApp finished (waiting for authStateLoaded if needed).");
        }
        // --- End Main App Continuation Logic ---


        // --- Call initApp to start the application ---
        // This is the entry point of the DOMContentLoaded handler
        initApp();
        // --- END Call initApp ---
});
