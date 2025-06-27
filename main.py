# -- coding: utf-8 --
"""
Conceptra AI - मुख्य सर्वर फ़ाइल (app.py)

इस फ़ाइल में Flask सर्वर का पूरा लॉजिक है, जो AI मॉडल से इंटरैक्ट करता है,
यूजर को मैनेज करता है, और पेमेंट को हैंडल करता है।
"""

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
    # यह Secret File 'key.json' को Render deployment की root directory में ढूंढेगा।
    key_path = project_root / 'key.json'

    if not key_path.exists():
         raise FileNotFoundError(f"Firebase key file not found at expected path: {key_path}")

    # Credential ऑब्जेक्ट बनाएं JSON data का उपयोग करके
    # credentials.Certificate सीधे file path ले सकता है
    cred = credentials.Certificate(key_path)

    # Firebase Admin SDK को initialize करें
    # Agar app pehle se initialize hai (Render hot-reloads mein ho sakta hai), skip karein
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)

    # Firestore और Auth clients को प्राप्त करें
    db = firestore.client()
    auth_admin = firebase_admin.auth # <-- Admin Auth SDK प्राप्त करें verification के लिए

    print("SUCCESS: Firebase Admin SDK सफलतापूर्वक Secret File 'key.json' से शुरू हो गया है।")

except FileNotFoundError as e:
    print(f"FATAL ERROR: Firebase Admin SDK शुरू नहीं हो सका। 'key.json' फाइल नहीं मिली। कृपया सुनिश्चित करें कि यह Secret File के रूप में सही तरह से ऐड किया गया है। एरर: {e}")
    db = None # Ensure db is None if initialization fails
    auth_admin = None # Ensure auth_admin is None if initialization fails
except Exception as e:
    print(f"FATAL ERROR: Firebase Admin SDK शुरू नहीं हो सका। 'key.json' फाइल में कुछ और समस्या है। एरर: {e}")
    db = None # Ensure db is None if initialization fails
    auth_admin = None # Ensure auth_admin is None if initialization fails


# --- Flask App Initialization ---

app = Flask(name)

# CORS (Cross-Origin Resource Sharing) को सक्षम करना ताकि आपका वेबपेज सर्वर से बात कर सके।
CORS(app)

# --- Razorpay Client Initialization ---
# यह आपके पेमेंट गेटवे को शुरू करता है।

# ✅✅✅ बदला हुआ हिस्सा: Environment Variables के बजाय Secret Files से पढ़ रहा है ✅✅✅
try:
    # यह Razorpay कीज़ को Secret Files से पढ़ेगा।
    # सुनिश्चित करें कि आपने Render Secrets में RAZORPAY_KEY_ID और RAZORPAY_KEY_SECRET को Secret Files के रूप में ऐड किया है।
    # Render उन्हें फाइल के रूप में उपलब्ध कराएगा।
    razorpay_key_id_path = project_root / 'RAZORPAY_KEY_ID'
    razorpay_key_secret_path = project_root / 'RAZORPAY_KEY_SECRET'

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
        print(f"AI के जवाब से टेक्स्ट निकालते समय एरर: {e}")
        return "माफ कीजिये, AI से जवाब नहीं मिल सका।"

# ✅✅✅ manage_tokens अब db None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
def manage_tokens(uid, cost_in_tokens=1500):
    """यूजर के टोकन बैलेंस को चेक और अपडेट करता है।"""
    # Ensure db is initialized before using it
    if db is None: # <-- Check for None
        print("DEBUG: manage_tokens called but db is None (Firestore not initialized).")
        return False, {"error": "डेटाबेस कनेक्शन उपलब्ध नहीं है। कृपया सर्वर लॉग जांचें।"} # Added more context


    user_ref = db.collection('users').document(uid)
    try:
        user_doc = user_ref.get()
        if not user_doc.exists:
            return False, {"error": "यूजर प्रोफाइल डेटाबेस में नहीं मिला। कृपया दोबारा लॉगिन करें।"} # Added more context

        current_balance = user_doc.to_dict().get('tokens_balance', 0)
        if current_balance < cost_in_tokens:
            return False, {"error": f"आपके टोकन ({current_balance}) कम हैं। इस काम के लिए {cost_in_tokens} टोकन चाहिए। कृपया रिचार्ज करें।"}

        # टोकन बैलेंस घटाएं (यह एक एटॉमिक ऑपरेशन है)
        user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
        print(f"DEBUG: Tokens deducted: {cost_in_tokens} for UID {uid}. New balance should be {current_balance - cost_in_tokens}")
        return True, None
    except Exception as e:
        print(f"DEBUG: टोकन घटाते समय एरर (UID: {uid}): {e}")
        return False, {"error": "टोकन काटने में विफल। कृपया फिर से प्रयास करें।"}

# ✅✅✅ verify_user अब auth_admin None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
def verify_user():
    """रिक्वेस्ट हेडर से Firebase ID Token को वेरिफाई करता है।"""
    # Ensure auth_admin is initialized before using it
    if auth_admin is None: # <-- Check for None
        print("DEBUG: verify_user called but auth_admin is None (Admin Auth SDK not initialized).")
        # This indicates a FATAL server error during initialization.
        # Frontend should ideally handle 503 or similar error if check_user_privileges returns it.
        return None # Cannot verify if Admin Auth SDK is not initialized


    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        # print("DEBUG: No or invalid Authorization header.")
        return None # Indicates not logged in or invalid request format

    id_token = auth_header.split('Bearer ')[1]
    try:
        # Token verification ke liye Admin Auth SDK ka upyog karen
        decoded_token = auth_admin.verify_id_token(id_token)
        # print(f"DEBUG: Token verified for UID: {decoded_token['uid']}")
        return decoded_token['uid']
    except Exception as e:
        # This catches invalid/expired tokens etc.
        print(f"DEBUG: Auth Token वेरिफिकेशन में विफल: {e}")
        return None # Indicates invalid/expired token

# ✅✅✅ यह फंक्शन पहले से सही था, कोई बदलाव नहीं ✅✅✅
def check_user_privileges(uid, cost_in_tokens):
    """
    यह फंक्शन पहले यूजर की पहचान करता है।
    - अगर यूजर लॉग-इन नहीं है (uid is None), तो एरर देता है।
    - अगर यूजर 'मालिक' (Admin) है, तो उसे अनुमति देता है और टोकन नहीं काटता।
    - अगर यूजर सामान्य है, तो उसके टोकन चेक करता है और काटता है।
    """
    # verify_user (जो verify_user से आता है) None hone par authentication failed.
    if uid is None:
        # This handles cases where verify_user returned None due to missing header or failed verification.
        print("DEBUG: check_user_privileges received None UID. Authentication Failed.")
        return False, jsonify({'error': 'प्रमाणीकरण विफल। कृपया दोबारा लॉगिन करें।'}), 401

    # Agar auth_admin initialize nahi hua, toh Admin check bhi nahi ho payega.
    # Is case mein, verify_user already None return kar chuka hoga aur upar wala if block chal jayega.
    # Lekin ek extra safety check yahaan bhi add kar sakte hain agar verify_user ne UID return kiya
    # lekin Admin SDK initialization mein partial error hua. (This is less likely but safe).
    # For simplicity, rely on uid is None check covering the case where verify_user returns None.
    # If uid is NOT None, it implies auth_admin successfully verified the token.

    try:
        # Firebase से यूजर की पूरी जानकारी (ईमेल समेत) निकालते हैं
        # Use auth_admin, not auth (frontend SDK auth object)
        user_record = auth_admin.get_user(uid) # <-- Use auth_admin
        # अगर यूजर का ईमेल, मालिक के ईमेल से मिलता है, तो उसे आगे बढ़ने दें
        if user_record.email == ADMIN_EMAIL:
            print(f"ADMIN ACCESS: User {user_record.email} is bypassing token check.")
            return True, None, None # अनुमति है, कोई एरर नहीं
    except Exception as e:
        # अगर यूजर की जानकारी निकालने में कोई एरर आए (e.g., user deleted after token issued),
        # तो उसे सामान्य यूजर मानें या error दें।
        # For now, treat as regular user check failing.
        print(f"DEBUG: Admin check failed for UID {uid}. Treating as regular user for token check. Error: {e}")

    # अगर यूजर मालिक नहीं है, तो उसके टोकन की जाँच करें
    # manage_tokens already checks if db is None
    is_ok, error_response = manage_tokens(uid, cost_in_tokens)
    if not is_ok:
        # manage_tokens returned False because of low tokens or db error
        print(f"DEBUG: Token management failed for UID {uid}. Reason: {error_response.get('error')}")
        return False, jsonify(error_response), 402 # अनुमति नहीं है (Insufficient Tokens or DB Error)

    # अगर सामान्य यूजर के पास टोकन हैं, तो उसे भी अनुमति है
    print(f"DEBUG: User {uid} authorized. Token cost: {cost_in_tokens} deducted.")
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
    # Render index.html from the templates folder
    return render_template('index.html')

# --- Payment Routes ---
# इनमें कोई बदलाव नहीं है क्योंकि ये पहले से सही काम कर रहे थे।

# ✅✅✅ create_order Razorpay client None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/create-order', methods=['POST'])
def create_order():
    # Ensure razorpay_client is initialized before using it
    if razorpay_client is None: # <-- Check for None
        print("DEBUG: create_order called but razorpay_client is None (Razorpay not initialized). Check server logs.")
        return jsonify({"error": "पेमेंट सेवा अभी उपलब्ध नहीं है। कृपया सर्वर लॉग जांचें।"}), 503 # Service Unavailable


    # ✅✅✅ यूजर प्रमाणीकरण आवश्यक है ✅✅✅
    # यह सुनिश्चित करता है कि केवल लॉग-इन उपयोगकर्ता ही ऑर्डर बना सकें
    uid = verify_user() # <-- verify_user अब auth_admin का उपयोग करेगा
    if not uid:
         print("DEBUG: create_order request failed: User not authenticated.")
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
        order = razorpay_client.order.create(data=order_data)
        print(f"SUCCESS: Razorpay ऑर्डर बनाया गया: {order.get('id')} for UID: {uid}")
        # Return order ID and amount (in paise as required by Razorpay frontend SDK)
        return jsonify({"order_id": order.get('id'), "amount": order.get('amount')})
    except Exception as e:
        print(f"DEBUG: Razorpay ऑर्डर बनाने में एरर for UID {uid}: {e}")
        return jsonify({"error": "पेमेंट ऑर्डर बनाने में विफल। कृपया फिर से प्रयास करें।"}), 500 # Internal Server Error


# ✅✅✅ razorpay_webhook Razorpay client या db None hone par gracefully handle karega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/razorpay-webhook', methods=['POST'])
def razorpay_webhook():
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
        print("FATAL: razorpay_client is None. Cannot verify webhook signature.")
        # Cannot verify signature, so cannot trust payload.
        # Returning 500 indicates server issue. Razorpay will retry.
        return 'Server unavailable for signature verification', 500


    # Webhook सिग्नेचर वेरिफाई करें
    try:
        razorpay_client.utility.verify_webhook_signature(
            request.get_data(),
            request.headers.get('X-Razorpay-Signature'),
            webhook_secret
        )
        print("DEBUG: Webhook signature verified successfully.")
    except Exception as e:
        print(f"DEBUG: Webhook सिग्नेचर वेरिफिकेशन में विफल: {e}")
        # Signature mismatch implies the request is not from Razorpay or has been tampered with.
        # Returning 400 is appropriate.
        return 'Invalid signature', 400


    payload = request.get_json()
    event = payload.get('event')
    print(f"DEBUG: Webhook payload received. Event: {event}")

    # Process only 'payment.captured' event
    if event == 'payment.captured':
        # Ensure db is initialized to update user tokens
        if db is None: # <-- Check for None
            print("FATAL: db is None. Cannot update user tokens after payment capture. Check server logs.")
            # Cannot fulfill the core purpose of the webhook.
            # Returning 500 will ask Razorpay to retry later.
            return 'Database unavailable for token update', 500

        payment_info = payload.get('payload', {}).get('payment', {}).get('entity', {})
        uid = payment_info.get('notes', {}).get('firebase_uid')
        amount_paid = payment_info.get('amount') # यह पैसे में है (e.g., 10000 for ₹100)
        payment_id = payment_info.get('id')
        order_id = payment_info.get('order_id')


        if uid is None or amount_paid is None:
             print(f"WARNING: Webhook payload missing uid ({uid}) or amount ({amount_paid}). Payment ID: {payment_id}")
             return 'Missing required data in payload', 400 # Malformed payload


        tokens_to_add = 0
        # Note: Amount comes in paise from Razorpay webhook
        if amount_paid == 10000:    # ₹100 plan (100 * 100 paise)
            tokens_to_add = 50000
        elif amount_paid == 45000:  # ₹450 plan (450 * 100 paise)
            tokens_to_add = 250000
        # Add other plans based on amount_paid in paise

        if tokens_to_add > 0:
            try:
                user_ref = db.collection('users').document(uid)
                # Use firestore.FieldValue.increment for safe atomic updates
                user_ref.update({"tokens_balance": firestore.FieldValue.increment(tokens_to_add)})
                print(f"SUCCESS: यूजर {uid} को {tokens_to_add} टोकन जोड़े गए। Payment ID: {payment_id}, Order ID: {order_id}")
            except Exception as e:
                print(f"DEBUG: Firestore अपडेट एरर (Webhook) for UID {uid}, Payment ID {payment_id}: {e}")
                 # Failed to update user tokens. Return 500 to request retry from Razorpay.
                return f'Failed to update tokens for user {uid}', 500
        else:
             print(f"DEBUG: No tokens defined for received amount_paid {amount_paid} for UID {uid}. Payment ID: {payment_id}")
             # Payment captured, but amount doesn't match known plans.
             # Acknowledge OK (200) as payment was captured, but log a warning.
             return 'OK (Amount does not match known plans)', 200


    elif event.startswith('payment.failed'):
        # Log failed payments
        payment_info = payload.get('payload', {}).get('payment', {}).get('entity', {})
        print(f"DEBUG: Webhook: Payment Failed. ID: {payment_info.get('id')}, Order: {payment_info.get('order_id')}, Status: {payment_info.get('status')}, Error: {payment_info.get('error_description')}")
        return 'OK (Failed payment logged)', 200 # Acknowledge failed payments


    # Acknowledge OK for other events we don't process explicitly
    return 'OK', 200


# --- Feature Routes ---
# 1. Ask a Doubt

# ✅✅✅ ask_ai_image check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    # check_user_privileges already handles verify_user internally if uid is passed None
    # But we call verify_user first to potentially get UID for logging/admin check before token cost.
    uid = verify_user() # Call verify_user first to get UID if possible
    # check_user_privileges checks if UID is None OR if user doesn't have tokens/DB issue
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2500)
    if not is_authorized:
        print(f"DEBUG: Ask AI Image request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Ask AI Image called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    question_text = request.form.get('question', '')
    image_file = request.files.get('image')
    if not question_text and not image_file:
        print("DEBUG: Ask AI Image request missing question or image.")
        # Note: Tokens were already deducted by check_user_privileges if authorized.
        # Need to implement token refund if request data is invalid *after* authorization.
        # For now, token is deducted, but invalid input is reported.
        return jsonify({'error': 'कृपया कोई सवाल लिखें या इमेज अपलोड करें।'}), 400 # Bad Request


    prompt_parts = [f"ROLE: Expert tutor. TASK: Solve this student's doubt step-by-step. LANGUAGE: Same as user's query.\n{FORMATTING_INSTRUCTIONS}"]
    if image_file:
        try:
            img = Image.open(image_file)
            prompt_parts.append(img)
            print("DEBUG: Image file successfully opened.")
        except Exception as e:
            print(f"DEBUG: Error opening image file: {e}")
            # Token refund logic needed here if cost was already deducted
            return jsonify({'error': f'इमेज फाइल को प्रोसेस करने में गड़बड़ हो गयी: {e}'}), 400 # Bad Request


    if question_text:
        prompt_parts.append(f"\nUser's Question: {question_text}")
        print(f"DEBUG: User Question: {question_text[:100]}...") # Log first 100 chars

    try:
        print(f"DEBUG: Calling AI model for Ask AI Image (UID: {uid}). Prompt parts count: {len(prompt_parts)}")
        response = model.generate_content(prompt_parts)
        answer = get_response_text(response)
        print(f"DEBUG: AI response received for Ask AI Image (UID: {uid}). Answer length: {len(answer)}")
        return jsonify({'answer': answer}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Ask AI Image (UID: {uid}): {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction and before response.
        # For now, token is deducted, but AI failure is reported.
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500 # Internal Server Error


# 2. Generate Notes

# ✅✅✅ generate_notes check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=2000) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Generate Notes request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Generate Notes called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    note_type = data.get('noteType', 'long')
    if not topic:
        print("DEBUG: Generate Notes request missing topic.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया एक विषय प्रदान करें।'}), 400 # Bad Request


    if note_type == 'short':
        prompt = f'ROLE: Expert teacher. TASK: Generate a brief summary and key bullet points for "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    else: # default is 'long'
        prompt = f'ROLE: Expert teacher. TASK: Generate comprehensive, well-structured notes on "{topic}".\n{FORMATTING_INSTRUCTIONS}'

    try:
        print(f"DEBUG: Calling AI model for Generate Notes (UID: {uid}). Topic: {topic}, Type: {note_type}")
        response = model.generate_content(prompt)
        notes = get_response_text(response)
        print(f"DEBUG: AI response received for Generate Notes (UID: {uid}). Notes length: {len(notes)}")
        return jsonify({'notes': notes}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Generate Notes (UID: {uid}). Topic: {topic}. Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500 # Internal Server Error


# 3. Practice MCQs

# ✅✅✅ generate_mcq check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Generate MCQ request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Generate MCQ called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    count = min(int(data.get('count', 5)), 50) # Limit count to 50
    if not topic:
        print("DEBUG: Generate MCQ request missing topic.")
         # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया एक विषय प्रदान करें।'}), 400 # Bad Request

    # Prompt specifically asks for JSON
    prompt = f'Generate {count} MCQs on "{topic}". The language of questions and options must match the topic language. Difficulty mix: 40% easy, 40% medium, 20% hard. Output must be a valid JSON array of objects with keys: "question", "options" (array of 4 strings), "correct_answer", and "conceptTag". Do not include any surrounding text, explanation, or markdown like ```json`.'

    try:
        print(f"DEBUG: Calling AI model for Generate MCQ (UID: {uid}). Topic: {topic}, Count: {count}. Requesting JSON mime type.")
        # For JSON output, explicitly set response_mime_type
        # The AI should return *only* the JSON string.
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        # Attempt to parse the text response as JSON
        mcqs_text = get_response_text(response)
        # If the model still adds ```json```, remove them (as a fallback, prompt should prevent this)
        mcqs_text = re.sub(r'```json\s*\n*', '', mcqs_text, count=1) # Remove leading ```json optionally followed by newline
        mcqs_text = re.sub(r'\n*```\s*$', '', mcqs_text, count=1) # Remove trailing ``` optionally preceded by newline

        print(f"DEBUG: Attempting to parse JSON response for MCQ:\n{mcqs_text[:500]}...") # Log first 500 chars of response text

        questions = json.loads(mcqs_text)

        # Validate if the parsed JSON is a list (array)
        if not isinstance(questions, list):
             print(f"WARNING: AI returned JSON but it's not a list/array for MCQ. Raw: {mcqs_text}")
             raise ValueError("AI returned JSON but not the expected list format.")

        print(f"DEBUG: AI response received and parsed for Generate MCQ (UID: {uid}). Generated {len(questions)} MCQs.")
        return jsonify(questions) # Return the parsed list/array (Success)

    except json.JSONDecodeError as e:
        print(f"DEBUG: Error parsing AI response as JSON for Generate MCQ (UID: {uid}): {e}. Raw response: {mcqs_text}")
        # This error means AI did not return valid JSON
        return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था (JSON parse error)। कृपया विषय बदलकर फिर से प्रयास करें।'}), 500 # Internal Server Error
    except Exception as e:
        print(f"DEBUG: Error generating content or invalid format for Generate MCQ (UID: {uid}): {e}")
        return jsonify({'error': f'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी: {e}'}), 500 # Internal Server Error

# ... इसी तरह आपके बाकी सभी फंक्शन यहाँ आएंगे ...
# 4. Solved Examples

# ✅✅✅ get_solved_notes check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1800) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Get Solved Notes request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Get Solved Notes called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    count = min(int(data.get('count', 3)), 50) # Limit count to 50
    if not topic:
        print("DEBUG: Get Solved Notes request missing topic.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया एक विषय प्रदान करें।'}), 400 # Bad Request


    prompt = f"ROLE: Expert teacher. TASK: Provide {count} detailed, step-by-step solved problems for: \"{topic}\".\n{FORMATTING_INSTRUCTIONS}"
    try:
        print(f"DEBUG: Calling AI model for Get Solved Notes (UID: {uid}). Topic: {topic}, Count: {count}")
        response = model.generate_content(prompt)
        solved_notes = get_response_text(response)
        print(f"DEBUG: AI response received for Get Solved Notes (UID: {uid}). Notes length: {len(solved_notes)}")
        return jsonify({'solved_notes': solved_notes}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Get Solved Notes (UID: {uid}). Topic: {topic}. Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500 # Internal Server Error


# 5. Career Counselor

# ✅✅✅ get_career_advice check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Get Career Advice request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Get Career Advice called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    interests = data.get('interests')
    if not interests:
        print("DEBUG: Get Career Advice request missing interests.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया अपनी रुचियां बताएं।'}), 400 # Bad Request


    prompt = f'ROLE: Expert AI Career Counselor. TASK: Based on user interests "{interests}", provide a detailed career roadmap.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG: Calling AI model for Get Career Advice (UID: {uid}). Interests: {interests[:100]}...") # Log first 100 chars
        response = model.generate_content(prompt)
        advice = get_response_text(response)
        print(f"DEBUG: AI response received for Get Career Advice (UID: {uid}). Advice length: {len(advice)}")
        return jsonify({'advice': advice}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Get Career Advice (UID: {uid}). Interests: {interests[:100]}.... Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी।'}), 500 # Internal Server Error

# 6. Study Planner

# ✅✅✅ generate_study_plan check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Generate Study Plan request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Generate Study Plan called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है। कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    details = data.get('details')
    if not details:
        print("DEBUG: Generate Study Plan request missing details.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया प्लान के लिए विवरण दें।'}), 400 # Bad Request


    prompt = f'ROLE: Expert study planner. TASK: Create a 7-day study plan based on: "{details}". Use Hinglish for the plan.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG: Calling AI model for Generate Study Plan (UID: {uid}). Details: {details[:100]}...") # Log first 100 chars
        response = model.generate_content(prompt)
        plan = get_response_text(response)
        print(f"DEBUG: AI response received for Generate Study Plan (UID: {uid}). Plan length: {len(plan)}")
        return jsonify({'plan': plan}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Generate Study Plan (UID: {uid}). Details: {details[:100]}.... Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500 # Internal Server Error

# 7. Flashcards

# ✅✅✅ generate_flashcards check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1000) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Generate Flashcards request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Generate Flashcards called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    count = min(int(data.get('count', 8)), 50) # Limit count to 50
    if not topic:
        print("DEBUG: Generate Flashcards request missing topic.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया एक विषय प्रदान करें!'}), 400 # Bad Request

    # Prompt specifically asks for JSON
    prompt = f'Generate {count} flashcards for "{topic}". The language must match the topic language. Response must be ONLY a valid JSON array. Each object must have "front" and "back" keys. Do not include any surrounding text, explanation, or markdown like ```json`.'

    try:
        print(f"DEBUG: Calling AI model for Generate Flashcards (UID: {uid}). Topic: {topic}, Count: {count}. Requesting JSON mime type.")
        # For JSON output, explicitly set response_mime_type
        # The AI should return *only* the JSON string.
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        # Attempt to parse the text response as JSON
        flashcards_text = get_response_text(response)
         # Clean potential trailing/leading markdown like ```json``` if AI adds it
        flashcards_text = re.sub(r'```json\s*\n*', '', flashcards_text, count=1) # Remove leading ```json optionally followed by newline
        flashcards_text = re.sub(r'\n*```\s*$', '', flashcards_text, count=1) # Remove trailing ``` optionally preceded by newline

        print(f"DEBUG: Attempting to parse JSON response for Flashcards:\n{flashcards_text[:500]}...") # Log first 500 chars of response text

        cards = json.loads(flashcards_text)

        # Validate if the parsed JSON is a list of objects with 'front' and 'back' keys
        if not isinstance(cards, list) or not all(isinstance(item, dict) and 'front' in item and 'back' in item for item in cards):
             print(f"WARNING: AI returned JSON but it's not the expected format (list of objects with front/back). Raw: {flashcards_text}")
             raise ValueError("AI returned JSON but not in expected flashcard format.")


        print(f"DEBUG: AI response received and parsed for Generate Flashcards (UID: {uid}). Generated {len(cards)} flashcards.")
        return jsonify(cards) # Return the parsed list/array (Success)

    except json.JSONDecodeError as e:
        print(f"DEBUG: Error parsing AI response as JSON for Generate Flashcards (UID: {uid}): {e}. Raw response: {flashcards_text}")
        # This error means AI did not return valid JSON
        return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था (JSON parse error)। कृपया विषय बदलकर फिर से प्रयास करें।'}), 500 # Internal Server Error
    except Exception as e:
        print(f"DEBUG: Error generating content or invalid format for Generate Flashcards (UID: {uid}): {e}")
        return jsonify({'error': f'AI से फ्लैशकार्ड जेनरेट करते वक़्त गड़बड़ हो गयी: {e}'}), 500 # Internal Server Error


# 8. Essay Writer

# ✅✅✅ write_essay check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/write-essay-ai', methods=['POST'])
def write_essay_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1500) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Write Essay request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Write Essay called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        print("DEBUG: Write Essay request missing topic.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया निबंध के लिए एक विषय दें!'}), 400 # Bad Request

    prompt = f'ROLE: Expert Essay Writer. TASK: Write a well-structured essay on "{topic}".\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG: Calling AI model for Write Essay (UID: {uid}). Topic: {topic}")
        response = model.generate_content(prompt)
        essay = get_response_text(response)
        print(f"DEBUG: AI response received for Write Essay (UID: {uid}). Essay length: {len(essay)}")
        return jsonify({'essay': essay}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Write Essay (UID: {uid}). Topic: {topic}. Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500 # Internal Server Error


# 9. Presentation Maker

# ✅✅✅ create_presentation check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/create-presentation-ai', methods=['POST'])
def create_presentation_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=1200) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Create Presentation request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Create Presentation called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        print("DEBUG: Create Presentation request missing topic.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया प्रेजेंटेशन के लिए एक विषय दें!'}), 400 # Bad Request


    prompt = f'ROLE: AI Presentation Maker. TASK: Create a presentation outline on "{topic}" with a title slide and 5 content slides. Use standard markdown.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG: Calling AI model for Create Presentation (UID: {uid}). Topic: {topic}")
        response = model.generate_content(prompt)
        presentation = get_response_text(response)
        print(f"DEBUG: AI response received for Create Presentation (UID: {uid}). Presentation length: {len(presentation)}")
        return jsonify({'presentation': presentation}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Create Presentation (UID: {uid}). Topic: {topic}. Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500 # Internal Server Error


# 10. Concept Explainer

# ✅✅✅ explain_concept check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/explain-concept-ai', methods=['POST'])
def explain_concept_route():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=800) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Explain Concept request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Explain Concept called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    topic = data.get('topic')
    if not topic:
        print("DEBUG: Explain Concept request missing topic.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': ' कृपया समझाने के लिए एक कॉन्सेप्ट दें!'}), 400 # Bad Request


    prompt = f'ROLE: Friendly teacher. TASK: Explain "{topic}" simply, like I am 15 years old. Use Hinglish.\n{FORMATTING_INSTRUCTIONS}'
    try:
        print(f"DEBUG: Calling AI model for Explain Concept (UID: {uid}). Topic: {topic}")
        response = model.generate_content(prompt)
        explanation = get_response_text(response)
        print(f"DEBUG: AI response received for Explain Concept (UID: {uid}). Explanation length: {len(explanation)}")
        return jsonify({'explanation': explanation}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Explain Concept (UID: {uid}). Topic: {topic}. Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से जवाब जेनरेट करने में गड़बड़ हो गयी!'}), 500 # Internal Server Error


# 11. Quiz Analysis

# ✅✅✅ analyze_quiz_results check_user_privileges/model None hone par error dega (यह बदलाव पिछले वर्जन में भी किया था, इसे बनाए रखा है) ✅✅✅
@app.route('/analyze-quiz-results', methods=['POST'])
def analyze_quiz_results():
    uid = verify_user() # Call verify_user first to get UID if possible
    is_authorized, error_json, status_code = check_user_privileges(uid, cost_in_tokens=500) # <-- This checks login & tokens
    if not is_authorized:
        print(f"DEBUG: Analyze Quiz Results request denied for UID {uid}. Reason: {error_json.get_json().get('error')}")
        return error_json, status_code # Returns error JSON and status code (401 or 402)

    # Ensure AI model is initialized before using it
    if model is None: # <-- Check for None
        print("DEBUG: Analyze Quiz Results called but model is None (AI not initialized). Check server logs.")
        return jsonify({'error': 'AI अभी अनुपलब्ध है! कृपया सर्वर लॉग जांचें।'}), 503 # Service Unavailable


    data = request.get_json()
    user_answers = data.get('answers') # Expects a list of answer objects
    if not user_answers or not isinstance(user_answers, list):
        print("DEBUG: Analyze Quiz Results request missing or invalid answers list.")
        # Token refund logic needed here if cost was already deducted
        return jsonify({'error': 'विश्लेषण के लिए कोई जवाब नहीं मिला!'}), 400 # Bad Request


    incorrect_answers = [ans for ans in user_answers if not ans.get('isCorrect')]
    if not incorrect_answers:
        print(f"DEBUG: Analyze Quiz Results: All answers correct for UID {uid}.")
        # No tokens deducted if all answers correct and cost_in_tokens=0 for this case.
        # If cost_in_tokens was non-zero and deducted, need refund logic here.
        return jsonify({'analysis': "शानदार प्रदर्शन! आपके सभी जवाब सही थे। अपनी तैयारी जारी रखें।"})

    # Extract unique concept tags from incorrect answers
    incorrect_concepts = ", ".join(sorted(list(set([ans.get('conceptTag', 'General') for ans in incorrect_answers])))) # Sort tags for consistency
    print(f"DEBUG: Analyzing incorrect concepts for UID {uid}: {incorrect_concepts}")


    prompt = f"""
ROLE: Expert AI performance analyst.
TASK: Analyze a student's incorrect quiz answers and provide a constructive report in Hinglish.
DATA: Student made mistakes in these concepts: {incorrect_concepts}.
INSTRUCTIONS:
1. Identify weak topics based on the provided concepts.
2. Suggest specific improvements for each identified weak topic.
3. End with an encouraging message.
{FORMATTING_INSTRUCTIONS}
""" # <-- यह ट्रिपल-कोट स्ट्रिंग ठीक से बंद हो रही है।

    try:
        print(f"DEBUG: Calling AI model for Quiz Analysis (UID: {uid}). Concepts: {incorrect_concepts[:100]}...") # Log first 100 chars
        response = model.generate_content(prompt)
        analysis = get_response_text(response)
        print(f"DEBUG: AI response received for Quiz Analysis (UID: {uid}). Analysis length: {len(analysis)}")
        return jsonify({'analysis': analysis}) # Success
    except Exception as e:
        print(f"DEBUG: Error generating content for Quiz Analysis (UID: {uid}). Concepts: {incorrect_concepts[:100]}.... Error: {e}")
        # Consider adding back tokens if AI generation fails *after* cost deduction
        return jsonify({'error': 'AI से विश्लेषण जेनरेट करने में गड़बड़ हो गयी!'}), 500 # Internal Server Error


# --- SECTION 5: Main Execution Block ---
# ✅✅✅ यह हिस्सा पहले से सही था, कोई बदलाव नहीं ✅✅✅
if __name__ == '__main__':
    # यह सुनिश्चित करता है कि सर्वर सही पोर्ट पर चले, खासकर Render जैसे प्लेटफॉर्म पर।
    # debug=False production ke liye zaroori hai.
    # host='0.0.0.0' is needed for Render.
    # port reads from environment variable 'PORT' provided by Render, default to 8080.
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=False)
