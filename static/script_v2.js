// --- WELCOME SCREEN LOGIC ---
// Is logic mein koi badlav nahi kiya gaya hai.
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.opacity = '0';
        setTimeout(() => {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (appContainer) {
                appContainer.style.display = 'block';
                // Welcome screen ke baad app ko fade in karne ke liye
                setTimeout(() => appContainer.style.opacity = '1', 50);
            }
        }, 500);
    }, 3500); // Wait time ko thoda kam kiya hai, aap ise 4000 bhi kar sakte hain.
});

// --- NAVIGATION LOGIC ---
// Is logic mein koi badlav nahi kiya gaya hai.
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    window.scrollTo(0, 0);
}

// --- ✅✅✅ NEW & SAFER: ENHANCED AI CONTENT RENDERER ---
// Is function mein koi badlav nahi kiya gaya hai.
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
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        try {
            await window.MathJax.typesetPromise([element]);
        } catch (err) {
            console.error('MathJax rendering failed:', err);
        }
    }
}


// --- PAGINATION LOGIC (Now uses async render function) ---
// Is pagination logic mein koi badlav nahi kiya gaya hai, yeh pehle se theek tha.
let paginationData = {};

async function renderPaginatedContent(contentAreaId, controlsId, content) {
    const contentArea = document.getElementById(contentAreaId);
    const controlsArea = document.getElementById(controlsId);

    if (!contentArea || !controlsArea) return;

    const pages = content.split(/\n---\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (pages.length === 0) {
        pages.push(content); // Agar separator na mile, toh poora content ek page hai
    }

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

    if (pages.length > 1) {
        controlsArea.innerHTML = `
            <button class="pagination-btn" id="${contentAreaId}-back" onclick="changePage('${contentAreaId}', -1)">Back</button>
            <span class="page-indicator" id="${contentAreaId}-indicator">Page 1 of ${pages.length}</span>
            <button class="pagination-btn" id="${contentAreaId}-next" onclick="changePage('${contentAreaId}', 1)">Next</button>
        `;
    } else {
        controlsArea.innerHTML = '';
    }

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
    if (!data || data.pages.length <= 1) return;

    document.getElementById(`${contentAreaId}-indicator`).textContent = `Page ${data.currentPage + 1} of ${data.pages.length}`;
    document.getElementById(`${contentAreaId}-back`).disabled = (data.currentPage === 0);
    document.getElementById(`${contentAreaId}-next`).disabled = (data.currentPage === data.pages.length - 1);
}

// --- CUSTOM INPUT LOGIC ---
function setupCustomInput(radioGroupName, customInputId) {
    // --- BADLAV: Selector ko theek kiya gaya (quotes lagaye gaye) ---
    const radios = document.querySelectorAll(`input[name="${radioGroupName}"]`);
    const customInput = document.getElementById(customInputId);

    if (!customInput) return;

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            // Sirf 'custom' value wale radio ke liye custom input enable karein
            const isCustom = document.querySelector(`input[name="${radioGroupName}"]:checked`).value === 'custom';
            customInput.disabled = !isCustom;
        });
    });
}

// Event listener ko DOMContentLoaded ke andar daalna behtar practice hai
document.addEventListener('DOMContentLoaded', () => {
    setupCustomInput('mcq-count', 'mcq-custom-count');
    setupCustomInput('flashcard-count', 'flashcard-custom-count');
    setupCustomInput('solved-notes-count', 'solved-notes-custom-count');
});


// --- FEATURE LOGIC ---

// 1. ASK DOUBT
// --- BADLAV: 'submit' ki jagah button ke 'click' event ka istemal ---
document.getElementById('ask-doubt-submit')?.addEventListener('click', async () => {
    const doubtInput = document.getElementById('doubt-input');
    const imageInput = document.getElementById('doubt-image-input');
    const imageFile = imageInput.files[0];
    const responseContainer = document.getElementById('ai-response-container');
    const responseDiv = document.getElementById('ai-response');
    const submitButton = document.getElementById('ask-doubt-submit');

    if (doubtInput.value.trim() === '' && !imageFile) {
        return alert('Please apna sawaal likhein ya image upload karein.');
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Analyzing...';
    responseContainer.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">AI से जवाब मिलने का इंतज़ार है...</div>';

    const formData = new FormData();
    formData.append('question', doubtInput.value);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        // Assume you have a function to get the Firebase auth token
        // const idToken = await getAuthToken(); // Example: await auth.currentUser.getIdToken();
        const response = await fetch('/ask-ai-image', {
            method: 'POST',
            // headers: { 'Authorization': `Bearer ${idToken}` }, // Authentication ke liye header
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderEnhancedAIContent(responseDiv, data.answer);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Get Answer';
        doubtInput.value = '';
        imageInput.value = ''; // Clear file input
        document.getElementById('file-name-display').textContent = '';
    }
});

// File input ke liye display name update karne ka logic
document.getElementById('doubt-image-input')?.addEventListener('change', function() {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (this.files.length > 0) {
        fileNameDisplay.textContent = `File: ${this.files[0].name}`;
    } else {
        fileNameDisplay.textContent = '';
    }
});


// 2. GENERATE NOTES
// --- BADLAV: 'submit' ki jagah button ke 'click' event ka istemal ---
document.getElementById('generate-notes-submit')?.addEventListener('click', async () => {
    const topicInput = document.getElementById('notes-topic-input');
    const topic = topicInput.value.trim();
    if (!topic) return alert('Please enter a topic.');

    const noteType = document.querySelector('input[name="note-length"]:checked').value;
    const submitButton = document.getElementById('generate-notes-submit');
    const responseContainer = document.getElementById('notes-output-container');
    const responseDiv = document.getElementById('notes-response');

    submitButton.disabled = true;
    submitButton.textContent = 'Generating...';
    responseContainer.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Generating Notes...</div>';

    try {
        const response = await fetch('/generate-notes-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, noteType })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderEnhancedAIContent(responseDiv, data.notes);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">माफ़ कीजिये, कुछ गड़बड़ हो गयी: ${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Generate';
    }
});


// 3. PRACTICE MCQs
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
    quizContainer.innerHTML = `<div class="loading-animation">AI aapke liye ${count} sawaal taiyaar kar raha hai...</div>`;
    document.getElementById('quiz-result').innerHTML = '';
    document.getElementById('submit-quiz-btn').style.display = 'block';
    document.getElementById('post-quiz-options').style.display = 'none';
    document.getElementById('quiz-analysis-report').innerHTML = '';
    document.getElementById('quiz-analysis-report').style.display = 'none';

    try {
        const response = await fetch('/generate-mcq-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count })
        });
        const questions = await response.json();
        if (!response.ok) throw new Error(questions.error || `Server error: ${response.status}`);
        window.currentQuizQuestions = questions;
        await displayQuestions(questions);
    } catch (error) {
        quizContainer.innerHTML = `<p style="color: var(--color-red);">Quiz generate nahi ho saka: ${error.message}</p>`;
        // Wapas setup view dikhane ka option
        setTimeout(() => {
           setupView.style.display = 'block';
           quizView.style.display = 'none';
        }, 3000);
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
        let optionsHTML = shuffledOptions.map(option =>
            `<label class="mcq-option"><input type="radio" name="question-${index}" value="${option}"> <span></span></label>`
        ).join('');
        
        const questionTextDiv = document.createElement('div');
        await renderEnhancedAIContent(questionTextDiv, `<strong>Q${index + 1}:</strong> ${q.question}`);
        
        questionElement.innerHTML = `${questionTextDiv.innerHTML}<div class="options-container" id="options-${index}">${optionsHTML}</div>`;
        quizContainer.appendChild(questionElement);

        // Options text ko render karne ke liye
        const optionLabels = questionElement.querySelectorAll('.mcq-option span');
        for(let i=0; i < shuffledOptions.length; i++) {
            await renderEnhancedAIContent(optionLabels[i], shuffledOptions[i]);
        }
    }
}

document.getElementById('submit-quiz-btn')?.addEventListener('click', () => {
    let score = 0;
    const userAnswersForAnalysis = [];

    if (!window.currentQuizQuestions || !window.correctAnswers) {
        alert("Quiz data not found. Please start a new quiz.");
        return;
    }

    window.currentQuizQuestions.forEach((questionData, i) => {
        const selectedRadio = document.querySelector(`input[name="question-${i}"]:checked`);
        const correctAnswer = window.correctAnswers[i];
        
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
            label.style.pointerEvents = 'none'; // Disable further clicks
            const optionValue = label.querySelector('input').value;
            if (optionValue === correctAnswer) {
                label.classList.add('correct-answer');
            }
            if (selectedRadio && selectedRadio.value === optionValue && !isCorrect) {
                label.classList.add('incorrect-answer');
            }
        });

        if (isCorrect) score++;
    });

    document.getElementById('quiz-result').innerHTML = `<h3>Your Score: ${score} / ${window.correctAnswers.length}</h3>`;
    document.getElementById('submit-quiz-btn').style.display = 'none';
    document.getElementById('post-quiz-options').style.display = 'block';

    if (score < window.correctAnswers.length) {
        getQuizAnalysis(userAnswersForAnalysis);
    } else {
         document.getElementById('quiz-analysis-report').style.display = 'block';
         document.getElementById('quiz-analysis-report').innerHTML = '<p style="color: var(--color-green);"><strong>Excellent!</strong> All answers are correct.</p>';
    }
});

async function getQuizAnalysis(answers) {
    const analysisDiv = document.getElementById('quiz-analysis-report');
    if (!analysisDiv) return;
    analysisDiv.innerHTML = '<div class="loading-animation">Aapke performance ka analysis kiya ja raha hai...</div>';
    analysisDiv.style.display = 'block';

    try {
        const response = await fetch('/analyze-quiz-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: answers })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        
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

// --- Baaki sabhi features ke liye isi pattern ko follow karein ---

// 4. SOLVED NOTES
document.getElementById('get-solved-notes-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('solved-notes-topic-input').value.trim();
    if (!topic) return alert('Please enter a topic.');

    const selectedCountRadio = document.querySelector('input[name="solved-notes-count"]:checked');
    let count = selectedCountRadio.value;
    if (count === 'custom') {
        count = document.getElementById('solved-notes-custom-count').value;
    }

    const button = document.getElementById('get-solved-notes-btn');
    const container = document.getElementById('solved-notes-response-container');
    const responseDiv = document.getElementById('solved-notes-response');
    
    button.disabled = true; button.textContent = 'Generating...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Loading solved examples...</div>';

    try {
        const response = await fetch('/get-solved-notes-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderEnhancedAIContent(responseDiv, data.solved_notes);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Get Solved Examples';
    }
});


// 5. CAREER COUNSELOR
document.getElementById('get-career-advice-btn')?.addEventListener('click', async () => {
    const interests = document.getElementById('career-interests-input').value.trim();
    if (!interests) return alert('Please enter your interests.');

    const button = document.getElementById('get-career-advice-btn');
    const container = document.getElementById('career-response-container');
    const contentArea = document.getElementById('career-paginated-content');
    const controlsArea = document.getElementById('career-pagination-controls');

    button.disabled = true; button.textContent = 'Generating...';
    container.style.display = 'block';
    contentArea.innerHTML = '<div class="loading-animation">Finding career paths...</div>';
    controlsArea.innerHTML = '';

    try {
        const response = await fetch('/get-career-advice-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interests })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderPaginatedContent('career-paginated-content', 'career-pagination-controls', data.advice);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Get Career Advice';
    }
});


// 6. STUDY PLANNER
document.getElementById('generate-study-plan-btn')?.addEventListener('click', async () => {
    const details = document.getElementById('study-plan-details-input').value.trim();
    if (!details) return alert('Please provide details for the plan.');

    const button = document.getElementById('generate-study-plan-btn');
    const container = document.getElementById('study-plan-response-container');
    const contentArea = document.getElementById('study-plan-paginated-content');
    const controlsArea = document.getElementById('study-plan-pagination-controls');

    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    contentArea.innerHTML = '<div class="loading-animation">Creating your personalized plan...</div>';
    controlsArea.innerHTML = '';

    try {
        const response = await fetch('/generate-study-plan-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ details })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderPaginatedContent('study-plan-paginated-content', 'study-plan-pagination-controls', data.plan);
    } catch (error) {
        contentArea.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create My Plan';
    }
});


// 7. FLASHCARDS
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

    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    container.innerHTML = `<div class="loading-animation">AI ${count} flashcards bana raha hai...</div>`;

    try {
        const response = await fetch('/generate-flashcards-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count })
        });
        const cards = await response.json();
        if (!response.ok) throw new Error(cards.error || `Server error: ${response.status}`);
        await displayFlashcards(cards);
    } catch (error) {
        container.innerHTML = `<p style="color: var(--color-red);">Flashcards nahi ban sake: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create Flashcards';
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
        
        const innerCard = document.createElement('div');
        innerCard.className = 'flashcard-inner';

        await renderEnhancedAIContent(frontDiv, cardData.front);
        await renderEnhancedAIContent(backDiv, cardData.back);
        
        innerCard.appendChild(frontDiv);
        innerCard.appendChild(backDiv);
        cardEl.appendChild(innerCard);
        
        cardEl.addEventListener('click', () => cardEl.classList.toggle('flipped'));
        grid.appendChild(cardEl);
    }
    container.appendChild(grid);
}


// 8. ESSAY WRITER
document.getElementById('write-essay-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('essay-topic-input').value.trim();
    if (!topic) return alert('Please provide an essay topic.');

    const button = document.getElementById('write-essay-btn');
    const container = document.getElementById('essay-writer-response-container');
    const responseDiv = document.getElementById('essay-writer-response');

    button.disabled = true; button.textContent = 'Writing...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Writing your essay...</div>';

    try {
        const response = await fetch('/write-essay-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderEnhancedAIContent(responseDiv, data.essay);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Write Essay';
    }
});


// 9. PRESENTATION MAKER
document.getElementById('create-presentation-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('presentation-topic-input').value.trim();
    if (!topic) return alert('Please provide a presentation topic.');

    const button = document.getElementById('create-presentation-btn');
    const container = document.getElementById('presentation-maker-response-container');
    const responseDiv = document.getElementById('presentation-maker-response');

    button.disabled = true; button.textContent = 'Creating...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Creating presentation outline...</div>';

    try {
        const response = await fetch('/create-presentation-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderEnhancedAIContent(responseDiv, data.presentation);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Create Presentation';
    }
});


// 10. CONCEPT EXPLAINER
// --- BADLAV: 'submit' ki jagah button ke 'click' event ka istemal ---
document.getElementById('get-explanation-btn')?.addEventListener('click', async () => {
    const topic = document.getElementById('concept-input').value.trim();
    if (!topic) return alert('Please provide a concept to explain.');

    const button = document.getElementById('get-explanation-btn');
    const container = document.getElementById('concept-output-container');
    const responseDiv = document.getElementById('explainer-response');

    button.disabled = true; button.textContent = 'Explaining...';
    container.style.display = 'block';
    responseDiv.innerHTML = '<div class="loading-animation">Explaining the concept...</div>';

    try {
        const response = await fetch('/explain-concept-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        await renderEnhancedAIContent(responseDiv, data.explanation);
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--color-red);">Error: ${error.message}</p>`;
    } finally {
        button.disabled = false; button.textContent = 'Samjhao!';
    }
});
