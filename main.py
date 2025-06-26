import os
import json
import re
from pathlib import Path
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, Response # <-- नया: Response को इम्पोर्ट किया गया
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore, auth
from flask_cors import CORS
import razorpay

# --- Firebase Admin SDK को शुरू करना ---
try:
    key_path = Path(__file__).resolve().parent / 'key.json'
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("SUCCESS: Firebase Admin SDK initialized.")
except Exception as e:
    print(f"FATAL ERROR: Could not initialize Firebase Admin SDK. Make sure 'key.json' is added as a Secret File in Render and path is correct. Error: {e}")
    db = None

# Flask App को शुरू करना
app = Flask(__name__)
CORS(app)

# --- Razorpay Client को शुरू करना ---
try:
    base_path_for_secrets = Path(__file__).resolve().parent
    key_id_filename_on_render = 'RAZORPAY_KEY_ID'
    key_secret_filename_on_render = 'RAZORPAY_KEY_SECRET'
    key_id_file_path = base_path_for_secrets / key_id_filename_on_render
    key_secret_file_path = base_path_for_secrets / key_secret_filename_on_render

    if not key_id_file_path.is_file():
        raise ValueError(f"Razorpay Key ID file ('{key_id_filename_on_render}') not found at {key_id_file_path}.")
    if not key_secret_file_path.is_file():
        raise ValueError(f"Razorpay Key Secret file ('{key_secret_filename_on_render}') not found at {key_secret_file_path}.")

    with open(key_id_file_path, 'r') as f_id:
        razorpay_key_id_from_file = f_id.read().strip()
    with open(key_secret_file_path, 'r') as f_secret:
        razorpay_key_secret_from_file = f_secret.read().strip()

    if not razorpay_key_id_from_file or not razorpay_key_secret_from_file:
        raise ValueError("Content of Razorpay Key ID or Key Secret file is empty.")
    
    razorpay_key_id = razorpay_key_id_from_file
    razorpay_key_secret = razorpay_key_secret_from_file
    
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    print("SUCCESS: Razorpay client initialized using keys from Secret Files.")
except ValueError as e:
    print(f"FATAL ERROR initializing Razorpay client: {e}.")
    razorpay_client = None
except Exception as e:
    print(f"UNEXPECTED FATAL ERROR during Razorpay client initialization: {e}")
    razorpay_client = None

# Google API Key को कॉन्फ़िगर करना
try:
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in Environment Variables.")
    genai.configure(api_key=api_key)
    print("SUCCESS: Google API Key loaded and configured.")
except (ValueError, KeyError) as e:
    print(f"FATAL ERROR: {e}. Please check your Environment Variables on Render.")
    model = None
else:
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    model = genai.GenerativeModel('gemini-1.5-flash-latest', safety_settings=safety_settings)

# हेल्पर फंक्शन: AI के जवाब से टेक्स्ट निकालना (Streaming के लिए अब इस्तेमाल नहीं होगा, पर JSON वालों के लिए रहेगा)
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

# --- ⭐⭐ ज़रूरी बदलाव: Streaming के लिए नया हेल्पर फंक्शन ⭐⭐ ---
# यह फंक्शन AI से जवाब को टुकड़ों (chunks) में लेकर तुरंत भेजता है
def stream_generator(prompt_parts):
    """
    यह फंक्शन AI API से response को stream करता है।
    """
    try:
        # stream=True सबसे ज़रूरी बदलाव है
        response_stream = model.generate_content(prompt_parts, stream=True)
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text  # हर chunk को तुरंत ब्राउज़र को भेज दो
    except Exception as e:
        print(f"--- STREAMING ERROR: {e} ---")
        yield f"माफ कीजिये, AI से जवाब जेनरेट करते समय एक समस्या आ गयी: {e}"

# --- टोकन मैनेजमेंट और यूज़र वेरिफिकेशन के फंक्शन (कोई बदलाव नहीं) ---
def manage_tokens(uid, cost_in_tokens=1500):
    if not db: return False, {"error": "Database connection is not available."}
    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists: return False, {"error": "User profile not found in database."}
    user_data = user_doc.to_dict()
    current_balance = user_data.get('tokens_balance', 0)
    if current_balance < cost_in_tokens: return False, {"error": f"Insufficient tokens. You need {cost_in_tokens} but you have {current_balance}."}
    try:
        user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
        return True, None
    except Exception as e:
        print(f"--- TOKEN DEDUCTION ERROR for UID {uid}: {e} ---")
        return False, {"error": "Could not deduct tokens."}

def verify_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '): return None
    id_token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        print(f"--- AUTH TOKEN VERIFICATION FAILED: {e} ---")
        return None

# --- SHARED PROMPT INSTRUCTIONS (कोई बदलाव नहीं) ---
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

# --- पेमेंट रूट्स (कोई बदलाव नहीं) ---
@app.route('/create-order', methods=['POST'])
def create_order():
    if not razorpay_client: return jsonify({"error": "Payment service is currently unavailable."}), 503
    data = request.get_json()
    amount_in_rupees = data.get('amount')
    uid = data.get('uid')
    if not amount_in_rupees or not uid: return jsonify({"error": "Amount and User ID are required."}), 400
    amount_in_paise = int(amount_in_rupees) * 100
    order_data = {"amount": amount_in_paise, "currency": "INR", "receipt": f"receipt_{uid}_{int(os.times().user)}", "notes": {"firebase_uid": uid}}
    try:
        order = razorpay_client.order.create(data=order_data)
        return jsonify({"order_id": order['id'], "amount": order['amount']})
    except Exception as e:
        print(f"--- RAZORPAY ORDER CREATION ERROR: {e} ---")
        return jsonify({"error": "Could not create payment order."}), 500

@app.route('/razorpay-webhook', methods=['POST'])
def razorpay_webhook():
    webhook_body = request.get_data()
    webhook_signature = request.headers.get('X-Razorpay-Signature')
    webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET')
    if not webhook_secret:
        print("FATAL: RAZORPAY_WEBHOOK_SECRET is not set in environment.")
        return 'Server configuration error', 500
    try:
        razorpay_client.utility.verify_webhook_signature(webhook_body, webhook_signature, webhook_secret)
    except Exception as e:
        print(f"--- WEBHOOK SIGNATURE VERIFICATION FAILED: {e} ---")
        return 'Invalid signature', 400
    payload = request.get_json()
    if payload['event'] == 'payment.captured':
        payment_info = payload['payload']['payment']['entity']
        uid = payment_info['notes'].get('firebase_uid')
        amount_paid = payment_info['amount']
        if uid and db:
            tokens_to_add = 0
            if amount_paid == 10000: tokens_to_add = 50000
            elif amount_paid == 45000: tokens_to_add = 250000
            if tokens_to_add > 0:
                user_ref = db.collection('users').document(uid)
                try:
                    user_ref.update({"tokens_balance": firestore.FieldValue.increment(tokens_to_add)})
                    print(f"SUCCESS: Added {tokens_to_add} tokens to user {uid}.")
                except Exception as e:
                    print(f"--- FIRESTORE UPDATE ERROR (WEBHOOK): {e} ---")
    return 'OK', 200

# --- ⭐⭐ AI Endpoints में Streaming का बदलाव ⭐⭐ ---

# Department 1: Ask a Doubt (Streaming लागू)
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=2500)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
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
        
        # --- बदलाव: Streaming का इस्तेमाल ---
        # अब हम jsonify नहीं करेंगे, बल्कि Response को stream करेंगे।
        return Response(stream_generator(prompt_parts), mimetype='text/plain')
        
    except Exception as e:
        print(f"--- ERROR in ask_ai_image_route: {e} ---")
        return Response(f"सर्वर में एक समस्या आ गयी है: {e}", status=500, mimetype='text/plain')

# Department 2: Generate Notes (Streaming लागू)
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=2000)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        note_type = data.get('noteType', 'long')
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        
        if note_type == 'short':
            notes_prompt = f'**ROLE:** Expert teacher. **TASK:** Generate a brief summary for "{topic}". **LANGUAGE:** Same language as topic.\n{FORMATTING_INSTRUCTIONS}'
        else:
            notes_prompt = f'**ROLE:** Expert teacher. **TASK:** Generate comprehensive notes on "{topic}". **LANGUAGE:** Same language as topic.\n{FORMATTING_INSTRUCTIONS}'
        
        # --- बदलाव: Streaming का इस्तेमाल ---
        return Response(stream_generator([notes_prompt]), mimetype='text/plain')

    except Exception as e:
        print(f"--- ERROR in generate_notes_route: {e} ---")
        return Response(f"नोट्स जेनरेट करते वक़्त सर्वर में समस्या आ गयी: {e}", status=500, mimetype='text/plain')

# Department 3: Generate MCQs (JSON वाला - इसे नहीं बदलेंगे)
# JSON को stream करना सही नहीं है, क्योंकि JSON को पूरा होने के बाद ही parse किया जा सकता है।
# इसलिए, जो फंक्शन JSON लौटाते हैं, वे वैसे ही रहेंगे।
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1000)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 5)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        mcq_prompt = f'Generate {count} MCQs on "{topic}". The language of the questions and options must match the language of the topic itself. The difficulty mix must be 40% easy, 40% medium, and 20% hard. Output must be a valid JSON array of objects with "question", "options" (array of 4 strings), "correct_answer", and a "conceptTag" (string). No extra text or markdown formatting.'
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(mcq_prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        mcq_data = json.loads(response_text)
        return jsonify(mcq_data)
    except Exception as e:
        print(f"--- ERROR in generate_mcq_route: {e} ---")
        return jsonify({'error': 'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी।'}), 500

# Quiz Result Analysis (Streaming लागू)
@app.route('/analyze-quiz-results', methods=['POST'])
def analyze_quiz_results():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=500)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        if not data: return jsonify({'error': 'Request mein koi data nahi mila.'}), 400
        user_answers = data.get('answers')
        if not user_answers: return jsonify({'error': 'Analysis ke liye koi jawab nahi diye gaye.'}), 400
        incorrect_answers = [ans for ans in user_answers if not ans.get('isCorrect')]
        if not incorrect_answers:
            return Response("**शानदार प्रदर्शन!** आपके सभी जवाब सही थे। अपनी तैयारी जारी रखें।")
        incorrect_concepts_str = ", ".join([ans.get('conceptTag', 'Unknown') for ans in incorrect_answers])
        analysis_prompt = f"""
        **ROLE:** Expert AI performance analyst for a student. **TASK:** Analyze incorrect answers and provide a constructive report.
        **DATA:** Student made mistakes in: {incorrect_concepts_str}.
        **INSTRUCTIONS:** 1. Identify top 2-3 weak concepts. 2. Suggest actionable improvements for each. 3. End with encouragement. 4. Use simple Hinglish. {FORMATTING_INSTRUCTIONS}"""
        
        # --- बदलाव: Streaming का इस्तेमाल ---
        return Response(stream_generator([analysis_prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in analyze_quiz_results: {e} ---")
        return Response(f'Analysis करते समय सर्वर में एक समस्या आ गयी है: {e}', status=500, mimetype='text/plain')

# Teacher Dashboard (JSON वाला - इसे नहीं बदलेंगे)
@app.route('/analyze-teacher-dashboard', methods=['POST'])
def analyze_teacher_dashboard():
    if not db: return jsonify({'error': 'Firebase connection not available.'}), 503
    if not model: return jsonify({'error': 'AI model not available.'}), 503
    try:
        data = request.get_json()
        test_id = data.get('testId')
        if not test_id: return jsonify({'error': 'Test ID is missing.'}), 400
        results_ref = db.collection('TestResults').where('testId', '==', test_id).stream()
        all_student_answers = [doc.to_dict() for doc in results_ref]
        if not all_student_answers: return jsonify({"weakest_concepts": [], "action_plan": "Abhi tak kisi student ne yeh test nahi diya hai."})
        incorrect_concepts = []
        student_names_by_concept = {}
        for result in all_student_answers:
            student_name = result.get('studentId', 'Unknown Student')
            for answer in result.get('answers', []):
                if not answer.get('isCorrect'):
                    concept = answer.get('conceptTag', 'Unknown Concept')
                    incorrect_concepts.append(concept)
                    if concept not in student_names_by_concept: student_names_by_concept[concept] = set()
                    student_names_by_concept[concept].add(student_name)
        if not incorrect_concepts: return jsonify({"weakest_concepts": [], "action_plan": "Sabhi students ne saare jawab sahi diye! Shandaar pradarshan!"})
        analysis_prompt = f"""
        **ROLE:** Expert AI analyst for a teacher. **TASK:** Analyze class test results. **DATA:** Incorrect concepts: {str(incorrect_concepts)}.
        **INSTRUCTIONS (Output in a valid JSON format only):**
        1. Identify top 3 weak concepts. 2. Calculate error percentage for each. 3. Create JSON with "weakest_concepts" (array of objects with "concept", "error_percentage", "students") and "action_plan" (Hinglish string).
        **Example:** {{"weakest_concepts": [{{"concept": "Newton's Laws", "error_percentage": 67, "students": ["s1", "s2"]}}], "action_plan": "Newton's Laws ko dubara samjhaein."}}
        """
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(analysis_prompt, generation_config=generation_config)
        report_data = json.loads(get_response_text(response))
        for concept_data in report_data.get("weakest_concepts", []):
            concept_name = concept_data.get("concept")
            if concept_name in student_names_by_concept: concept_data["students"] = list(student_names_by_concept[concept_name])
        return jsonify(report_data)
    except Exception as e:
        print(f"--- ERROR in analyze_teacher_dashboard: {e} ---")
        return jsonify({'error': 'Analysis karte samay server mein takneeki samasya aa gayi hai.'}), 500

# Generate Test (JSON वाला - इसे नहीं बदलेंगे)
@app.route('/generate-test-with-ai', methods=['POST'])
def generate_test_with_ai_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1200)
    if not is_ok: return jsonify(error_response), 402
    if not model: return jsonify({'error': 'AI model is not available.'}), 503
    try:
        data = request.get_json()
        topic, count, difficulty, test_type = data.get('topic'), data.get('count', 10), data.get('difficulty', 'Medium'), data.get('testType', 'mcq')
        if not topic: return jsonify({'error': 'Topic is required.'}), 400
        prompt = ""
        if test_type == 'mcq':
            prompt = f'Generate a test with {count} MCQs on "{topic}" at {difficulty} difficulty. Output MUST be a valid JSON array of objects. Each object needs "text", "options" (array of 4 strings), "correctAnswer", and "conceptTag". Match language of topic. No extra text.'
        else:
            prompt = f'Generate a test with {count} questions and answers on "{topic}" at {difficulty} difficulty. Output MUST be a valid JSON array of objects. Each object needs "text" and "answer". Match language of topic. No extra text.'
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(prompt, generation_config=generation_config)
        generated_questions = json.loads(get_response_text(response))
        if test_type == 'mcq':
            for q in generated_questions:
                try: q['correctAnswerIndex'] = q['options'].index(q['correctAnswer'])
                except (ValueError, KeyError): q['correctAnswerIndex'] = 0
        return jsonify(generated_questions)
    except json.JSONDecodeError:
        return jsonify({'error': 'AI did not return valid JSON. Please try again.'}), 500
    except Exception as e:
        print(f"--- ERROR in generate_test_with_ai_route: {e} ---")
        return jsonify({'error': 'An unknown server error occurred.'}), 500

# Solved Notes (Streaming लागू)
@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1800)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 3)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        solved_notes_prompt = f"**ROLE:** Expert teacher. **TASK:** Provide {count} detailed, step-by-step solved problems for: \"{topic}\". **LANGUAGE:** Same language as topic.\n{FORMATTING_INSTRUCTIONS}"
        return Response(stream_generator([solved_notes_prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in get_solved_notes_route: {e} ---")
        return Response(f'Error generating solved notes: {e}', status=500, mimetype='text/plain')

# Career Advice (Streaming लागू)
@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=800)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        interests = data.get('interests')
        if not interests: return jsonify({'error': 'Please provide your interests.'}), 400
        prompt = f'**ROLE:** Expert AI Career Counselor. **TASK:** Based on interests "{interests}", provide a detailed roadmap. **LANGUAGE:** Same language as interests. Create sections for Career Paths, Stream, Degrees, etc. **Use `---` on a new line to separate sections.**\n{FORMATTING_INSTRUCTIONS}'
        return Response(stream_generator([prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in get_career_advice_route: {e} ---")
        return Response(f'Error generating career advice: {e}', status=500, mimetype='text/plain')

# Study Plan (Streaming लागू)
@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1000)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        plan_details = data.get('details')
        if not plan_details: return jsonify({'error': 'Please provide details for the plan.'}), 400
        prompt = f'**ROLE:** Expert study planner. **TASK:** Create a 7-day plan based on: "{plan_details}". **LANGUAGE:** Same language as details. **RULES: Use `---` on a new line to separate each day.**\n{FORMATTING_INSTRUCTIONS}'
        return Response(stream_generator([prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in generate_study_plan_route: {e} ---")
        return Response(f'Error generating study plan: {e}', status=500, mimetype='text/plain')

# Flashcards (JSON वाला - इसे नहीं बदलेंगे)
@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1000)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 8)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        prompt = f'Generate {count} flashcards for "{topic}". Language must match the topic. Difficulty: 40% easy, 40% medium, 20% hard. Response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. No extra text.'
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        cards_data = json.loads(response_text)
        return jsonify(cards_data)
    except json.JSONDecodeError as json_err:
        print(f"JSON DECODE ERROR in flashcards. AI Response: {response_text}. Error: {json_err}")
        return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था।'}), 500
    except Exception as e:
        print(f"--- UNKNOWN ERROR in generate_flashcards_route: {e} ---")
        return jsonify({'error': 'फ्लैशकार्ड बनाते समय एक अज्ञात सर्वर समस्या हुई।'}), 500

# Essay Writer (Streaming लागू)
@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1500)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide an essay topic.'}), 400
        prompt = f'**ROLE:** Expert Essay Writer. **TASK:** Write a well-structured essay on "{topic}". **LANGUAGE:** Same language as topic.\n{FORMATTING_INSTRUCTIONS}'
        return Response(stream_generator([prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in write_essay_route: {e} ---")
        return Response(f'Error generating essay: {e}', status=500, mimetype='text/plain')

# Presentation Maker (Streaming लागू)
@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1200)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide a presentation topic.'}), 400
        prompt = f'**ROLE:** AI Presentation Maker. **TASK:** Create a presentation outline on "{topic}". **LANGUAGE:** Same language as topic. Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
        return Response(stream_generator([prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in create_presentation_route: {e} ---")
        return Response(f'Error generating presentation: {e}', status=500, mimetype='text/plain')

# Concept Explainer (Streaming लागू)
@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=800)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        prompt = f'**ROLE:** Friendly teacher. **TASK:** Explain "{topic}" simply. **LANGUAGE:** Same language as topic.\n{FORMATTING_INSTRUCTIONS}'
        return Response(stream_generator([prompt]), mimetype='text/plain')
    except Exception as e:
        print(f"--- ERROR in explain_concept_route: {e} ---")
        return Response(f'कॉन्सेप्ट समझाते समय सर्वर में कोई समस्या आ गयी: {e}', status=500, mimetype='text/plain')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
