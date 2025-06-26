// static/script_v2.js

// --- START: FIREBASE SDK v9 IMPORTS ---
// यह सुनिश्चित करता है कि हम Firebase के नवीनतम (v9) तरीके का उपयोग कर रहे हैं।
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, getIdToken } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
// --- END: FIREBASE SDK v9 IMPORTS ---

// --- FIREBASE SETUP (using v9) ---
// यह वही firebaseConfig है जो आपके मुख्य ऐप (New File.js) में इस्तेमाल हो रहा है।
// यह सुनिश्चित करता है कि दोनों स्क्रिप्ट एक ही Firebase प्रोजेक्ट से जुड़ें।
const firebaseConfig = {
  apiKey: "AIzaSyBKsycaVUdBKZMLIRhP3tkC36786MJFyq4", // <<<--- आपके New File.js से API Key
  authDomain: "conceptra-c1000.firebaseapp.com",
  databaseURL: "https://conceptra-c1000-default-rtdb.firebaseio.com",
  projectId: "conceptra-c1000",
  storageBucket: "conceptra-c1000.appspot.com", // <<<--- आपके New File.js से storageBucket
  messagingSenderId: "298402987968",
  appId: "1:298402987968:web:c0d0d7d6c08cdfa6bc5225",
  measurementId: "G-QRQYEVSJJ6"
};

// Firebase v9 को शुरू करें।
// हमने इसे "InsightAIFirebaseApp" नाम दिया है ताकि अगर आपके मुख्य ऐप में पहले से ही
// डिफ़ॉल्ट नाम से Firebase शुरू हो चुका है, तो कोई टकराव न हो।
const insightAIApp = initializeApp(firebaseConfig, "InsightAIFirebaseApp");
const insightAIAuth = getAuth(insightAIApp); // v9 प्रमाणीकरण (auth) इंस्टैंस
// --- END: FIREBASE SETUP (using v9) ---


// --- WELCOME SCREEN LOGIC ---
// इस हिस्से में कोई बदलाव नहीं किया गया है क्योंकि यह पहले से सही था।
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) {
                 appContainer.style.display = 'block';
                 setTimeout(() => appContainer.style.opacity = '1', 50);
            }
        }, 500);
    }, 3500);
});


// --- NAVIGATION LOGIC ---
// इस हिस्से में कोई बदलाव नहीं किया गया है।
function navigateTo(screenId) {
    document.querySelectorAll('.app-container .screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    window.scrollTo(0, 0);
}


// --- AI CONTENT RENDERER ---
// इस हिस्से में कोई बदलाव नहीं किया गया है।
async function renderEnhancedAIContent(element, content) {
    if (!element) return;
    
    let processedContent = content.replace(/\[chem\](.*?)\[\/chem\]/g, '<span class="chem-reaction">$1</span>');

    const htmlContent = marked.parse(processedContent);
    element.innerHTML = htmlContent;

    const highlightColors = ['highlight-yellow', 'highlight-skyblue', 'highlight-pink'];
    
    element.querySelectorAll('strong').forEach((strongEl) => {
        const randomColorClass = highlightColors[Math.floor(Math.random() * highlightColors.length)];
        strongEl.classList.add(randomColorClass);
    });

    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        try {
            await window.MathJax.typesetPromise([element]);
        } catch (err) {
            console.error('MathJax rendering failed:', err);
        }
    }
}


// --- TYPEWRITER EFFECT FUNCTION ---
// इस हिस्से में कोई बदलाव नहीं किया गया है।
async function typewriterEffect(element, text, onComplete) {
    let i = 0;
    element.innerHTML = "";
    const speed = 15;

    function type() {
        if (i < text.length) {
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
            element.scrollTop = element.scrollHeight;
            setTimeout(type, speed);
        } else if (onComplete) {
            onComplete();
        }
    }
    type();
}


// --- HELPER FUNCTION FOR API REQUESTS (Firebase v9 Auth के लिए अपडेट किया गया) ---
async function handleApiRequest(button, container, responseDiv, url, getBody) {
    const body = getBody();
    if (!body) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Generating...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';

    try {
        const user = insightAIAuth.currentUser; // <<<--- बदला हुआ: v9 auth इंस्टैंस का उपयोग करें
        const headers = { 'Content-Type': 'application/json' };
        
        if (user) {
            try {
                // Firebase v9: getIdToken को सीधे कॉल करें, यूजर ऑब्जेक्ट को पहले आर्गुमेंट के रूप में पास करें
                const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ: v9 getIdToken
                headers['Authorization'] = 'Bearer ' + idTokenString;
            } catch (tokenError) {
                console.error('Firebase ID टोकन प्राप्त करने में त्रुटि (v9):', tokenError);
                // अगर टोकन प्राप्त करने में त्रुटि होती है, तो एक विशिष्ट त्रुटि फेंकें
                throw new Error(`प्रमाणीकरण टोकन त्रुटि: ${tokenError.message}. कृपया पुनः लॉग इन करने का प्रयास करें।`);
            }
        }
        // अगर 'user' null है (यानी यूजर लॉग इन नहीं है), तो 'Authorization' हेडर नहीं जोड़ा जाएगा।
        // सर्वर तब सही ढंग से "प्रमाणीकरण विफल" के साथ प्रतिक्रिया देगा।

        const response = await fetch(url, { // Python सर्वर का URL यहाँ कॉलर द्वारा उपयोग किया जाएगा
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            // सर्वर से आए एरर मैसेज को प्राथमिकता दें, या एक सामान्य मैसेज दिखाएँ
            let errorMessage = `सर्वर त्रुटि: ${response.status}`;
            if (data && data.error) {
                errorMessage = data.error; // सर्वर द्वारा भेजा गया विशिष्ट एरर
            } else if (response.statusText) {
                errorMessage = response.statusText;
            }
            throw new Error(errorMessage);
        }
        
        const key = Object.keys(data)[0];
        const fullText = data[key] || "कोई सामग्री प्राप्त नहीं हुई।";
        await renderEnhancedAIContent(responseDiv, fullText);

    } catch (error) {
        // सुनिश्चित करें कि एरर का मैसेज दिखाया जाए
        responseDiv.innerHTML = `<p style="color: var(--color-red);">क्षमा करें, एक त्रुटि हुई: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}
// --- END: HELPER FUNCTION FOR API REQUESTS ---


// --- PAGINATION LOGIC ---
// इस हिस्से में कोई बदलाव नहीं किया गया है।
let paginationData = {};
async function renderPaginatedContent(contentAreaId, controlsId, content) {
    // ... (कोड अपरिवर्तित)
    const contentArea = document.getElementById(contentAreaId);
    const controlsArea = document.getElementById(controlsId);
    if (!contentArea || !controlsArea) return;

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
        await renderEnhancedAIContent(pageDivs[i], pages[i]);
    }

    controlsArea.innerHTML = `<button class="pagination-btn" id="${contentAreaId}-back" onclick="changePage('${contentAreaId}', -1)">Back</button> <span class="page-indicator" id="${contentAreaId}-indicator"></span> <button class="pagination-btn" id="${contentAreaId}-next" onclick="changePage('${contentAreaId}', 1)">Next</button>`;
    updatePaginationControls(contentAreaId);
}
function changePage(contentAreaId, direction) {
    // ... (कोड अपरिवर्तित)
    const data = paginationData[contentAreaId];
    if (!data) return;
    const newPage = data.currentPage + direction;
    if (newPage >= 0 && newPage < data.pages.length) {
        data.currentPage = newPage;
        const contentArea = document.getElementById(contentAreaId);
        contentArea.querySelectorAll('.content-page').forEach((page, index) => {
            page.classList.toggle('active', index === newPage);
        });
        updatePaginationControls(contentAreaId);
    }
}
function updatePaginationControls(contentAreaId) {
    // ... (कोड अपरिवर्तित)
    const data = paginationData[contentAreaId];
    if (!data) return;
    document.getElementById(`${contentAreaId}-indicator`).textContent = `Page ${data.currentPage + 1} of ${data.pages.length}`;
    document.getElementById(`${contentAreaId}-back`).disabled = (data.currentPage === 0);
    document.getElementById(`${contentAreaId}-next`).disabled = (data.currentPage === data.pages.length - 1);
}


// --- मुख्य EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', function() {

    // --- CUSTOM COUNT INPUT LOGIC --- (कोई बदलाव नहीं)
    // ... (कोड अपरिवर्तित)
    document.querySelectorAll('input[type="radio"][value="custom"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const customInput = this.closest('.option-selector-group').querySelector('.custom-count-input');
            if (customInput) {
                customInput.disabled = !this.checked;
                if (this.checked) customInput.focus();
            }
        });
        const otherRadios = radio.closest('.option-selector-group').querySelectorAll('input[type="radio"]:not([value="custom"])');
        otherRadios.forEach(other => {
            other.addEventListener('change', function() {
                 const customInput = this.closest('.option-selector-group').querySelector('.custom-count-input');
                 if (customInput) customInput.disabled = true;
            });
        });
    });


    // Image file का नाम दिखाने के लिए (कोई बदलाव नहीं)
    const imageInput = document.getElementById('doubt-image-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    if (imageInput && fileNameDisplay) {
        imageInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                fileNameDisplay.textContent = `File: ${this.files[0].name}`;
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    }


    // 1. Ask Doubt (Firebase v9 Auth के लिए अपडेट किया गया)
    document.getElementById('ask-doubt-submit').addEventListener('click', async function() {
        const button = this;
        const questionInput = document.getElementById('doubt-input');
        const imageInputInternal = document.getElementById('doubt-image-input'); // वेरिएबल का नाम बदला ताकि ग्लोबल imageInput से क्लैश न हो
        const responseContainer = document.getElementById('ai-response-container');
        const responseDiv = document.getElementById('ai-response');
        const fileNameDisplayInternal = document.getElementById('file-name-display'); // वेरिएबल का नाम बदला

        const questionText = questionInput.value.trim();
        const imageFile = imageInputInternal.files[0];

        if (questionText === '' && !imageFile) {
            alert('Please write your doubt or upload an image.');
            return;
        }

        button.disabled = true;
        button.textContent = 'Analyzing...';
        responseContainer.style.display = 'block';
        responseDiv.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';

        const formData = new FormData();
        formData.append('question', questionText);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const user = insightAIAuth.currentUser; // <<<--- बदला हुआ: v9 auth इंस्टैंस
            const headers = {}; 
             if (user) {
                try {
                    const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ: v9 getIdToken
                    headers['Authorization'] = 'Bearer ' + idTokenString;
                } catch (tokenError) {
                    console.error('Firebase ID टोकन प्राप्त करने में त्रुटि (इमेज अपलोड v9):', tokenError);
                    throw new Error(`प्रमाणीकरण टोकन त्रुटि: ${tokenError.message}. कृपया पुनः लॉग इन करने का प्रयास करें।`);
                }
            }

            const response = await fetch('/ask-ai-image', { // Python सर्वर एंडपॉइंट
                method: 'POST',
                headers: headers, // FormData के लिए, Content-Type ब्राउज़र द्वारा सेट किया जाता है
                body: formData
            });

            const data = await response.json();
             if (!response.ok) {
                let errorMessage = `सर्वर त्रुटि: ${response.status}`;
                if (data && data.error) {
                    errorMessage = data.error;
                } else if (response.statusText) {
                    errorMessage = response.statusText;
                }
                throw new Error(errorMessage);
            }
            
            const fullText = data.answer;
            await renderEnhancedAIContent(responseDiv, fullText);

        } catch (error) {
            responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Answer';
            questionInput.value = '';
            if (imageInputInternal) imageInputInternal.value = ''; 
            if(fileNameDisplayInternal) fileNameDisplayInternal.textContent = '';
        }
    });

    // 2. Generate Notes - यह handleApiRequest का उपयोग करेगा, जो पहले ही अपडेट हो चुका है
    document.getElementById('generate-notes-submit').addEventListener('click', function() {
        const button = this;
        const topicInput = document.getElementById('notes-topic-input');
        const container = document.getElementById('notes-output-container');
        const responseDiv = document.getElementById('notes-response');
        
        handleApiRequest(button, container, responseDiv, '/generate-notes-ai', () => {
            const topic = topicInput.value.trim();
            const noteType = document.querySelector('input[name="note-length"]:checked').value;
            if (topic === '') {
                alert('Please enter a topic.');
                return null;
            }
            return { topic, noteType };
        });
    });

    // 3. Practice MCQs (Firebase v9 Auth के लिए अपडेट किया गया, क्योंकि यह सीधे fetch कॉल करता है)
    document.getElementById('start-quiz-btn').addEventListener('click', async function() {
        const button = this;
        const topic = document.getElementById('mcq-topic-input').value.trim();
        if (topic === '') {
            alert('Please enter a topic for the quiz.');
            return;
        }

        let count = document.querySelector('input[name="mcq-count"]:checked').value;
        if (count === 'custom') {
            count = document.getElementById('mcq-custom-count').value;
        }

        document.getElementById('mcq-setup-view').style.display = 'none';
        const quizView = document.getElementById('mcq-quiz-view');
        quizView.style.display = 'block';
        document.getElementById('quiz-topic-title').innerText = `Quiz on: ${topic}`;
        const quizContainer = document.getElementById('quiz-container');
        quizContainer.innerHTML = '<div class="loading-animation">Generating Quiz...</div>';

        button.disabled = true;
        button.textContent = 'Generating...';

        try {
            const user = insightAIAuth.currentUser; // <<<--- बदला हुआ: v9 auth इंस्टैंस
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                 try {
                    const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ: v9 getIdToken
                    headers['Authorization'] = 'Bearer ' + idTokenString;
                } catch (tokenError) {
                    console.error('Firebase ID टोकन प्राप्त करने में त्रुटि (MCQ v9):', tokenError);
                    throw new Error(`प्रमाणीकरण टोकन त्रुटि: ${tokenError.message}. कृपया पुनः लॉग इन करने का प्रयास करें।`);
                }
            }
            
            const response = await fetch('/generate-mcq-ai', { // Python सर्वर एंडपॉइंट
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ topic, count })
            });

            const questions = await response.json();
            if (!response.ok) {
                let errorMessage = `सर्वर त्रुटि: ${response.status}`;
                if (questions && questions.error) {
                    errorMessage = questions.error;
                } else if (response.statusText) {
                    errorMessage = response.statusText;
                }
                throw new Error(errorMessage);
            }
            window.currentQuizQuestions = questions;
            await displayQuestions(questions);
            document.getElementById('submit-quiz-btn').style.display = 'block';
            document.getElementById('post-quiz-options').style.display = 'none';
            document.getElementById('quiz-result').innerHTML = '';
            document.getElementById('quiz-analysis-report').innerHTML = '';

        } catch (error) {
            quizContainer.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
            document.getElementById('mcq-setup-view').style.display = 'block';
            quizView.style.display = 'none';
        } finally {
            button.disabled = false;
            button.textContent = 'Start Quiz';
        }
    });
    
    // 4. Get Solved Examples - यह handleApiRequest का उपयोग करेगा, जो अपडेट हो चुका है
    document.getElementById('get-solved-notes-btn').addEventListener('click', function() {
        const button = this;
        const topicInput = document.getElementById('solved-notes-topic-input');
        const container = document.getElementById('solved-notes-response-container');
        const responseDiv = document.getElementById('solved-notes-response');

        handleApiRequest(button, container, responseDiv, '/get-solved-notes-ai', () => {
            const topic = topicInput.value.trim();
            if (topic === '') {
                alert('Please enter a topic.');
                return null;
            }
            let count = document.querySelector('input[name="solved-notes-count"]:checked').value;
            if (count === 'custom') {
                count = document.getElementById('solved-notes-custom-count').value;
            }
            return { topic, count };
        });
    });

    // 5. Get Career Advice (Firebase v9 Auth के लिए अपडेट किया गया)
    document.getElementById('get-career-advice-btn').addEventListener('click', async function() {
        const button = this;
        const interests = document.getElementById('career-interests-input').value.trim();
        const container = document.getElementById('career-response-container');
        const contentArea = document.getElementById('career-paginated-content');
        const controlsArea = document.getElementById('career-pagination-controls');

        if (interests === '') {
            alert('Please enter your interests.');
            return;
        }

        button.disabled = true;
        button.textContent = 'Generating...';
        container.style.display = 'block';
        contentArea.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';
        controlsArea.innerHTML = '';

        try {
            const user = insightAIAuth.currentUser; // <<<--- बदला हुआ
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                try {
                    const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ
                    headers['Authorization'] = 'Bearer ' + idTokenString;
                } catch (tokenError) { console.error('Token error:', tokenError); throw new Error(`Auth token error: ${tokenError.message}`); }
            }

            const response = await fetch('/get-career-advice-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ interests })
            });

            const data = await response.json();
            if (!response.ok) { let e = data.error || response.statusText; throw new Error(e); }
            await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
        } catch (error) {
            contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Career Advice';
        }
    });

    // 6. Generate Study Plan (Firebase v9 Auth के लिए अपडेट किया गया)
    document.getElementById('generate-study-plan-btn').addEventListener('click', async function() {
        const button = this;
        const details = document.getElementById('study-plan-details-input').value.trim();
        const container = document.getElementById('study-plan-response-container');
        const contentArea = document.getElementById('study-plan-paginated-content');
        const controlsArea = document.getElementById('study-plan-pagination-controls');

        if (details === '') { alert('Please provide details for the plan.'); return; }

        button.disabled = true; button.textContent = 'Creating...';
        container.style.display = 'block';
        contentArea.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';
        controlsArea.innerHTML = '';

        try {
            const user = insightAIAuth.currentUser; // <<<--- बदला हुआ
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                try {
                    const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ
                    headers['Authorization'] = 'Bearer ' + idTokenString;
                } catch (tokenError) { console.error('Token error:', tokenError); throw new Error(`Auth token error: ${tokenError.message}`); }
            }
            const response = await fetch('/generate-study-plan-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ details })
            });
            const data = await response.json();
            if (!response.ok) { let e = data.error || response.statusText; throw new Error(e); }
            await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
        } catch (error) {
            contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false; button.textContent = 'Create My Plan';
        }
    });
        
    // 7. Generate Flashcards (Firebase v9 Auth के लिए अपडेट किया गया)
    document.getElementById('generate-flashcards-btn').addEventListener('click', async function() {
        const button = this;
        const topic = document.getElementById('flashcard-topic-input').value.trim();
        const container = document.getElementById('flashcard-response-container');
        
        if (topic === '') { alert('Please enter a topic for flashcards.'); return; }
        let count = document.querySelector('input[name="flashcard-count"]:checked').value;
        if (count === 'custom') { count = document.getElementById('flashcard-custom-count').value; }

        button.disabled = true; button.textContent = 'Creating...';
        container.style.display = 'block';
        container.innerHTML = '<div class="loading-animation">Generating Flashcards...</div>';

        try {
            const user = insightAIAuth.currentUser; // <<<--- बदला हुआ
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                try {
                    const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ
                    headers['Authorization'] = 'Bearer ' + idTokenString;
                } catch (tokenError) { console.error('Token error:', tokenError); throw new Error(`Auth token error: ${tokenError.message}`); }
            }
            const response = await fetch('/generate-flashcards-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ topic, count })
            });
            const cards = await response.json();
            if (!response.ok) { let e = cards.error || response.statusText; throw new Error(e); }
            await displayFlashcards(cards);
        } catch (error) {
            container.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false; button.textContent = 'Create Flashcards';
        }
    });
        
    // 8. Write Essay - यह handleApiRequest का उपयोग करेगा
    document.getElementById('write-essay-btn').addEventListener('click', function() {
        const button = this;
        const topicInput = document.getElementById('essay-topic-input');
        const container = document.getElementById('essay-writer-response-container');
        const responseDiv = document.getElementById('essay-writer-response');

        handleApiRequest(button, container, responseDiv, '/write-essay-ai', () => {
            const topic = topicInput.value.trim();
            if (topic === '') { alert('Please enter a topic.'); return null; }
            return { topic };
        });
    });

    // 9. Create Presentation - यह handleApiRequest का उपयोग करेगा
    document.getElementById('create-presentation-btn').addEventListener('click', function() {
        const button = this;
        const topicInput = document.getElementById('presentation-topic-input');
        const container = document.getElementById('presentation-maker-response-container');
        const responseDiv = document.getElementById('presentation-maker-response');

        handleApiRequest(button, container, responseDiv, '/create-presentation-ai', () => {
            const topic = topicInput.value.trim();
            if (topic === '') { alert('Please enter a topic.'); return null; }
            return { topic };
        });
    });
        
    // 10. Get Explanation - यह handleApiRequest का उपयोग करेगा
    document.getElementById('get-explanation-btn').addEventListener('click', function() {
        const button = this;
        const conceptInput = document.getElementById('concept-input');
        const container = document.getElementById('concept-output-container');
        const responseDiv = document.getElementById('explainer-response');

        handleApiRequest(button, container, responseDiv, '/explain-concept-ai', () => {
            const topic = conceptInput.value.trim();
            if (topic === '') { alert('Please enter a concept.'); return null; }
            return { topic };
        });
    });

    // --- QUIZ HELPER FUNCTIONS ---
    async function displayQuestions(questions) {
        // ... (यह कोड अपरिवर्तित)
        const quizContainer = document.getElementById('quiz-container');
        quizContainer.innerHTML = '';
        window.correctAnswers = questions.map(q => q.correct_answer);

        for (const [index, q] of questions.entries()) {
            const questionElement = document.createElement('div');
            questionElement.className = 'mcq-question-block';
            
            const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
            let optionsHTML = shuffledOptions.map(option =>
                `<label class="mcq-option"><input type="radio" name="question-${index}" value="${option}"> <span></span></label>`
            ).join('');

            const questionTextDiv = document.createElement('div');
            await renderEnhancedAIContent(questionTextDiv, `<strong>Q${index + 1}:</strong> ${q.question}`);
            
            questionElement.innerHTML = `
                ${questionTextDiv.innerHTML}
                <div class="options-container" id="options-${index}">${optionsHTML}</div>
            `;
            quizContainer.appendChild(questionElement);
            
            const optionLabels = questionElement.querySelectorAll('.mcq-option span');
            for(let i = 0; i < optionLabels.length; i++) {
                await renderEnhancedAIContent(optionLabels[i], shuffledOptions[i]);
            }
        }
    }

    document.getElementById('submit-quiz-btn').addEventListener('click', function() {
        // ... (यह कोड अपरिवर्तित क्योंकि यह getQuizAnalysis को कॉल करता है)
        let score = 0;
        const userAnswersForAnalysis = [];

        window.correctAnswers.forEach((correctAnswer, i) => {
            const selectedRadio = document.querySelector(`input[name="question-${i}"]:checked`);
            const questionData = window.currentQuizQuestions[i];
            
            let userAnswer = selectedRadio ? selectedRadio.value : "Not Answered";
            let isCorrect = (userAnswer === correctAnswer);

            userAnswersForAnalysis.push({
                question: questionData.question,
                userAnswer: userAnswer,
                isCorrect: isCorrect,
                conceptTag: questionData.conceptTag || "General"
            });

            const optionsContainer = document.getElementById(`options-${i}`);
            if (optionsContainer) {
                optionsContainer.querySelectorAll('label').forEach(label => {
                    label.style.pointerEvents = 'none';
                    const inputValue = label.querySelector('input').value;
                    if (inputValue === correctAnswer) {
                        label.classList.add('correct');
                    }
                    if (selectedRadio && selectedRadio.value === inputValue && !isCorrect) {
                         label.classList.add('incorrect');
                    }
                });
            }

            if (isCorrect) score++;
        });

        document.getElementById('quiz-result').innerHTML = `<h3>Your Score: ${score} / ${window.correctAnswers.length}</h3>`;
        this.style.display = 'none';
        document.getElementById('post-quiz-options').style.display = 'block';

        getQuizAnalysis(userAnswersForAnalysis); // यह अब अपडेटेड getQuizAnalysis को कॉल करेगा
    });

    // Quiz Analysis (Firebase v9 Auth के लिए अपडेट किया गया)
    async function getQuizAnalysis(answers) {
        const analysisDiv = document.getElementById('quiz-analysis-report');
        analysisDiv.style.display = 'block';
        analysisDiv.innerHTML = '<div class="loading-animation">Analyzing your performance...</div>';

        try {
            const user = insightAIAuth.currentUser; // <<<--- बदला हुआ
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                try {
                    const idTokenString = await getIdToken(user, true); // <<<--- बदला हुआ
                    headers['Authorization'] = 'Bearer ' + idTokenString;
                } catch (tokenError) { console.error('Token error:', tokenError); throw new Error(`Auth token error: ${tokenError.message}`); }
            }

            const response = await fetch('/analyze-quiz-results', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ answers })
            });
            const data = await response.json();
            if (!response.ok) { let e = data.error || response.statusText; throw new Error(e); }
            await renderEnhancedAIContent(analysisDiv, data.analysis);
        } catch (error) {
            analysisDiv.innerHTML = `<p style="color: var(--color-red);">Could not get analysis: ${error.message}</p>`;
        }
    }

    document.getElementById('retake-quiz-btn').addEventListener('click', function() {
        // ... (यह कोड अपरिवर्तित)
        document.getElementById('mcq-quiz-view').style.display = 'none';
        document.getElementById('mcq-setup-view').style.display = 'block';
        const mcqTopicInput = document.getElementById('mcq-topic-input');
        if (mcqTopicInput) mcqTopicInput.value = '';
    });

    async function displayFlashcards(cards) {
        // ... (यह कोड अपरिवर्तित)
        const container = document.getElementById('flashcard-response-container');
        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'flashcard-grid';

        for (const cardData of cards) {
            const cardEl = document.createElement('div');
            cardEl.className = 'flashcard';
            const frontDiv = document.createElement('div');
            frontDiv.className = 'card-front';
            const backDiv = document.createElement('div');
            backDiv.className = 'card-back';
            
            await renderEnhancedAIContent(frontDiv, cardData.front);
            await renderEnhancedAIContent(backDiv, cardData.back);

            cardEl.innerHTML = `<div class="flashcard-inner">${frontDiv.outerHTML}${backDiv.outerHTML}</div>`;
            cardEl.addEventListener('click', () => cardEl.classList.toggle('flipped'));
            grid.appendChild(cardEl);
        }
        container.appendChild(grid);
    }
});
