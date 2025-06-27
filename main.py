# -- coding: utf-8 --
"""
Conceptra - मुख्य सर्वर फ़ाइल (main.py)

इस फ़ाइल में आपके पूरे Conceptra ऐप का सर्वर लॉजिक है, जिसमें AI,
यूजर मैनेजमेंट, पेमेंट, और अन्य फीचर्स शामिल हैं।
"""

# ✅✅✅ नया DEBUG print - Main App के स्टार्टअप को ट्रैक करने के लिए ✅✅✅
print("DEBUG_MAIN_INIT_001: Conceptra main.py script execution started.")


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
import time

# --- आपके मूल कोड को सपोर्ट करने के लिए ये वैरिएबल बनाये गए हैं ---
# NOTE: '__name__' और '__file__' Python द्वारा स्वतः परिभाषित होते हैं, इन्हें रीडिफाइन करने की ज़रूरत नहीं है।
#       'project_root' को थोड़ा एडजस्ट किया गया है ताकि यह वर्तमान फाइल की डायरेक्टरी को सही ढंग से इंगित करे।
project_root = Path(__file__).resolve().parent
# -----------------------------------------------------------------

# ✅✅✅ मालिक की पहचान के लिए ईमेल (AI Code से) ✅✅✅
ADMIN_EMAIL = "himanshu@conceptra.ai"

# --- SECTION 2: बाहरी सेवाओं (External Services) को शुरू करना ---

# --- Firebase Admin SDK Initialization ---
# यह सर्वर को आपके Firestore डेटाबेस से सुरक्षित रूप से कनेक्ट करने की अनुमति देता है।

# ✅✅✅ Firebase Admin SDK Initialization Logic (AI Code से, Secret File 'key.json' से पढ़ रहा है) ✅✅✅
# NOTE: यह ब्लॉक आपके Main App के किसी भी मौजूदा Firebase Admin Initialization को बदल देगा,
#       क्योंकि AI ऐप का लॉजिक Secret File हैंडलिंग के लिए अधिक उपयुक्त है।
db = None # Initialize to None
auth_admin = None # Initialize to None

try:
    print("DEBUG_MAIN_INIT_002: Attempting to initialize Firebase Admin SDK from key.json Secret File.")
    # Correctly reference key.json relative to the script location
    key_path = project_root / 'key.json'
    print(f"DEBUG_MAIN_INIT_003: Looking for key.json at path: {key_path}")

    if not key_path.exists():
         print(f"FATAL ERROR_MAIN_INIT_001: key.json file NOT found at {key_path}.")
         raise FileNotFoundError(f"Firebase key file not found at expected path: {key_path}")

    print(f"DEBUG_MAIN_INIT_004: Found key.json at {key_path}.")
    print("DEBUG_MAIN_INIT_005: Attempting to create credentials.Certificate...")
    cred = credentials.Certificate(key_path)
    print("DEBUG_MAIN_INIT_006: credentials.Certificate created successfully.")

    # Firebase Admin SDK को initialize करें
    if not firebase_admin._apps:
        print("DEBUG_MAIN_INIT_007: firebase_admin is not already initialized. Calling initialize_app...")
        firebase_admin.initialize_app(cred)
        print("DEBUG_MAIN_INIT_008: firebase_admin.initialize_app called.")
    else:
        print("DEBUG_MAIN_INIT_009: firebase_admin is already initialized. Skipping initialize_app call.")


    # Firestore और Auth clients को प्राप्त करें
    print("DEBUG_MAIN_INIT_010: Attempting to get firestore.client()...")
    db = firestore.client()
    print("DEBUG_MAIN_INIT_011: firestore.client() obtained.")

    print("DEBUG_MAIN_INIT_012: Attempting to get firebase_admin.auth...")
    auth_admin = firebase_admin.auth
    print("DEBUG_MAIN_INIT_013: firebase_admin.auth obtained.")


    print("SUCCESS_MAIN_INIT_001: Firebase Admin SDK सफलतापूर्वक Secret File 'key.json' से शुरू हो गया है। db and auth_admin are available.")

except FileNotFoundError as e:
    print(f"FATAL ERROR_MAIN_INIT_002: Firebase Admin SDK शुरू नहीं हो सका। 'key.json' फाइल नहीं मिली। कृपया सुनिश्चित करें कि यह Secret File के रूप में सही तरह से ऐड किया गया है। एरर: {e}")
    db = None
    auth_admin = None
except Exception as e:
    print(f"FATAL ERROR_MAIN_INIT_003: Firebase Admin SDK शुरू नहीं हो सका। 'key.json' फाइल में कुछ और समस्या है या क्रेडेंशियल अमान्य हैं। एरर: {e}")
    print(f"DEBUG_MAIN_INIT_014: Exception details: {e}")
    db = None
    auth_admin = None


# --- Flask App Initialization ---

# NOTE: Assuming your Main App already has this. Keep only one Flask app instance.
#       If your Main App had additional config here, merge it.
app = Flask(__name__)
print("DEBUG_MAIN_INIT_015: Flask app initialized.")

# NOTE: Assuming your Main App needs CORS. Keep if needed.
CORS(app)
print("DEBUG_MAIN_INIT_016: CORS initialized.")


# --- Razorpay Client Initialization ---
# यह आपके पेमेंट गेटवे को शुरू करता है।

# ✅✅✅ Razorpay Client Initialization Logic (AI Code से, Secret Files से पढ़ रहा है) ✅✅✅
# NOTE: यह ब्लॉक आपके Main App के किसी भी मौजूदा Razorpay Initialization को बदल देगा।
razorpay_client = None # Initialize to None
try:
    print("DEBUG_MAIN_INIT_017: Attempting to initialize Razorpay Client from Secret Files.")
    # Correctly reference secret files relative to the script location
    razorpay_key_id_path = project_root / 'RAZORPAY_KEY_ID'
    razorpay_key_secret_path = project_root / 'RAZORPAY_KEY_SECRET'
    print(f"DEBUG_MAIN_INIT_018: Looking for Razorpay Key ID at path: {razorpay_key_id_path}")
    print(f"DEBUG_MAIN_INIT_019: Looking for Razorpay Key Secret at path: {razorpay_key_secret_path}")

    if not razorpay_key_id_path.exists():
         print(f"FATAL ERROR_MAIN_INIT_004: RAZORPAY_KEY_ID file NOT found at {razorpay_key_id_path}.")
         raise FileNotFoundError(f"Razorpay Key ID file not found at expected path: {razorpay_key_id_path}")
    if not razorpay_key_secret_path.exists():
         print(f"FATAL ERROR_MAIN_INIT_005: RAZORPAY_KEY_SECRET file NOT found at {razorpay_key_secret_path}.")
         raise FileNotFoundError(f"Razorpay Key Secret file not found at expected path: {razorpay_key_secret_path}")

    print(f"DEBUG_MAIN_INIT_020: Found Razorpay Key ID at {razorpay_key_id_path}.")
    print(f"DEBUG_MAIN_INIT_021: Found Razorpay Key Secret at {razorpay_key_secret_path}.")
    print("DEBUG_MAIN_INIT_022: Attempting to read Razorpay Key ID file...")
    with open(razorpay_key_id_path, 'r') as f:
        razorpay_key_id = f.read().strip()
    print("DEBUG_MAIN_INIT_023: Successfully read Razorpay Key ID file.")

    print("DEBUG_MAIN_INIT_024: Attempting to read Razorpay Key Secret file...")
    with open(razorpay_key_secret_path, 'r') as f:
        razorpay_key_secret = f.read().strip()
    print("DEBUG_MAIN_INIT_025: Successfully read Razorpay Key Secret file.")


    if not razorpay_key_id:
        print("DEBUG_MAIN_INIT_026: Razorpay Key ID read from file is empty.")
        raise ValueError(f"Razorpay Key ID file is empty or could not be read.")
    if not razorpay_key_secret:
        print("DEBUG_MAIN_INIT_027: Razorpay Key Secret read from file is empty.")
        raise ValueError(f"Razorpay Key Secret file is empty or could not be read.")

    print("DEBUG_MAIN_INIT_028: Razorpay Key ID and Secret read successfully. Attempting to create Razorpay Client...")
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    print("DEBUG_MAIN_INIT_029: Razorpay Client object created.")

    print("SUCCESS_MAIN_INIT_002: Razorpay Client सफलतापूर्वक Secret Files से शुरू हो गया है।")

except FileNotFoundError as e:
    print(f"FATAL ERROR_MAIN_INIT_006: Razorpay Client शुरू नहीं हो सका। आवश्यक Secret File नहीं मिली। एरर: {e}")
    razorpay_client = None
except ValueError as e:
    print(f"FATAL ERROR_MAIN_INIT_007: Razorpay Client शुरू नहीं हो सका। Secret File खाली है या पढ़ने में समस्या। एरर: {e}")
    print(f"DEBUG_MAIN_INIT_030: Exception details: {e}")
    razorpay_client = None
except Exception as e:
    print(f"FATAL ERROR_MAIN_INIT_008: Razorpay Client शुरू नहीं हो सका। कुछ और समस्या। एरर: {e}")
    print(f"DEBUG_MAIN_INIT_031: Exception details: {e}")
    razorpay_client = None


# --- Google Gemini AI Model Configuration ---
# ✅✅✅ Google Gemini AI Model Configuration Logic (AI Code से, Environment variable से पढ़ रहा है) ✅✅✅
# NOTE: यह ब्लॉक आपके Main App के किसी भी मौजूदा AI Model Initialization को बदल देगा।
model = None # Initialize to None
try:
    print("DEBUG_MAIN_INIT_032: Attempting to configure Google Gemini AI model from Environment Variable.")
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        print("FATAL ERROR_MAIN_INIT_009: GOOGLE_API_KEY Environment variable not found or is empty.")
        raise ValueError("GOOGLE_API_KEY एनवायरनमेंट वेरिएबल में नहीं मिला।")

    print("DEBUG_MAIN_INIT_033: GOOGLE_API_KEY found. Configuring genai...")
    genai.configure(api_key=api_key)
    print("DEBUG_MAIN_INIT_034: genai.configure called.")

    # AI मॉडल के लिए सुरक्षा सेटिंग्स (कम प्रतिबंधात्मक)
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    # AI मॉडल चुनना (gemini-1.5-flash एक तेज़ और कुशल मॉडल है)
    print("DEBUG_MAIN_INIT_035: Loading Gemini model 'gemini-1.5-flash-latest'...")
    model = genai.GenerativeModel('gemini-1.5-flash-latest', safety_settings=safety_settings)
    print("DEBUG_MAIN_INIT_036: Gemini model object created.")

    print("SUCCESS_MAIN_INIT_003: Google Gemini AI मॉडल सफलतापूर्वक लोड हो गया है।")

except Exception as e:
    print(f"FATAL ERROR_MAIN_INIT_010: Google API Key या मॉडल कॉन्फ़िगर करने में विफल। एरर: {e}")
    print(f"DEBUG_MAIN_INIT_037: Exception details: {e}")
    model = None

print("DEBUG_MAIN_INIT_038: Section 2 (External Services) initialization finished.")


# --- SECTION 3: हेल्per फंक्शन्स (Helper Functions) ---
# ये छोटे फंक्शन हैं जो बार-बार इस्तेमाल होते हैं।
# ✅✅✅ Helper Functions (AI Code से, कोई बदलाव नहीं) ✅✅✅

def get_response_text(response):
    """AI के जवाब से टेक्स्ट निकालने के लिए एक सुरक्षित फंक्शन।"""
    try:
        if response and hasattr(response, 'parts') and response.parts:
            return "".join(part.text for part in response.parts)
        elif response and hasattr(response, 'text'):
            return response.text
        if response and hasattr(response, 'prompt_feedback') and response.prompt_feedback and response.prompt_feedback.block_reason:
            print(f"DEBUG_AI_001: AI response blocked. Reason: {response.prompt_feedback.block_reason.name}")
            return f"AI ने सुरक्षा कारणों से जवाब रोक दिया है। कारण: {response.prompt_feedback.block_reason.name}"
        print("DEBUG_AI_002: AI response is empty or unexpected format.")
        return "AI से कोई जवाब नहीं मिला।"
    except Exception as e:
        print(f"DEBUG_AI_003: AI के जवाब से टेक्स्ट निकालते समय एरर: {e}")
        return "माफ कीजिये, AI से जवाब मिल सका।"


def manage_tokens(uid, cost_in_tokens=1500):
    print(f"DEBUG_TOKEN_001: manage_tokens called for UID: {uid}, cost: {cost_in_tokens}")
    if db is None:
        print("DEBUG_TOKEN_002: manage_tokens: db is None. Firestore not initialized. Check server logs.")
        return False, {"error": "डेटाबेस कनेक्शन उपलब्ध नहीं है। कृपया सर्वर लॉग जांचें।"}

    user_ref = db.collection('users').document(uid)
    try:
        print(f"DEBUG_TOKEN_003: manage_tokens: Getting user doc for UID {uid}")
        user_doc = user_ref.get()
        if not user_doc.exists:
            print(f"DEBUG_TOKEN_004: manage_tokens: User doc not found for UID {uid}.")
            return False, {"error": "यूजर प्रोफाइल डेटाबेस में नहीं मिला। कृपया दोबारा लॉगिन करें।"}

        current_balance = user_doc.to_dict().get('tokens_balance', 0)
        print(f"DEBUG_TOKEN_005: manage_tokens: Current token balance for UID {uid} is {current_balance}.")
        if current_balance < cost_in_tokens:
            print(f"DEBUG_TOKEN_006: manage_tokens: Insufficient tokens ({current_balance}) for UID {uid}. Need {cost_in_tokens}.")
            return False, {"error": f"आपके टोकन ({current_balance}) कम हैं। इस काम के लिए {cost_in_tokens} टोकन चाहिए। कृपया रिचार्ज करें।"}

        print(f"DEBUG_TOKEN_007: manage_tokens: Attempting to deduct {cost_in_tokens} tokens from UID {uid}.")
        # Use update with increment for atomic operation
        user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
        print(f"DEBUG_TOKEN_008: manage_tokens: Tokens deducted successfully for UID {uid}.")
        return True, None
    except Exception as e:
        print(f"DEBUG_TOKEN_009: manage_tokens: एरर टोकन घटाते समय (UID: {uid}): {e}")
        print(f"DEBUG_TOKEN_010: manage_tokens: Exception details: {e}")
        return False, {"error": "टोकन काटने में विफल। कृपया फिर से प्रयास करें।"}


def verify_user():
    print("DEBUG_AUTH_001: verify_user called.")
    if auth_admin is None:
        print("DEBUG_AUTH_002: verify_user: auth_admin is None. Admin Auth SDK not initialized. Cannot verify token. Check server logs.")
        return None

    auth_header = request.headers.get('Authorization')
    print(f"DEBUG_AUTH_003: verify_user: Received Authorization header: {auth_header}")

    if not auth_header:
        print("DEBUG_AUTH_004: verify_user: Authorization header is missing.")
        return None

    if not auth_header.startswith('Bearer '):
        print("DEBUG_AUTH_005: verify_user: Authorization header does not start with 'Bearer '.")
        return None

    id_token = auth_header.split('Bearer ')[1]
    # print(f"DEBUG_AUTH_006: verify_user: Extracted token: {id_token[:10]}...") # Avoid logging full token
    print("DEBUG_AUTH_007: verify_user: Attempting to verify token using auth_admin...")
    try:
        decoded_token = auth_admin.verify_id_token(id_token)
        print(f"DEBUG_AUTH_008: verify_user: Token successfully verified for UID: {decoded_token.get('uid')}")
        return decoded_token.get('uid')
    except Exception as e:
        print(f"DEBUG_AUTH_009: verify_user: Auth Token वेरिफिकेशन में विफल: {e}")
        print(f"DEBUG_AUTH_010: verify_user: Verification Error Details: {e}")
        return None


def check_user_privileges(uid, cost_in_tokens):
    print(f"DEBUG_PRIV_001: check_user_privileges called with UID: {uid}, cost: {cost_in_tokens}.")

    if uid is None:
        print("DEBUG_PRIV_002: check_user_privileges: UID is None. Authentication Failed (from verify_user).")
        return False, jsonify({'error': 'प्रमाणीकरण विफल। कृपया दोबारा लॉगिन करें।'}), 401

    # Admin bypass logic (AI Code से)
    try:
        if auth_admin is None:
             print("DEBUG_PRIV_003: check_user_privileges: auth_admin is None during admin check. Skipping admin check, proceeding to token check.")
        else:
            print(f"DEBUG_PRIV_004: check_user_privileges: Attempting to fetch user record for UID {uid} for Admin check.")
            user_record = auth_admin.get_user(uid)
            print(f"DEBUG_PRIV_005: check_user_privileges: User record fetched. Email: {user_record.email}")
            if user_record.email == ADMIN_EMAIL:
                print(f"DEBUG_PRIV_006: ADMIN ACCESS: User {user_record.email} (UID: {uid}) is bypassing token check.")
                return True, None, None
            else:
                 print(f"DEBUG_PRIV_007: User {user_record.email} (UID: {uid}) is NOT the admin email {ADMIN_EMAIL}.")
    except Exception as e:
        print(f"DEBUG_PRIV_008: check_user_privileges: Error fetching user record for UID {uid} (Admin check failed): {e}. Proceeding to token check.")
        print(f"DEBUG_PRIV_009: Exception details: {e}")


    print(f"DEBUG_PRIV_010: check_user_privileges: User {uid} is not admin or admin check failed. Proceeding to manage_tokens check.")
    is_ok, error_response = manage_tokens(uid, cost_in_tokens)
    if not is_ok:
        print(f"DEBUG_PRIV_011: check_user_privileges: Token management failed for UID {uid}. Reason: {error_response.get('error')}. Returning error.")
        return False, jsonify(error_response), 402

    print(f"DEBUG_PRIV_012: check_user_privileges: User {uid} authorized. Token cost: {cost_in_tokens}.")
    return True, None, None


# --- सभी AI Prompts के लिए कॉमन फॉर्मेटिंग निर्देश (AI Code से) ---
FORMATTING_INSTRUCTIONS = """
VERY IMPORTANT FORMATTING RULES:

Use standard Markdown (## for main headings, ### for subheadings, * for lists).

For important keywords that need emphasis, wrap them in double asterisks.

For chemical reactions, wrap them ONLY in [chem]...[/chem] tags. Example: [chem]2H₂ + O₂ → 2H₂O[/chem].

For mathematical formulas, wrap them ONLY in [math]...[/math] tags. Example: [math]E = mc²[/math].

Do NOT use any other formatting for reactions or formulas.

Use --- on a new line to separate large sections or pages where applicable.
"""

# --- SECTION 4: APP ROUTES (API Endpoints) ---
# ✅✅✅ AI App Routes (AI Code से) ✅✅✅
# NOTE: ये रूट्स आपके Main App के मौजूदा रूट्स के साथ मर्ज हो जाएंगे।
#       सुनिश्चित करें कि कोई URL conflict न हो (जैसे अगर Main App में भी /create-order हो)।

@app.route('/')
def home():
    print("DEBUG_ROUTE_001: '/' route called. Rendering index.html")
    # NOTE: Assuming the merged HTML is now index.html in the templates folder
    return render_template('index.html')

# --- Payment Routes ---

@app.route('/create-order', methods=['POST'])
def create_order():
    print("DEBUG_ROUTE_002: '/create-order' route called.")
    if razorpay_client is None:
        print("DEBUG_ROUTE_003: create_order: razorpay_client is None. Returning 503.")
        return jsonify({"error": "पेमेंट सेवा अभी उपलब्ध नहीं है। कृपया सर्वर लॉग जांचें।"}), 503

    uid = verify_user()
    if not uid:
         print("DEBUG_ROUTE_004: create_order: User not authenticated (UID is None). Returning 401.")
         return jsonify({'error': 'प्रमाणीकरण विफल। कृपया दोबारा लॉगिन करें।'}), 401

    data = request.get_json()
    amount = data.get('amount')
    uid_from_body = data.get('uid')

    print(f"DEBUG_ROUTE_005: create_order: Request body - amount: {amount}, uid: {uid_from_body}. Verified UID: {uid}")

    if not amount or not uid_from_body:
        print("DEBUG_ROUTE_006: create_order: Missing amount or uid in body. Returning 400.")
        return jsonify({"error": "राशि और यूजर आईडी आवश्यक हैं।"}), 400

    if uid != uid_from_body:
         print(f"WARNING_ROUTE_001: create_order: UID mismatch. Token UID: {uid}, Body UID: {uid_from_body}. Returning 401.")
         return jsonify({'error': 'सुरक्षा त्रुटि: यूजर आईडी मेल नहीं खा रही है।'}), 401

    order_data = {
        "amount": int(amount) * 100,
        "currency": "INR",
        "receipt": f"receipt_{uid}_{int(time.time())}",
        "notes": {"firebase_uid": uid}
    }
    try:
        print(f"DEBUG_ROUTE_007: create_order: Calling Razorpay Client create order for UID: {uid}")
        order = razorpay_client.order.create(data=order_data)
        print(f"DEBUG_ROUTE_008: create_order: Razorpay order created. Order ID: {order.get('id')}")
        return jsonify({"order_id": order.get('id'), "amount": order.get('amount')})
    except Exception as e:
        print(f"DEBUG_ROUTE_009: create_order: Razorpay order creation error for UID {uid}: {e}")
        print(f"DEBUG_ROUTE_010: create_order: Exception details: {e}")
        return jsonify({"error": "पेमेंट ऑर्डर बनाने में विफल। कृपया फिर से प्रयास करें।"}), 500


@app.route('/razorpay-webhook', methods=['POST'])
def razorpay_webhook():
    print("DEBUG_ROUTE_011: '/razorpay-webhook' route called.")
    webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET')
    if not webhook_secret:
        print("FATAL ERROR_ROUTE_001: RAZORPAY_WEBHOOK_SECRET Environment variable not set. Returning 500.")
        return 'Server configuration error (Webhook secret missing)', 500

    if razorpay_client is None:
        print("FATAL ERROR_ROUTE_002: razorpay_client is None in webhook handler. Cannot verify signature. Returning 500.")
        return 'Server unavailable for signature verification', 500

    try:
        print("DEBUG_ROUTE_012: Webhook: Attempting to verify signature.")
        razorpay_client.utility.verify_webhook_signature(
            request.get_data(),
            request.headers.get('X-Razorpay-Signature'),
            webhook_secret
        )
        print("DEBUG_ROUTE_013: Webhook signature verified successfully.")
    except Exception as e:
        print(f"DEBUG_ROUTE_014: Webhook: सिग्नेचर वेरिफिकेशन में विफल: {e}")
        print(f"DEBUG_ROUTE_015: Webhook: Verification error details: {e}")
        return 'Invalid signature', 400

    payload = request.get_json()
    event = payload.get('event')
    print(f"DEBUG_ROUTE_016: Webhook payload received. Event: {event}")

    if event == 'payment.captured':
        print("DEBUG_ROUTE_017: Webhook: Processing payment.captured event.")
        if db is None:
            print("FATAL ERROR_ROUTE_003: db is None in webhook handler. Cannot update tokens. Returning 500.")
            return 'Database unavailable for token update', 500

        payment_info = payload.get('payload', {}).get('payment', {}).get('entity', {})
        uid = payment_info.get('notes', {}).get('firebase_uid')
        amount_paid = payment_info.get('amount')
        payment_id = payment_info.get('id')
        order_id = payment_info.get('order_id')

        print(f"DEBUG_ROUTE_018: Webhook: Payment ID: {payment_id}, Order ID: {order_id}, UID from notes: {uid}, Amount: {amount_paid}")

        if uid is None or amount_paid is None:
             print(f"WARNING_ROUTE_002: Webhook payload missing uid ({uid}) or amount ({amount_paid}). Payment ID: {payment_id}. Returning 400.")
             return 'Missing required data in payload', 400

        tokens_to_add = 0
        # Convert amount_paid to float or int before comparison if necessary,
        # though Razorpay amounts are usually in smallest unit (paise) as integers.
        # Assuming amount_paid is an integer in paise.
        if amount_paid == 10000: # 100 INR
            tokens_to_add = 50000
        elif amount_paid == 45000: # 450 INR
            tokens_to_add = 250000

        if tokens_to_add > 0:
            try:
                print(f"DEBUG_ROUTE_019: Webhook: Attempting to add {tokens_to_add} tokens to UID {uid}.")
                user_ref = db.collection('users').document(uid)
                # Use update with increment for atomic operation
                user_ref.update({"tokens_balance": firestore.FieldValue.increment(tokens_to_add)})
                print(f"SUCCESS_ROUTE_001: Webhook: User {uid} added {tokens_to_add} tokens. Payment ID: {payment_id}")
            except Exception as e:
                print(f"DEBUG_ROUTE_020: Webhook: Firestore update error (UID {uid}, Payment ID {payment_id}): {e}. Returning 500.")
                print(f"DEBUG_ROUTE_021: Webhook: Exception details: {e}")
                return f'Failed to update tokens for user {uid}', 500
        else:
             print(f"DEBUG_ROUTE_022: Webhook: No tokens defined for amount_paid {amount_paid} for UID {uid}. Payment ID: {payment_id}. Acknowledging OK.")
             # If amount doesn't match, it might be a different product or test, still acknowledge success to Razorpay
             return 'OK (Amount does not match known plans)', 200

    elif event.startswith('payment.failed'):
        payment_info = payload.get('payload', {}).get('payment', {}).get('entity', {})
        print(f"DEBUG_ROUTE_023: Webhook: Payment Failed. ID: {payment_info.get('id')}, Order: {payment_info.get('order_id')}, Status: {payment_info.get('status')}, Error: {payment_info.get('error_description')}")
        # Log failed payment, but return 200 to acknowledge receipt of the webhook
        return 'OK (Failed payment logged)', 200
    elif event.startswith('order.'):
         print(f"DEBUG_ROUTE_024: Webhook: Received order event '{event}', not processing. Acknowledging OK.")
         # Acknowledge order events if not explicitly handled
         return 'OK', 200

    print(f"DEBUG_ROUTE_025: Webhook: Received unknown event '{event}'. Acknowledging OK.")
    return 'OK', 200


# --- Feature Routes (AI Features) ---
# 1. Ask a Doubt

@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    print("DEBUG_ROUTE_026: '/ask-ai-image' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2500)
    if not is_authorized:
        print(f"DEBUG_ROUTE_027: Ask AI Image request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_028: Ask AI Image: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503

    question_text = request.form.get('question', '')
    image_file = request.files.get('image')
    if not question_text and not image_file:
        print("DEBUG_ROUTE_029: Ask AI Image request missing question or image. Returning 400.")
        return jsonify({'error': 'कृपया कोई सवाल लिखें या इमेज अपलोड करें।'}), 400

    prompt_parts = [f"ROLE: Expert tutor. TASK: Solve this student's doubt step-by-step. LANGUAGE: Same as user's query.\n{FORMATTING_INSTRUCTIONS}"]
    if image_file:
        try:
            img = Image.open(image_file)
            prompt_parts.append(img)
            print("DEBUG_ROUTE_030: Ask AI Image: Image file successfully opened.")
        except Exception as e:
            print(f"DEBUG_ROUTE_031: Ask AI Image: Error opening image file: {e}. Returning 400.")
            print(f"DEBUG_ROUTE_032: Ask AI Image: Exception details: {e}")
            return jsonify({'error': f'इमेज फाइल को प्रोसेस करने में गड़बड़ हो गयी: {e}'}), 400

    if question_text:
        prompt_parts.append(f"\nUser's Question: {question_text}")
        print(f"DEBUG_ROUTE_033: Ask AI Image: User Question: {question_text[:100]}...")

    try:
        print(f"DEBUG_ROUTE_034: Ask AI Image: Calling AI model (UID: {uid}). Prompt parts count: {len(prompt_parts)}")
        response = model.generate_content(prompt_parts)
        answer = get_response_text(response)
        print(f"DEBUG_ROUTE_035: Ask AI Image: AI response received (UID: {uid}). Answer length: {len(answer)}")
        return jsonify({'answer': answer})
    except Exception as e:
        print(f"DEBUG_ROUTE_036: Ask AI Image: Error generating content (UID: {uid}): {e}. Returning 500.")
        print(f"DEBUG_ROUTE_037: Ask AI Image: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500


# 2. Generate Notes

@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    print("DEBUG_ROUTE_038: '/generate-notes-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2000)
    if not is_authorized:
        print(f"DEBUG_ROUTE_039: Generate Notes request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_040: Generate Notes: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    note_type = data.get('noteType', 'long')
    if not topic:
        print("DEBUG_ROUTE_041: Generate Notes request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया एक विषय प्रदान करें।'}), 400

    if note_type == 'short':
        prompt = f'ROLE: Expert teacher. TASK: Generate a brief summary and key bullet points for "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    else:
        prompt = f'ROLE: Expert teacher. TASK: Generate comprehensive, well-structured notes on "{topic}".\n{FORMATTING_INSTRUCTIONS}'

    try:
        print(f"DEBUG_ROUTE_042: Generate Notes: Calling AI model (UID: {uid}). Topic: {topic}, Type: {note_type}")
        response = model.generate_content(prompt)
        notes = get_response_text(response)
        print(f"DEBUG_ROUTE_043: Generate Notes: AI response received (UID: {uid}). Notes length: {len(notes)}")
        return jsonify({'notes': notes})
    except Exception as e:
        print(f"DEBUG_ROUTE_044: Generate Notes: Error generating content (UID: {uid}). Topic: {topic}. Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_045: Generate Notes: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500


# 3. Practice MCQs

@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    print("DEBUG_ROUTE_046: '/generate-mcq-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
    if not is_authorized:
        print(f"DEBUG_ROUTE_047: Generate MCQ request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_048: Generate MCQ: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    count = min(int(data.get('count', 5)), 50)
    if not topic:
        print("DEBUG_ROUTE_049: Generate MCQ request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया एक विषय प्रदान करें!'}), 400

    prompt = f'Generate {count} MCQs on "{topic}". The language of questions and options must match the topic language. Difficulty mix: 40% easy, 40% medium, 20% hard. Output must be a valid JSON array of objects with keys: "question", "options" (array of 4 strings), "correct_answer", and "conceptTag". Do not include any surrounding text, explanation, or markdown like ```json`.'

    try:
        print(f"DEBUG_ROUTE_050: Generate MCQ: Calling AI model (UID: {uid}). Topic: {topic}, Count: {count}. Requesting JSON mime type.")
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        mcqs_text = get_response_text(response)
        # Clean up markdown json block
        mcqs_text = re.sub(r'```json\s*\n*', '', mcqs_text, count=1)
        mcqs_text = re.sub(r'\n*```\s*$', '', mcqs_text, count=1)

        print(f"DEBUG_ROUTE_051: Generate MCQ: Attempting to parse JSON response:\n{mcqs_text[:500]}...")

        questions = json.loads(mcqs_text)

        if not isinstance(questions, list):
             print(f"WARNING_ROUTE_003: Generate MCQ: AI returned JSON but it's not a list/array. Raw: {mcqs_text}. Returning 500.")
             raise ValueError("AI returned JSON but not the expected list format.")

        print(f"DEBUG_ROUTE_052: Generate MCQ: AI response received and parsed (UID: {uid}). Generated {len(questions)} MCQs.")
        return jsonify(questions)

    except json.JSONDecodeError as e:
        print(f"DEBUG_ROUTE_053: Generate MCQ: Error parsing AI response as JSON (UID: {uid}): {e}. Raw response: {mcqs_text}. Returning 500.")
        return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था (JSON parse error)। कृपया विषय बदलकर फिर से प्रयास करें।'}), 500
    except Exception as e:
        print(f"DEBUG_ROUTE_054: Generate MCQ: Error generating content or invalid format (UID: {uid}): {e}. Returning 500.")
        print(f"DEBUG_ROUTE_055: Generate MCQ: Exception details: {e}")
        return jsonify({'error': f'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी: {e}'}), 500


# 4. Solved Examples

@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    print("DEBUG_ROUTE_056: '/get-solved-notes-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1800)
    if not is_authorized:
        print(f"DEBUG_ROUTE_057: Get Solved Notes request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_058: Get Solved Notes: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    count = min(int(data.get('count', 3)), 50)
    if not topic:
        print("DEBUG_ROUTE_059: Get Solved Notes request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया एक विषय प्रदान करें।'}), 400

    prompt = f"ROLE: Expert teacher. TASK: Provide {count} detailed, step-by-step solved problems for: \"{topic}\".\n{FORMATTING_INSTRUCTIONS}"
    try:
        print(f"DEBUG_ROUTE_060: Get Solved Notes: Calling AI model (UID: {uid}). Topic: {topic}, Count: {count}")
        response = model.generate_content(prompt)
        solved_notes = get_response_text(response)
        print(f"DEBUG_ROUTE_061: Get Solved Notes: AI response received (UID: {uid}). Notes length: {len(solved_notes)}")
        return jsonify({'solved_notes': solved_notes})
    except Exception as e:
        print(f"DEBUG_ROUTE_062: Get Solved Notes: Error generating content (UID: {uid}). Topic: {topic}. Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_063: Get Solved Notes: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500


# 5. Career Counselor

@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    print("DEBUG_ROUTE_064: '/get-career-advice-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800)
    if not is_authorized:
        print(f"DEBUG_ROUTE_065: Get Career Advice request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_066: Get Career Advice: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    interests = data.get('interests')
    if not interests:
        print("DEBUG_ROUTE_067: Get Career Advice request missing interests. Returning 400.")
        return jsonify({'error': ' कृपया अपनी रुचियां बताएं!'}), 400

    prompt = f'ROLE: Expert AI Career Counselor. TASK: Based on user interests "{interests}", provide a detailed career roadmap.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG_ROUTE_068: Get Career Advice: Calling AI model (UID: {uid}). Interests: {interests[:100]}...")
        response = model.generate_content(prompt)
        advice = get_response_text(response)
        print(f"DEBUG_ROUTE_069: Get Career Advice: AI response received (UID: {uid}). Advice length: {len(advice)}")
        return jsonify({'advice': advice})
    except Exception as e:
        print(f"DEBUG_ROUTE_070: Get Career Advice: Error generating content (UID: {uid}). Interests: {interests[:100]}.... Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_071: Get Career Advice: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500

# 6. Study Planner

@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    print("DEBUG_ROUTE_072: '/generate-study-plan-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
    if not is_authorized:
        print(f"DEBUG_ROUTE_073: Generate Study Plan request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_074: Generate Study Plan: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    details = data.get('details')
    if not details:
        print("DEBUG_ROUTE_075: Generate Study Plan request missing details. Returning 400.")
        return jsonify({'error': ' कृपया प्लान के लिए विवरण दें!'}), 400

    prompt = f'ROLE: Expert study planner. TASK: Create a 7-day study plan based on: "{details}". Use Hinglish for the plan.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG_ROUTE_076: Generate Study Plan: Calling AI model (UID: {uid}). Details: {details[:100]}...")
        response = model.generate_content(prompt)
        plan = get_response_text(response)
        print(f"DEBUG_ROUTE_077: Generate Study Plan: AI response received (UID: {uid}). Plan length: {len(plan)}")
        return jsonify({'plan': plan})
    except Exception as e:
        print(f"DEBUG_ROUTE_078: Generate Study Plan: Error generating content (UID: {uid}). Details: {details[:100]}.... Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_079: Generate Study Plan: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500

# 7. Flashcards

@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    print("DEBUG_ROUTE_080: '/generate-flashcards-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000)
    if not is_authorized:
        print(f"DEBUG_ROUTE_081: Generate Flashcards request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_082: Generate Flashcards: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    count = min(int(data.get('count', 8)), 50)
    if not topic:
        print("DEBUG_ROUTE_083: Generate Flashcards request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया एक विषय प्रदान करें!'}), 400

    prompt = f'Generate {count} flashcards for "{topic}". The language must match the topic language. Response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. Do not include any surrounding text, explanation, or markdown like ```json`.'

    try:
        print(f"DEBUG_ROUTE_084: Generate Flashcards: Calling AI model (UID: {uid}). Topic: {topic}, Count: {count}. Requesting JSON mime type.")
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        flashcards_text = get_response_text(response)
        # Clean up markdown json block
        flashcards_text = re.sub(r'```json\s*\n*', '', flashcards_text, count=1)
        flashcards_text = re.sub(r'\n*```\s*$', '', flashcards_text, count=1)

        print(f"DEBUG_ROUTE_085: Generate Flashcards: Attempting to parse JSON response:\n{flashcards_text[:500]}...")

        cards = json.loads(flashcards_text)

        if not isinstance(cards, list) or not all(isinstance(item, dict) and 'front' in item and 'back' in item for item in cards):
             print(f"WARNING_ROUTE_004: Generate Flashcards: AI returned JSON but it's not the expected format (list of objects with front/back). Raw: {flashcards_text}. Returning 500.")
             raise ValueError("AI returned JSON but not in expected flashcard format.")


        print(f"DEBUG_ROUTE_086: Generate Flashcards: AI response received and parsed (UID: {uid}). Generated {len(cards)} flashcards.")
        return jsonify(cards)

    except json.JSONDecodeError as e:
        print(f"DEBUG_ROUTE_087: Generate Flashcards: Error parsing AI response as JSON (UID: {uid}): {e}. Raw response: {flashcards_text}. Returning 500.")
        return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था (JSON parse error)। कृपया विषय बदलकर फिर से प्रयास करें।'}), 500
    except Exception as e:
        print(f"DEBUG_ROUTE_088: Generate Flashcards: Error generating content or invalid format (UID: {uid}): {e}. Returning 500.")
        print(f"DEBUG_ROUTE_089: Generate Flashcards: Exception details: {e}")
        return jsonify({'error': f'AI से फ्लैशकार्ड जेनरेट करते वक़्त गड़बड़ हो गयी: {e}'}), 500


# 8. Essay Writer

@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
    print("DEBUG_ROUTE_090: '/write-essay-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1500)
    if not is_authorized:
        print(f"DEBUG_ROUTE_091: Write Essay request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_092: Write Essay: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        print("DEBUG_ROUTE_093: Write Essay request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया निबंध के लिए एक विषय दें!'}), 400

    prompt = f'ROLE: Expert Essay Writer. TASK: Write a well-structured essay on "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG_ROUTE_094: Write Essay: Calling AI model (UID: {uid}). Topic: {topic}")
        response = model.generate_content(prompt)
        essay = get_response_text(response)
        print(f"DEBUG_ROUTE_095: Write Essay: AI response received (UID: {uid}). Essay length: {len(essay)}")
        return jsonify({'essay': essay})
    except Exception as e:
        print(f"DEBUG_ROUTE_096: Write Essay: Error generating content (UID: {uid}). Topic: {topic}. Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_097: Write Essay: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500


# 9. Presentation Maker

@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
    print("DEBUG_ROUTE_098: '/create-presentation-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1200)
    if not is_authorized:
        print(f"DEBUG_ROUTE_099: Create Presentation request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_100: Create Presentation: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        print("DEBUG_ROUTE_101: Create Presentation request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया प्रेजेंटेशन के लिए एक विषय दें!'}), 400

    prompt = f'ROLE: AI Presentation Maker. TASK: Create a presentation outline on "{topic}" with a title slide and 5 content slides. Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG_ROUTE_102: Create Presentation: Calling AI model (UID: {uid}). Topic: {topic}")
        response = model.generate_content(prompt)
        presentation = get_response_text(response)
        print(f"DEBUG_ROUTE_103: Create Presentation: AI response received (UID: {uid}). Presentation length: {len(presentation)}")
        return jsonify({'presentation': presentation})
    except Exception as e:
        print(f"DEBUG_ROUTE_104: Create Presentation: Error generating content (UID: {uid}). Topic: {topic}. Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_105: Create Presentation: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500


# 10. Concept Explainer

@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
    print("DEBUG_ROUTE_106: '/explain-concept-ai' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800)
    if not is_authorized:
        print(f"DEBUG_ROUTE_107: Explain Concept request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_108: Explain Concept: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        print("DEBUG_ROUTE_109: Explain Concept request missing topic. Returning 400.")
        return jsonify({'error': ' कृपया समझाने के लिए एक कॉन्सेप्ट दें!'}), 400

    prompt = f'ROLE: Friendly teacher. TASK: Explain "{topic}" simply, like I am 15 years old. Use Hinglish.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG_ROUTE_110: Explain Concept: Calling AI model (UID: {uid}). Topic: {topic}")
        response = model.generate_content(prompt)
        explanation = get_response_text(response)
        print(f"DEBUG_ROUTE_111: Explain Concept: AI response received (UID: {uid}). Explanation length: {len(explanation)}")
        return jsonify({'explanation': explanation})
    except Exception as e:
        print(f"DEBUG_ROUTE_112: Explain Concept: Error generating content (UID: {uid}). Topic: {topic}. Error: {e}. Returning 500.")
        print(f"DEBUG_ROUTE_113: Explain Concept: Exception details: {e}")
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500


# 11. Quiz Analysis

@app.route('/analyze-quiz-results', methods=['POST'])
def analyze_quiz_results():
    print("DEBUG_ROUTE_114: '/analyze-quiz-results' route called.")
    uid = verify_user()
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=500)
    if not is_authorized:
        print(f"DEBUG_ROUTE_115: Analyze Quiz Results request denied for UID {uid}. Status: {status_code}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code

    if model is None:
        print("DEBUG_ROUTE_116: Analyze Quiz Results: model is None. Returning 503.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें!'}), 503

    data = request.get_json()
    user_answers = data.get('answers')
    if not user_answers or not isinstance(user_answers, list):
        print("DEBUG_ROUTE_117: Analyze Quiz Results request missing or invalid answers list. Returning 400.")
        return jsonify({'error': 'विश्लेषण के लिए कोई जवाब नहीं मिला!'}), 400

    incorrect_answers = [ans for ans in user_answers if not ans.get('isCorrect')]
    if not incorrect_answers:
        print(f"DEBUG_ROUTE_118: Analyze Quiz Results: All answers correct for UID {uid}. Returning success.")
        return jsonify({'analysis': "शानदार प्रदर्शन! आपके सभी जवाब सही थे। अपनी तैयारी जारी रखें।"})

    incorrect_concepts = ", ".join(sorted(list(set([ans.get('conceptTag', 'General') for ans in incorrect_answers]))))
    print(f"DEBUG_ROUTE_119: Analyze Quiz Results: Analyzing incorrect concepts for UID {uid}: {incorrect_concepts}")

    prompt = f"""
ROLE: Expert AI performance analyst.
TASK: Analyze a student's incorrect quiz answers and provide a constructive report in Hinglish.
DATA: Student made mistakes in these concepts: {incorrect_concepts}.
INSTRUCTIONS:
1. Identify weak topics based on the provided concepts.
2. Suggest specific improvements for each identified weak topic.
3. End with an encouraging message.
{FORMATTING_INSTRUCTIONS}
"""

    try:
        print(f"DEBUG_ROUTE_120: Analyze Quiz Results: Calling AI model (UID: {uid}). Concepts: {incorrect_concepts[:100]}...")
        response = model.generate_content(prompt)
        analysis = get_response_text(response)
        print(f"DEBUG_ROUTE_121: Analyze Quiz Results: AI response received (UID: {uid}). Analysis length: {len(analysis)}")
        return jsonify({'analysis': analysis})
    except Exception as e:
        print(f"DEBUG_ROUTE_122: Analyze Quiz Results: Error generating content (UID: {uid}): {e}. Returning 500.")
        print(f"DEBUG_ROUTE_123: Analyze Quiz Results: Exception details: {e}")
        return jsonify({'error': 'AI से विश्लेषण जेनरेट करने में गड़बड़ हो गयी!'}), 500


# --- SECTION 5: Main Execution Block ---
# ✅✅✅ Main Execution Block (AI Code से, Render Deployment के लिए उपयुक्त) ✅✅✅
# NOTE: यह ब्लॉक आपके Main App के किसी भी मौजूदा execution block को बदल देगा।
if __name__ == '__main__':
    print("DEBUG_APP_START_001: Starting Flask app...")
    # Render deploys by looking for a callable 'app'. gunicorn main:app uses this.
    # The host and port settings are standard for Render/Heroku-like platforms.
    # Debug is set to False for production.
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=False)

print("DEBUG_MAIN_INIT_039: main.py script execution finished.")
