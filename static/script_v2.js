// --- WELCOME SCREEN LOGIC ---
// यह सुनिश्चित करता है कि वेलकम स्क्रीन के बाद ऐप सही से दिखे।
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    
    setTimeout(() => {
        if (welcomeScreen) {
            welcomeScreen.style.opacity = '0';
            // welcomeScreen को DOM से हटाने के लिए ताकि यह बैकग्राउंड में न रहे
            welcomeScreen.addEventListener('transitionend', () => {
                welcomeScreen.style.display = 'none';
            });
        }
        
        if (appContainer) {
             // यह सुनिश्चित करता है कि ऐप कंटेनर दिखेगा
             appContainer.style.display = 'block'; 
             // App container को धीरे-धीरे दिखाने (fade in) के लिए जोड़ा गया
             setTimeout(() => appContainer.style.opacity = '1', 50);
        }
    }, 3500); // 3.5 सेकंड तक वेलकम स्क्रीन दिखेगी
});


// --- NAVIGATION LOGIC ---
// यह फंक्शन एक स्क्रीन से दूसरी स्क्रीन पर जाने के लिए है।
function navigateTo(screenId) {
    // सभी स्क्रीन से 'active' क्लास हटाता है
    document.querySelectorAll('.app-container .screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // जिस स्क्रीन पर जाना है, उसे ढूंढता है
    const targetScreen = document.getElementById(screenId);
    
    // अगर स्क्रीन मिलती है, तो उसे 'active' क्लास देता है ताकि वह दिखे
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    // हर बार नई स्क्रीन पर जाने पर पेज को ऊपर स्क्रॉल करता है
    window.scrollTo(0, 0);
}

// --- NEW: TYPEWRITER EFFECT FUNCTION ---
// यह फंक्शन AI के जवाब को धीरे-धीरे टाइप करके दिखाता है।
function typewriterEffect(element, text, speed = 10, onComplete) {
    if (!element) return;
    let i = 0;
    element.innerHTML = ""; // पहले से मौजूद कंटेंट को साफ़ करें
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    element.appendChild(cursor);

    function typing() {
        if (i < text.length) {
            // Markdown के खास कैरेक्टर्स को एक साथ प्रिंट करने के लिए
            let char = text.charAt(i);
            // Example: Handling markdown bold, italic, etc.
            if (char === '*' || char === '#' || char === '`') {
                 let tag = char;
                 if (text.substring(i, i+2) === '**' || text.substring(i, i+3) === '###' || text.substring(i, i+2) === '##') {
                     tag = text.substring(i).match(/^(\*\*|###|##|`{1,3})/)[0];
                 }
                 const endTagIndex = text.indexOf(tag, i + tag.length);
                 if (endTagIndex !== -1) {
                     const chunk = text.substring(i, endTagIndex + tag.length);
                     element.insertBefore(document.createTextNode(chunk), cursor);
                     i += chunk.length;
                 } else {
                      element.insertBefore(document.createTextNode(char), cursor);
                      i++;
                 }
            } else {
                 element.insertBefore(document.createTextNode(char), cursor);
                 i++;
            }

            // पेज को नीचे स्क्रॉल करें ताकि यूज़र टाइपिंग देख सके
            window.scrollTo(0, document.body.scrollHeight);
            setTimeout(typing, speed);
        } else {
            cursor.remove(); // टाइपिंग पूरी होने पर कर्सर हटा दें
            if (onComplete) {
                // टाइपिंग पूरी होने के बाद कॉलबैक फंक्शन चलाएं (जैसे MathJax, highlight.js)
                onComplete(element, text);
            }
        }
    }
    typing();
}


// --- AI CONTENT RENDERER ---
// यह फंक्शन मार्कडाउन, मैथ और कोड को सुंदर दिखाने के लिए है।
async function renderEnhancedAIContent(element, content) {
    if (!element) return;
    
    // [chem]...[/chem] को एक खास स्टाइल देने के लिए बदला गया
    let processedContent = content.replace(/\[chem\](.*?)\[\/chem\]/g, '<span class="chem-reaction">$1</span>');

    const htmlContent = marked.parse(processedContent);
    element.innerHTML = htmlContent;

    // ज़रूरी शब्दों को अलग-अलग रंगों में हाईलाइट करने के लिए
    const highlightColors = ['highlight-yellow', 'highlight-skyblue', 'highlight-pink'];
    element.querySelectorAll('strong').forEach((strongEl, index) => {
        strongEl.classList.add(highlightColors[index % highlightColors.length]);
    });

    // कोड ब्लॉक्स को हाईलाइट करने के लिए
    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    // MathJax को गणित के फ़ॉर्मूले रेंडर करने के लिए चलाना
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        try {
            await window.MathJax.typesetPromise([element]);
        } catch (err) {
            console.error('MathJax rendering failed:', err);
        }
    }
}


// --- HELPER FUNCTION FOR API REQUESTS ---
// यह फंक्शन AI सर्वर से बात करने में मदद करता है।
async function handleApiRequest(button, container, responseDiv, url, getBody, useTypingEffect = true) {
    const body = getBody();
    if (!body) return; // अगर बॉडी नहीं है तो कुछ मत करो

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Generating...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';

    try {
        const user = firebase.auth().currentUser;
        const headers = { 'Content-Type': 'application/json' };
        if (user) {
            const idToken = await user.getIdToken(true);
            headers['Authorization'] = 'Bearer ' + idToken;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Server error occurred.');
        }
        
        const key = Object.keys(data)[0]; // जवाब का पहला की (key) लेना
        const content = data[key] || "No content received.";
        
        if (useTypingEffect) {
            // टाइपराइटर इफ़ेक्ट का इस्तेमाल करें
            typewriterEffect(responseDiv, content, 10, async (finalElement, finalContent) => {
                 await renderEnhancedAIContent(finalElement, finalContent);
            });
        } else {
             // बिना टाइपराइटर के सीधे कंटेंट दिखाएं
             await renderEnhancedAIContent(responseDiv, content);
        }

    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Sorry, an error occurred: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


// --- PAGINATION LOGIC ---
// लंबे जवाबों को पेज में बांटने का काम करता है।
let paginationData = {};
async function renderPaginatedContent(contentAreaId, controlsId, content) {
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

    // पहले पेज पर टाइपिंग इफ़ेक्ट दिखाओ
    typewriterEffect(pageDivs[0], pages[0], 10, async (el, txt) => {
        await renderEnhancedAIContent(el, txt);
        // बाकी पेज का कंटेंट बिना टाइपिंग के लोड कर दो
        for (let i = 1; i < pageDivs.length; i++) {
             await renderEnhancedAIContent(pageDivs[i], pages[i]);
        }
    });

    controlsArea.innerHTML = `<button class="pagination-btn" id="${contentAreaId}-back" onclick="changePage('${contentAreaId}', -1)">Back</button> <span class="page-indicator" id="${contentAreaId}-indicator"></span> <button class="pagination-btn" id="${contentAreaId}-next" onclick="changePage('${contentAreaId}', 1)">Next</button>`;
    updatePaginationControls(contentAreaId);
}
function changePage(contentAreaId, direction) {
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
    const data = paginationData[contentAreaId];
    if (!data) return;
    document.getElementById(`${contentAreaId}-indicator`).textContent = `Page ${data.currentPage + 1} of ${data.pages.length}`;
    document.getElementById(`${contentAreaId}-back`).disabled = (data.currentPage === 0);
    document.getElementById(`${contentAreaId}-next`).disabled = (data.currentPage === data.pages.length - 1);
}


// --- ✅✅✅ MAIN EXECUTION BLOCK ✅✅✅ ---
// यह सुनिश्चित करता है कि पूरा HTML लोड होने के बाद ही यह कोड चले।
document.addEventListener('DOMContentLoaded', function() {

    // --- CUSTOM COUNT INPUT LOGIC ---
    // यह custom नंबर वाले इनपुट को enable/disable करता है।
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

    // इमेज फाइल का नाम दिखाने के लिए
    const imageInput = document.getElementById('doubt-image-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    if (imageInput && fileNameDisplay) {
        imageInput.addEventListener('change', function() {
            fileNameDisplay.textContent = this.files.length > 0 ? `File: ${this.files[0].name}` : '';
        });
    }

    // --- EVENT LISTENERS FOR ALL BUTTONS ---

    // 1. Ask Doubt
    document.getElementById('ask-doubt-submit').addEventListener('click', async function() {
        const button = this;
        const questionInput = document.getElementById('doubt-input');
        const imageInput = document.getElementById('doubt-image-input');
        const responseContainer = document.getElementById('ai-response-container');
        const responseDiv = document.getElementById('ai-response');
        
        const questionText = questionInput.value.trim();
        const imageFile = imageInput.files[0];

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
        if (imageFile) formData.append('image', imageFile);

        try {
            const user = firebase.auth().currentUser;
            const headers = {};
             if (user) {
                const idToken = await user.getIdToken(true);
                headers['Authorization'] = 'Bearer ' + idToken;
            }

            const response = await fetch('/ask-ai-image', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Server error.');
            
            // इमेज वाले सवाल के जवाब के लिए भी टाइपराइटर
            typewriterEffect(responseDiv, data.answer, 10, async (el, txt) => {
                await renderEnhancedAIContent(el, txt);
            });

        } catch (error) {
            responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Answer';
        }
    });

    // 2. Generate Notes
    document.getElementById('generate-notes-submit').addEventListener('click', function() {
        handleApiRequest(
            this,
            document.getElementById('notes-output-container'),
            document.getElementById('notes-response'),
            '/generate-notes-ai',
            () => {
                const topic = document.getElementById('notes-topic-input').value.trim();
                if (!topic) { alert('Please enter a topic.'); return null; }
                const noteType = document.querySelector('input[name="note-length"]:checked').value;
                return { topic, noteType };
            }
        );
    });

    // 3. Practice MCQs
    document.getElementById('start-quiz-btn').addEventListener('click', async function() {
        const button = this;
        const topic = document.getElementById('mcq-topic-input').value.trim();
        if (topic === '') {
            alert('Please enter a topic for the quiz.');
            return;
        }

        let count = document.querySelector('input[name="mcq-count"]:checked').value;
        if (count === 'custom') count = document.getElementById('mcq-custom-count').value;

        document.getElementById('mcq-setup-view').style.display = 'none';
        const quizView = document.getElementById('mcq-quiz-view');
        quizView.style.display = 'block';
        document.getElementById('quiz-topic-title').innerText = `Quiz on: ${topic}`;
        const quizContainer = document.getElementById('quiz-container');
        quizContainer.innerHTML = '<div class="loading-animation">Generating Quiz...</div>';

        button.disabled = true;
        button.textContent = 'Generating...';

        try {
            const user = firebase.auth().currentUser;
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                const idToken = await user.getIdToken(true);
                headers['Authorization'] = 'Bearer ' + idToken;
            }
            
            const response = await fetch('/generate-mcq-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ topic, count })
            });

            const questions = await response.json();
            if (!response.ok) throw new Error(questions.error || 'Could not generate quiz.');
            
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
    
    // 4. Get Solved Examples
    document.getElementById('get-solved-notes-btn').addEventListener('click', function() {
        handleApiRequest(
            this,
            document.getElementById('solved-notes-response-container'),
            document.getElementById('solved-notes-response'),
            '/get-solved-notes-ai',
            () => {
                const topic = document.getElementById('solved-notes-topic-input').value.trim();
                if (!topic) { alert('Please enter a topic.'); return null; }
                let count = document.querySelector('input[name="solved-notes-count"]:checked').value;
                if (count === 'custom') count = document.getElementById('solved-notes-custom-count').value;
                return { topic, count };
            }
        );
    });

    // 5. Get Career Advice
    document.getElementById('get-career-advice-btn').addEventListener('click', async function() {
        const button = this;
        const interests = document.getElementById('career-interests-input').value.trim();
        const container = document.getElementById('career-response-container');
        const contentArea = document.getElementById('career-paginated-content');
        const controlsArea = document.getElementById('career-pagination-controls');

        if (interests === '') { alert('Please enter your interests.'); return; }

        button.disabled = true;
        button.textContent = 'Generating...';
        container.style.display = 'block';
        contentArea.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';
        controlsArea.innerHTML = '';

        try {
            const user = firebase.auth().currentUser;
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                const idToken = await user.getIdToken(true);
                headers['Authorization'] = 'Bearer ' + idToken;
            }

            const response = await fetch('/get-career-advice-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ interests })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not get career advice.');
            await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
        } catch (error) {
            contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Career Advice';
        }
    });

    // 6. Generate Study Plan
    document.getElementById('generate-study-plan-btn').addEventListener('click', async function() {
        const button = this;
        const details = document.getElementById('study-plan-details-input').value.trim();
        if (details === '') { alert('Please provide details for the plan.'); return; }

        button.disabled = true;
        button.textContent = 'Creating...';
        const container = document.getElementById('study-plan-response-container');
        const contentArea = document.getElementById('study-plan-paginated-content');
        const controlsArea = document.getElementById('study-plan-pagination-controls');
        container.style.display = 'block';
        contentArea.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';
        controlsArea.innerHTML = '';

        try {
            const user = firebase.auth().currentUser;
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                const idToken = await user.getIdToken(true);
                headers['Authorization'] = 'Bearer ' + idToken;
            }

            const response = await fetch('/generate-study-plan-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ details })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not create study plan.');
            await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
        } catch (error) {
            contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Create My Plan';
        }
    });
        
    // 7. Generate Flashcards
    document.getElementById('generate-flashcards-btn').addEventListener('click', async function() {
        const button = this;
        const topic = document.getElementById('flashcard-topic-input').value.trim();
        const container = document.getElementById('flashcard-response-container');
        
        if (topic === '') { alert('Please enter a topic for flashcards.'); return; }

        let count = document.querySelector('input[name="flashcard-count"]:checked').value;
        if (count === 'custom') count = document.getElementById('flashcard-custom-count').value;

        button.disabled = true;
        button.textContent = 'Creating...';
        container.style.display = 'block';
        container.innerHTML = '<div class="loading-animation">Generating Flashcards...</div>';

        try {
            // ... (rest of the flashcard logic is fine)
            // It calls displayFlashcards which doesn't need typing effect.
        } catch (error) {
            // ...
        } finally {
            // ...
        }
    });
        
    // 8. Write Essay
    document.getElementById('write-essay-btn').addEventListener('click', function() {
        handleApiRequest(
            this,
            document.getElementById('essay-writer-response-container'),
            document.getElementById('essay-writer-response'),
            '/write-essay-ai',
            () => {
                const topic = document.getElementById('essay-topic-input').value.trim();
                if (!topic) { alert('Please enter a topic.'); return null; }
                return { topic };
            }
        );
    });

    // 9. Create Presentation
    document.getElementById('create-presentation-btn').addEventListener('click', function() {
        handleApiRequest(
            this,
            document.getElementById('presentation-maker-response-container'),
            document.getElementById('presentation-maker-response'),
            '/create-presentation-ai',
            () => {
                const topic = document.getElementById('presentation-topic-input').value.trim();
                if (!topic) { alert('Please enter a topic.'); return null; }
                return { topic };
            }
        );
    });
        
    // 10. Get Explanation
    document.getElementById('get-explanation-btn').addEventListener('click', function() {
        handleApiRequest(
            this,
            document.getElementById('concept-output-container'),
            document.getElementById('explainer-response'),
            '/explain-concept-ai',
            () => {
                const topic = document.getElementById('concept-input').value.trim();
                if (!topic) { alert('Please enter a concept.'); return null; }
                return { topic };
            }
        );
    });

    // --- QUIZ HELPER FUNCTIONS ---
    async function displayQuestions(questions) {
        // ... (Your existing displayQuestions logic is fine)
    }

    document.getElementById('submit-quiz-btn').addEventListener('click', function() {
        // ... (Your existing submit logic is fine)
    });

    async function getQuizAnalysis(answers) {
        const analysisDiv = document.getElementById('quiz-analysis-report');
        analysisDiv.style.display = 'block';
        analysisDiv.innerHTML = '<div class="loading-animation">Analyzing your performance...</div>';

        try {
            const user = firebase.auth().currentUser;
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                const idToken = await user.getIdToken(true);
                headers['Authorization'] = 'Bearer ' + idToken;
            }

            const response = await fetch('/analyze-quiz-results', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ answers })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not get analysis.');

            // Analysis ke liye bhi typewriter
            typewriterEffect(analysisDiv, data.analysis, 10, async (el, txt) => {
                 await renderEnhancedAIContent(el, txt);
            });
            
        } catch (error) {
            analysisDiv.innerHTML = `<p style="color: var(--color-red);">Could not get analysis: ${error.message}</p>`;
        }
    }

    document.getElementById('retake-quiz-btn').addEventListener('click', function() {
        // ... (Your existing retake logic is fine)
    });

    async function displayFlashcards(cards) {
        // ... (Your existing flashcard logic is fine)
    }
});
