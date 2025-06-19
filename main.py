import os
import json
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from PIL import Image

# Initialize the Flask App
app = Flask(__name__)

# --- API Key and Model Configuration ---
# This block configures the connection to the Google AI service.
try:
    # We get the API key from Render's Environment Variables.
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in Environment Variables.")
    genai.configure(api_key=api_key)
    print("SUCCESS: Google API Key loaded and configured.")
except (ValueError, KeyError) as e:
    # If the key is not found, this error will be printed in the console.
    print(f"FATAL ERROR: {e}. Please check your Environment Variables on Render.")

# We initialize the Gemini model that we will use for all AI tasks.
model = genai.GenerativeModel('gemini-1.5-flash-latest')

# --- Helper function to safely get text from AI response ---
def get_response_text(response):
    """Safely extracts text from the Gemini response, handling potential errors."""
    try:
        # This is the safest way to get the text part.
        return response.text
    except Exception:
        # If the response is blocked or has no text, we return an error message.
        return "Maaf kijiye, AI se jawab nahi mil saka. Shayad aapka sawaal suraksha neetiyon ke khilaaf ho."

# --- Routes (The different 'pages' or 'endpoints' of our app) ---

# This is the main route. When the user opens the app, this function runs.
@app.route('/')
def home():
    # It just shows the main HTML page to the user.
    return render_template('index.html')

# Department 1: Ask a Doubt (Handles image and text questions)
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    try:
        question_text = request.form.get('question', '')
        image_file = request.files.get('image')

        if not question_text and not image_file:
            return jsonify({'error': 'Please provide a question or an image.'}), 400

        instruction_prompt = """
        **ROLE:** You are an expert Physics and Math tutor for a student app.
        **TASK:** Analyze the user's image and text. Solve the question step-by-step.
        **VERY IMPORTANT RULES:**
        1.  **LANGUAGE:** Detect the language of the user's query. ALWAYS respond in the SAME language.
        2.  **NO HTML TAGS:** Do not use any HTML tags.
        3.  **SUBSCRIPTS:** For subscripts, use an underscore (e.g., v_f).
        4.  **MULTIPLICATION:** ALWAYS use the '×' symbol.
        5.  **MCQ BEHAVIOR:** If options are provided, you MUST choose the closest possible answer.
        """
        
        prompt_parts = [instruction_prompt]
        
        if image_file:
            # === YAHAN BADLAV KIYA GAYA HAI ===
            # This is the more reliable way to open an image from a web request.
            prompt_parts.append(Image.open(image_file))
        
        if question_text:
            prompt_parts.append(f"User's Text: {question_text}")
        
        response = model.generate_content(prompt_parts)
        
        answer_text = get_response_text(response)
        return jsonify({'answer': answer_text})
        
    except Exception as e:
        print(f"--- ERROR in ask_ai_image_route: {e} ---")
        return jsonify({'error': 'Server mein ek samasya aa gayi hai. Kripya baad mein prayas karein.'}), 500

# Department 2: Generate Notes
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400

        notes_prompt = f"""
        **ROLE:** You are an expert teacher.
        **TASK:** Generate comprehensive notes on the topic: "{topic}".
        **RULES:**
        1.  **LANGUAGE:** Generate notes in the SAME language as the topic.
        2.  **FORMATTING:** Use headings with `##`, sub-headings with `###`, bullet points (`* `), and **bold** keywords.
        3.  **SYMBOLS:** Use '×' for multiplication and underscores for subscripts.
        """
        response = model.generate_content(notes_prompt)
        notes_text = get_response_text(response)
        return jsonify({'notes': notes_text})
    except Exception as e:
        print(f"--- ERROR in generate_notes_route: {e} ---")
        return jsonify({'error': 'Notes generate karte waqt server mein samasya aa gayi.'}), 500

# Department 3: Generate MCQs
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400

        mcq_prompt = f"""
        Generate 5 multiple-choice questions (MCQs) on the topic: "{topic}".
        The questions and options should be in the SAME language as the topic.
        Provide the output in a valid JSON format only. Do not add any text before or after the JSON.
        The JSON structure should be an array of objects. Each object must have:
        "question", "options" (array of 4 strings), and "correct_answer".
        """
        
        generation_config = genai.types.GenerationConfig(
            response_mime_type="application/json"
        )
        
        response = model.generate_content(mcq_prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        mcq_data = json.loads(response_text)
        return jsonify(mcq_data)
        
    except Exception as e:
        print(f"--- ERROR in generate_mcq_route: {e} ---")
        return jsonify({'error': 'AI se MCQ generate karte waqt gadbad ho gayi.'}), 500

# Department 4: Solved Notes & Examples
@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400

        solved_notes_prompt = f"""
        **ROLE:** You are an expert teacher providing solved examples.
        **TASK:** Provide 2-3 detailed, step-by-step solved problems for the topic: "{topic}".
        **RULES:**
        1.  **LANGUAGE:** Respond in the SAME language as the topic.
        2.  **FORMATTING:** State the problem clearly, list 'Given' data, and a 'Solution' section.
        3.  **SYMBOLS:** Use '×' for multiplication and underscores for subscripts.
        """
        response = model.generate_content(solved_notes_prompt)
        solved_notes_text = get_response_text(response)
        return jsonify({'solved_notes': solved_notes_text})
    except Exception as e:
        print(f"--- ERROR in get_solved_notes_route: {e} ---")
        return jsonify({'error': 'Error generating solved notes.'}), 500

# This line is for local testing. Render will use its own command to start the server.
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
