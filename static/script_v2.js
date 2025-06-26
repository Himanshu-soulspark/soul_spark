// --- WELCOME SCREEN LOGIC ---
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    // This logic is kept exactly the same to ensure it works as before.
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) {
                // ज़रूरी बदलाव: appContainer को block करने के बाद उसे दिखाना भी ज़रूरी है।
                appContainer.style.display = 'block';
                appContainer.style.opacity = '1';
            }
        }, 500);
    }, 4000); // Original timeout was 4000ms, keeping it same.
});

// --- NAVIGATION LOGIC ---
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
    window.scrollTo(0, 0);
}

// --- ✅✅✅ NEW & SAFER: ENHANCED AI CONTENT RENDERER ---
// This function is now 'async' to safely wait for MathJax to finish.
async function renderEnhancedAIContent(element, content) {
    if (!element) return;

    // 1. Pre-process custom tags. We leave [math] tags alone for MathJax.
    let processedContent = content
        .replace(/\[chem\]([\s\S]*?)\[\/chem\]/g, '<span class="chem-reaction">$1</span>');

    // 2. Convert markdown to HTML.
    const htmlContent = marked.parse(processedContent);
    element.innerHTML = htmlContent;

    // 3. Apply dynamic styling for keywords and code blocks.
    const highlightColors = ['highlight-yellow', 'highlight-skyblue', 'highlight-pink'];
    element.querySelectorAll('strong').forEach((strongEl, index) => {
        strongEl.classList.add(highlightColors[index % highlightColors.length]);
    });
    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    // 4. Safely process math formulas using MathJax.
    // We check if MathJax and its typesetting function are available.
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        try {
            // 'await' ensures we wait for MathJax to finish before continuing.
            // This prevents race conditions and makes the process stable.
            await window.MathJax.typesetPromise([element]);
        } catch (err) {
            console.error('MathJax rendering failed:', err);
        }
    }
}

// --- HELPER FUNCTION FOR API REQUESTS (Now uses async render function) ---
// Note: This function is good but the event listeners below are the main problem. We will call it from corrected listeners.
async function handleApiRequest(buttonId, containerId, responseId, url, body) {
    const submitButton = document.getElementById(buttonId);
    const responseContainer = document.getElementById(containerId);
    const responseDiv = document.getElementById(responseId);

    if (!submitButton || !responseContainer || !responseDiv) {
        console.error("Helper function error: One or more element IDs are wrong.", { buttonId, containerId, responseId });
        return;
    }

    submitButton.disabled = true;
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = 'Generating...';
    responseContainer.style.display = 'block';
    responseDiv.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Server से response नहीं मिला।');

        const key = Object.keys(data)[0];
        // Use the new, safer async renderer. We 'await' it.
        await renderEnhancedAIContent(responseDiv, data[key]);

    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText;
    }
}

// --- PAGINATION LOGIC (Now uses async render function) ---
let paginationData = {};

async function renderPaginatedContent(contentAreaId, controlsId, content) {
    const contentArea = document.getElementById(contentAreaId);
    const controlsArea = document.getElementById(controlsId);

    if (!contentArea || !controlsArea) return;

    const pages = content.split(/\n---\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (pages.length === 0) {
        contentArea.innerHTML = "<p>No content to display.</p>";
        controlsArea.innerHTML = '';
        return;
    }

    paginationData[contentAreaId] = { pages: pages, currentPage: 0 };

    contentArea.innerHTML = '';
    // We create all page divs first
    const pageDivs = pages.map((pageContent, index) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'content-page';
        if (index === 0) pageDiv.classList.add('active');
        contentArea.appendChild(pageDiv);
        return pageDiv;
    });

    // Then we render content in them asynchronously
    for (let i = 0; i < pageDivs.length; i++) {
        await renderEnhancedAIContent(pageDivs[i], pages[i]);
    }

    controlsArea.innerHTML = `<button class="pagination-btn" id="${contentAreaId}-back" onclick="changePage('${contentAreaId}', -1)">Back</button> <span class="page-indicator" id="${contentAreaId}-indicator">Page 1 of ${pages.length}</span> <button class="pagination-btn" id="${contentAreaId}-next" onclick="changePage('${contentAreaId}', 1)">Next</button>`;

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
    const indicator = document.getElementById(`${contentAreaId}-indicator`);
    const backBtn = document.getElementById(`${contentAreaId}-back`);
    const nextBtn = document.getElementById(`${contentAreaId}-next`);

    if(indicator) indicator.textContent = `Page ${data.currentPage + 1} of ${data.pages.length}`;
    if(backBtn) backBtn.disabled = (data.currentPage === 0);
    if(nextBtn) nextBtn.disabled = (data.currentPage === data.pages.length - 1);
}

// --- CUSTOM INPUT LOGIC ---
function setupCustomInput(radioGroupName, customInputId) {
    const radios = document.querySelectorAll(`input[name="${radioGroupName}"]`);
    const customInput = document.getElementById(customInputId);
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if(customInput) customInput.disabled = (radio.value !== 'custom');
        });
    });
}
setupCustomInput('mcq-count', 'mcq-custom-count');
setupCustomInput('flashcard-count', 'flashcard-custom-count');
setupCustomInput('solved-notes-count', 'solved-notes-custom-count');

// --- ========================================================== ---
// --- ✅✅✅ ज़रूरी बदलाव: सभी Event Listeners को ठीक किया गया ✅✅✅ ---
// --- ========================================================== ---

// ASK DOUBT
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('ask-doubt-submit')?.addEventListener('click', async () => {
    const doubtInput = document.getElementById('doubt-input');
    const imageInput = document.getElementById('doubt-image-input');
    const imageFile = imageInput.files[0];
    const responseContainer = document.getElementById('ai-response-container');
    const responseDiv = document.getElementById('ai-response');
    const submitButton = document.getElementById('ask-doubt-submit');

    if (doubtInput.value.trim() === '' && !imageFile) return alert('Please apna sawaal likhein ya image upload karein.');

    submitButton.disabled = true;
    submitButton.textContent = 'Analyzing...';
    responseContainer.style.display = 'block';
    responseDiv.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';

    const formData = new FormData();
    formData.append('question', doubtInput.value);
    if (imageFile) formData.append('image', imageFile);

    try {
        const response = await fetch('/ask-ai-image', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await renderEnhancedAIContent(responseDiv, data.answer);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Get Answer';
        doubtInput.value = '';
        imageInput.value = ''; // Reset file input
        document.getElementById('file-name-display').textContent = '';
    }
});

// GENERATE NOTES
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('generate-notes-submit')?.addEventListener('click', () => {
    const topic = document.getElementById('notes-topic-input').value.trim();
    const noteType = document.querySelector('input[name="note-length"]:checked').value;
    if (topic) {
        handleApiRequest('generate-notes-submit', 'notes-output-container', 'notes-response', '/generate-notes-ai', { topic, noteType });
    } else {
        alert("Please provide a topic.");
    }
});

// PRACTICE MCQs (This was already correct with a click listener)
document.getElementById('start-quiz-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('mcq-topic-input').value.trim();
    if (topic === '') return alert('Please ek topic likhein.');

    const selectedCountRadio = document.querySelector('input[name="mcq-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') {
        count = document.getElementById('mcq-custom-count').value;
    }

    const setupView = document.getElementById('mcq-setup-view');
    const quizView = document.getElementById('mcq-quiz-view');
    const quizContainer = document.getElementById('quiz-container');
    const startBtn = document.getElementById('start-quiz-btn');

    startBtn.disabled = true;
    startBtn.textContent = 'Generating...';
    setupView.style.display = 'none';
    quizView.style.display = 'block';
    document.getElementById('quiz-topic-title').textContent = `Quiz on: ${topic}`;
    quizContainer.innerHTML = `<p>AI aapke liye ${count} sawaal taiyaar kar raha hai...</p>`;
    document.getElementById('quiz-result').innerHTML = '';
    document.getElementById('submit-quiz-btn').style.display = 'block';
    document.getElementById('post-quiz-options').style.display = 'none';
    document.getElementById('quiz-analysis-report').innerHTML = '';
    document.getElementById('quiz-analysis-report').style.display = 'none';

    try {
        const response = await fetch('/generate-mcq-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count }) });
        const questions = await response.json();
        if (!response.ok) throw new Error(questions.error);
        window.currentQuizQuestions = questions;
        await displayQuestions(questions); // await for questions to be displayed
    } catch (error) {
        quizContainer.innerHTML = `<p style="color: var(--color-red);">Quiz generate nahi ho saka: ${error.message}</p>`;
        setupView.style.display = 'block';
        quizView.style.display = 'none';
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Quiz';
    }
});

async function displayQuestions(questions) {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';
    window.correctAnswers = questions.map(q => q.correct_answer);

    for (const [index, q] of questions.entries()) {
        const questionElement = document.createElement('div');
        questionElement.className = 'mcq-question-block';

        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        let optionsHTML = shuffledOptions.map(option => `<label class="mcq-option"><input type="radio" name="question-${index}" value="${option}"> <span>${option}</span></label>`).join('');

        const questionTextDiv = document.createElement('div');
        // Render the question text properly first
        await renderEnhancedAIContent(questionTextDiv, `<strong>Q${index + 1}:</strong> ${q.question}`);

        // Then build the final HTML
        questionElement.innerHTML = `${questionTextDiv.innerHTML}<div class="options-container" id="options-${index}">${optionsHTML}</div>`;
        quizContainer.appendChild(questionElement);
    }
}

// UPDATED Submit Quiz Logic
document.getElementById('submit-quiz-btn')?.addEventListener('click', () => {
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

        document.getElementById(`options-${i}`).querySelectorAll('label').forEach(label => {
            label.style.pointerEvents = 'none';
            if (label.querySelector('input').value === correctAnswer) {
                label.style.borderLeft = '5px solid var(--color-green)';
            }
        });
        if (selectedRadio && !isCorrect) {
            selectedRadio.parentElement.style.borderLeft = '5px solid var(--color-red)';
        }

        if (isCorrect) score++;
    });

    document.getElementById('quiz-result').innerHTML = `<h3>Your Score: ${score} / ${window.correctAnswers.length}</h3>`;
    document.getElementById('submit-quiz-btn').style.display = 'none';
    document.getElementById('post-quiz-options').style.display = 'block';

    getQuizAnalysis(userAnswersForAnalysis);
});

async function getQuizAnalysis(answers) {
    const analysisDiv = document.getElementById('quiz-analysis-report');
    if (!analysisDiv) return;
    analysisDiv.innerHTML = '<p>Aapke performance ka analysis kiya ja raha hai...</p>';
    analysisDiv.style.display = 'block';

    try {
        const response = await fetch('/analyze-quiz-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: answers })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        await renderEnhancedAIContent(analysisDiv, data.analysis);
    } catch (error) {
        analysisDiv.innerHTML = `<p style="color: var(--color-red);">Analysis nahi ho saka: ${error.message}</p>`;
    }
}

document.getElementById('retake-quiz-btn')?.addEventListener('click', () => {
    document.getElementById('mcq-quiz-view').style.display = 'none';
    document.getElementById('mcq-setup-view').style.display = 'block';
    document.getElementById('mcq-topic-input').value = '';
});

// SOLVED NOTES
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('get-solved-notes-btn')?.addEventListener('click', () => {
    const topic = document.getElementById('solved-notes-topic-input').value.trim();
    const selectedCountRadio = document.querySelector('input[name="solved-notes-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') {
        count = document.getElementById('solved-notes-custom-count').value;
    }
    if (topic) {
        handleApiRequest('get-solved-notes-btn', 'solved-notes-response-container', 'solved-notes-response', '/get-solved-notes-ai', { topic, count });
    } else {
        alert("Please provide a topic.");
    }
});

// CAREER COUNSELOR
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('get-career-advice-btn')?.addEventListener('click', async () => {
    const interests = document.getElementById('career-interests-input').value.trim();
    if (!interests) return alert("Please provide your interests.");

    const button = document.getElementById('get-career-advice-btn');
    const container = document.getElementById('career-response-container');
    const contentArea = document.getElementById('career-paginated-content');
    const controlsArea = document.getElementById('career-pagination-controls');

    button.disabled = true;
    button.textContent = 'Generating...';
    container.style.display = 'block';
    contentArea.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';
    controlsArea.innerHTML = '';

    try {
        const response = await fetch('/get-career-advice-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interests }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Get Career Advice';
    }
});

// STUDY PLANNER
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('generate-study-plan-btn')?.addEventListener('click', async () => {
    const details = document.getElementById('study-plan-details-input').value.trim();
    if (!details) return alert("Please provide details for the plan.");

    const button = document.getElementById('generate-study-plan-btn');
    const container = document.getElementById('study-plan-response-container');
    const contentArea = document.getElementById('study-plan-paginated-content');
    const controlsArea = document.getElementById('study-plan-pagination-controls');

    button.disabled = true;
    button.textContent = 'Creating...';
    container.style.display = 'block';
    contentArea.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';
    controlsArea.innerHTML = '';

    try {
        const response = await fetch('/generate-study-plan-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ details }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Create My Plan';
    }
});

// FLASHCARDS
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('generate-flashcards-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('flashcard-topic-input').value.trim();
    if (!topic) return alert('Please enter a topic.');

    const selectedCountRadio = document.querySelector('input[name="flashcard-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') {
        count = document.getElementById('flashcard-custom-count').value;
    }

    const button = document.getElementById('generate-flashcards-btn');
    const container = document.getElementById('flashcard-response-container');

    button.disabled = true;
    button.textContent = 'Creating...';
    container.style.display = 'block';
    container.innerHTML = `<p>AI ${count} flashcards bana raha hai...</p>`;

    try {
        const response = await fetch('/generate-flashcards-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count }) });
        const cards = await response.json();
        if (!response.ok) throw new Error(cards.error);
        await displayFlashcards(cards); // await for cards to be displayed
    } catch (error) {
        container.innerHTML = `<p style="color: var(--color-red);">Flashcards nahi ban sake: ${error.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Create Flashcards';
    }
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
        const backDiv = document.createElement('div');
        frontDiv.className = 'card-front';
        backDiv.className = 'card-back';

        // Render front and back content safely
        await renderEnhancedAIContent(frontDiv, cardData.front);
        await renderEnhancedAIContent(backDiv, cardData.back);

        cardEl.innerHTML = `<div class="flashcard-inner">${frontDiv.outerHTML}${backDiv.outerHTML}</div>`;
        cardEl.addEventListener('click', () => cardEl.classList.toggle('flipped'));
        grid.appendChild(cardEl);
    }
    container.appendChild(grid);
}

// ESSAY WRITER
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('write-essay-btn')?.addEventListener('click', () => {
    const topic = document.getElementById('essay-topic-input').value.trim();
    if (topic) {
        handleApiRequest('write-essay-btn', 'essay-writer-response-container', 'essay-writer-response', '/write-essay-ai', { topic });
    } else {
        alert("Please provide an essay topic.");
    }
});

// PRESENTATION MAKER
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
document.getElementById('create-presentation-btn')?.addEventListener('click', () => {
    const topic = document.getElementById('presentation-topic-input').value.trim();
    if (topic) {
        handleApiRequest('create-presentation-btn', 'presentation-maker-response-container', 'presentation-maker-response', '/create-presentation-ai', { topic });
    } else {
        alert("Please provide a presentation topic.");
    }
});

// CONCEPT EXPLAINER
// ज़रूरी बदलाव: 'submit' की जगह बटन के 'click' इवेंट को सुना जा रहा है।
// HTML में बटन का ID 'get-explanation-btn' है और input का ID 'concept-input' है।
document.getElementById('get-explanation-btn')?.addEventListener('click', () => {
    const topic = document.getElementById('concept-input').value.trim();
    if (topic) {
        handleApiRequest('get-explanation-btn', 'concept-output-container', 'explainer-response', '/explain-concept-ai', { topic });
    } else {
        alert("Please provide a concept to explain.");
    }
});
