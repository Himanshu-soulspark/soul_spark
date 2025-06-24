import os
import json
import re
from pathlib import Path
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore, auth # <-- नया: Firebase Auth को इम्पोर्ट किया
from flask_cors import CORS
import razorpay # <-- नया: Razorpay लाइब्रेरी को इम्पोर्ट किया

# --- Firebase Admin SDK को शुरू करना ---
# यह सर्वर साइड पर Firestore से बात करने के लिए ज़रूरी है
# आपको अपनी Firebase सर्विस अकाउंट की key.json फाइल Render पर अपलोड करनी होगी
try:
    # यह कोड key.json फाइल को प्रोजेक्ट के रूट डायरेक्टरी में ढूंढेगा
    # Render Secret Files को रूट डायरेक्टरी में ही रखता है
    # यह सुनिश्चित करेगा कि कोड हमेशा सही जगह से फाइल उठाए
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

# --- नया: Razorpay Client को शुरू करना ---
try:
    razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID')
    razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
    if not razorpay_key_id or not razorpay_key_secret:
        raise ValueError("Razorpay keys not found in Environment Variables.")
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    print("SUCCESS: Razorpay client initialized.")
except (ValueError, KeyError) as e:
    print(f"FATAL ERROR: {e}. Please check your Razorpay Environment Variables on Render.")
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

# --- नया: टोकन मैनेजमेंट के लिए हेल्पर फंक्शन ---
def manage_tokens(uid, cost_in_tokens=1500): # हर AI कॉल की डिफ़ॉल्ट कीमत 1500 टोकन
    """
    यह फंक्शन टोकन बैलेंस चेक करता है और इस्तेमाल होने पर काटता है।
    Returns: (True, None) अगर सफल हो, (False, error_message) अगर असफल हो।
    """
    if not db:
        return False, {"error": "Database connection is not available."}
    
    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        return False, {"error": "User profile not found in database."}

    user_data = user_doc.to_dict()
    current_balance = user_data.get('tokens_balance', 0)

    if current_balance < cost_in_tokens:
        return False, {"error": f"Insufficient tokens. You need {cost_in_tokens} but you have {current_balance}. Please recharge."}

    # टोकन बैलेंस घटाएं
    try:
        user_ref.update({
            "tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)
        })
        return True, None
    except Exception as e:
        print(f"--- TOKEN DEDUCTION ERROR for UID {uid}: {e} ---")
        return False, {"error": "Could not deduct tokens. Please try again."}

# --- नया: यूज़र को वेरिफाई करने के लिए हेल्पर फंक्शन ---
def verify_user():
    """
    रिक्वेस्ट हेडर से Firebase ID Token को वेरिफाई करता है।
    Returns: user's UID अगर सफल हो, None अगर असफल हो।
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    id_token = auth_header.split('Bearer ')[1]
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        print(f"--- AUTH TOKEN VERIFICATION FAILED: {e} ---")
        return None


# --- SHARED PROMPT INSTRUCTIONS ---
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

# --- नया: पेमेंट के लिए नए Endpoints ---

@app.route('/create-order', methods=['POST'])
def create_order():
    if not razorpay_client:
        return jsonify({"error": "Payment service is currently unavailable."}), 503

    data = request.get_json()
    amount_in_rupees = data.get('amount')
    uid = data.get('uid') # यूज़र की UID ऐप से आएगी

    if not amount_in_rupees or not uid:
        return jsonify({"error": "Amount and User ID are required."}), 400

    amount_in_paise = int(amount_in_rupees) * 100
    order_data = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": f"receipt_{uid}_{int(os.times().user)}",
        "notes": {
            "firebase_uid": uid
        }
    }
    
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
            if amount_paid == 10000: # ₹100 plan
                tokens_to_add = 50000
            elif amount_paid == 45000: # ₹450 plan
                tokens_to_add = 250000
            
            if tokens_to_add > 0:
                user_ref = db.collection('users').document(uid)
                try:
                    user_ref.update({
                        "tokens_balance": firestore.FieldValue.increment(tokens_to_add)
                    })
                    print(f"SUCCESS: Added {tokens_to_add} tokens to user {uid}.")
                except Exception as e:
                    print(f"--- FIRESTORE UPDATE ERROR (WEBHOOK): {e} ---")

    return 'OK', 200

# --- मौजूदा AI Endpoints में टोकन सिस्टम जोड़ना ---

# Department 1: Ask a Doubt
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    # --- नया: टोकन और यूज़र वेरिफिकेशन ---
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    
    # इमेज वाले सवालों के लिए ज़्यादा टोकन लगेंगे
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=2500)
    if not is_ok: return jsonify(error_response), 402 # 402 Payment Required

    # --- आपका मौजूदा कोड ---
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
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
    # --- नया: टोकन और यूज़र वेरिफिकेशन ---
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=2000)
    if not is_ok: return jsonify(error_response), 402

    # --- आपका मौजूदा कोड ---
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        note_type = data.get('noteType', 'long')
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        
        if note_type == 'short':
            notes_prompt = f'**ROLE:** Expert teacher. **TASK:** Generate a brief summary and key bullet points for "{topic}". **LANGUAGE:** Respond in the same language as the provided topic. \n{FORMATTING_INSTRUCTIONS}'
        else:
            notes_prompt = f'**ROLE:** Expert teacher. **TASK:** Generate comprehensive, well-structured notes on "{topic}". **LANGUAGE:** Respond in the same language as the provided topic. \n{FORMATTING_INSTRUCTIONS}'

        response = model.generate_content(notes_prompt)
        notes_text = get_response_text(response)
        return jsonify({'notes': notes_text})
    except Exception as e:
        print(f"--- ERROR in generate_notes_route: {e} ---")
        return jsonify({'error': 'नोट्स जेनरेट करते वक़्त सर्वर में समस्या आ गयी।'}), 500

# (नोट: मैंने हर फंक्शन में टोकन सिस्टम नहीं जोड़ा है ताकि कोड ज़्यादा लंबा न हो, 
# लेकिन आप ऊपर दिए गए 'ask_ai_image_route' और 'generate_notes_route' के पैटर्न को
# अपने बाकी सभी AI वाले फंक्शन में कॉपी-पेस्ट कर सकते हैं।)
#
# उदाहरण: किसी और फंक्शन में कैसे जोड़ें:
# @app.route('/your-ai-function', methods=['POST'])
# def your_ai_function_route():
#     # --- बस ये 4 लाइनें कॉपी-पेस्ट करें ---
#     uid = verify_user()
#     if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
#     is_ok, error_response = manage_tokens(uid, cost_in_tokens=1500) # अपनी कीमत सेट करें
#     if not is_ok: return jsonify(error_response), 402
#
#     # --- यहाँ से आपका मौजूदा कोड शुरू होगा ---
#     try:
#         ... (बाकी का कोड वैसा ही रहेगा)


# Department 3: Generate MCQs (UPDATED with difficulty mix)
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    # --- नया: टोकन और यूज़र वेरिफिकेशन ---
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1000)
    if not is_ok: return jsonify(error_response), 402

    # --- आपका मौजूदा कोड ---
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
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

# ... (बाकी के सभी फंक्शन वैसे ही रहेंगे जैसा आपने दिया था) ...
# आप ऊपर दिए गए पैटर्न का इस्तेमाल करके उनमें भी टोकन सिस्टम आसानी से लगा सकते हैं।

# --- नीचे के सभी फंक्शन आपके दिए हुए कोड के अनुसार ही हैं ---
# मैंने उनमें कोई बदलाव नहीं किया है ताकि आप खुद से टोकन सिस्टम जोड़ सकें।

# --- NEW ENDPOINT: Quiz Result Analysis ---
@app.route('/analyze-quiz-results', methods=['POST'])
def analyze_quiz_results():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=500)
    if not is_ok: return jsonify(error_response), 402
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request mein koi data nahi mila.'}), 400
            
        user_answers = data.get('answers')
        if not user_answers:
            return jsonify({'error': 'Analysis ke liye koi jawab nahi diye gaye.'}), 400
            
        incorrect_answers = [ans for ans in user_answers if not ans.get('isCorrect')]
        
        if not incorrect_answers:
            return jsonify({'analysis': "**शानदार प्रदर्शन!** आपके सभी जवाब सही थे। अपनी तैयारी जारी रखें।"})

        incorrect_concepts_str = ", ".join([ans.get('conceptTag', 'Unknown') for ans in incorrect_answers])

        analysis_prompt = f"""
        **ROLE:** Expert AI performance analyst for a student.
        **TASK:** Analyze the student's incorrect answers from a quiz and provide a constructive report.
        **DATA:** The student made mistakes in these concepts: {incorrect_concepts_str}.
        
        **INSTRUCTIONS:**
        1.  **Identify Weak Topics:** Identify the top 2-3 concepts where the student made the most mistakes.
        2.  **Suggest Improvement:** For each weak topic, provide a clear, actionable suggestion. This could be revising a specific part of the chapter, watching a video, or practicing more problems of a certain type.
        3.  **Provide Encouragement:** End with a positive and motivating message.
        4.  **Language:** Use simple Hinglish.
        
        {FORMATTING_INSTRUCTIONS}
        """

        response = model.generate_content(analysis_prompt)
        analysis_text = get_response_text(response)
        
        return jsonify({'analysis': analysis_text})

    except Exception as e:
        print(f"--- ERROR in analyze_quiz_results: {e} ---")
        return jsonify({'error': 'Analysis karte samay server mein ek takneeki samasya aa gayi hai. Kripya baad mein koshish karein.'}), 500

# ... (बाकी सभी फंक्शन्स नीचे हैं) ...
# मैंने सिर्फ ऊपर के कुछ फंक्शन्स में टोकन सिस्टम का उदाहरण दिया है।
# आप इसी तरह से बाकी फंक्शन्स में भी टोकन सिस्टम लगा सकते हैं।

# --- NEW ENDPOINT FOR TEACHER DASHBOARD ---
@app.route('/analyze-teacher-dashboard', methods=['POST'])
def analyze_teacher_dashboard():
    # टीचर के फंक्शन के लिए आप टोकन सिस्टम नहीं लगाना चाहेंगे, इसलिए इसे वैसा ही रहने देते हैं।
    if not db:
        return jsonify({'error': 'Firebase connection not available.'}), 503
    if not model:
        return jsonify({'error': 'AI model not available.'}), 503

    try:
        data = request.get_json()
        test_id = data.get('testId')
        if not test_id:
            return jsonify({'error': 'Test ID is missing from the request.'}), 400

        results_ref = db.collection('TestResults').where('testId', '==', test_id).stream()
        
        all_student_answers = []
        for result_doc in results_ref:
            all_student_answers.append(result_doc.to_dict())

        if not all_student_answers:
            return jsonify({
                "weakest_concepts": [],
                "action_plan": "Abhi tak kisi student ne yeh test nahi diya hai. Jab students test de denge, to analysis yahan dikhega."
            })
            
        incorrect_concepts = []
        student_names_by_concept = {}

        for result in all_student_answers:
            student_name = result.get('studentId', 'Unknown Student') 
            for answer in result.get('answers', []):
                if not answer.get('isCorrect'):
                    concept = answer.get('conceptTag', 'Unknown Concept')
                    incorrect_concepts.append(concept)
                    if concept not in student_names_by_concept:
                        student_names_by_concept[concept] = set()
                    student_names_by_concept[concept].add(student_name)
        
        if not incorrect_concepts:
            return jsonify({
                "weakest_concepts": [],
                "action_plan": "Sabhi students ne saare jawab sahi diye! Shandaar pradarshan!"
            })

        analysis_prompt = f"""
        **ROLE:** Expert AI performance analyst for a teacher.
        **TASK:** Analyze the combined test results for a whole class and generate a detailed report for the teacher.
        **DATA:** The list of all incorrect concepts from all students is: {str(incorrect_concepts)}.
        
        **INSTRUCTIONS (Output in a valid JSON format only):**
        1.  Identify the top 3 concepts with the most mistakes.
        2.  For each of these 3 weak concepts, calculate the percentage of students who made a mistake in it.
        3.  Create a JSON object with two keys: "weakest_concepts" and "action_plan".
        4.  The "weakest_concepts" key should hold an array of objects. Each object must have three keys: "concept" (string), "error_percentage" (integer), and "students" (an array of student names who were weak in this concept).
        5.  The "action_plan" key should hold a string suggesting a clear, step-by-step plan for the teacher to address these weaknesses.
        6.  The language for the action plan must be simple Hinglish.

        **Example JSON Output:**
        {{
          "weakest_concepts": [
            {{
              "concept": "Newton's Laws",
              "error_percentage": 67,
              "students": ["student123", "student456"]
            }},
            {{
              "concept": "Friction",
              "error_percentage": 33,
              "students": ["student789"]
            }}
          ],
          "action_plan": "Newton's Laws me kaafi students ko problem hai. Is concept ko practical examples ke saath dubara samjhaein.\\nFriction ke liye extra practice problems assign karein."
        }}
        """
        
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(analysis_prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        
        report_data = json.loads(response_text)
        
        for concept_data in report_data.get("weakest_concepts", []):
            concept_name = concept_data.get("concept")
            if concept_name in student_names_by_concept:
                concept_data["students"] = list(student_names_by_concept[concept_name])
                
        return jsonify(report_data)

    except Exception as e:
        print(f"--- ERROR in analyze_teacher_dashboard: {e} ---")
        return jsonify({'error': 'Analysis karte samay server mein ek takneeki samasya aa gayi hai.'}), 500


@app.route('/generate-test-with-ai', methods=['POST'])
def generate_test_with_ai_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1200)
    if not is_ok: return jsonify(error_response), 402

    if not model:
        return jsonify({'error': 'AI model is not available.'}), 503

    try:
        data = request.get_json()
        topic = data.get('topic')
        count = data.get('count', 10)
        difficulty = data.get('difficulty', 'Medium')
        test_type = data.get('testType', 'mcq') 

        if not topic:
            return jsonify({'error': 'Topic is required to generate a test.'}), 400

        prompt = ""
        if test_type == 'mcq':
            prompt = f"""
            Generate a test with exactly {count} multiple-choice questions on the topic "{topic}".
            The difficulty level for all questions should be {difficulty}.
            The language of the generated questions, options, and answers must match the language of the topic "{topic}".
            Your output MUST be a valid JSON array of objects.
            Each object in the array represents a single question and MUST have the following keys:
            - "text": The question text (string).
            - "options": An array of exactly 4 string options.
            - "correctAnswer": The string of the correct answer, which must be one of the provided options.
            - "conceptTag": A short, specific concept tag related to the question (e.g., "Ohm's Law", "Mitochondria").
            Do not include any text outside of the JSON array.
            """
        else:
            prompt = f"""
            Generate a test with exactly {count} questions and their answers on the topic "{topic}".
            The difficulty level for all questions should be {difficulty}.
            The language of the generated questions and answers must match the language of the topic "{topic}".
            Your output MUST be a valid JSON array of objects.
            Each object MUST have exactly two keys: "text" (for the question text) and "answer" (for the correct answer text).
            Do not include any text outside of the JSON array.
            """

        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        
        generated_questions = json.loads(response_text)
        
        if test_type == 'mcq':
            for q in generated_questions:
                try:
                    q['correctAnswerIndex'] = q['options'].index(q['correctAnswer'])
                except (ValueError, KeyError):
                    q['correctAnswerIndex'] = 0

        return jsonify(generated_questions)

    except json.JSONDecodeError:
        print(f"--- JSON DECODE ERROR in generate_test_with_ai. AI Response: {response_text} ---")
        return jsonify({'error': 'AI did not return valid JSON. Please try again.'}), 500
    except Exception as e:
        print(f"--- ERROR in generate_test_with_ai_route: {e} ---")
        return jsonify({'error': 'An unknown server error occurred while generating the test.'}), 500


@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1800)
    if not is_ok: return jsonify(error_response), 402

    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 3)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        solved_notes_prompt = f"**ROLE:** Expert teacher. **TASK:** Provide {count} detailed, step-by-step solved problems for: \"{topic}\". **LANGUAGE:** Respond in the same language as the provided topic. \n{FORMATTING_INSTRUCTIONS}"
        response = model.generate_content(solved_notes_prompt)
        solved_notes_text = get_response_text(response)
        return jsonify({'solved_notes': solved_notes_text})
    except Exception as e:
        print(f"--- ERROR in get_solved_notes_route: {e} ---")
        return jsonify({'error': 'Error generating solved notes.'}), 500


@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=800)
    if not is_ok: return jsonify(error_response), 402

    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        interests = data.get('interests')
        if not interests: return jsonify({'error': 'Please provide your interests.'}), 400
        prompt = f'**ROLE:** Expert AI Career Counselor. **TASK:** Based on user interests "{interests}", provide a detailed career roadmap. **LANGUAGE:** Respond in the same language as the user\'s provided interests. Create sections for Career Paths, Required Stream, Degrees, etc. **Use `---` on a new line to separate each major section.**\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        advice_text = get_response_text(response)
        return jsonify({'advice': advice_text})
    except Exception as e:
        print(f"--- ERROR in get_career_advice_route: {e} ---")
        return jsonify({'error': 'Error generating career advice.'}), 500


@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1000)
    if not is_ok: return jsonify(error_response), 402
    
    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        plan_details = data.get('details')
        if not plan_details: return jsonify({'error': 'Please provide details for the plan.'}), 400
        prompt = f'**ROLE:** Expert study planner. **TASK:** Create a 7-day study plan based on: "{plan_details}". **LANGUAGE:** Respond in the same language as the provided details. **RULES: Use `---` on a new line to separate each day.**\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        plan_text = get_response_text(response)
        return jsonify({'plan': plan_text})
    except Exception as e:
        print(f"--- ERROR in generate_study_plan_route: {e} ---")
        return jsonify({'error': 'Error generating study plan.'}), 500


@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1000)
    if not is_ok: return jsonify(error_response), 402

    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        count = min(int(data.get('count', 8)), 50)
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        prompt = f'Generate {count} flashcards for "{topic}". The language of the flashcard content (front and back) must match the language of the topic. The difficulty mix must be 40% easy/foundational, 40% medium/applied, and 20% hard/advanced. Your response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. No extra text or markdown.'
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


@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1500)
    if not is_ok: return jsonify(error_response), 402

    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide an essay topic.'}), 400
        prompt = f'**ROLE:** Expert Essay Writer. **TASK:** Write a well-structured essay on "{topic}". **LANGUAGE:** Write the essay in the same language as the provided topic. \n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        essay_text = get_response_text(response)
        return jsonify({'essay': essay_text})
    except Exception as e:
        print(f"--- ERROR in write_essay_route: {e} ---")
        return jsonify({'error': 'Error generating essay.'}), 500
        

@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=1200)
    if not is_ok: return jsonify(error_response), 402

    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide a presentation topic.'}), 400
        prompt = f'**ROLE:** AI Presentation Maker. **TASK:** Create a presentation outline on "{topic}". **LANGUAGE:** Create the presentation in the same language as the provided topic. Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        presentation_text = get_response_text(response)
        return jsonify({'presentation': presentation_text})
    except Exception as e:
        print(f"--- ERROR in create_presentation_route: {e} ---")
        return jsonify({'error': 'Error generating presentation.'}), 500


@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
    uid = verify_user()
    if not uid: return jsonify({'error': 'Authentication failed. Please login again.'}), 401
    is_ok, error_response = manage_tokens(uid, cost_in_tokens=800)
    if not is_ok: return jsonify(error_response), 402

    try:
        if not model: return jsonify({'error': 'AI is currently unavailable. Please try again later.'}), 503
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({'error': 'Please provide a topic.'}), 400
        prompt = f'**ROLE:** Friendly teacher. **TASK:** Explain "{topic}" simply. **LANGUAGE:** Explain in the same language as the provided topic. \n{FORMATTING_INSTRUCTIONS}'
        response = model.generate_content(prompt)
        explanation_text = get_response_text(response)
        if "AI ने सुरक्षा कारणों से जवाब रोक दिया है" in explanation_text: return jsonify({'error': explanation_text}), 500
        return jsonify({'explanation': explanation_text})
    except Exception as e:
        print(f"--- ERROR in explain_concept_route: {e} ---")
        return jsonify({'error': 'कॉन्सेप्ट समझाते समय सर्वर में कोई समस्या आ गयी।'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
