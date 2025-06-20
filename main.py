import os
import json
import re
from pathlib import Path # <<< 1. यह नई लाइन जोड़ी गई है
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore

# --- Firebase Admin SDK को शुरू करना ---
# यह सर्वर साइड पर Firestore से बात करने के लिए ज़रूरी है
# आपको अपनी Firebase सर्विस अकाउंट की key.json फाइल Render पर अपलोड करनी होगी
try:
    # <<< 2. यह लाइन बदली गई है
    key_path = Path(__file__).resolve().parent.parent / 'key.json' 
    # <<< 3. यह लाइन भी बदली गई है
    cred = credentials.Certificate(key_path) 
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("SUCCESS: Firebase Admin SDK initialized.")
except Exception as e:
    print(f"FATAL ERROR: Could not initialize Firebase Admin SDK. Make sure 'key.json' is added as a Secret File in Render and path is correct. Error: {e}")
    db = None

# Flask App को शुरू करना
app = Flask(__name__)

# Google API Key को कॉन्फ़िगर करना
try:
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in Environment Variables.")
    genai.configure(api_key=api_key)
    print("SUCCESS: Google API Key loaded and configured.")
except (ValueError, KeyError) as e:
    print(f"FATAL ERROR: {e}. Please check your Environment Variables on Render.")

# AI मॉडल चुनना और सुरक्षा सेटिंग्स को एडजस्ट करना
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]
model = genai.GenerativeModel('gemini-1.5-flash-latest', safety_settings=safety_settings)

# हेल्पर फंक्शन: AI के जवाब से टेक्स्ट निकालना
def get_response_text(response):
    try:
        if response.parts:
            return "".join(part.text for part in response.parts)
        elif hasattr(response, 'text'):
            return response.text
        if response.prompt_feedback and response.prompt_feedback.block_reason:
            return f"AI ने सुरक्षा कारणों से जवाब रोक दिया है। कारण: {response.prompt_feedback.block_reason.name}"
        return "AI से कोई जवाब नहीं मिला।"
    except Exception as e:
        print(f"Error extracting text from response: {e}")
        return "माफ कीजिये, AI से जवाब नहीं मिल सका।"

# --- NEW: Shared prompt instructions for formatting ---
FORMATTING_INSTRUCTIONS = """
**VERY IMPORTANT FORMATTING RULES:**
1.  Use standard Markdown (`##` for main headings, `###` for subheadings, `*` for lists).
2.  For **important keywords** that need emphasis, wrap them in double asterisks like `**this**`.
3.  For **chemical reactions**, wrap them ONLY in `[chem]...[/chem]` tags. Example: `[chem]2H₂ + O₂ → 2H₂O[/chem]`.
4.  For **mathematical formulas or equations**, wrap them ONLY in `[math]...[/math]` tags. Example: `[math]E = mc²[/math]`.
Do NOT use any other formatting for reactions or formulas.
"""

# --- ऐप के रूट्स ---

@app.route('/')
def home():
    return render_template('index.html')

# Department 1: Ask a Doubt
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    try:
        question_text = request.form.get('question', '')
        image_file = request.files.get('image')
        if not question_text and not image_file: return jsonify({'error': 'Please provide a question or an image.'}), 400
        instruction_prompt = f"**ROLE:** Expert tutor. **TASK:** Solve the user's question step-by-step. **LANGUAGE:** Same as user's query.\n{FORMATTING_INSTRUCTIONS}"
        prompt_parts = [instruction_prompt]
        if image_file:
            img = Image.open(image_file)
            img.thumbnail((512, 512))
            prompt_parts.append(img)
        if question_text: prompt_parts.append(f"User's Text: {question_text}")
        response = model.generate_content(prompt_parts)
        answer_text = get_response_text(response)
        return jsonify({'answer': answer_text})
    except Exception as e:
        print(f"--- ERROR in ask_ai_image_route: {e} ---")
        return jsonify({'error': 'सर्वर में एक समस्या आ गयी है।'}), 500

# Department 2: Generate Notes
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        note_type = data.get('noteType', 'long')
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        
        if note_type == 'short':
            notes_prompt = f'**ROLE:** Expert teacher. **TASK:** Generate a brief summary and key bullet points for "{topic}".\n{FORMATTING_INSTRUCTIONS}'
        else:
            notes_prompt = f'**ROLE:** Expert teacher. **TASK:** Generate comprehensive, well-structured notes on "{topic}".\n{FORMATTING_INSTRUCTIONS}'

        response = model.generate_content(notes_prompt)
        notes_text = get_response_text(response)
        return jsonify({'notes': notes_text})
    except Exception as e:
        print(f"--- ERROR in generate_notes_route: {e} ---")
        return jsonify({'error': 'नोट्स जेनरेट करते वक़्त सर्वर में समस्या आ गयी।'}), 500

# Department 3: Generate MCQs
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 5)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        mcq_prompt = f'Generate {count} MCQs on "{topic}". Output must be a valid JSON array of objects with "question", "options" (array of 4 strings), and "correct_answer". No extra text or markdown formatting.'
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(mcq_prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        mcq_data = json.loads(response_text)
        return jsonify(mcq_data)
    except Exception as e:
        print(f"--- ERROR in generate_mcq_route: {e} ---")
        return jsonify({'error': 'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी।'}), 500

# Department 4: Solved Notes & Examples
@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 3)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        solved_notes_prompt = f"**ROLE:** Expert teacher. **TASK:** Provide {count} detailed, step-by-step solved problems for: \"{topic}\".\n{FORMATTING_INSTRUCTIONS}"
        response = model.generate_content(solved_notes_prompt)
        solved_notes_text = get_response_text(response)
        return jsonify({'solved_notes': solved_notes_text})
    except Exception as e:
        print(f"--- ERROR in get_solved_notes_route: {e} ---")
        return jsonify({'error': 'Error generating solved notes.'}), 500

# Department 5: Career Counselor
@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    try:
        data = request.get_json()
        interests = data.get('interests')
        if not interests: return jsonify({'error': 'Please provide your interests.'}), 400
        prompt = f'**ROLE:** Expert AI Career Counselor. **TASK:** Based on user interests "{interests}", provide a detailed career roadmap in Hinglish. Create sections for Career Paths, Required Stream, Degrees, etc. **Use `---` on a new line to separate each major section.**\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        advice_text = get_response_text(response)
        return jsonify({'advice': advice_text})
    except Exception as e:
        print(f"--- ERROR in get_career_advice_route: {e} ---")
        return jsonify({'error': 'Error generating career advice.'}), 500

# Department 6: Study Planner
@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    try:
        data = request.get_json()
        plan_details = data.get('details')
        if not plan_details: return jsonify({'error': 'Please provide details for the plan.'}), 400
        prompt = f'**ROLE:** Expert study planner. **TASK:** Create a 7-day study plan based on: "{plan_details}". **RULES: Use `---` on a new line to separate each day.**\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        plan_text = get_response_text(response)
        return jsonify({'plan': plan_text})
    except Exception as e:
        print(f"--- ERROR in generate_study_plan_route: {e} ---")
        return jsonify({'error': 'Error generating study plan.'}), 500

# Department 7: Flashcard Generator
@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 8)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        prompt = f'Generate {count} flashcards for "{topic}". Your response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. No extra text or markdown.'
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        if "AI ने सुरक्षा कारणों से जवाब रोक दिया है" in response_text: return jsonify({'error': response_text}), 500
        try:
            cards_data = json.loads(response_text)
            if isinstance(cards_data, list): return jsonify(cards_data)
            else: raise json.JSONDecodeError("Response is not a list.", response_text, 0)
        except json.JSONDecodeError as json_err:
            print(f"JSON DECODE ERROR in flashcards. AI Response: {response_text}. Error: {json_err}")
            return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था।'}), 500
    except Exception as e:
        print(f"--- UNKNOWN ERROR in generate_flashcards_route: {e} ---")
        return jsonify({'error': 'फ्लैशकार्ड बनाते समय एक अज्ञात सर्वर समस्या हुई।'}), 500

# Department 8: Essay Writer
@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide an essay topic.'}), 400
        prompt = f'**ROLE:** Expert Essay Writer. **TASK:** Write a well-structured essay on "{topic}".\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        essay_text = get_response_text(response)
        return jsonify({'essay': essay_text})
    except Exception as e:
        print(f"--- ERROR in write_essay_route: {e} ---")
        return jsonify({'error': 'Error generating essay.'}), 500
        
# Department 9: Presentation Maker
@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide a presentation topic.'}), 400
        prompt = f'**ROLE:** AI Presentation Maker. **TASK:** Create a presentation outline on "{topic}". Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        presentation_text = get_response_text(response)
        return jsonify({'presentation': presentation_text})
    except Exception as e:
        print(f"--- ERROR in create_presentation_route: {e} ---")
        return jsonify({'error': 'Error generating presentation.'}), 500

# Department 10: Concept Explainer
@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        prompt = f'**ROLE:** Friendly teacher. **TASK:** Explain "{topic}" simply.\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        explanation_text = get_response_text(response)
        if "AI ने सुरक्षा कारणों से जवाब रोक दिया है" in explanation_text: return jsonify({'error': explanation_text}), 500
        return jsonify({'explanation': explanation_text})
    except Exception as e:
        print(f"--- ERROR in explain_concept_route: {e} ---")
        return jsonify({'error': 'कॉन्सेप्ट समझाते समय सर्वर में कोई समस्या आ गयी।'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
