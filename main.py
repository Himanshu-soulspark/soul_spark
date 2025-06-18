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
    # We get the API key from Replit's secure "Secrets" tab.
    # This is the best practice to keep your key safe.
    api_key = os.environ['GOOGLE_API_KEY']
    genai.configure(api_key=api_key)
    print("SUCCESS: Google API Key loaded and configured.")
except KeyError:
    # If the key is not found in Secrets, this error will be printed in the console.
    print("FATAL ERROR: GOOGLE_API_KEY not found in Replit Secrets. Please check the 'Secrets' 🔒 tab.")

# We initialize the Gemini model that we will use for all AI tasks.
model = genai.GenerativeModel('gemini-1.5-flash-latest')

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
        # Get the text part and the image file from the user's request.
        question_text = request.form.get('question', '')
        image_file = request.files.get('image')

        # Check if the user sent anything at all.
        if not question_text and not image_file:
            return jsonify({'error': 'Please provide a question or an image.'}), 400

        # This is the detailed instruction set for the AI for this specific task.
        instruction_prompt = """
        **ROLE:** You are an expert Physics and Math tutor for a student app.
        **TASK:** Analyze the user's image and text. Solve the question step-by-step.

        **VERY IMPORTANT RULES:**
        1.  **LANGUAGE:** Detect the language of the user's query (e.g., English, Hinglish, Hindi). ALWAYS respond in the SAME language.
        2.  **NO HTML TAGS:** Do not use any HTML tags like `<sub>`, `<sup>`, `<b>`.
        3.  **SUBSCRIPTS:** For subscripts, use an underscore. Example: For `v` final, write `v_f`.
        4.  **MULTIPLICATION:** ALWAYS use the '×' symbol (the multiplication sign, not the letter 'x') for multiplication.
        5.  **MCQ BEHAVIOR:** If multiple-choice options are provided, you MUST choose the closest possible answer from the options. Do not say "None of the options are correct" unless impossible.
        """
        
        # We build the full prompt for the AI, starting with our instructions.
        prompt_parts = [instruction_prompt]
        
        if image_file:
            # If there's an image, we open it and add it to the prompt.
            prompt_parts.append(Image.open(image_file.stream))
        
        if question_text:
            # If there's text, we add it to the prompt.
            prompt_parts.append(f"User's Text (and options if any): {question_text}")
        
        # Send the complete prompt to the AI and get the response.
        response = model.generate_content(prompt_parts)
        
        # Send the AI's text answer back to the user's browser.
        return jsonify({'answer': response.text})
    except Exception as e:
        print(f"--- ERROR in ask_ai_image_route: {e} ---")
        return jsonify({'error': 'Server error in ask-doubt.'}), 500

# Department 2: Generate Notes
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    try:
        # Get the data sent from the user's browser.
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400

        # Detailed instructions for the "Generate Notes" task.
        notes_prompt = f"""
        **ROLE:** You are an expert teacher.
        **TASK:** Generate comprehensive notes on the topic provided below.
        
        **RULES:**
        1.  **LANGUAGE:** Detect the language of the topic (e.g., English, Hinglish, Hindi). Generate the notes in the SAME language.
        2.  **FORMATTING:** Use headings with `##`, sub-headings with `###`, bullet points (`* `), and **bold** keywords.
        3.  **SYMBOLS:** Use '×' for multiplication and underscores for subscripts (e.g., `H_2O`).

        ---
        TOPIC TO CREATE NOTES ON:
        {topic}
        """
        # Send the prompt to the AI.
        response = model.generate_content(notes_prompt)
        # Send the AI's generated notes back to the browser.
        return jsonify({'notes': response.text})
    except Exception as e:
        print(f"--- ERROR in generate_notes_route: {e} ---")
        return jsonify({'error': 'Server error in generate-notes.'}), 500

# Department 3: Generate MCQs
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400

        # Instructions for the "Generate MCQs" task, demanding a JSON output.
        mcq_prompt = f"""
        Generate 5 multiple-choice questions (MCQs) on the topic: "{topic}".
        The questions and options should be in the SAME language as the topic.
        
        Provide the output in a valid JSON format only. Do not add any text before or after the JSON.
        The JSON structure should be an array of objects. Each object must have:
        1. "question" key
        2. "options" key with an array of 4 strings
        3. "correct_answer" key
        
        Use '×' for multiplication and underscores for subscripts (e.g., `v_f`) if needed.
        """
        
        # Special configuration to tell the AI that we strictly want JSON.
        generation_config = genai.types.GenerationConfig(
            response_mime_type="application/json"
        )
        
        response = model.generate_content(mcq_prompt, generation_config=generation_config)
        
        # Load the AI's text response as a JSON object to ensure it's valid.
        mcq_data = json.loads(response.text)
        # Send the validated JSON data back to the browser.
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

        # Instructions for the "Solved Notes" task.
        solved_notes_prompt = f"""
        **ROLE:** You are an expert teacher providing solved examples.
        **TASK:** Provide 2-3 detailed, step-by-step solved problems for the topic below.
        
        **RULES:**
        1.  **LANGUAGE:** Respond in the SAME language as the topic.
        2.  **FORMATTING:** State the problem clearly, list 'Given' data, and a 'Solution' section.
        3.  **SYMBOLS:** Use '×' for multiplication and underscores for subscripts. NO HTML TAGS.
        ---
        TOPIC FOR SOLVED EXAMPLES:
        {topic}
        """
        response = model.generate_content(solved_notes_prompt)
        return jsonify({'solved_notes': response.text})
    except Exception as e:
        print(f"--- ERROR in get_solved_notes_route: {e} ---")
        return jsonify({'error': 'Error generating solved notes.'}), 500

# This line starts the web server when you press the "Run" button.
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=81)