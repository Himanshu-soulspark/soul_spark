// --- WELCOME SCREEN LOGIC ---
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
        }, 500);
    }, 4000);
});

// --- NAVIGATION LOGIC ---
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
    window.scrollTo(0, 0);
}

// Function to process AI content for display
function renderAIContent(element, content) {
    if (!element) return;
    const cleanedContent = content.replace(/```json\n?([\s\S]*?)```/g, '$1').trim();
    element.innerHTML = marked.parse(cleanedContent);
    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

// --- HELPER FUNCTION FOR API REQUESTS ---
async function handleApiRequest(formId, buttonId, containerId, responseId, url, body) {
    const form = document.getElementById(formId);
    if (!form) return;

    const submitButton = document.getElementById(buttonId);
    const responseContainer = document.getElementById(containerId);
    const responseDiv = document.getElementById(responseId);

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
        renderAIContent(responseDiv, data[key]);
        
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText;
    }
}

// --- NEW: PAGINATION LOGIC ---
let paginationData = {};

function renderPaginatedContent(contentAreaId, controlsId, content) {
    const contentArea = document.getElementById(contentAreaId);
    const controlsArea = document.getElementById(controlsId);
    
    if (!contentArea || !controlsArea) return;

    // Split content by '---' surrounded by newlines
    const pages = content.split(/\n---\n/).map(p => p.trim()).filter(p => p.length > 0);
    
    paginationData[contentAreaId] = {
        pages: pages,
        currentPage: 0
    };

    contentArea.innerHTML = '';
    pages.forEach((pageContent, index) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'content-page';
        if (index === 0) pageDiv.classList.add('active');
        pageDiv.innerHTML = marked.parse(pageContent);
        contentArea.appendChild(pageDiv);
    });

    controlsArea.innerHTML = `
        <button class="pagination-btn" id="${contentAreaId}-back" onclick="changePage('${contentAreaId}', -1)">Back</button>
        <span class="page-indicator" id="${contentAreaId}-indicator">Page 1 of ${pages.length}</span>
        <button class="pagination-btn" id="${contentAreaId}-next" onclick="changePage('${contentAreaId}', 1)">Next</button>
    `;

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


// --- CUSTOM INPUT LOGIC ---
function setupCustomInput(radioGroupName, customInputId) {
    const radios = document.querySelectorAll(`input[name="${radioGroupName}"]`);
    const customInput = document.getElementById(customInputId);
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            customInput.disabled = (radio.value !== 'custom');
        });
    });
}
setupCustomInput('mcq-count', 'mcq-custom-count');
setupCustomInput('flashcard-count', 'flashcard-custom-count');
setupCustomInput('solved-notes-count', 'solved-notes-custom-count');


// --- EXISTING AND MODIFIED FEATURES LOGIC ---

// ASK DOUBT (No Change)
document.getElementById('doubt-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const doubtInput = document.getElementById('doubt-input');
    const imageFile = document.getElementById('doubt-image-input').files[0];
    const responseContainer = document.getElementById('ai-response-container');
    const responseDiv = document.getElementById('ai-response');
    const submitButton = document.getElementById('ask-doubt-submit');

    if (doubtInput.value.trim() === '' && !imageFile) return alert('Please apna sawaal likhein ya image upload karein.');

    submitButton.disabled = true; submitButton.textContent = 'Analyzing...';
    responseContainer.style.display = 'block'; responseDiv.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';

    const formData = new FormData();
    formData.append('question', doubtInput.value);
    if (imageFile) formData.append('image', imageFile);
    
    try {
        const response = await fetch('/ask-ai-image', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        renderAIContent(responseDiv, data.answer);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false; submitButton.textContent = 'Get Answer';
        document.getElementById('doubt-form').reset();
        document.getElementById('file-name-display').textContent = '';
    }
});

// GENERATE NOTES (MODIFIED)
document.getElementById('notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('notes-topic-input').value.trim();
    const noteType = document.querySelector('input[name="note-type"]:checked').value;
    if(topic) handleApiRequest('notes-form', 'generate-notes-submit', 'notes-response-container', 'notes-response', '/generate-notes-ai', { topic, noteType });
});

// PRACTICE MCQs (MODIFIED)
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

    startBtn.disabled = true; startBtn.textContent = 'Generating...';
    setupView.style.display = 'none'; quizView.style.display = 'block';
    document.getElementById('quiz-topic-title').textContent = `Quiz on: ${topic}`;
    quizContainer.innerHTML = `<p>AI aapke liye ${count} sawaal taiyaar kar raha hai...</p>`;
    document.getElementById('quiz-result').innerHTML = '';
    document.getElementById('submit-quiz-btn').style.display = 'block';
    document.getElementById('post-quiz-options').style.display = 'none';

    try {
        const response = await fetch('/generate-mcq-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count }) });
        const questions = await response.json();
        if (!response.ok) throw new Error(questions.error);
        displayQuestions(questions);
    } catch (error) {
        quizContainer.innerHTML = `<p style="color: var(--color-red);">Quiz generate nahi ho saka: ${error.message}</p>`;
        setupView.style.display = 'block'; quizView.style.display = 'none';
    } finally {
        startBtn.disabled = false; startBtn.textContent = 'Start Quiz';
    }
});

function displayQuestions(questions) {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';
    window.correctAnswers = questions.map(q => q.correct_answer);
    questions.forEach((q, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'mcq-question-block';
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        let optionsHTML = shuffledOptions.map(option => `<label class="mcq-option"><input type="radio" name="question-${index}" value="${option}"> <span>${option}</span></label>`).join('');
        questionElement.innerHTML = `<p class="question-text"><strong>Q${index + 1}:</strong> ${q.question}</p><div class="options-container" id="options-${index}">${optionsHTML}</div>`;
        quizContainer.appendChild(questionElement);
    });
}

document.getElementById('submit-quiz-btn')?.addEventListener('click', () => {
    let score = 0;
    window.correctAnswers.forEach((answer, i) => {
        const selected = document.querySelector(`input[name="question-${i}"]:checked`);
        document.getElementById(`options-${i}`).querySelectorAll('label').forEach(label => {
            label.style.pointerEvents = 'none';
            if (label.querySelector('input').value === answer) label.style.borderLeft = '5px solid var(--color-green)';
        });
        if (selected) {
            if (selected.value === answer) score++;
            else selected.parentElement.style.borderLeft = '5px solid var(--color-red)';
        }
    });
    document.getElementById('quiz-result').innerHTML = `Your Score: ${score} out of ${window.correctAnswers.length}`;
    document.getElementById('submit-quiz-btn').style.display = 'none';
    document.getElementById('post-quiz-options').style.display = 'block';
});

document.getElementById('retake-quiz-btn')?.addEventListener('click', () => {
    document.getElementById('mcq-quiz-view').style.display = 'none';
    document.getElementById('mcq-setup-view').style.display = 'block';
    document.getElementById('mcq-topic-input').value = '';
});

// SOLVED NOTES (MODIFIED)
document.getElementById('solved-notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('solved-notes-topic-input').value.trim();
    const selectedCountRadio = document.querySelector('input[name="solved-notes-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') {
        count = document.getElementById('solved-notes-custom-count').value;
    }
    if(topic) handleApiRequest('solved-notes-form', 'get-solved-notes-btn', 'solved-notes-response-container', 'solved-notes-response', '/get-solved-notes-ai', { topic, count });
});

// CAREER COUNSELOR (MODIFIED for Pagination)
document.getElementById('career-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const interests = document.getElementById('career-interests-input').value.trim();
    if(!interests) return;

    const button = document.getElementById('get-career-advice-btn');
    const container = document.getElementById('career-response-container');
    const contentArea = document.getElementById('career-paginated-content');
    const controlsArea = document.getElementById('career-pagination-controls');

    button.disabled = true; button.textContent = 'Generating...';
    container.style.display = 'block';
    contentArea.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';
    controlsArea.innerHTML = '';
    
    try {
        const response = await fetch('/get-career-advice-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interests }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Get Career Advice';
    }
});

// STUDY PLANNER (MODIFIED for Pagination)
document.getElementById('study-plan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const details = document.getElementById('study-plan-details-input').value.trim();
    if(!details) return;

    const button = document.getElementById('generate-study-plan-btn');
    const container = document.getElementById('study-plan-response-container');
    const contentArea = document.getElementById('study-plan-paginated-content');
    const controlsArea = document.getElementById('study-plan-pagination-controls');

    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    contentArea.innerHTML = '<p>AI से जवाब मिलने का इंतज़ार है...</p>';
    controlsArea.innerHTML = '';

    try {
        const response = await fetch('/generate-study-plan-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ details }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create My Plan';
    }
});

// FLASHCARDS (MODIFIED)
document.getElementById('flashcard-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = document.getElementById('flashcard-topic-input').value.trim();
    if (!topic) return alert('Please enter a topic.');

    const selectedCountRadio = document.querySelector('input[name="flashcard-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') {
        count = document.getElementById('flashcard-custom-count').value;
    }

    const button = document.getElementById('generate-flashcards-btn');
    const container = document.getElementById('flashcard-response-container');
    
    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    container.innerHTML = `<p>AI ${count} flashcards bana raha hai...</p>`;

    try {
        const response = await fetch('/generate-flashcards-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count }) });
        const cards = await response.json();
        if (!response.ok) throw new Error(cards.error);
        displayFlashcards(cards);
    } catch (error) {
        container.innerHTML = `<p style="color: var(--color-red);">Flashcards nahi ban sake: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create Flashcards';
    }
});

function displayFlashcards(cards) {
    const container = document.getElementById('flashcard-response-container');
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'flashcard-grid';
    cards.forEach(cardData => {
        const cardEl = document.createElement('div');
        cardEl.className = 'flashcard';
        cardEl.innerHTML = `<div class="flashcard-inner"><div class="card-front">${cardData.front}</div><div class="card-back">${cardData.back}</div></div>`;
        cardEl.addEventListener('click', () => cardEl.classList.toggle('flipped'));
        grid.appendChild(cardEl);
    });
    container.appendChild(grid);
}

// ESSAY WRITER (No Change)
document.getElementById('essay-writer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('essay-topic-input').value.trim();
    if(topic) handleApiRequest('essay-writer-form', 'write-essay-btn', 'essay-writer-response-container', 'essay-writer-response', '/write-essay-ai', { topic });
});

// PRESENTATION MAKER (No Change)
document.getElementById('presentation-maker-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('presentation-topic-input').value.trim();
    if(topic) handleApiRequest('presentation-maker-form', 'create-presentation-btn', 'presentation-maker-response-container', 'presentation-maker-response', '/create-presentation-ai', { topic });
});

// CONCEPT EXPLAINER (No Change)
document.getElementById('explainer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('explainer-topic-input').value.trim();
    if(topic) handleApiRequest('explainer-form', 'get-explanation-btn', 'explainer-response-container', 'explainer-response', '/explain-concept-ai', { topic });
});
