# -- coding: utf-8 --
"""
Conceptra AI - मुख्य सर्वर फ़ाइल (app.py)

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

# --- आपके मूल कोड को सपोर्ट करने के लिए ये वैरिएबल बनाये गए हैं ---
name = __name__
file = __file__
# -----------------------------------------------------------------

# ✅✅✅ नया बदलाव: मालिक की पहचान के लिए ईमेल ✅✅✅
ADMIN_EMAIL = "himanshu@conceptra.ai"

# --- SECTION 2: बाहरी सेवाओं (External Services) को शुरू करना ---
# --- Firebase Admin SDK Initialization ---
# यह सर्वर को आपके Firestore डेटाबेस से सुरक्षित रूप से कनेक्ट करने की अनुमति देता है।

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

# --- Flask App Initialization ---

app = Flask(name)

# CORS (Cross-Origin Resource Sharing) को सक्षम करना ताकि आपका वेबपेज सर्वर से बात कर सके।
CORS(app)

# --- Razorpay Client Initialization ---
# यह आपके पेमेंट गेटवे को शुरू करता है।

try:
    # यह आपकी Razorpay कीज़ को सुरक्षित रूप से Environment Variables से पढ़ता है।
    # Render पर, आपको इन्हें 'Secret Files' के रूप में सेट करना होगा।
    key_id_file_path = Path(file).resolve().parent / 'RAZORPAY_KEY_ID'
    key_secret_file_path = Path(file).resolve().parent / 'RAZORPAY_KEY_SECRET'

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
            return False, {"error": f"आपके टोकन ({current_balance}) कम हैं। इस काम के लिए {cost_in_tokens} टोकन चाहिए। कृपया रिचार्ज करें।"}
        
        # टोकन बैलेंस घटाएं (यह एक एटॉमिक ऑपरेशन है)
        user_ref.update({"tokens_balance": firestore.FieldValue.increment(-cost_in_tokens)})
        return True, None
    except Exception as e:
        print(f"टोकन घटाते समय एरर (UID: {uid}): {e}")
        return False, {"error": "टोकन काटने में विफल। कृपया फिर से प्रयास करें।"}

def verify_user():
    """रिक्वेस्ट हेडर से Firebase ID Token को वेरिफाई करता है।"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    id_token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        print(f"Auth Token वेरिफिकेशन में विफल: {e}")
        return None

# ✅✅✅ नया बदलाव: मालिक की जाँच करने और टोकन मैनेज करने के लिए नया फंक्शन ✅✅✅
def check_user_privileges(uid, cost_in_tokens):
    """
    यह फंक्शन पहले यूजर की पहचान करता है।
    - अगर यूजर लॉग-इन नहीं है, तो एरर देता है।
    - अगर यूजर 'मालिक' (Admin) है
