# -*- coding: utf-8 -*-
"""
================================================================
 Conceptra AI - मुख्य सर्वर फ़ाइल (app.py)
================================================================
 इस फ़ाइल में Flask सर्वर का पूरा लॉजिक है, जो AI मॉडल से इंटरैक्ट करता है,
 यूजर को मैनेज करता है, और पेमेंट को हैंडल करता है।
"""

# --- SECTION 1: ज़रूरी लाइब्रेरी को इम्पोर्ट करना ---
import os
import json
import re
from pathlib import Path
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, Response
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore, auth
from flask_cors import CORS
import razorpay
import time # Razorpay रसीद के लिए

# ✅✅✅ नया बदलाव: मालिक की पहचान के लिए ईमेल ✅✅✅
# जब आप इस ईमेल से लॉग-इन करेंगे, तो टोकन नहीं कटेंगे।
ADMIN_EMAIL = "himanshu@conceptra.ai"


# --- SECTION 2: बाहरी सेवाओं (External Services) को शुरू करना ---

# --- Firebase Admin SDK Initialization ---
# यह सर्वर को आपके Firestore डेटाबेस से सुरक्षित रूप से कनेक्ट करने की अनुमति देता है।
try:
    # यह key.json फाइल को Render जैसे होस्टिंग प्लेटफॉर्म पर सही जगह से उठाएगा।
    key_path = Path(__file__).resolve().parent / 'key.json'
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("SUCCESS: Firebase Admin SDK सफलतापूर्वक शुरू हो गया है।")
except Exception as e:
    print(f"FATAL ERROR: Firebase Admin SDK शुरू नहीं हो सका। कृपया सुनिश्चित करें कि 'key.json' फाइल सही जगह पर है। एरर: {e}")
    db = None

# --- Flask App Initialization ---
app = Flask(__name__)
# CORS (Cross-Origin Resource Sharing) को सक्षम करना ताकि आपका वेबपेज सर्वर से बात कर सके।
CORS(app)

# --- Razorpay Client Initialization ---
# यह आपके पेमेंट गेटवे को शुरू करता है।
try:
    # यह आपकी Razorpay कीज़ को सुरक्षित रूप से Environment Variables से पढ़ता है।
    # Render पर, आपको इन्हें 'Secret Files' के रूप में सेट करना होगा।
    key_id_file_path = Path(__file__).resolve().parent / 'RAZORPAY_KEY_ID'
    key_secret_file_path = Path(__file__).resolve().parent / 'RAZORPAY_KEY_SECRET'

    with open(key_id_file_path, 'r') as f:
        razorpay_key_id = f.read().strip()
    with open(key_secret_file_path, 'r') as f:
        razorpay_key_secret = f.read().strip()

    if not razorpay_key_id or not razorpay_key_secret:
        raise ValueError("Razorpay की कीज़ फाइलों में मौजूद नहीं हैं।")

    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    print("SUCCESS: Razorpay Client सफलतापूर्वक शुरू हो गया है।")
except Exception as e:
    print(f"FATAL ERROR: Razorpay Client शुरू नहीं हो सका। कृपया अपनी कीज़ जांचें। एरर: {e}")
    razorpay_client = None

# --- Google Gemini AI Model Configuration ---
try:
    # यह आपकी Google API Key को Environment Variable से पढ़ता है।
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_API_KEY एनवायरनमेंट वेरिएबल में नहीं मिला।")
    genai.configure(api_key=api_key)
    
    # AI मॉडल के लिए सुरक्षा सेटिंग्स (कम प्रतिबंधात्मक)
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    # AI मॉडल चुनना (gemini-1.5-flash एक तेज़ और कुशल मॉडल है)
    model = genai.GenerativeModel('gemini-1.5-flash-latest', safety_settings=safety_settings)
    print("SUCCESS: Google Gemini AI मॉडल सफलतापूर्वक लोड हो गया है।")
except Exception as e:
    print(f"FATAL ERROR: Google API Key या मॉडल कॉन्फ़िगर करने में विफल। एरर: {e}")
    model = None

# --- SECTION 3: हेल्पर फंक्शन्स (Helper Functions) ---
# ये छोटे फंक्शन हैं जो बार-बार इस्तेमाल होते हैं।

def get_response_text(response):
    """AI के जवाब से टेक्स्ट निकालने के लिए एक सुरक्षित फंक्शन।"""
    try:
        # अगर जवाब टुकड़ों में है, तो सभी को जोड़ें
        if response.parts:
            return "".join(part.text for part in response.parts)
        # अगर सीधा टेक्स्ट है
        elif hasattr(response, 'text'):
            return response.text
        # अगर AI ने सुरक्षा कारणों से जवाब को ब्लॉक कर दिया है
        if response.prompt_feedback and response.prompt_feedback.block_reason:
            return f"AI ने सुरक्षा कारणों से जवाब रोक दिया है। कारण: {response.prompt_feedback.block_reason.name}"
        return "AI से कोई जवाब नहीं मिला।"
    except Exception as e:
        print(f"AI के जवाब से टेक्स्ट निकालते समय एरर: {e}")
        return "माफ कीजिये, AI से जवाब नहीं मिल सका।"

def manage_tokens(uid, cost_in_tokens=1500):
    """यूजर के टोकन बैलेंस को चेक और अपडेट करता है।"""
    if not db:
        return False, {"error": "डेटाबेस कनेक्शन उपलब्ध नहीं है।"}

    user_ref = db.collection('users').document(uid)
    try:
        user_doc = user_ref.get()
        if not user_doc.exists:
            return False, {"error": "यूजर प्रोफाइल डेटाबेस में नहीं मिला।"}
        
        current_balance = user_doc.to_dict().get('tokens_balance', 0)
        if current_balance < cost_in_tokens:
            return False, {"error": f"आपके सिक्के ({current_balance}) कम हैं। इस काम के लिए {cost_in_tokens} सिक्के चाहिए। कृपया रिचार्ज करें।"} # "टोकन" को "सिक्के" से बदला गया
        
        # टोकन बैलेंस घटाएं (यह एक एटॉमिक ऑपरेशन है)
        user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
        return True, None
    except Exception as e:
        print(f"सिक्के घटाते समय एरर (UID: {uid}): {e}") # "टोकन" को "सिक्के" से बदला गया
        return False, {"error": "सिक्के काटने में विफल। कृपया फिर से प्रयास करें।"} # "टोकन" को "सिक्के" से बदला गया

def verify_user():
    """रिक्वेस्ट हेडर से Firebase ID Token को वेरिफाई करता है।"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        # अगर हेडर नहीं है या सही फॉर्मेट में नहीं है, तो लॉग करें और None लौटाएं
        if not auth_header:
            print("प्रमाणीकरण विफल: Authorization हेडर मौजूद नहीं है।")
        else:
            print("प्रमाणीकरण विफल: Authorization हेडर 'Bearer ' से शुरू नहीं होता है।")
        return None 
    
    id_token = auth_header.split('Bearer ')[1]
    if not id_token: # सुनिश्चित करें कि टोकन खाली नहीं है
        print("प्रमाणीकरण विफल: Authorization हेडर में टोकन खाली है।")
        return None
        
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except firebase_admin.auth.InvalidIdTokenError:
        print(f"Auth Token वेरिफिकेशन में विफल: अमान्य ID टोकन।")
        return None
    except Exception as e: # अन्य Firebase auth एरर को पकड़ें
        print(f"Auth Token वेरिफिकेशन में अप्रत्याशित एरर: {e}")
        return None

# ✅✅✅ बदला हुआ हिस्सा: `check_user_privileges` में एरर मैसेज को और स्पष्ट किया गया ✅✅✅
def check_user_privileges(uid, cost_in_tokens):
    """
    यह फंक्शन पहले यूजर की पहचान करता है।
    - अगर यूजर लॉग-इन नहीं है (uid is None), तो एरर देता है।
    - अगर यूजर 'मालिक' (Admin) है, तो उसे अनुमति देता है और टोकन नहीं काटता।
    - अगर यूजर सामान्य है, तो उसके टोकन चेक करता है और काटता है।
    """
    if not uid:
        # यह मैसेज तब आएगा जब verify_user() None लौटाएगा
        return False, jsonify({'error': 'प्रमाणीकरण विफल। आपको लॉग इन करने की आवश्यकता हो सकती है या आपका सेशन समाप्त हो गया है।'}), 401 
    
    try:
        # Firebase से यूजर की पूरी जानकारी (ईमेल समेत) निकालते हैं
        user_record = auth.get_user(uid)
        # अगर यूजर का ईमेल, मालिक के ईमेल से मिलता है, तो उसे आगे बढ़ने दें
        if user_record.email == ADMIN_EMAIL:
            print(f"ADMIN ACCESS: User {user_record.email} is bypassing token check.")
            return True, None, None # अनुमति है, कोई एरर नहीं
    except Exception as e:
        # अगर यूजर की जानकारी निकालने में कोई एरर आए, तो उसे सामान्य यूजर मानें
        print(f"Admin check failed for UID {uid}. Treating as regular user. Error: {e}")

    # अगर यूजर मालिक नहीं है, तो उसके टोकन की जाँच करें
    is_ok, error_response = manage_tokens(uid, cost_in_tokens)
    if not is_ok:
        # manage_tokens से आया हुआ एरर मैसेज यहाँ इस्तेमाल होगा
        return False, jsonify(error_response), 402 # अनुमति नहीं है, 402 Payment Required
    
    # अगर सामान्य यूजर के पास टोकन हैं, तो उसे भी अनुमति है
    return True, None, None

# --- सभी AI Prompts के लिए कॉमन फॉर्मेटिंग निर्देश ---
FORMATTING_INSTRUCTIONS = """
VERY IMPORTANT FORMATTING RULES:
- Use standard Markdown (## for main headings, ### for subheadings, * for lists).
- For important keywords that need emphasis, wrap them in **double asterisks**.
- For chemical reactions, wrap them ONLY in [chem]...[/chem] tags. Example: [chem]2H₂ + O₂ → 2H₂O[/chem].
- For mathematical formulas, wrap them ONLY in [math]...[/math] tags. Example: [math]E = mc²[/math].
- Do NOT use any other formatting for reactions or formulas.
- Use --- on a new line to separate large sections or pages where applicable.
"""

# --- SECTION 4: APP ROUTES (API Endpoints) ---

@app.route('/')
def home():
    """मुख्य पेज (index.html) को रेंडर करता है।"""
    return render_template('index.html')

# --- Payment Routes ---
# इनमें कोई बदलाव नहीं है क्योंकि ये पहले से सही काम कर रहे थे।
@app.route('/create-order', methods=['POST'])
def create_order():
    if not razorpay_client:
        return jsonify({"error": "पेमेंट सेवा अभी उपलब्ध नहीं है।"}), 503
    
    uid = verify_user() # ऑर्डर बनाने से पहले यूजर को वेरिफाई करें
    if not uid:
        return jsonify({"error": "ऑर्डर बनाने के लिए प्रमाणीकरण आवश्यक है।"}), 401

    data = request.get_json()
    amount = data.get('amount')
    # uid अब verify_user() से मिलेगा, तो इसे JSON बॉडी से लेने की जरूरत नहीं।
    # firebase_uid = data.get('uid') # इस लाइन की अब आवश्यकता नहीं

    if not amount: # केवल राशि की जाँच करें
        return jsonify({"error": "राशि आवश्यक है।"}), 400
    
    order_data = {
        "amount": int(amount) * 100,  # राशि पैसे में
        "currency": "INR",
        "receipt": f"receipt_{uid}_{int(time.time())}", # verify_user से मिला uid इस्तेमाल करें
        "notes": {"firebase_uid": uid} # verify_user से मिला uid इस्तेमाल करें
    }
    try:
        order = razorpay_client.order.create(data=order_data)
        return jsonify({"order_id": order['id'], "amount": order['amount']})
    except Exception as e:
        print(f"Razorpay ऑर्डर बनाने में एरर: {e}")
        return jsonify({"error": "पेमेंट ऑर्डर बनाने में विफल।"}), 500

@app.route('/razorpay-webhook', methods=['POST'])
def razorpay_webhook():
    webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET')
    if not webhook_secret:
        print("FATAL: RAZORPAY_WEBHOOK_SECRET एनवायरनमेंट में सेट नहीं है।")
        return 'Server configuration error', 500
    
    webhook_body = request.get_data()
    webhook_signature = request.headers.get('X-Razorpay-Signature')

    if not webhook_signature:
        print("Webhook एरर: X-Razorpay-Signature हेडर मौजूद नहीं है।")
        return 'Signature header missing', 400

    try:
        razorpay_client.utility.verify_webhook_signature(
            webhook_body.decode('utf-8'), # डेटा को स्ट्रिंग के रूप में डीकोड करें
            webhook_signature, 
            webhook_secret
        )
    except razorpay.errors.SignatureVerificationError as e: # विशिष्ट एरर को पकड़ें
        print(f"Webhook सिग्नेचर वेरिफिकेशन में विफल: {e}")
        return 'Invalid signature', 400
    except Exception as e:
        print(f"Webhook वेरिफिकेशन में अप्रत्याशित एरर: {e}")
        return 'Webhook verification error', 400

    payload = request.get_json()
    if payload and payload.get('event') == 'payment.captured' and db:
        payment_info = payload.get('payload', {}).get('payment', {}).get('entity')
        if not payment_info:
            print("Webhook एरर: पेमेंट की जानकारी पेलोड में नहीं मिली।")
            return 'Invalid payload', 400

        uid = payment_info.get('notes', {}).get('firebase_uid')
        amount_paid = payment_info.get('amount')  # यह पैसे में है

        if not uid or amount_paid is None:
            print(f"Webhook एरर: UID ({uid}) या राशि ({amount_paid}) पेमेंट की जानकारी में नहीं मिली।")
            return 'Missing UID or amount in payment info', 400

        tokens_to_add = 0
        if amount_paid == 10000:    # ₹100 plan
            tokens_to_add = 50000
        elif amount_paid == 45000:  # ₹450 plan
            tokens_to_add = 250000
        
        if tokens_to_add > 0:
            try:
                user_ref = db.collection('users').document(uid)
                user_ref.update({"tokens_balance": firestore.FieldValue.increment(tokens_to_add)})
                print(f"SUCCESS: यूजर {uid} को {tokens_to_add} सिक्के जोड़े गए।") # "टोकन" को "सिक्के" से बदला गया
            except Exception as e:
                print(f"Firestore अपडेट एरर (Webhook): {e}")
                return 'Database update error', 500 # एरर होने पर सर्वर को सूचित करें
    elif not payload or not payload.get('event'):
        print("Webhook एरर: अमान्य या खाली पेलोड।")
        return 'Invalid or empty payload', 400
        
    return 'OK', 200

# --- Feature Routes ---

# 1. Ask a Doubt
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2500)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    question_text = request.form.get('question', '')
    image_file = request.files.get('image')
    if not question_text and not image_file: return jsonify({'error': 'कृपया कोई सवाल लिखें या इमेज अपलोड करें।'}), 400

    prompt_parts = [f"ROLE: Expert tutor. TASK: Solve this student's doubt step-by-step. LANGUAGE: Same as user's query.\n{FORMATTING_INSTRUCTIONS}"]
    if image_file:
        try:
            img = Image.open(image_file)
            # आप यहाँ इमेज का आकार या प्रकार भी जांच सकते हैं यदि आवश्यक हो
            prompt_parts.append(img)
        except Exception as e:
            print(f"इमेज प्रोसेस करते समय एरर: {e}")
            return jsonify({'error': 'अपलोड की गई इमेज को प्रोसेस करने में समस्या हुई।'}), 400
            
    if question_text:
        prompt_parts.append(f"\nUser's Question: {question_text}")
    
    try:    
        response = model.generate_content(prompt_parts)
        return jsonify({'answer': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Ask Doubt): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 2. Generate Notes
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2000)
    if not is_authorized:
        return error_json, status_code
    
    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    note_type = data.get('noteType', 'long')
    if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400

    if note_type == 'short':
        prompt = f'ROLE: Expert teacher. TASK: Generate a brief summary and key bullet points for "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    else:
        prompt = f'ROLE: Expert teacher. TASK: Generate comprehensive, well-structured notes on "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    
    try:
        response = model.generate_content(prompt)
        return jsonify({'notes': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Generate Notes): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 3. Practice MCQs
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    try:
        count = min(int(data.get('count', 5)), 50) # सुनिश्चित करें कि count एक पूर्णांक है
    except ValueError:
        return jsonify({'error': 'MCQ की संख्या एक मान्य नंबर होनी चाहिए।'}), 400
        
    if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400
    
    prompt = f'Generate {count} MCQs on "{topic}". The language of questions and options must match the topic language. Difficulty mix: 40% easy, 40% medium, 20% hard. Output must be a valid JSON array of objects with keys: "question", "options" (array of 4 strings), "correct_answer", and "conceptTag". No extra text or markdown.'
    
    try:
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        # AI से मिला टेक्स्ट JSON है या नहीं, इसकी जाँच करें
        response_text = get_response_text(response)
        try:
            parsed_json = json.loads(response_text)
            return jsonify(parsed_json)
        except json.JSONDecodeError:
            print(f"MCQ बनाते समय JSON पार्सिंग में एरर। AI का जवाब: {response_text}")
            return jsonify({'error': 'AI से मिला जवाब सही JSON फॉर्मेट में नहीं था।'}), 500
    except Exception as e:
        print(f"MCQ बनाते समय एरर: {e}")
        return jsonify({'error': 'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी।'}), 500


# 4. Solved Examples
@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1800)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    try:
        count = min(int(data.get('count', 3)), 50)
    except ValueError:
        return jsonify({'error': 'उदाहरणों की संख्या एक मान्य नंबर होनी चाहिए।'}), 400

    if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400

    prompt = f"ROLE: Expert teacher. TASK: Provide {count} detailed, step-by-step solved problems for: \"{topic}\".\n{FORMATTING_INSTRUCTIONS}"
    try:
        response = model.generate_content(prompt)
        return jsonify({'solved_notes': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Solved Notes): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 5. Career Counselor
@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    interests = data.get('interests')
    if not interests: return jsonify({'error': 'कृपया अपनी रुचियां बताएं।'}), 400

    prompt = f'ROLE: Expert AI Career Counselor. TASK: Based on user interests "{interests}", provide a detailed career roadmap.\n{FORMATTING_INSTRUCTIONS}'
    try:
        response = model.generate_content(prompt)
        return jsonify({'advice': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Career Advice): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 6. Study Planner
@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400
    
    details = data.get('details')
    if not details: return jsonify({'error': 'कृपया प्लान के लिए विवरण दें।'}), 400

    prompt = f'ROLE: Expert study planner. TASK: Create a 7-day study plan based on: "{details}". Use Hinglish for the plan.\n{FORMATTING_INSTRUCTIONS}'
    try:
        response = model.generate_content(prompt)
        return jsonify({'plan': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Study Plan): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 7. Flashcards
@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    try:
        count = min(int(data.get('count', 8)), 50)
    except ValueError:
        return jsonify({'error': 'फ्लैशकार्ड की संख्या एक मान्य नंबर होनी चाहिए।'}), 400
        
    if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400
    
    prompt = f'Generate {count} flashcards for "{topic}". The language must match the topic language. Response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. No extra text or markdown.'

    try:
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        response_text = get_response_text(response)
        try:
            parsed_json = json.loads(response_text)
            return jsonify(parsed_json)
        except json.JSONDecodeError:
            print(f"Flashcard बनाते समय JSON पार्सिंग में एरर। AI का जवाब: {response_text}")
            return jsonify({'error': 'AI से मिला जवाब सही JSON फॉर्मेट में नहीं था।'}), 500
    except Exception as e:
        print(f"Flashcard बनाते समय एरर: {e}")
        return jsonify({'error': 'AI से फ्लैशकार्ड जेनरेट करते वक़्त गड़बड़ हो गयी।'}), 500


# 8. Essay Writer
@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1500)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    if not topic: return jsonify({'error': 'कृपया निबंध के लिए एक विषय दें।'}), 400

    prompt = f'ROLE: Expert Essay Writer. TASK: Write a well-structured essay on "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    try:
        response = model.generate_content(prompt)
        return jsonify({'essay': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Essay Writer): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 9. Presentation Maker
@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1200)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    if not topic: return jsonify({'error': 'कृपया प्रेजेंटेशन के लिए एक विषय दें।'}), 400

    prompt = f'ROLE: AI Presentation Maker. TASK: Create a presentation outline on "{topic}" with a title slide and 5 content slides. Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
    try:
        response = model.generate_content(prompt)
        return jsonify({'presentation': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Presentation Maker): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500

# 10. Concept Explainer
@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800)
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503
    
    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    topic = data.get('topic')
    if not topic: return jsonify({'error': 'कृपया समझाने के लिए एक कॉन्सेप्ट दें।'}), 400

    prompt = f'ROLE: Friendly teacher. TASK: Explain "{topic}" simply, like I am 15 years old. Use Hinglish.\n{FORMATTING_INSTRUCTIONS}'
    try:
        response = model.generate_content(prompt)
        return jsonify({'explanation': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Concept Explainer): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500


# 11. Quiz Analysis
@app.route('/analyze-quiz-results', methods=['POST'])
def analyze_quiz_results():
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=500) # टोकन कॉस्ट पहले से सही थी
    if not is_authorized:
        return error_json, status_code

    if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

    data = request.get_json()
    if not data: return jsonify({'error': 'अनुरोध डेटा गायब है या JSON फॉर्मेट में नहीं है।'}), 400

    user_answers = data.get('answers')
    if not user_answers: return jsonify({'error': 'विश्लेषण के लिए कोई जवाब नहीं मिला।'}), 400
    if not isinstance(user_answers, list): return jsonify({'error': 'जवाब एक सूची (list) के रूप में होने चाहिए।'}), 400


    incorrect_answers = [ans for ans in user_answers if isinstance(ans, dict) and not ans.get('isCorrect')]
    if not incorrect_answers:
        return jsonify({'analysis': "शानदार प्रदर्शन! आपके सभी जवाब सही थे। अपनी तैयारी जारी रखें."})

    incorrect_concepts_list = [ans.get('conceptTag', 'General') for ans in incorrect_answers if ans.get('conceptTag')]
    incorrect_concepts = ", ".join(set(incorrect_concepts_list))
    if not incorrect_concepts: # अगर conceptTag नहीं है, तो एक सामान्य मैसेज दें
        incorrect_concepts = "विभिन्न विषयों"
    
    prompt = f"""
    ROLE: Expert AI performance analyst.
    TASK: Analyze a student's incorrect quiz answers and provide a constructive report in Hinglish.
    DATA: Student made mistakes in these concepts: {incorrect_concepts}.
    INSTRUCTIONS:
    1. Identify weak topics based on the concepts.
    2. Suggest specific improvements for each weak topic.
    3. End with an encouraging message.
    {FORMATTING_INSTRUCTIONS}
    """
    try:
        response = model.generate_content(prompt)
        return jsonify({'analysis': get_response_text(response)})
    except Exception as e:
        print(f"Gemini AI से जवाब प्राप्त करते समय एरर (Quiz Analysis): {e}")
        return jsonify({'error': 'AI से जवाब प्राप्त करने में असमर्थ। कृपया बाद में प्रयास करें।'}), 500


# --- SECTION 5: Main Execution Block ---
if __name__ == '__main__':
    # यह सुनिश्चित करता है कि सर्वर सही पोर्ट पर चले, खासकर Render जैसे प्लेटफॉर्म पर।
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=False)
