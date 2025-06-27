# -- coding: utf-8 --
"""
Conceptra AI - मुख्य सर्वर फ़ाइल (app.py)

इस फ़ाइल में Flask सर्वर का पूरा लॉजिक है, जो AI मॉडल से इंटरैक्ट करता है,
यूजर को मैनेज करता है, और पेमेंट को हैंडल करता है।
"""

# ✅✅✅ नया DEBUG print ✅✅✅
print("DEBUG: main.py script execution started.")


# --- SECTION 1: ज़रूरी लाइब्रेरी को इम्पोर्ट करना ---

import os
import json # JSON data parse karne ke liye agar key.json ka content env var mein ho (halanki ab file se padhenge)
import re
from pathlib import Path
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, Response
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore, auth # Admin Auth SDK ke liye auth import kiya
from flask_cors import CORS
import razorpay
import time # Razorpay रसीद के लिए

# --- आपके मूल कोड को सपोर्ट करने के लिए ये वैरिएबल बनाये गए हैं ---
# (यह आपके original code structure को preserve करने के लिए है)
# Render पर 'file' variable की वैल्यू आपके main.py की location होती है।
# Path(file).resolve().parent आपके प्रोजेक्ट के root directory तक पहुँचने में मदद करता है।
name = __name__
file = __file__
project_root = Path(file).resolve().parent
# -----------------------------------------------------------------

# ✅✅✅ नया बदलाव: मालिक की पहचान के लिए ईमेल ✅✅✅
ADMIN_EMAIL = "himanshu@conceptra.ai"

# --- SECTION 2: बाहरी सेवाओं (External Services) को शुरू करना ---

# --- Firebase Admin SDK Initialization ---
# यह सर्वर को आपके Firestore डेटाबेस से सुरक्षित रूप से कनेक्ट करने की अनुमति देता है।

# ✅✅✅ बदला हुआ हिस्सा: Environment Variable के बजाय Secret File 'key.json' से पढ़ रहा है ✅✅✅
try:
    print("DEBUG: Attempting to initialize Firebase Admin SDK from key.json Secret File.")
    # यह Secret File 'key.json' को Render deployment की root directory में ढूंढेगा।
    key_path = project_root / 'key.json'
    print(f"DEBUG: Looking for key.json at path: {key_path}")


    if not key_path.exists():
         raise FileNotFoundError(f"Firebase key file not found at expected path: {key_path}")

    print(f"DEBUG: Found key.json at {key_path}. Attempting to initialize...")
    # Credential ऑब्जेक्ट बनाएं JSON data का उपयोग करके
    # credentials.Certificate सीधे file path ले सकता है
    cred = credentials.Certificate(key_path)

    # Firebase Admin SDK को initialize करें
    # Agar app pehle se initialize hai (Render hot-reloads mein ho sakta hai), skip karein
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        print("DEBUG: firebase_admin.initialize_app called.")
    else:
        print("DEBUG: firebase_admin already initialized. Skipping initialize_app call.")


    # Firestore और Auth clients को प्राप्त करें
    db = firestore.client()
    auth_admin = firebase_admin.auth # <-- Admin Auth SDK प्राप्त करें verification के लिए

    print("SUCCESS: Firebase Admin SDK सफलतापूर्वक Secret File 'key.json' से शुरू हो गया है। db and auth_admin are available.")

except FileNotFoundError as e:
    print(f"FATAL ERROR: Firebase Admin SDK शुरू नहीं हो सका। 'key.json' फाइल नहीं मिली। कृपया सुनिश्चित करें कि यह Secret File के रूप में सही तरह से ऐड किया गया है। एरर: {e}")
    db = None # Ensure db is None if initialization fails
    auth_admin = None # Ensure auth_admin is None if initialization fails
except Exception as e:
    print(f"FATAL ERROR: Firebase Admin SDK शुरू नहीं हो सका। 'key.json' फाइल में कुछ और समस्या है या क्रेडेंशियल अमान्य हैं। एरर: {e}")
    db = None # Ensure db is None if initialization fails
    auth_admin = None # Ensure auth_admin is None if initialization fails


# --- Flask App Initialization ---

app = Flask(name)
print("DEBUG: Flask app initialized.")

# CORS (Cross-Origin Resource Sharing) को सक्षम करना ताकि आपका वेबपेज सर्वर से बात कर सके।
CORS(app)
print("DEBUG: CORS initialized.")

# --- Razorpay Client Initialization ---
# यह आपके पेमेंट गेटवे को शुरू करता है।

# ✅✅✅ बदला हुआ हिस्सा: Environment Variables के बजाय Secret Files से पढ़ रहा है ✅✅✅
try:
    print("DEBUG: Attempting to initialize Razorpay Client from Secret Files.")
    # यह Razorpay कीज़ को Secret Files से पढ़ेगा।
    # सुनिश्चित करें कि आपने Render Secrets में RAZORPAY_KEY_ID और RAZORPAY_KEY_SECRET को Secret Files के रूप में ऐड किया है।
    # Render उन्हें फाइल के रूप में उपलब्ध कराएगा।
    razorpay_key_id_path = project_root / 'RAZORPAY_KEY_ID'
    razorpay_key_secret_path = project_root / 'RAZORPAY_KEY_SECRET'
    print(f"DEBUG: Looking for Razorpay Key ID at path: {razorpay_key_id_path}")
    print(f"DEBUG: Looking for Razorpay Key Secret at path: {razorpay_key_secret_path}")


    if not razorpay_key_id_path.exists():
         raise FileNotFoundError(f"Razorpay Key ID file not found at expected path: {razorpay_key_id_path}")
    if not razorpay_key_secret_path.exists():
         raise FileNotFoundError(f"Razorpay Key Secret file not found at expected path: {razorpay_key_secret_path}")


    with open(razorpay_key_id_path, 'r') as f:
        razorpay_key_id = f.read().strip()
    with open(razorpay_key_secret_path, 'r') as f:
        razorpay_key_secret = f.read().strip()

    if not razorpay_key_id:
        raise ValueError(f"Razorpay Key ID file is empty or could not be read.")
    if not razorpay_key_secret:
        raise ValueError(f"Razorpay Key Secret file is empty or could not be read.")

    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    print("SUCCESS: Razorpay Client सफलतापूर्वक Secret Files से शुरू हो गया है।")

except FileNotFoundError as e:
    print(f"FATAL ERROR: Razorpay Client शुरू नहीं हो सका। आवश्यक Secret File नहीं मिली। एरर: {e}")
    razorpay_client = None
except ValueError as e:
    print(f"FATAL ERROR: Razorpay Client शुरू नहीं हो सका। Secret File खाली है या पढ़ने में समस्या। एरर: {e}")
    razorpay_client = None
except Exception as e:
    print(f"FATAL ERROR: Razorpay Client शुरू नहीं हो सका। कुछ और समस्या। एरर: {e}")
    razorpay_client = None


# --- Google Gemini AI Model Configuration ---
# ✅✅✅ यह हिस्सा environment variable se padh raha tha, aur Render setup ke anusaar ab bhi padhega, koi badlav nahi ✅✅✅
try:
    print("DEBUG: Attempting to configure Google Gemini AI model from Environment Variable.")
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

# --- SECTION 3: हेल्per फंक्शन्स (Helper Functions) ---
# ये छोटे फंक्शन हैं जो बार-बार इस्तेमाल होते हैं।

# ✅✅✅ यह फंक्शन पहले से सही था, कोई बदलाव नहीं ✅✅✅
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
        print(f"DEBUG: AI के जवाब से टेक्स्ट निकालते समय एरर: {e}")
        return "माफ कीजिये, AI से जवाब नहीं मिल सका।"

# ✅✅✅ manage_tokens अब db None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
def manage_tokens(uid, cost_in_tokens=1500):
    """यूजर के टोकन बैलेंस को चेक और अपडेट करता है।"""
    print(f"DEBUG: manage_tokens called for UID: {uid}, cost: {cost_in_tokens}")
    # Ensure db is initialized before using it
    if db is None: # <-- Check for None
        print("DEBUG: manage_tokens: db is None. Firestore not initialized. Check server logs.")
        return False, {"error": "डेटाबेस कनेक्शन उपलब्ध नहीं है। कृपया सर्वर लॉग जांचें।"} # Added more context


    user_ref = db.collection('users').document(uid)
    try:
        print(f"DEBUG: manage_tokens: Getting user doc for UID {uid}")
        user_doc = user_ref.get()
        if not user_doc.exists:
            print(f"DEBUG: manage_tokens: User doc not found for UID {uid}.")
            return False, {"error": "यूजर प्रोफाइल डेटाबेस में नहीं मिला। कृपया दोबारा लॉगिन करें।"} # Added more context

        current_balance = user_doc.to_dict().get('tokens_balance', 0)
        print(f"DEBUG: manage_tokens: Current token balance for UID {uid} is {current_balance}.")
        if current_balance < cost_in_tokens:
            print(f"DEBUG: manage_tokens: Insufficient tokens ({current_balance}) for UID {uid}. Need {cost_in_tokens}.")
            return False, {"error": f"आपके टोकन ({current_balance}) कम हैं। इस काम के लिए {cost_in_tokens} टोकन चाहिए। कृपया रिचार्ज करें।"}

        # टोकन बैलेंस घटाएं (यह एक एटॉमिक ऑपरेशन है)
        user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
        print(f"DEBUG: manage_tokens: Tokens deducted: {cost_in_tokens} for UID {uid}. New balance should be {current_balance - cost_in_tokens}.")
        return True, None
    except Exception as e:
        print(f"DEBUG: manage_tokens: एरर टोकन घटाते समय (UID: {uid}): {e}")
        return False, {"error": "टोकन काटने में विफल। कृपया फिर से प्रयास करें।"}

# ✅✅✅ verify_user अब auth_admin None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
def verify_user():
    """रिक्वेस्ट हेडर से Firebase ID Token को वेरिफाई करता है।"""
    print("DEBUG: verify_user called.")
    # Ensure auth_admin is initialized before using it
    if auth_admin is None: # <-- Check for None
        print("DEBUG: verify_user: auth_admin is None. Admin Auth SDK not initialized. Cannot verify token. Check server logs.")
        # This indicates a FATAL server error during initialization.
        # Frontend should ideally handle 503 or similar error if check_user_privileges returns it.
        return None # Cannot verify if Admin Auth SDK is not initialized


    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("DEBUG: verify_user: No or invalid Authorization header.")
        return None # Indicates not logged in or invalid request format

    id_token = auth_header.split('Bearer ')[1]
    # print(f"DEBUG: verify_user: Received token: {id_token[:10]}...") # Avoid logging full token
    try:
        print("DEBUG: verify_user: Attempting to verify token using auth_admin...")
        # Token verification ke liye Admin Auth SDK ka upyog karen
        decoded_token = auth_admin.verify_id_token(id_token)
        print(f"DEBUG: verify_user: Token successfully verified for UID: {decoded_token.get('uid')}")
        return decoded_token.get('uid') # Use .get() for safety
    except Exception as e:
        # This catches invalid/expired tokens etc.
        print(f"DEBUG: verify_user: Auth Token वेरिफिकेशन में विफल: {e}")
        return None # Indicates invalid/expired token

# ✅✅✅ यह फंक्शन पहले से सही था, कोई बदलाव नहीं ✅✅✅
def check_user_privileges(uid, cost_in_tokens):
    """
    यह फंक्शन पहले यूजर की पहचान करता है।
    - अगर यूजर लॉग-इन नहीं है (uid is None), तो एरर देता है।
    - अगर यूजर 'मालिक' (Admin) है, तो उसे अनुमति देता है और टोकन नहीं काटता।
    - अगर यूजर सामान्य है, तो उसके टोकen चेक करता है और काटता है।
    """
    print(f"DEBUG: check_user_privileges called with UID: {uid}, cost: {cost_in_tokens}.")

    # verify_user (जो verify_user से आता है) None hone par authentication failed.
    if uid is None:
        # This handles cases where verify_user returned None due to missing header or failed verification.
        print("DEBUG: check_user_privileges: UID is None. Authentication Failed.")
        return False, jsonify({'error': 'प्रमाणीकरण विफल। कृपया दोबारा लॉगिन करें।'}), 401 # Unauthorized

    # Agar auth_admin initialize nahi hua, toh Admin check bhi nahi ho payega.
    # Is case mein, verify_user already None return kar chuka hoga aur upar wala if block chal jayega.
    # Agar uid is NOT None, it implies auth_admin successfully verified the token.
    # We can proceed assuming auth_admin is available if uid is not None.

    try:
        print(f"DEBUG: check_user_privileges: Attempting to fetch user record for UID {uid} for Admin check.")
        # Firebase से यूजर की पूरी जानकारी (ईमेल समेत) निकालते हैं
        # Use auth_admin, not auth (frontend SDK auth object)
        user_record = auth_admin.get_user(uid) # <-- Use auth_admin
        print(f"DEBUG: check_user_privileges: User record fetched. Email: {user_record.email}")
        # अगर यूजर का ईमेल, मालिक के ईमेल से मिलता है, तो उसे आगे बढ़ने दें
        if user_record.email == ADMIN_EMAIL:
            print(f"ADMIN ACCESS: User {user_record.email} (UID: {uid}) is bypassing token check.")
            return True, None, None # अनुमति है, कोई एरर नहीं
    except Exception as e:
        # अगर यूजर की जानकारी निकालने में कोई एरर आए (e.g., user deleted after token issued),
        # तो उसे सामान्य यूजर मानें और टोकन चेक करें।
        print(f"DEBUG: check_user_privileges: Error fetching user record for UID {uid} (Admin check failed): {e}. Proceeding to token check.")
        # Continue to token check below as this might just be a user record fetch issue, not a token issue.


    # अगर यूजर मालिक नहीं है (या एडमिन चेक फेल हुआ), तो उसके टोकन की जाँच करें
    # manage_tokens already checks if db is None
    print(f"DEBUG: check_user_privileges: User {uid} is not admin or admin check failed. Proceeding to manage_tokens check.")
    is_ok, error_response = manage_tokens(uid, cost_in_tokens)
    if not is_ok:
        # manage_tokens returned False because of low tokens or db error
        print(f"DEBUG: check_user_privileges: Token management failed for UID {uid}. Reason: {error_response.get('error')}")
        return False, jsonify(error_response), 402 # अनुमति नहीं है (Insufficient Tokens or DB Error)

    # अगर सामान्य यूजर के पास टोकन हैं, तो उसे भी अनुमति है
    print(f"DEBUG: check_user_privileges: User {uid} authorized. Token cost: {cost_in_tokens}.")
    return True, None, None

# --- सभी AI Prompts के लिए कॉमन फॉर्मेटिंग निर्देश ---
# ✅✅✅ यह हिस्सा पहले से सही था, कोई बदलाव नहीं ✅✅✅
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

@app.route('/')
def home():
    """मुख्य पेज (index.html) को रेंडर करता है।"""
    print("DEBUG: '/' route called. Rendering index.html")
    # Render index.html from the templates folder
    return render_template('index.html')

# --- Payment Routes ---
# इनमें कोई बदलाव नहीं है क्योंकि ये पहले से सही काम कर रहे थे।

# ✅✅✅ create_order Razorpay client None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/create-order', methods=['POST'])
def create_order():
    print("DEBUG: '/create-order' route called.")
    # Ensure razorpay_client is initialized before using it
    if razorpay_client is None: # <-- Check for None
        print("DEBUG: create_order: razorpay_client is None. Razorpay not initialized. Check server logs.")
        return jsonify({"error": "पेमेंट सेवा अभी उपलब्ध नहीं है। कृपया सर्वर लॉग जांचें।"}), 503 # Service Unavailable


    # ✅✅✅ यूजर प्रमाणीकरण आवश्यक है ✅✅✅
    # यह सुनिश्चित करता है कि केवल लॉग-इन उपयोगकर्ता ही ऑर्डर बना सकें
    uid = verify_user() # <-- verify_user अब auth_admin का उपयोग करेगा
    if not uid:
         print("DEBUG: create_order request failed: User not authenticated (UID is None).")
         return jsonify({'error': 'प्रमाणीकरण विफल। कृपया दोबारा लॉगिन करें।'}), 401 # Unauthorized


    data = request.get_json()
    amount = data.get('amount') # Amount should come in Rupees from frontend
    uid_from_body = data.get('uid') # Get UID from request body as well

    if not amount or not uid_from_body:
        print("DEBUG: create_order request missing amount or uid in body.")
        return jsonify({"error": "राशि और यूजर आईडी आवश्यक हैं।"}), 400 # Bad Request

    # Optional safety check: ensure UID from body matches verified UID
    if uid != uid_from_body:
         print(f"WARNING: UID mismatch in create_order. Token UID: {uid}, Body UID: {uid_from_body}. Rejecting request.")
         return jsonify({'error': 'सुरक्षा त्रुटि: यूजर आईडी मेल नहीं खा रही है।'}), 401 # Security check failed


    order_data = {
        "amount": int(amount) * 100,  # राशि पैसे में (Frontend se Rupees mein aayegi, backend Razorpay ko Paise mein bhejega)
        "currency": "INR",
        "receipt": f"receipt_{uid}_{int(time.time())}", # Unique receipt ID
        "notes": {"firebase_uid": uid} # Attach user ID to the order for webhook
    }
    try:
        print(f"DEBUG: create_order: Calling Razorpay Client to create order for UID: {uid}")
        order = razorpay_client.order.create(data=order_data)
        print(f"SUCCESS: Razorpay ऑर्डर बनाया गया: {order.get('id')} for UID: {uid}")
        # Return order ID and amount (in paise as required by Razorpay frontend SDK)
        return jsonify({"order_id": order.get('id'), "amount": order.get('amount')})
    except Exception as e:
        print(f"DEBUG: create_order: Razorpay ऑर्डर बनाने में एरर for UID {uid}: {e}")
        return jsonify({"error": "पेमेंट ऑर्डर बनाने में विफल। कृपया फिर से प्रयास करें।"}), 500 # Internal Server Error


# ✅✅✅ razorpay_webhook Razorpay client या db None hone par gracefully handle karega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/razorpay-webhook', methods=['POST'])
def razorpay_webhook():
    print("DEBUG: '/razorpay-webhook' route called.")
    # Environment Variable से webhook secret पढ़ें
    webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET')
    if not webhook_secret:
        print("FATAL: RAZORPAY_WEBHOOK_SECRET एनवायरनमेंट में सेट नहीं है। Webhook verification skip kiya ja raha hai.")
        # In production, you MUST NOT proceed if webhook_secret is not set.
        # For debugging, you might temporarily remove the verify_webhook_signature call,
        # but it's a major security risk. Better to fix the environment variable.
        # Returning 500 indicates a server-side configuration error to Razorpay.
        return 'Server configuration error (Webhook secret missing)', 500


    # Ensure razorpay_client is initialized to verify signature
    if razorpay_client is None:
        print("FATAL: razorpay_client is None. Cannot verify webhook signature. Check server logs.")
        # Cannot verify signature, so cannot trust payload.
        # Returning 500 indicates server issu
