// --- WELCOME SCREEN LOGIC ---
// यह हिस्सा बिलकुल सही था, इसे वैसे ही रखा गया है।
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) {
                 appContainer.style.display = 'block';
                 // App container को fade in करने के लिए जोड़ा गया
                 setTimeout(() => appContainer.style.opacity = '1', 50);
            }
        }, 500);
    }, 3500);
});


// --- NAVIGATION LOGIC ---
// यह फंक्शन भी बिलकुल सही है।
function navigateTo(screenId) {
    document.querySelectorAll('.app-container .screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    window.scrollTo(0, 0);
}


// --- AI CONTENT RENDERER ---
// यह फंक्शन मार्कडाउन, मैथ और कोड को सुंदर दिखाने के लिए है। यह बिलकुल सही है।
async function renderEnhancedAIContent(element, content) {
    if (!element) return;
    
    // MathJax को ठीक से काम करने के लिए [math]...[/math] को बदलना नहीं है
    // [chem]...[/chem] को एक खास स्टाइल देने के लिए बदला गया
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


// --- HELPER FUNCTION FOR API REQUESTS ---
// यह फंक्शन भी सही काम कर रहा है।
async function handleApiRequest(button, container, responseDiv, url, getBody) {
    const body = getBody();
    if (!body) return; // अगर बॉडी नहीं है तो कुछ मत करो

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Generating...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Generating... Please wait.</div>';

    try {
        // Firebase Auth Token को हर रिक्वेस्ट के साथ भेजना (अगर यूज़र लॉग इन है)
        const user = firebase.auth().currentUser;
        const headers = {
            'Content-Type': 'application/json'
        };
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
            // सर्वर से मिले एरर मैसेज को दिखाना
            throw new Error(data.error || 'Server error occurred.');
        }
        
        const key = Object.keys(data)[0]; // जवाब का पहला की (key) लेना
        await renderEnhancedAIContent(responseDiv, data[key] || "No content received.");

    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Sorry, an error occurred: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


// --- PAGINATION LOGIC ---
// यह भी सही है।
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


// --- ✅✅✅ यहाँ से मुख्य बदलाव शुरू होते हैं ---
document.addEventListener('DOMContentLoaded', function() {

    // --- CUSTOM COUNT INPUT LOGIC ---
    // यह सही है, इसे वैसे ही रखा गया है।
    document.querySelectorAll('input[type="radio"][value="custom"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const customInput = this.closest('.option-selector-group').querySelector('.custom-count-input');
            if (customInput) {
                customInput.disabled = !this.checked;
                if (this.checked) customInput.focus();
            }
        });
        // Non-custom radio buttons disable the custom input
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
            if (this.files.length > 0) {
                fileNameDisplay.textContent = `File: ${this.files[0].name}`;
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    }


    // 1. Ask Doubt
    // ✅ FIX: अब यह 'submit' के बजाय 'ask-doubt-submit' बटन के 'click' पर काम करेगा।
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
                headers: headers, // Form data के साथ Content-Type नहीं देना होता, ब्राउज़र खुद सेट करता है
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Server error occurred.');
            }
            await renderEnhancedAIContent(responseDiv, data.answer);
        } catch (error) {
            responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Answer';
            questionInput.value = '';
            imageInput.value = ''; // फाइल इनपुट को रीसेट करना
            fileNameDisplay.textContent = '';
        }
    });

    // 2. Generate Notes
    // ✅ FIX: अब यह 'generate-notes-submit' बटन के 'click' पर काम करेगा।
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
    // ✅ FIX: अब यह 'start-quiz-btn' बटन के 'click' पर काम करेगा।
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
            window.currentQuizQuestions = questions; // Store globally for submission
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
    // ✅ FIX: अब यह 'get-solved-notes-btn' बटन के 'click' पर काम करेगा।
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
    // ✅ FIX: अब यह 'get-career-advice-btn' बटन के 'click' पर काम करेगा।
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
            if (!response.ok) throw new Error(data.error);
            await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
        } catch (error) {
            contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Get Career Advice';
        }
    });

    // 6. Generate Study Plan
    // ✅ FIX: अब यह 'generate-study-plan-btn' बटन के 'click' पर काम करेगा।
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
            if (!response.ok) throw new Error(data.error);
            await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
        } catch (error) {
            contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Create My Plan';
        }
    });
        
    // 7. Generate Flashcards
    // ✅ FIX: अब यह 'generate-flashcards-btn' बटन के 'click' पर काम करेगा।
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
            if (!response.ok) throw new Error(cards.error);
            await displayFlashcards(cards);
        } catch (error) {
            container.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Create Flashcards';
        }
    });
        
    // 8. Write Essay
    // ✅ FIX: अब यह 'write-essay-btn' बटन के 'click' पर काम करेगा।
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
    // ✅ FIX: अब यह 'create-presentation-btn' बटन के 'click' पर काम करेगा।
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
    // ✅ FIX: अब यह 'get-explanation-btn' बटन के 'click' पर काम करेगा।
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

    // --- QUIZ HELPER FUNCTIONS (ये सही हैं) ---
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
            
            // Render option text after adding to DOM
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
            if (!response.ok) throw new Error(data.error);

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
