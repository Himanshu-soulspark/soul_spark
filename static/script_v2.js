// --- FIREBASE SETUP ---
// यह कोड आपके वेबपेज को आपके Firebase प्रोजेक्ट से जोड़ता है।
// यह सबसे ऊपर इसलिए रखा गया है ताकि बाकी कोई भी फंक्शन इसे इस्तेमाल कर सके।

// ✅✅✅ यह नया कोड यहाँ से शुरू होता है ✅✅✅

// 1. यह आपका Firebase कॉन्फ़िगरेशन है, जिसे आपने दिया था।
const firebaseConfig = {
  apiKey: "AIzaSyB2PG5JvDko2UmQDlY9gN5lBgga2vQy-Ws",
  authDomain: "conceptra-c1000.firebaseapp.com",
  databaseURL: "https://conceptra-c1000-default-rtdb.firebaseio.com",
  projectId: "conceptra-c1000",
  storageBucket: "conceptra-c1000.firebasestorage.app",
  messagingSenderId: "298402987968",
  appId: "1:298402987968:web:c0d0d7d6c08cdfa6bc5225",
  measurementId: "G-QRQYEVSJJ6"
};

// 2. इस लाइन से Firebase शुरू होता है। अब आपका ऐप कनेक्ट हो गया है।
firebase.initializeApp(firebaseConfig);

// ✅✅✅ नया कोड यहाँ खत्म होता है ✅✅✅


// --- WELCOME SCREEN LOGIC ---
// Yeh hissa bilkul sahi tha aur ise waise hi rakha gaya hai. Yeh sunishchit karta hai ki welcome screen ke baad app sahi se dikhe.
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) {
                 appContainer.style.display = 'block'; // Yeh sunishchit karta hai ki app container dikhe
                 // App container ko fade in karne ke liye joda gaya
                 setTimeout(() => appContainer.style.opacity = '1', 50);
            }
        }, 500); // 0.5 second baad welcome screen poori tarah se hat jaayegi
    }, 3500); // 3.5 second tak welcome screen dikhegi
});


// --- NAVIGATION LOGIC ---
// Yeh function bhi bilkul sahi hai aur screen badalne ka kaam karta hai.
function navigateTo(screenId) {
    document.querySelectorAll('.app-container .screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    window.scrollTo(0, 0);
}


// --- AI CONTENT RENDERER ---
// Yeh function markdown, math aur code ko sundar dikhane ke liye hai. Yeh bilkul sahi hai.
async function renderEnhancedAIContent(element, content) {
    if (!element) return;
    
    // MathJax ko theek se kaam karne ke liye [math]...[/math] ko badalna nahi hai
    // [chem]...[/chem] ko ek khaas style dene ke liye badla gaya
    let processedContent = content.replace(/\[chem\](.*?)\[\/chem\]/g, '<span class="chem-reaction">$1</span>');

    const htmlContent = marked.parse(processedContent);
    element.innerHTML = htmlContent;

    const highlightColors = ['highlight-yellow', 'highlight-skyblue', 'highlight-pink'];
    element.querySelectorAll('strong').forEach((strongEl, index) => {
        strongEl.classList.add(highlightColors[index % highlightColors.length]);
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


// --- ✅ ZAROORI BADLAAV: TYPEWRITER EFFECT FUNCTION ---
// Yeh naya function AI ke jawab ko letter-by-letter screen par type karega.
async function typewriterEffect(element, text, onComplete) {
    let i = 0;
    element.innerHTML = ""; // Pehle se मौजूद content ko saaf karein
    const speed = 15; // Typing ki speed (milliseconds mein). Kam value matlab tez typing.

    function type() {
        if (i < text.length) {
            // HTML tags ko ek saath add karein, character by character nahi
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
            element.scrollTop = element.scrollHeight; // Type hote samay neeche scroll karein
            setTimeout(type, speed);
        } else if (onComplete) {
            onComplete(); // Jab typing poori ho jaye, toh onComplete function ko call karein
        }
    }
    type();
}


// --- HELPER FUNCTION FOR API REQUESTS ---
// Is function mein zaroori badlaav kiya gaya hai taaki yeh naye typewriter effect ka istemal kare.
async function handleApiRequest(button, container, responseDiv, url, getBody) {
    const body = getBody();
    if (!body) return; // Agar body nahi hai toh kuch mat karo

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
        
        const key = Object.keys(data)[0];
        const fullText = data[key] || "No content received.";

        // ✅ BADLAAV: Ab hum seedhe render nahi karenge. Pehle typewriter effect chalayenge.
        // Typewriter poora hone ke baad, hum content ko format karenge.
        await typewriterEffect(responseDiv, fullText, async () => {
            await renderEnhancedAIContent(responseDiv, fullText);
        });

    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Sorry, an error occurred: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


// --- PAGINATION LOGIC ---
// Yeh sahi hai aur lambe jawabon ko page mein baantne ka kaam karta hai. Ismein koi badlaav nahi.
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

    for (let i = 0; i < pageDivs.length; i++) {
        await renderEnhancedAIContent(pageDivs[i], pages[i]);
    }

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


// --- Yahan se mukhya event listeners shuru hote hain. Inmein koi badlaav nahi hai ---
document.addEventListener('DOMContentLoaded', function() {

    // --- CUSTOM COUNT INPUT LOGIC ---
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

    // Image file ka naam dikhane ke liye
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
        if (imageFile) {
            formData.append('image', imageFile);
        }

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
            if (!response.ok) {
                throw new Error(data.error || 'Server error occurred.');
            }
            
            const fullText = data.answer;
            await typewriterEffect(responseDiv, fullText, async () => {
                await renderEnhancedAIContent(responseDiv, fullText);
            });

        } catch (error) {
            responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Answer';
            questionInput.value = '';
            imageInput.value = '';
            if(fileNameDisplay) fileNameDisplay.textContent = '';
        }
    });

    // 2. Generate Notes
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

    // 3. Practice MCQs
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
            if (!response.ok) {
                throw new Error(questions.error || 'Could not generate quiz.');
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
    
    // 4. Get Solved Examples
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

    // 5. Get Career Advice
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
        const container = document.getElementById('study-plan-response-container');
        const contentArea = document.getElementById('study-plan-paginated-content');
        const controlsArea = document.getElementById('study-plan-pagination-controls');

        if (details === '') {
            alert('Please provide details for the plan.');
            return;
        }

        button.disabled = true;
        button.textContent = 'Creating...';
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
        
        if (topic === '') {
            alert('Please enter a topic for flashcards.');
            return;
        }

        let count = document.querySelector('input[name="flashcard-count"]:checked').value;
        if (count === 'custom') {
            count = document.getElementById('flashcard-custom-count').value;
        }

        button.disabled = true;
        button.textContent = 'Creating...';
        container.style.display = 'block';
        container.innerHTML = '<div class="loading-animation">Generating Flashcards...</div>';

        try {
            const user = firebase.auth().currentUser;
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                const idToken = await user.getIdToken(true);
                headers['Authorization'] = 'Bearer ' + idToken;
            }

            const response = await fetch('/generate-flashcards-ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ topic, count })
            });

            const cards = await response.json();
            if (!response.ok) throw new Error(cards.error || 'Could not create flashcards.');
            await displayFlashcards(cards);
        } catch (error) {
            container.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Create Flashcards';
        }
    });
        
    // 8. Write Essay
    document.getElementById('write-essay-btn').addEventListener('click', function() {
        const button = this;
        const topicInput = document.getElementById('essay-topic-input');
        const container = document.getElementById('essay-writer-response-container');
        const responseDiv = document.getElementById('essay-writer-response');

        handleApiRequest(button, container, responseDiv, '/write-essay-ai', () => {
            const topic = topicInput.value.trim();
            if (topic === '') {
                alert('Please enter a topic.');
                return null;
            }
            return { topic };
        });
    });

    // 9. Create Presentation
    document.getElementById('create-presentation-btn').addEventListener('click', function() {
        const button = this;
        const topicInput = document.getElementById('presentation-topic-input');
        const container = document.getElementById('presentation-maker-response-container');
        const responseDiv = document.getElementById('presentation-maker-response');

        handleApiRequest(button, container, responseDiv, '/create-presentation-ai', () => {
            const topic = topicInput.value.trim();
            if (topic === '') {
                alert('Please enter a topic.');
                return null;
            }
            return { topic };
        });
    });
        
    // 10. Get Explanation
    document.getElementById('get-explanation-btn').addEventListener('click', function() {
        const button = this;
        const conceptInput = document.getElementById('concept-input');
        const container = document.getElementById('concept-output-container');
        const responseDiv = document.getElementById('explainer-response');

        handleApiRequest(button, container, responseDiv, '/explain-concept-ai', () => {
            const topic = conceptInput.value.trim();
            if (topic === '') {
                alert('Please enter a concept.');
                return null;
            }
            return { topic };
        });
    });

    // --- QUIZ HELPER FUNCTIONS ---
    async function displayQuestions(questions) {
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

        getQuizAnalysis(userAnswersForAnalysis);
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

            await renderEnhancedAIContent(analysisDiv, data.analysis);
        } catch (error) {
            analysisDiv.innerHTML = `<p style="color: var(--color-red);">Could not get analysis: ${error.message}</p>`;
        }
    }

    document.getElementById('retake-quiz-btn').addEventListener('click', function() {
        document.getElementById('mcq-quiz-view').style.display = 'none';
        document.getElementById('mcq-setup-view').style.display = 'block';
        document.getElementById('mcq-topic-input').value = '';
    });

    async function displayFlashcards(cards) {
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
