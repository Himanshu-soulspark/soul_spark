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

// GENERATE NOTES (No Change)
document.getElementById('notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('notes-topic-input').value.trim();
    if(topic) handleApiRequest('notes-form', 'generate-notes-submit', 'notes-response-container', 'notes-response', '/generate-notes-ai', { topic });
});

// PRACTICE MCQs (No Change)
document.getElementById('start-quiz-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('mcq-topic-input').value.trim();
    if (topic === '') return alert('Please ek topic likhein.');
    
    const setupView = document.getElementById('mcq-setup-view');
    const quizView = document.getElementById('mcq-quiz-view');
    const quizContainer = document.getElementById('quiz-container');
    const startBtn = document.getElementById('start-quiz-btn');

    startBtn.disabled = true; startBtn.textContent = 'Generating...';
    setupView.style.display = 'none'; quizView.style.display = 'block';
    document.getElementById('quiz-topic-title').textContent = `Quiz on: ${topic}`;
    quizContainer.innerHTML = '<p>AI aapke liye sawaal taiyaar kar raha hai...</p>';
    document.getElementById('quiz-result').innerHTML = '';
    document.getElementById('submit-quiz-btn').style.display = 'block';
    document.getElementById('post-quiz-options').style.display = 'none';

    try {
        const response = await fetch('/generate-mcq-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
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

// SOLVED NOTES (No Change)
document.getElementById('solved-notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('solved-notes-topic-input').value.trim();
    if(topic) handleApiRequest('solved-notes-form', 'get-solved-notes-btn', 'solved-notes-response-container', 'solved-notes-response', '/get-solved-notes-ai', { topic });
});

// CAREER COUNSELOR (No Change)
document.getElementById('career-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const interests = document.getElementById('career-interests-input').value.trim();
    if(interests) handleApiRequest('career-form', 'get-career-advice-btn', 'career-response-container', 'career-response', '/get-career-advice-ai', { interests });
});

// STUDY PLANNER (No Change)
document.getElementById('study-plan-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const details = document.getElementById('study-plan-details-input').value.trim();
    if(details) handleApiRequest('study-plan-form', 'generate-study-plan-btn', 'study-plan-response-container', 'study-plan-response', '/generate-study-plan-ai', { details });
});

// FLASHCARDS (No Change in logic)
document.getElementById('flashcard-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = document.getElementById('flashcard-topic-input').value.trim();
    if (!topic) return alert('Please enter a topic.');

    const button = document.getElementById('generate-flashcards-btn');
    const container = document.getElementById('flashcard-response-container');
    
    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    container.innerHTML = '<p>AI flashcards bana raha hai...</p>';

    try {
        const response = await fetch('/generate-flashcards-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
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

// ESSAY WRITER (UPDATED)
document.getElementById('essay-writer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('essay-topic-input').value.trim();
    if(topic) handleApiRequest('essay-writer-form', 'write-essay-btn', 'essay-writer-response-container', 'essay-writer-response', '/write-essay-ai', { topic });
});

// PRESENTATION MAKER (UPDATED)
document.getElementById('presentation-maker-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('presentation-topic-input').value.trim();
    if(topic) handleApiRequest('presentation-maker-form', 'create-presentation-btn', 'presentation-maker-response-container', 'presentation-maker-response', '/create-presentation-ai', { topic });
});

// CONCEPT EXPLAINER (NEW)
document.getElementById('explainer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('explainer-topic-input').value.trim();
    if(topic) handleApiRequest('explainer-form', 'get-explanation-btn', 'explainer-response-container', 'explainer-response', '/explain-concept-ai', { topic });
});
