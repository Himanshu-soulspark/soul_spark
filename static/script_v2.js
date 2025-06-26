// --- WELCOME SCREEN LOGIC (कोई बदलाव नहीं) ---
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

// --- NAVIGATION LOGIC (कोई बदलाव नहीं) ---
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
    window.scrollTo(0, 0);
}

// --- AI CONTENT RENDERER (कोई बदलाव नहीं) ---
// यह फंक्शन पहले से ही बहुत अच्छा है और इसे बदलने की ज़रूरत नहीं है।
async function renderEnhancedAIContent(element, content) {
    if (!element) return;

    let processedContent = content
        .replace(/\[chem\]([\s\S]*?)\[\/chem\]/g, '<span class="chem-reaction">$1</span>');
    
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


// ⭐⭐⭐⭐⭐⭐⭐⭐ सबसे ज़रूरी बदलाव ⭐⭐⭐⭐⭐⭐⭐⭐
// यह नया फंक्शन Python सर्वर से आने वाले streaming response को हैंडल करता है।
async function handleApiStreamRequest(formId, buttonId, containerId, responseId, url, body) {
    const submitButton = document.getElementById(buttonId);
    const responseContainer = document.getElementById(containerId);
    const responseDiv = document.getElementById(responseId);

    if (!submitButton || !responseContainer || !responseDiv) return;

    submitButton.disabled = true;
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = 'Generating...';
    responseContainer.style.display = 'block';
    responseDiv.innerHTML = '<p>AI से जवाब मिलना शुरू हो रहा है...</p>';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json(); // Error response is likely JSON
            throw new Error(errorData.error || 'Server से response नहीं मिला।');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        responseDiv.innerHTML = ''; // जवाब आने से पहले एरिया खाली करें

        // Stream को टुकड़ों में पढ़ें
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            fullResponseText += chunk;
            // जवाब को Markdown में बदलकर दिखाएं
            responseDiv.innerHTML = marked.parse(fullResponseText); 
        }

        // पूरी तरह से लोड होने के बाद एक बार फिर से स्टाइल और MathJax लागू करें
        await renderEnhancedAIContent(responseDiv, fullResponseText);

    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText;
    }
}

// --- PAGINATION LOGIC (थोड़ा बदलाव ताकि streaming के बाद काम करे) ---
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

    controlsArea.innerHTML = `
        <button class="pagination-btn" id="${contentAreaId}-back" onclick="changePage('${contentAreaId}', -1)">Back</button>
        <span class="page-indicator" id="${contentAreaId}-indicator">Page 1 of ${pages.length}</span>
        <button class="pagination-btn" id="${contentAreaId}-next" onclick="changePage('${contentAreaId}', 1)">Next</button>
    `;
    updatePaginationControls(contentAreaId);
}

function changePage(contentAreaId, direction) { // कोई बदलाव नहीं
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

function updatePaginationControls(contentAreaId) { // कोई बदलाव नहीं
    const data = paginationData[contentAreaId];
    if (!data) return;
    document.getElementById(`${contentAreaId}-indicator`).textContent = `Page ${data.currentPage + 1} of ${data.pages.length}`;
    document.getElementById(`${contentAreaId}-back`).disabled = (data.currentPage === 0);
    document.getElementById(`${contentAreaId}-next`).disabled = (data.currentPage === data.pages.length - 1);
}

// --- CUSTOM INPUT LOGIC (कोई बदलाव नहीं) ---
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

// --- ⭐⭐ FORM SUBMISSION LOGIC में बदलाव ⭐⭐ ---

// ASK DOUBT (Streaming लागू)
document.getElementById('doubt-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const doubtInput = document.getElementById('doubt-input');
    const imageFile = document.getElementById('doubt-image-input').files[0];
    const responseContainer = document.getElementById('ai-response-container');
    const responseDiv = document.getElementById('ai-response');
    const submitButton = document.getElementById('ask-doubt-submit');

    if (doubtInput.value.trim() === '' && !imageFile) return alert('Please apna sawaal likhein ya image upload karein.');

    submitButton.disabled = true; submitButton.textContent = 'Analyzing...';
    responseContainer.style.display = 'block'; responseDiv.innerHTML = '<p>AI से जवाब मिलना शुरू हो रहा है...</p>';

    const formData = new FormData();
    formData.append('question', doubtInput.value);
    if (imageFile) formData.append('image', imageFile);
    
    try {
        const response = await fetch('/ask-ai-image', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Server से response नहीं मिला।');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        responseDiv.innerHTML = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponseText += decoder.decode(value);
            responseDiv.innerHTML = marked.parse(fullResponseText);
        }
        await renderEnhancedAIContent(responseDiv, fullResponseText);

    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false; submitButton.textContent = 'Get Answer';
        document.getElementById('doubt-form').reset();
        document.getElementById('file-name-display').textContent = '';
    }
});

// GENERATE NOTES (Streaming लागू)
document.getElementById('notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('notes-topic-input').value.trim();
    const noteType = document.querySelector('input[name="note-type"]:checked').value;
    if(topic) {
        handleApiStreamRequest('notes-form', 'generate-notes-submit', 'notes-response-container', 'notes-response', '/generate-notes-ai', { topic, noteType });
    }
});

// PRACTICE MCQs (कोई बदलाव नहीं, क्योंकि यह JSON इस्तेमाल करता है)
document.getElementById('start-quiz-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('mcq-topic-input').value.trim();
    if (topic === '') return alert('Please ek topic likhein.');
    
    const selectedCountRadio = document.querySelector('input[name="mcq-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') count = document.getElementById('mcq-custom-count').value;

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
    document.getElementById('quiz-analysis-report').innerHTML = '';

    try {
        const response = await fetch('/generate-mcq-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count }) });
        const questions = await response.json();
        if (!response.ok) throw new Error(questions.error);
        window.currentQuizQuestions = questions;
        await displayQuestions(questions);
    } catch (error) {
        quizContainer.innerHTML = `<p style="color: var(--color-red);">Quiz generate nahi ho saka: ${error.message}</p>`;
        setupView.style.display = 'block'; quizView.style.display = 'none';
    } finally {
        startBtn.disabled = false; startBtn.textContent = 'Start Quiz';
    }
});

async function displayQuestions(questions) { // कोई बदलाव नहीं
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';
    window.correctAnswers = questions.map(q => q.correct_answer);
    for (const [index, q] of questions.entries()) {
        const questionElement = document.createElement('div');
        questionElement.className = 'mcq-question-block';
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        let optionsHTML = shuffledOptions.map(option => `<label class="mcq-option"><input type="radio" name="question-${index}" value="${option}"> <span>${option}</span></label>`).join('');
        const questionTextDiv = document.createElement('div');
        await renderEnhancedAIContent(questionTextDiv, `<strong>Q${index + 1}:</strong> ${q.question}`);
        questionElement.innerHTML = `${questionTextDiv.innerHTML}<div class="options-container" id="options-${index}">${optionsHTML}</div>`;
        quizContainer.appendChild(questionElement);
    }
}

document.getElementById('submit-quiz-btn')?.addEventListener('click', () => { // कोई बदलाव नहीं
    let score = 0;
    const userAnswersForAnalysis = [];
    window.correctAnswers.forEach((correctAnswer, i) => {
        const selectedRadio = document.querySelector(`input[name="question-${i}"]:checked`);
        const questionData = window.currentQuizQuestions[i];
        let userAnswer = selectedRadio ? selectedRadio.value : "Not Answered";
        let isCorrect = (userAnswer === correctAnswer);
        userAnswersForAnalysis.push({ question: questionData.question, userAnswer: userAnswer, isCorrect: isCorrect, conceptTag: questionData.conceptTag || "General" });
        document.getElementById(`options-${i}`).querySelectorAll('label').forEach(label => {
            label.style.pointerEvents = 'none';
            if (label.querySelector('input').value === correctAnswer) label.style.borderLeft = '5px solid var(--color-green)';
        });
        if (selectedRadio && !isCorrect) selectedRadio.parentElement.style.borderLeft = '5px solid var(--color-red)';
        if (isCorrect) score++;
    });
    document.getElementById('quiz-result').innerHTML = `<h3>Your Score: ${score} / ${window.correctAnswers.length}</h3>`;
    document.getElementById('submit-quiz-btn').style.display = 'none';
    document.getElementById('post-quiz-options').style.display = 'block';
    getQuizAnalysis(userAnswersForAnalysis);
});

// Quiz Analysis (Streaming लागू)
async function getQuizAnalysis(answers) {
    const analysisDiv = document.getElementById('quiz-analysis-report');
    if (!analysisDiv) return;
    analysisDiv.innerHTML = '<p>Aapke performance ka analysis kiya ja raha hai...</p>';
    analysisDiv.style.display = 'block';
    try {
        const response = await fetch('/analyze-quiz-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: answers }) });
        if (!response.ok) throw new Error('Analysis server error');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        analysisDiv.innerHTML = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponseText += decoder.decode(value);
            analysisDiv.innerHTML = marked.parse(fullResponseText);
        }
        await renderEnhancedAIContent(analysisDiv, fullResponseText);
    } catch (error) {
        analysisDiv.innerHTML = `<p style="color: var(--color-red);">Analysis nahi ho saka: ${error.message}</p>`;
    }
}

document.getElementById('retake-quiz-btn')?.addEventListener('click', () => { // कोई बदलाव नहीं
    document.getElementById('mcq-quiz-view').style.display = 'none';
    document.getElementById('mcq-setup-view').style.display = 'block';
    document.getElementById('mcq-topic-input').value = '';
});

// SOLVED NOTES (Streaming लागू)
document.getElementById('solved-notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('solved-notes-topic-input').value.trim();
    const selectedCountRadio = document.querySelector('input[name="solved-notes-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') count = document.getElementById('solved-notes-custom-count').value;
    if(topic) handleApiStreamRequest('solved-notes-form', 'get-solved-notes-btn', 'solved-notes-response-container', 'solved-notes-response', '/get-solved-notes-ai', { topic, count });
});

// CAREER COUNSELOR (Streaming लागू)
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
    contentArea.innerHTML = '<p>AI से जवाब मिलना शुरू हो रहा है...</p>';
    controlsArea.innerHTML = '';
    
    try {
        const response = await fetch('/get-career-advice-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interests }) });
        if (!response.ok) throw new Error('Server error');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        contentArea.innerHTML = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponseText += decoder.decode(value);
            contentArea.innerHTML = marked.parse(fullResponseText.replace(/\n---\n/g, '<hr>')); // तात्कालिक प्रदर्शन
        }
        // पूरा जवाब आने के बाद pagination लागू करें
        await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', fullResponseText);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Get Career Advice';
    }
});

// STUDY PLANNER (Streaming लागू)
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
    contentArea.innerHTML = '<p>AI से जवाब मिलना शुरू हो रहा है...</p>';
    controlsArea.innerHTML = '';

    try {
        const response = await fetch('/generate-study-plan-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ details }) });
        if (!response.ok) throw new Error('Server error');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        contentArea.innerHTML = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponseText += decoder.decode(value);
            contentArea.innerHTML = marked.parse(fullResponseText.replace(/\n---\n/g, '<hr>'));
        }
        await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', fullResponseText);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create My Plan';
    }
});

// FLASHCARDS (कोई बदलाव नहीं, क्योंकि यह JSON इस्तेमाल करता है)
document.getElementById('flashcard-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = document.getElementById('flashcard-topic-input').value.trim();
    if (!topic) return alert('Please enter a topic.');

    const selectedCountRadio = document.querySelector('input[name="flashcard-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') count = document.getElementById('flashcard-custom-count').value;

    const button = document.getElementById('generate-flashcards-btn');
    const container = document.getElementById('flashcard-response-container');
    
    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    container.innerHTML = `<p>AI ${count} flashcards bana raha hai...</p>`;

    try {
        const response = await fetch('/generate-flashcards-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, count }) });
        const cards = await response.json();
        if (!response.ok) throw new Error(cards.error);
        await displayFlashcards(cards);
    } catch (error) {
        container.innerHTML = `<p style="color: var(--color-red);">Flashcards nahi ban sake: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create Flashcards';
    }
});

async function displayFlashcards(cards) { // कोई बदलाव नहीं
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
        await renderEnhancedAIContent(frontDiv, cardData.front);
        await renderEnhancedAIContent(backDiv, cardData.back);
        cardEl.innerHTML = `<div class="flashcard-inner">${frontDiv.outerHTML}${backDiv.outerHTML}</div>`;
        cardEl.addEventListener('click', () => cardEl.classList.toggle('flipped'));
        grid.appendChild(cardEl);
    }
    container.appendChild(grid);
}

// ESSAY WRITER (Streaming लागू)
document.getElementById('essay-writer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('essay-topic-input').value.trim();
    if(topic) handleApiStreamRequest('essay-writer-form', 'write-essay-btn', 'essay-writer-response-container', 'essay-writer-response', '/write-essay-ai', { topic });
});

// PRESENTATION MAKER (Streaming लागू)
document.getElementById('presentation-maker-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('presentation-topic-input').value.trim();
    if(topic) handleApiStreamRequest('presentation-maker-form', 'create-presentation-btn', 'presentation-maker-response-container', 'presentation-maker-response', '/create-presentation-ai', { topic });
});

// CONCEPT EXPLAINER (Streaming लागू)
document.getElementById('explainer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('explainer-topic-input').value.trim();
    // ⭐ ज़रूरी बदलाव: Input का ID `explainer-topic-input` था, उसे सही किया।
    if(topic) handleApiStreamRequest('explainer-form', 'get-explanation-btn', 'explainer-response-container', 'explainer-response', '/explain-concept-ai', { topic });
});
