// --- WELCOME SCREEN LOGIC ---
window.addEventListener('load', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.querySelector('.app-container');

    setTimeout(() => {
        if (welcomeScreen) {
            welcomeScreen.style.opacity = '0';
        }
        
        setTimeout(() => {
            if (welcomeScreen) {
                welcomeScreen.style.display = 'none';
            }
            if (appContainer) {
                appContainer.style.display = 'block';
            }
        }, 500);

    }, 4000);
});


// --- NAVIGATION LOGIC ---
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
}

// Function to process AI content for display
function renderAIContent(element, content) {
    if (element) {
        element.innerHTML = marked.parse(content);
        element.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

// --- FEATURE 1: ASK DOUBT ---
const doubtForm = document.getElementById('doubt-form');
if (doubtForm) {
    const imageInput = document.getElementById('doubt-image-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    
    imageInput.addEventListener('change', () => {
        fileNameDisplay.textContent = imageInput.files.length > 0 ? `Selected: ${imageInput.files[0].name}` : '';
    });

    doubtForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const doubtInput = document.getElementById('doubt-input');
        const imageFile = imageInput.files[0];
        const responseContainer = document.getElementById('ai-response-container');
        const responseDiv = document.getElementById('ai-response');
        const submitButton = document.getElementById('ask-doubt-submit');

        if (doubtInput.value.trim() === '' && !imageFile) return alert('Please apna sawaal likhein ya image upload karein.');

        submitButton.disabled = true;
        submitButton.textContent = 'Analyzing...';
        responseContainer.style.display = 'block';
        responseDiv.innerHTML = '<p>AI se jawab milne ka intezar hai...</p>';

        const formData = new FormData();
        formData.append('question', doubtInput.value);
        if (imageFile) formData.append('image', imageFile);
        
        try {
            const response = await fetch('/ask-ai-image', { method: 'POST', body: formData });
            if (!response.ok) throw new Error((await response.json()).error || 'Server se response nahi mila.');
            const data = await response.json();
            renderAIContent(responseDiv, data.answer.trim());
        } catch (error) {
            responseDiv.innerHTML = `<p style="color: var(--color-red);">Maaf kijiye, kuch gadbad ho gayi: ${error.message}</p>`;
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Get Answer';
            doubtForm.reset();
            fileNameDisplay.textContent = '';
        }
    });
}


// --- FEATURE 2: GENERATE NOTES ---
const notesForm = document.getElementById('notes-form');
if (notesForm) {
    notesForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const topicInput = document.getElementById('notes-topic-input');
        const topic = topicInput.value.trim();
        
        const notesContainer = document.getElementById('notes-response-container');
        const notesDiv = document.getElementById('notes-response');
        const generateButton = document.getElementById('generate-notes-submit');

        if (topic === '') return alert('Please ek topic likhein.');

        generateButton.disabled = true;
        generateButton.textContent = 'Generating...';
        notesContainer.style.display = 'block';
        notesDiv.innerHTML = '<p>AI notes taiyaar kar raha hai...</p>';

        try {
            const response = await fetch('/generate-notes-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic })
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Server se response nahi mila.');
            const data = await response.json();
            renderAIContent(notesDiv, data.notes.trim());
        } catch (error) {
            notesDiv.innerHTML = `<p style="color: var(--color-red);">Maaf kijiye, kuch gadbad ho gayi: ${error.message}</p>`;
        } finally {
            generateButton.disabled = false;
            generateButton.textContent = 'Generate';
        }
    });
}


// --- FEATURE 3: PRACTICE MCQs ---
let correctAnswers = [];
const startQuizBtn = document.getElementById('start-quiz-btn');
const mcqSetupView = document.getElementById('mcq-setup-view');
const mcqQuizView = document.getElementById('mcq-quiz-view');
const submitQuizBtn = document.getElementById('submit-quiz-btn');
const postQuizOptions = document.getElementById('post-quiz-options');
const retakeQuizBtn = document.getElementById('retake-quiz-btn');

if (startQuizBtn) {
    startQuizBtn.addEventListener('click', async () => {
        const mcqTopicInput = document.getElementById('mcq-topic-input');
        const topic = mcqTopicInput.value.trim();
        if (topic === '') return alert('Please ek topic likhein.');
        
        // Reset state for a new quiz
        submitQuizBtn.style.display = 'block';
        submitQuizBtn.disabled = false;
        postQuizOptions.style.display = 'none';
        
        const quizContainer = document.getElementById('quiz-container');
        const quizTopicTitle = document.getElementById('quiz-topic-title');
        
        startQuizBtn.disabled = true;
        startQuizBtn.textContent = 'Generating Quiz...';
        mcqSetupView.style.display = 'none';
        mcqQuizView.style.display = 'block';
        quizTopicTitle.textContent = `Quiz on: ${topic}`;
        quizContainer.innerHTML = '<p>AI aapke liye sawaal taiyaar kar raha hai...</p>';
        document.getElementById('quiz-result').innerHTML = '';

        try {
            const response = await fetch('/generate-mcq-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic })
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Server se response nahi mila.');
            const questions = await response.json();
            displayQuestions(questions);
        } catch (error) {
            quizContainer.innerHTML = `<p style="color: var(--color-red);">Quiz generate nahi ho saka: ${error.message}</p>`;
            // Allow user to go back
            mcqSetupView.style.display = 'block';
            mcqQuizView.style.display = 'none';
        } finally {
            startQuizBtn.disabled = false;
            startQuizBtn.textContent = 'Start Quiz';
        }
    });
}

function displayQuestions(questions) {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';
    correctAnswers = questions.map(q => q.correct_answer);

    questions.forEach((q, index) => {
        const questionElement = document.createElement('div');
        questionElement.classList.add('mcq-question-block');
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        let optionsHTML = '';
        shuffledOptions.forEach(option => {
            optionsHTML += `
                <label class="mcq-option">
                    <input type="radio" name="question-${index}" value="${option}">
                    <span>${option}</span>
                </label>
            `;
        });
        questionElement.innerHTML = `
            <p class="question-text"><strong>Q${index + 1}:</strong> ${q.question}</p>
            <div class="options-container" id="options-${index}">${optionsHTML}</div>
        `;
        quizContainer.appendChild(questionElement);
    });
}

if (submitQuizBtn) {
    submitQuizBtn.addEventListener('click', () => {
        if (correctAnswers.length === 0) return;

        let score = 0;
        for (let i = 0; i < correctAnswers.length; i++) {
            const selectedOption = document.querySelector(`input[name="question-${i}"]:checked`);
            const optionsContainer = document.getElementById(`options-${i}`);
            const allLabels = optionsContainer.querySelectorAll('label');

            allLabels.forEach(label => {
                label.style.pointerEvents = 'none'; // Disable clicking after submit
                const radio = label.querySelector('input');
                if (radio.value === correctAnswers[i]) {
                    label.style.borderLeft = '5px solid #2ecc71'; // Green for correct
                }
            });

            if (selectedOption) {
                if (selectedOption.value === correctAnswers[i]) {
                    score++;
                } else {
                    selectedOption.parentElement.style.borderLeft = '5px solid var(--color-red)'; // Red for incorrect
                }
            }
        }
        const resultDiv = document.getElementById('quiz-result');
        resultDiv.innerHTML = `Your Score: ${score} out of ${correctAnswers.length}`;
        submitQuizBtn.style.display = 'none';
        postQuizOptions.style.display = 'block';
    });
}

if(retakeQuizBtn) {
    retakeQuizBtn.addEventListener('click', () => {
        mcqQuizView.style.display = 'none';
        mcqSetupView.style.display = 'block';
        document.getElementById('mcq-topic-input').value = ''; // Clear previous topic
    });
}

// --- FEATURE 4: SOLVED NOTES ---
const solvedNotesForm = document.getElementById('solved-notes-form');
if (solvedNotesForm) {
    solvedNotesForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const topicInput = document.getElementById('solved-notes-topic-input');
        const topic = topicInput.value.trim();
        
        const responseContainer = document.getElementById('solved-notes-response-container');
        const responseDiv = document.getElementById('solved-notes-response');
        const getBtn = document.getElementById('get-solved-notes-btn');

        if (topic === '') return alert('Please ek topic likhein.');

        getBtn.disabled = true;
        getBtn.textContent = 'Fetching...';
        responseContainer.style.display = 'block';
        responseDiv.innerHTML = '<p>AI aapke liye solved examples dhoondh raha hai...</p>';

        try {
            const response = await fetch('/get-solved-notes-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic })
            });
            if (!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            renderAIContent(responseDiv, data.solved_notes.trim());
        } catch (error) {
            responseDiv.innerHTML = `<p style="color: var(--color-red);">Maaf kijiye, kuch gadbad ho gayi: ${error.message}</p>`;
        } finally {
            getBtn.disabled = false;
            getBtn.textContent = 'Get Solved Examples';
        }
    });
}