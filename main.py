
-- coding: utf-8 --
"""
Conceptra AI - मुख्य सर्वर फ़ाइल (app.py)

इस फ़ाइल में Flask सर्वर का पूरा लॉजिक है, जो AI मॉडल से इंटरैक्ट करता है,
यूजर को मैनेज करता है, और पेमेंट को हैंडल करता है।
"""

--- SECTION 1: ज़रूरी लाइब्रेरी को इम्पोर्ट करना ---

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

✅✅✅ नया बदलाव: मालिक की पहचान के लिए ईमेल ✅✅✅
जब आप इस ईमेल से लॉग-इन करेंगे, तो टोकन नहीं कटेंगे।

ADMIN_EMAIL = "himanshu@conceptra.ai"

--- SECTION 2: बाहरी सेवाओं (External Services) को शुरू करना ---
--- Firebase Admin SDK Initialization ---
यह सर्वर को आपके Firestore डेटाबेस से सुरक्षित रूप से कनेक्ट करने की अनुमति देता है।

try:
# यह key.json फाइल को Render जैसे होस्टिंग प्लेटफॉर्म पर सही जगह से उठाएगा।
key_path = Path(file).resolve().parent / 'key.json'
cred = credentials.Certificate(key_path)
firebase_admin.initialize_app(cred)
db = firestore.client()
print("SUCCESS: Firebase Admin SDK सफलतापूर्वक शुरू हो गया है।")
except Exception as e:
print(f"FATAL ERROR: Firebase Admin SDK शुरू नहीं हो सका। कृपया सुनिश्चित करें कि 'key.json' फाइल सही जगह पर है। एरर: {e}")
db = None

--- Flask App Initialization ---

app = Flask(name)

CORS (Cross-Origin Resource Sharing) को सक्षम करना ताकि आपका वेबपेज सर्वर से बात कर सके।

CORS(app)

--- Razorpay Client Initialization ---
यह आपके पेमेंट गेटवे को शुरू करता है।

try:
# यह आपकी Razorpay कीज़ को सुरक्षित रूप से Environment Variables से पढ़ता है।
# Render पर, आपको इन्हें 'Secret Files' के रूप में सेट करना होगा।
key_id_file_path = Path(file).resolve().parent / 'RAZORPAY_KEY_ID'
key_secret_file_path = Path(file).resolve().parent / 'RAZORPAY_KEY_SECRET'

Generated code
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

--- Google Gemini AI Model Configuration ---

try:
# यह आपकी Google API Key को Environment Variable से पढ़ता है।
api_key = os.environ.get('GOOGLE_API_KEY')
if not api_key:
raise ValueError("GOOGLE_API_KEY एनवायरनमेंट वेरिएबल में नहीं मिला।")
genai.configure(api_key=api_key)

Generated code
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
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

except Exception as e:
print(f"FATAL ERROR: Google API Key या मॉडल कॉन्फ़िगर करने में विफल। एरर: {e}")
model = None

--- SECTION 3: हेल्पर फंक्शन्स (Helper Functions) ---
ये छोटे फंक्शन हैं जो बार-बार इस्तेमाल होते हैं।

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

Generated code
user_ref = db.collection('users').document(uid)
try:
    user_doc = user_ref.get()
    if not user_doc.exists:
        return False, {"error": "यूजर प्रोफाइल डेटाबेस में नहीं मिला।"}
    
    current_balance = user_doc.to_dict().get('tokens_balance', 0)
    if current_balance < cost_in_tokens:
        return False, {"error": f"आपके टोकन ({current_balance}) कम हैं। इस काम के लिए {cost_in_tokens} टोकन चाहिए। कृपया रिचार्ज करें।"}
    
    # टोकन बैलेंस घटाएं (यह एक एटॉमिक ऑपरेशन है)
    user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
    return True, None
except Exception as e:
    print(f"टोकन घटाते समय एरर (UID: {uid}): {e}")
    return False, {"error": "टोकन काटने में विफल। कृपया फिर से प्रयास करें।"}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

def verify_user():
"""रिक्वेस्ट हेडर से Firebase ID Token को वेरिफाई करता है।"""
auth_header = request.headers.get('Authorization')
if not auth_header or not auth_header.startswith('Bearer '):
return None

Generated code
id_token = auth_header.split('Bearer ')[1]
try:
    decoded_token = auth.verify_id_token(id_token)
    return decoded_token['uid']
except Exception as e:
    print(f"Auth Token वेरिफिकेशन में विफल: {e}")
    return None
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
✅✅✅ नया बदलाव: मालिक की जाँच करने और टोकन मैनेज करने के लिए नया फंक्शन ✅✅✅

def check_user_privileges(uid, cost_in_tokens):
"""
यह फंक्शन पहले यूजर की पहचान करता है।
- अगर यूजर लॉग-इन नहीं है, तो एरर देता है।
- अगर यूजर 'मालिक' (Admin) है, तो उसे अनुमति देता है और टोकन नहीं काटता।
- अगर यूजर सामान्य है, तो उसके टोकन चेक करता है और काटता है।
"""
if not uid:
return False, jsonify({'error': 'प्रमाणीकरण विफल। कृपया दोबारा लॉगिन करें।'}), 401

Generated code
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
    return False, jsonify(error_response), 402 # अनुमति नहीं है

# अगर सामान्य यूजर के पास टोकन हैं, तो उसे भी अनुमति है
return True, None, None
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
--- सभी AI Prompts के लिए कॉमन फॉर्मेटिंग निर्देश ---

FORMATTING_INSTRUCTIONS = """
VERY IMPORTANT FORMATTING RULES:

Use standard Markdown (## for main headings, ### for subheadings, * for lists).

For important keywords that need emphasis, wrap them in double asterisks.

For chemical reactions, wrap them ONLY in [chem]...[/chem] tags. Example: [chem]2H₂ + O₂ → 2H₂O[/chem].

For mathematical formulas, wrap them ONLY in [math]...[/math] tags. Example: [math]E = mc²[/math].

Do NOT use any other formatting for reactions or formulas.

Use --- on a new line to separate large sections or pages where applicable.
"""

--- SECTION 4: APP ROUTES (API Endpoints) ---

@app.route('/')
def home():
"""मुख्य पेज (index.html) को रेंडर करता है।"""
return render_template('index.html')

--- Payment Routes ---
इनमें कोई बदलाव नहीं है क्योंकि ये पहले से सही काम कर रहे थे।

@app.route('/create-order', methods=['POST'])
def create_order():
if not razorpay_client:
return jsonify({"error": "पेमेंट सेवा अभी उपलब्ध नहीं है।"}), 503
data = request.get_json()
amount = data.get('amount')
uid = data.get('uid')
if not amount or not uid:
return jsonify({"error": "राशि और यूजर आईडी आवश्यक हैं।"}), 400
order_data = {
"amount": int(amount) * 100,  # राशि पैसे में
"currency": "INR",
"receipt": f"receipt_{uid}_{int(time.time())}",
"notes": {"firebase_uid": uid}
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
try:
razorpay_client.utility.verify_webhook_signature(
request.get_data(),
request.headers.get('X-Razorpay-Signature'),
webhook_secret
)
except Exception as e:
print(f"Webhook सिग्नेचर वेरिफिकेशन में विफल: {e}")
return 'Invalid signature', 400
payload = request.get_json()
if payload['event'] == 'payment.captured' and db:
payment_info = payload['payload']['payment']['entity']
uid = payment_info['notes'].get('firebase_uid')
amount_paid = payment_info['amount']  # यह पैसे में है
tokens_to_add = 0
if amount_paid == 10000:    # ₹100 plan
tokens_to_add = 50000
elif amount_paid == 45000:  # ₹450 plan
tokens_to_add = 250000
if uid and tokens_to_add > 0:
try:
user_ref = db.collection('users').document(uid)
user_ref.update({"tokens_balance": firestore.FieldValue.increment(tokens_to_add)})
print(f"SUCCESS: यूजर {uid} को {tokens_to_add} टोकन जोड़े गए।")
except Exception as e:
print(f"Firestore अपडेट एरर (Webhook): {e}")
return 'OK', 200

--- Feature Routes ---
1. Ask a Doubt

@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2500)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

question_text = request.form.get('question', '')
image_file = request.files.get('image')
if not question_text and not image_file: return jsonify({'error': 'कृपया कोई सवाल लिखें या इमेज अपलोड करें।'}), 400

prompt_parts = [f"ROLE: Expert tutor. TASK: Solve this student's doubt step-by-step. LANGUAGE: Same as user's query.\n{FORMATTING_INSTRUCTIONS}"]
if image_file:
    prompt_parts.append(Image.open(image_file))
if question_text:
    prompt_parts.append(f"\nUser's Question: {question_text}")
    
response = model.generate_content(prompt_parts)
return jsonify({'answer': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
2. Generate Notes

@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2000)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
note_type = data.get('noteType', 'long')
if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400

if note_type == 'short':
    prompt = f'ROLE: Expert teacher. TASK: Generate a brief summary and key bullet points for "{topic}".\n{FORMATTING_INSTRUCTIONS}'
else:
    prompt = f'ROLE: Expert teacher. TASK: Generate comprehensive, well-structured notes on "{topic}".\n{FORMATTING_INSTRUCTIONS}'

response = model.generate_content(prompt)
return jsonify({'notes': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
3. Practice MCQs

@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
count = min(int(data.get('count', 5)), 50)
if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400

prompt = f'Generate {count} MCQs on "{topic}". The language of questions and options must match the topic language. Difficulty mix: 40% easy, 40% medium, 20% hard. Output must be a valid JSON array of objects with keys: "question", "options" (array of 4 strings), "correct_answer", and "conceptTag". No extra text or markdown.'

try:
    response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
    return jsonify(json.loads(get_response_text(response)))
except Exception as e:
    print(f"MCQ बनाते समय एरर: {e}")
    return jsonify({'error': 'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी।'}), 500
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
... इसी तरह आपके बाकी सभी फंक्शन यहाँ आएंगे ...
मैंने आपकी मूल फ़ाइल से सभी रूट्स को यहाँ शामिल कर लिया है।
4. Solved Examples

@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1800)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
count = min(int(data.get('count', 3)), 50)
if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400

prompt = f"ROLE: Expert teacher. TASK: Provide {count} detailed, step-by-step solved problems for: \"{topic}\".\n{FORMATTING_INSTRUCTIONS}"
response = model.generate_content(prompt)
return jsonify({'solved_notes': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
5. Career Counselor

@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
interests = data.get('interests')
if not interests: return jsonify({'error': 'कृपया अपनी रुचियां बताएं।'}), 400

prompt = f'ROLE: Expert AI Career Counselor. TASK: Based on user interests "{interests}", provide a detailed career roadmap.\n{FORMATTING_INSTRUCTIONS}'
response = model.generate_content(prompt)
return jsonify({'advice': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
6. Study Planner

@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
details = data.get('details')
if not details: return jsonify({'error': 'कृपया प्लान के लिए विवरण दें।'}), 400

prompt = f'ROLE: Expert study planner. TASK: Create a 7-day study plan based on: "{details}". Use Hinglish for the plan.\n{FORMATTING_INSTRUCTIONS}'
response = model.generate_content(prompt)
return jsonify({'plan': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
7. Flashcards

@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
count = min(int(data.get('count', 8)), 50)
if not topic: return jsonify({'error': 'कृपया एक विषय प्रदान करें।'}), 400

prompt = f'Generate {count} flashcards for "{topic}". The language must match the topic language. Response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. No extra text or markdown.'

try:
    response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
    return jsonify(json.loads(get_response_text(response)))
except Exception as e:
    print(f"Flashcard बनाते समय एरर: {e}")
    return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था।'}), 500
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
8. Essay Writer

@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1500)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
if not topic: return jsonify({'error': 'कृपया निबंध के लिए एक विषय दें।'}), 400

prompt = f'ROLE: Expert Essay Writer. TASK: Write a well-structured essay on "{topic}".\n{FORMATTING_INSTRUCTIONS}'
response = model.generate_content(prompt)
return jsonify({'essay': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
9. Presentation Maker

@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1200)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
if not topic: return jsonify({'error': 'कृपया प्रेजेंटेशन के लिए एक विषय दें।'}), 400

prompt = f'ROLE: AI Presentation Maker. TASK: Create a presentation outline on "{topic}" with a title slide and 5 content slides. Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
response = model.generate_content(prompt)
return jsonify({'presentation': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
10. Concept Explainer

@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
topic = data.get('topic')
if not topic: return jsonify({'error': 'कृपया समझाने के लिए एक कॉन्सेप्ट दें।'}), 400

prompt = f'ROLE: Friendly teacher. TASK: Explain "{topic}" simply, like I am 15 years old. Use Hinglish.\n{FORMATTING_INSTRUCTIONS}'
response = model.generate_content(prompt)
return jsonify({'explanation': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
11. Quiz Analysis

@app.route('/analyze-quiz-results', methods=['POST'])
def analyze_quiz_results():
uid = verify_user()
# ✅✅✅ नया बदलाव: यहाँ मालिक और टोकन की जाँच हो रही है ✅✅✅
is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=500)
if not is_authorized:
return error_json, status_code

Generated code
if not model: return jsonify({'error': 'AI अभी अनुपलब्ध है।'}), 503

data = request.get_json()
user_answers = data.get('answers')
if not user_answers: return jsonify({'error': 'विश्लेषण के लिए कोई जवाब नहीं मिला।'}), 400

incorrect_answers = [ans for ans in user_answers if not ans.get('isCorrect')]
if not incorrect_answers:
    return jsonify({'analysis': "शानदार प्रदर्शन! आपके सभी जवाब सही थे। अपनी तैयारी जारी रखें।"})

incorrect_concepts = ", ".join(set([ans.get('conceptTag', 'General') for ans in incorrect_answers]))

prompt = f"""
ROLE: Expert AI performance analyst.
TASK: Analyze a student's incorrect quiz answers and provide a constructive report in Hinglish.
DATA: Student made mistakes in these concepts: {incorrect_concepts}.
INSTRUCTIONS:
1. Identify weak topics.
2. Suggest specific improvements for each.
3. End with an encouraging message.
{FORMATTING_INSTRUCTIONS}
"""
response = model.generate_content(prompt)
return jsonify({'analysis': get_response_text(response)})
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
--- SECTION 5: Main Execution Block ---

if name == 'main':
# यह सुनिश्चित करता है कि सर्वर सही पोर्ट पर चले, खासकर Render जैसे प्लेटफॉर्म पर।
app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=False)
