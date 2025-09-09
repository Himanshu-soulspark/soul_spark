// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
// =================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Razorpay = require('razorpay');
const path = require('path');
const axios = require('axios');
const { google } = require('googleapis');
const FormData = require('form-data'); // Face++ API के लिए ज़रूरी
const crypto = require('crypto'); // Razorpay Signature को वेरिफाई करने के लिए ज़रूरी

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

const app = express();
app.use(cors());

// IMPORTANT: Webhook ko handle karne ke liye raw body zaroori hai.
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    try {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(req.body); 
        const digest = shasum.digest('hex');
        if (digest !== signature) {
            console.warn('Webhook signature mismatch!');
            return res.status(400).json({ status: 'Signature mismatch' });
        }
        const body = JSON.parse(req.body.toString());
        const event = body.event;
        const payload = body.payload;
        
        if (event === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.payment.entity;
            const amount = payment.amount / 100;
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            if (usersQuery.empty) {
                console.error(`Webhook Error: No user found for subscription ID ${subscription.id}`);
                return res.json({ status: 'ok' });
            }
            const userRefठीक = usersQuery.docs[0].ref;
            let coinsToAdd = 0;
            if (amount है, मैं आपकी बात समझ गया हूँ। आप पूरी तरह से सही हैं। === 2000) coinsToAdd = 11000;
            else if (amount === 2 अगर पहले ₹1 का पेमेंट सफल हो रहा था और अब नहीं हो रहा, तो इसका मतलब है कि हमारे कोड में ही00) coinsToAdd = 1000;
            if (coinsToAdd > 0) {
                await user कोई ऐसी चीज़ है जो समस्या पैदा कर रही है, खासकर जब हम सब्सक्रिप्शन बनाने की कोशिश करते हैं।

अबRef.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd), subscriptionStatus: 'active' });
                 हम कोई नया प्रयोग नहीं करेंगे। हम वापस उस **सबसे सरल और सबसे भरोसेमंद तरीके** पर जाएँगे जो पहले कामconsole.log(`SUCCESS: Added ${coinsToAdd} coins to user ${userRef.id} for ₹${amount}. कर रहा था, और उसमें आपके ऑटो-पेमेंट और डाउनग्रेड वाले लॉजिक को सुरक्षित तरीके से जोड़ेंगे।`);
            }
        } else if (event === 'payment.failed') {
            // Hum subscription ID

**हम यह करेंगे:**
1.  **₹1 का पेमेंट** एक **सामान्य पेमेंट ऑर्डर** की तरह होगा ko payment ke notes se lene ki koshish karenge
            const subscriptionId = payload.payment.entity.notes.subscription। (यह पहले काम कर रहा था)।
2.  जैसे ही ₹1 का पेमेंट **सफल** होगा_id; 
            if (!subscriptionId) {
                return res.json({ status: 'ok,, हम **बैकएंड में** उसी ग्राहक के लिए एक नया **सब्सक्रिप्शन** बनाएँगे जो 10 मिनट but no subscription ID found' });
            }
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscriptionId).limit(1).get();
            if (users बाद शुरू होगा।

यह तरीका सबसे स्थिर (stable) है और इसमें Razorpay के सिस्टम में सबसे कम कन्फQuery.empty) return res.json({ status: 'ok' });
            const user = usersQuery.docs्यूजन होता है।

---

### **आपका अंतिम, पूरा और सही `server.js` कोड**

मैंने[0].data();
            const userRef = usersQuery.docs[0].ref;
            if (user.currentPlan === 'PlanA') {
                console.log(`INFO: Plan A (₹2000) इस कोड में सिर्फ़ वही **अति-आवश्यक बदलाव** किए हैं जो इस नई, सरल प्रक्रिया को लागू failed for user ${userRef.id}. Downgrading to Plan B.`);
                await razorpay.subscriptions.cancel करने के लिए ज़रूरी हैं। आपके सभी पुराने फंक्शन्स (AI, Health, आदि) पूरी तरह से सुरक्षित हैं(subscriptionId);
                const startTime = new Date();
                startTime.setMinutes(startTime.getMinutes() + 15।

```javascript
// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
//);
                const startAtTimestamp = Math.floor(startTime.getTime() / 1000);
                 =================================================================
const express = require('express');
const cors = require('cors');
const adminconst newSubscription = await razorpay.subscriptions.create({
                    plan_id: process.env.RAZORPAY_ = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Razorpay = require('razorpay');
const path = require('path');
const axios = require('axiosPLAN_ID_B,
                    customer_id: user.razorpayCustomerId,
                    total_count: 24,
                    start_at: startAtTimestamp,
                    customer_notify: 1
                });
                await userRef.update({
                    razorpaySubscriptionId: newSubscription.id,
                    currentPlan');
const { google } = require('googleapis');
const FormData = require('form-data'); // Face++: 'PlanB',
                    subscriptionStatus: 'downgraded_pending'
                });
                console.log( API के लिए ज़रूरी
const crypto = require('crypto'); // Razorpay Signature को वेरिफाई करने के लिए ज़रूरी

`SUCCESS: Downgraded user ${userRef.id} to Plan B. Next charge in 15 minutes.`);
            }
        }
        // Jab Auth Link se payment successful hota hai, to subscription active ho jata hai
        else if (// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================event === 'subscription.activated') {
            const subscription = payload.subscription.entity;
            const usersQuery

const app = express();
app.use(cors());

// IMPORTANT: Webhook ko handle karne ke liye raw = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            if(!usersQuery.empty) {
                const userRef = usersQuery.docs body zaroori hai.
app.post('/razorpay-webhook', express.raw({ type: 'application[0].ref;
                // Yahan hum 55 coins denge, kyunki abhi-abhi ₹1 kata hai.
                await userRef.update({
                    coins: admin.firestore.FieldValue.increment(5/json' }), async (req, res) => {
    const secret = process.env.RAZORPAY_5),
                    subscriptionStatus: 'active'
                });
                console.log(`SUCCESS: Subscription activated for user ${userRef.id}. 55 coins added.`);
            }
        }
        
        res.json({ statusWEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    try: 'ok' });
    } catch (error) {
        console.error('Error processing webhook:', error {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.);
        res.status(500).send('Webhook processing error.');
    }
});
// Bupdate(req.body); 
        const digest = shasum.digest('hex');
        if (digest !== signature) {
            console.warn('Webhook signature mismatch!');
            return res.status(400).aki sabhi routes ke liye JSON parser ka istemal karein
app.use(express.json({ limit: 'json({ status: 'Signature mismatch' });
        }
        const body = JSON.parse(req.body.toString());
        const event = body.event;
        const payload = body.payload;
        
        if (10mb' }));

// --- Firebase Admin SDK को शुरू करें ---
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT env variable is not set!');
  const serviceevent === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.paymentAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.entity;
            const amount = payment.amount / 100;
            const usersQuery = await.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get catch (error) {
  console.error("\n\n❌❌❌ FATAL ERROR: Firebase Admin SDK could();
            if (usersQuery.empty) {
                console.error(`Webhook Error: No user found for subscription ID not be initialized. ❌❌❌");
  console.error("REASON:", error.message);
  console ${subscription.id}`);
                return res.json({ status: 'ok' });
            }
            const userRef = usersQuery.docs[0].ref;
            let coinsToAdd = 0;
            if (amount.error("\nSOLUTION: Please check your 'FIREBASE_SERVICE_ACCOUNT' environment variable in Render.\n");
  process.exit(1);
}
const db = admin.firestore();

// --- Baki Services === 2000) coinsToAdd = 11000;
            else if (amount === 2 (AI, YouTube, etc.) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API00) coinsToAdd = 1000;
            if (coinsToAdd > 0) {
                await user_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-Ref.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd), subscriptionStatus: 'active' });
                flash" });
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const youtubeconsole.log(`SUCCESS: Added ${coinsToAdd} coins to user ${userRef.id} for ₹${amount}.`);
            }
        } else if (event === 'payment.failed') {
            const subscriptionId = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY }); = payload.payment.entity.notes.subscription_id;
            if (!subscriptionId) {
                return res
console.log("✅ All services initialized.");


// =================================================================
// 3. API End.json({ status: 'ok, but no subscription ID found' });
            }
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscriptionId).limit(1).get();
points (Non-Payment - Poora Purana Code Yahan Hai)
// =================================================================

// ---            if (usersQuery.empty) return res.json({ status: 'ok' });
            const user = usersQuery.docs[0].data();
            const userRef = usersQuery.docs[0].ref;
 AI से दवा-भोजन इंटरेक्शन पूछने वाला Endpoint ---
app.post('/get-food-interaction            if (user.currentPlan === 'PlanA') {
                console.log(`INFO: Plan A (₹', async (req, res) => {
    try {
        const { medicines, token } = req.body;
2000) failed for user ${userRef.id}. Downgrading to Plan B.`);
                await        if (!token || !medicines) return res.status(400).json({ error: "Token and medicines razorpay.subscriptions.cancel(subscriptionId);
                const startTime = new Date();
                startTime.setMinutes are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get(startTime.getMinutes() + 15);
                const startAtTimestamp = Math.floor(startTime.getTime() / 1000);
                const newSubscription = await razorpay.subscriptions.create({
                    plan_id: process();
        if (!userDoc.exists) return res.status(404).json({ error: "User.env.RAZORPAY_PLAN_ID_B,
                    customer_id: user.razorpay not found." });
        const userData = userDoc.data();
        const COIN_COST = 2;CustomerId,
                    total_count: 24,
                    start_at: startAtTimestamp,
                    customer_notify: 1
                });
                await userRef.update({
                    razorpaySubscriptionId: new
        if (userData.coins < COIN_COST) return res.status(403).json({Subscription.id,
                    currentPlan: 'PlanB',
                    subscriptionStatus: 'downgraded_pending'
                 error: "You don't have enough coins (minimum 2 required)." });
        const improvedPrompt = });
                console.log(`SUCCESS: Downgraded user ${userRef.id} to Plan B. Next charge in 15 minutes.`);
            }
        }
        
        res.json({ status: 'ok'`
      You are an expert AI Health Assistant. A user is taking these medicines: ${medicines}.
      Your });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res task is to provide a detailed food interaction guide. The response MUST be a valid JSON object ONLY, with no extra text.status(500).send('Webhook processing error.');
    }
});
// Baki sabhi routes ke liye JSON parser ka istemal karein
app.use(express.json({ limit: '10 or markdown. The entire response, including all food names and reasons, MUST be in simple Hindi (Devanagari script).mb' }));

// --- Firebase Admin SDK को शुरू करें ---
try {
  if (!process.env.FIRE
      The JSON object must have three keys: "avoid", "limit", and "safe".
      "avoid": An array of objects for foods to completely avoid. Each object must have "item" and "reason" keys.
      "BASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT env variable is not set!');
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({limit": An array of objects for foods to eat in limited quantity. Each object must also have "item" and "reason" credential: admin.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin SDK initialized successfully."); keys.
      "safe": An array of strings listing at least 5 examples of safe foods in Hindi.
      For
} catch (error) {
  console.error("\n\n❌❌❌ FATAL ERROR: Firebase the medicines ${medicines}, be sure to include critical interactions. If there's no specific info for a category, Admin SDK could not be initialized. ❌❌❌");
  console.error("REASON:", error.message); provide an empty array [].
    `;
        const result = await aiModel.generateContent(improvedPrompt);
        const aiAnswer = result.response.text();
        await userRef.update({ coins: admin.firestore.FieldValue
  console.error("\nSOLUTION: Please check your 'FIREBASE_SERVICE_ACCOUNT' environment variable in Render.\.increment(-COIN_COST) });
        res.json({ answer: aiAnswer });
    } catchn");
  process.exit(1);
}
const db = admin.firestore();

// --- B (error) {
        console.error("Error in /get-food-interaction:", error);
        res.aki Services (AI, YouTube, etc.) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-status(500).json({ error: "Internal server error." });
    }
});

// --- AI से1.5-flash" });
const razorpay = new Razorpay({ key_id: process.env.RA सामान्य सवाल और आर्टिकल पूछने वाला Endpoint ---
app.post('/ask-ai', async (req, res) => {
    try {
        const { question, token } = req.body;
        if (!token || !questionZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET) return res.status(400).json({ error: "Token and question are required." });
        const decoded });
const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_APIToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!_KEY });
console.log("✅ All services initialized.");


// =================================================================
// 3userDoc.exists) return res.status(404).json({ error: "User not found." });. API Endpoints (Non-Payment - Poora Purana Code Yahan Hai)
// =================================================================
        const userData = userDoc.data();
        const COIN_COST = 1;
        if (userData.coins < COIN_COST) return res.status(403).json({ error: "

// --- AI से दवा-भोजन इंटरेक्शन पूछने वाला Endpoint ---
app.post('/get-food-interaction', async (req, res) => {
    try {
        const { medicines, token } = req.body;
You don't have enough coins (minimum 1 required)." });
        const result = await aiModel.generateContent(question);
        const aiAnswer = result.response.text();
        await userRef.update({ coins: admin        if (!token || !medicines) return res.status(400).json({ error: "Token and.firestore.FieldValue.increment(-COIN_COST) });
        res.json({ answer: aiAnswer });
    } catch (error) {
        console.error("Error in /ask-ai:", error);
        res medicines are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        .status(500).json({ error: "Internal server error." });
    }
});

// --- AI MEDICAL ASSISTANT ENDPOINT ---
app.post('/assistant-chat', async (req, res) =>const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await {
    try {
        const { question, token } = req.body;
        if (!token || !question userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
        const userData = userDoc.data();
        const COIN_COST) return res.status(400).json({ error: "Token and question are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection = 2;
        if (userData.coins < COIN_COST) return res.status(403).json('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        ({ error: "You don't have enough coins (minimum 2 required)." });
        const improvedPrompt = if (!userDoc.exists) return res.status(404).json({ error: "User not found`
      You are an expert AI Health Assistant. A user is taking these medicines: ${medicines}.
      Your." });
        const userData = userDoc.data();
        const assistantPrompt = `
      You are a caring and empathetic female AI medical assistant named 'Shubh'.
      Respond in the same language as the user's question task is to provide a detailed food interaction guide. The response MUST be a valid JSON object ONLY, with no extra text.
      You can generate a detailed response, up to 4500 characters if needed.
      When or markdown. The entire response, including all food names and reasons, MUST be in simple Hindi (Devanagari script a user mentions a medical symptom or illness (like 'पेट दर्द', 'fever', 'headache', etc.), you).
      The JSON object must have three keys: "avoid", "limit", and "safe".
      " MUST follow this three-part structure in your response:
      Immediate Relief: Start by suggesting some simple, safe home remedies or general advice for initial comfort. For example, for a stomach ache, suggest warm water, ginger tea, oravoid": An array of objects for foods to completely avoid. Each object must have "item" and "reason" keys.
      "limit": An array of objects for foods to eat in limited quantity. Each object must also have "item" and "reason" keys.
      "safe": An array of strings listing at least 5 examples of safe foods in Hindi.
      For the medicines ${medicines}, be sure to include critical interactions. If there's no specific info for a category, avoiding spicy food.
      General Medication: Suggest ONLY common, general-purpose, over-the-counter (OTC) medicines that provide an empty array [].
    `;
        const result = await aiModel.generateContent(improvedPrompt);
        const aiAnswer = result.response.text();
        await userRef.update({ coins: admin.firestore.FieldValue are typically used for the symptom. For a stomach ache, you could mention an antacid. Be very generic.
      Crucial Disclaimer: ALWAYS end your response with a strong, clear disclaimer. You must state: 'यह सलाह केवल.increment(-COIN_COST) });
        res.json({ answer: aiAnswer });
    } catch (error शुरुआती राहत के लिए है। किसी भी दवा को लेने से पहले कृपया डॉक्टर से सलाह ज़रूर लें। आपकी सही स्थिति का) {
        console.error("Error in /get-food-interaction:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- AI से सामान्य सवाल और आर्टिकल पूछने वाला Endpoint ---
app.post('/ask-ai', async (req, res) => {
 मूल्यांकन एक योग्य चिकित्सक ही कर सकते हैं।' (This advice is for initial relief only. Please consult a doctor before taking    try {
        const { question, token } = req.body;
        if (!token || !question) return res.status(400).json({ error: "Token and question are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users'). any medication. Only a qualified physician can properly evaluate your condition.)
      User's question is: "${question}"
doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!user    `;
        const result = await aiModel.generateContent(assistantPrompt);
        const aiAnswer = result.response.text();
        const responseLength = aiAnswer.length;
        let coinCost = Math.ceil(responseDoc.exists) return res.status(404).json({ error: "User not found." });
        const userData = userDoc.data();
        const COIN_COST = 1;
        if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don'tLength / 1000) * 2;
        if (coinCost === 0 && responseLength >  have enough coins (minimum 1 required)." });
        const result = await aiModel.generateContent(question);
        const0) coinCost = 2;
        if (coinCost > 0) {
            if (userData.coins < coinCost) {
                return res.status(403).json({ answer: `इस जवाब aiAnswer = result.response.text();
        await userRef.update({ coins: admin.firestore.FieldValue के लिए ${coinCost} सिक्कों की ज़रूरत है, लेकिन आपके पास पर्याप्त सिक्के नहीं हैं।` });
            }
.increment(-COIN_COST) });
        res.json({ answer: aiAnswer });
    } catch (error) {
        console.error("Error in /ask-ai:", error);
        res.status            await userRef.update({ coins: admin.firestore.FieldValue.increment(-coinCost) });
        }
        (500).json({ error: "Internal server error." });
    }
});

// --- AIres.json({ answer: aiAnswer });
    } catch (error) {
        console.error("Error in /assistant-chat:", error);
        res.status(500).json({ error: "Internal server error." MEDICAL ASSISTANT ENDPOINT ---
app.post('/assistant-chat', async (req, res) => {
    try {
        const { question, token } = req.body;
        if (!token || !question) return res. });
    }
});

// --- AI डाइट प्लान बनाने वाला Endpoint ---
app.post('/generate-diet-plan', async (req, res) => {
    try {
        const { prompt, token } =status(400).json({ error: "Token and question are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc req.body;
        if (!token || !prompt) return res.status(400).json({.exists) return res.status(404).json({ error: "User not found." });
         error: "Token and prompt are required." });
        const decodedToken = await admin.auth().verifyIdTokenconst userData = userDoc.data();
        const assistantPrompt = `
      You are a caring and empathetic female(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
        const userData = userDoc.data();
        const COIN_COST = 1;
        if (userData.coins < COIN_COST) AI medical assistant named 'Shubh'.
      Respond in the same language as the user's question.
      You can generate a detailed response, up to 4500 characters if needed.
      When a user mentions a medical symptom or return res.status(403).json({ error: "You don't have enough coins (minimum 1 required)." });
        const result = await aiModel.generateContent(prompt);
        const aiAnswer = result.response.text();
        await userRef.update({ coins: admin.firestore.FieldValue.increment(- illness (like 'पेट दर्द', 'fever', 'headache', etc.), you MUST follow this three-part structureCOIN_COST) });
        res.json({ answer: aiAnswer });
    } catch (error) in your response:
      Immediate Relief: Start by suggesting some simple, safe home remedies or general advice for initial comfort {
        console.error("Error in /generate-diet-plan:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- FACE++. For example, for a stomach ache, suggest warm water, ginger tea, or avoiding spicy food.
      General स्किन एनालिसिस ENDPOINT ---
app.post('/analyze-skin', async (req, res) => {
    try { Medication: Suggest ONLY common, general-purpose, over-the-counter (OTC) medicines that are typically used for the symptom
        const { imageBase64, token } = req.body;
        if (!token || !imageBase64) return res.status(400).json({ error: "Token and image data are required.". For a stomach ache, you could mention an antacid. Be very generic.
      Crucial Disclaimer: ALWAYS });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get end your response with a strong, clear disclaimer. You must state: 'यह सलाह केवल शुरुआती राहत के लिए है। किसी();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
        const userData = userDoc.data();
        const COIN_COST =  भी दवा को लेने से पहले कृपया डॉक्टर से सलाह ज़रूर लें। आपकी सही स्थिति का मूल्यांकन एक योग्य चिकित्सक ही कर सकते हैं1;
        if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don't have enough credits for a Quick Scan." });
        const apiKey = process.env.FACEPP_API_KEY;
        const apiSecret = process.env.FACEPP_API_SECRET;।' (This advice is for initial relief only. Please consult a doctor before taking any medication. Only a qualified physician can properly evaluate your condition.)
      User's question is: "${question}"
    `;
        const result =
        if (!apiKey || !apiSecret) throw new Error("Face++ API credentials are not set on the server.");
        const formData = new FormData();
        formData.append('api_key', apiKey);
        formData.append(' await aiModel.generateContent(assistantPrompt);
        const aiAnswer = result.response.text();
        const responseLength = aiAnswer.length;
        let coinCost = Math.ceil(responseLength / 100api_secret', apiSecret);
        formData.append('image_base64', imageBase64);0) * 2;
        if (coinCost === 0 && responseLength > 0) coinCost = 2
        formData.append('return_attributes', 'skinstatus');
        const faceppResponse = await axios.post('https://api-us.faceplusplus.com/facepp/v3/detect', formData,;
        if (coinCost > 0) {
            if (userData.coins < coinCost) {
                return res.status(403).json({ answer: `इस जवाब के लिए ${coinCost} सिक् { headers: formData.getHeaders() });
        if (faceppResponse.data && faceppResponse.data.faces && faceppResponse.data.faces.length > 0) {
            await userRef.update({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });
            const skinStatus = faceppResponse.dataकों की ज़रूरत है, लेकिन आपके पास पर्याप्त सिक्के नहीं हैं।` });
            }
            await userRef.update({ coins: admin.firestore.FieldValue.increment(-coinCost) });
        }
        res.json({ answer: aiAnswer });
    } catch (error) {
        console.error("Error in /assistant-chat:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

//.faces[0].attributes.skinstatus;
            const analysisResult = {
                health: skinStatus.health, --- AI डाइट प्लान बनाने वाला Endpoint ---
app.post('/generate-diet-plan', async (req, res
                blemishes: skinStatus.acne.length + skinStatus.stain.length,
                darkCircle: skinStatus.dark_circle,
            };
            res.json({ success: true, data: analysisResult) => {
    try {
        const { prompt, token } = req.body;
        if (!token || !prompt) return res.status(400).json({ error: "Token and prompt are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db });
        } else {
            res.status(404).json({ error: "Could not detect.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: "User a face in the image. Please try again with a clearer picture." });
        }
    } catch (error) not found." });
        const userData = userDoc.data();
        const COIN_COST = 1;
        if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don't have enough coins (minimum 1 required)." });
        const result = await {
        console.error("Error in /analyze-skin:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "An error occurred during skin aiModel.generateContent(prompt);
        const aiAnswer = result.response.text();
        await userRef.update analysis." });
    }
});

// --- YouTube वीडियो खोजने वाला Endpoint ---
app.get('/get-youtube-videos', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({error: 'Search query is required.' });
    try {
        const response = await youtube.search.list({ part: 'snippet', q: `${query} exercise tutorial({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });
        res.json({ answer: aiAnswer });
    } catch (error) {
        console.error("Error in /generate-diet-plan:", error);
        res.status(500).json({ error: "Internal server error." hindi`, maxResults: 5, type: 'video' });
        res.json(response.data. });
    }
});

// --- FACE++ स्किन एनालिसिस ENDPOINT ---
app.post('/analyze-skin', async (req, res) => {
    try {
        const { imageBase64, token } = req.items);
    } catch (error) {
        console.error('Error fetching YouTube videos:', error);
body;
        if (!token || !imageBase64) return res.status(400).json({ error:        res.status(500).json({ error: 'Could not fetch YouTube videos.' });
    }
});

// --- मौसम के हिसाब से स्वास्थ्य सलाह देने वाला Endpoint ---
app.get('/get-weather-advice', async ( "Token and image data are required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
        const userData = userDoc.data();
req, res) => {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required.' });
    try {
        const weather        const COIN_COST = 1;
        if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don't have enough credits for a Quick Scan."Response = await axios.get('https://api.openweathermap.org/data/2.5/weather', { params: { q: city, appid: process.env.WEATHER_API_KEY, units: 'metric' });
        const apiKey = process.env.FACEPP_API_KEY;
        const apiSecret = process.env } });
        const weather = weatherResponse.data;
        const advicePrompt = `Based on this weather in.FACEPP_API_SECRET;
        if (!apiKey || !apiSecret) throw new Error("Face++ API credentials ${city}: temperature is ${weather.main.temp}°C, humidity is ${weather.main.humidity}%, and are not set on the server.");
        const formData = new FormData();
        formData.append('api_key', condition is ${weather.weather[0].description}. Provide a short, simple health tip in Hindi.`;
        const result apiKey);
        formData.append('api_secret', apiSecret);
        formData.append('image_base64 = await aiModel.generateContent(advicePrompt);
        const advice = result.response.text();
        res.json({ advice });
    } catch (error) {
        console.error('Error getting weather advice:', error', imageBase64);
        formData.append('return_attributes', 'skinstatus');
        const faceppResponse = await axios.post('https://api-us.faceplusplus.com/facepp/v3/detect);
        res.status(500).json({ error: 'Could not get weather advice.' });
    }
});

// --- LocationIQ से पता प्राप्त करने वाला Endpoint ---
app.get('/get-address-from-coords', async', formData, { headers: formData.getHeaders() });
        if (faceppResponse.data && faceppResponse.data.faces && faceppResponse.data.faces.length > 0) {
            await userRef.update({ (req, res) => {
    const { lat, lon } = req.query;
    if (!lat coins: admin.firestore.FieldValue.increment(-COIN_COST) });
            const skinStatus = faceppResponse.data || !lon) return res.status(400).json({ error: 'Latitude (lat) and Long.faces[0].attributes.skinstatus;
            const analysisResult = {
                health: skinStatus.health,
                blemishes: skinStatus.acne.length + skinStatus.stain.length,
                darkCircleitude (lon) are required.' });
    try {
        const response = await axios.get('https://us1.locationiq.com/v1/reverse.php', { params: { key: process.env.LOCATION: skinStatus.dark_circle,
            };
            res.json({ success: true, data: analysisResult });
        } else {
            res.status(404).json({ error: "Could not detectIQ_API_KEY, lat: lat, lon: lon, format: 'json' } });
        if (response.data && response.data.display_name) {
            res.json({ address: response.data.display_name });
        } else {
            res.status(404).json({ error: 'Could a face in the image. Please try again with a clearer picture." });
        }
    } catch (error) {
        console.error("Error in /analyze-skin:", error.response ? error.response.data : not find address for these coordinates.' });
        }
    } catch (error) {
        console.error(' error.message);
        res.status(500).json({ error: "An error occurred during skinError fetching address from LocationIQ:', error.message);
        res.status(500).json({ error: 'Failed to get address from location service.' });
    }
});

// --- भोजन की पोषण जानकारी देने वाला Endpoint ---
 analysis." });
    }
});

// --- YouTube वीडियो खोजने वाला Endpoint ---
app.get('/get-youtube-videos', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({error: 'Search query is required.' });
    tryapp.get('/get-nutrition-info', async (req, res) => {
    const { food } = req.query;
    if (!food) return res.status(400).json({ error: 'Food item is required.' {
        const response = await youtube.search.list({ part: 'snippet', q: `${query} exercise tutorial });
    try {
        const nutritionixResponse = await axios.post('https://trackapi.nutritionix hindi`, maxResults: 5, type: 'video' });
        res.json(response.data.items);
    } catch (error) {
        console.error('Error fetching YouTube videos:', error);
        res.status(500).json({ error: 'Could not fetch YouTube videos.' });
    }
});

// ---.com/v2/natural/nutrients', { query: food }, { headers: { 'x-app-id': process.env.NUTRITIONIX_APP_ID, 'x-app-key': process.env.NUTRITIONIX_API_KEY } });
        if (nutritionixResponse.data && nutritionixResponse मौसम के हिसाब से स्वास्थ्य सलाह देने वाला Endpoint ---
app.get('/get-weather-advice', async (req, res).data.foods && nutritionixResponse.data.foods.length > 0) {
            return res.json({ source: 'Nutritionix', data: nutritionixResponse.data.foods[0] });
        } => {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required.' });
    try {
        const weatherResponse = await axios
    } catch (nutritionixError) {
        console.log("Nutritionix failed, trying USDA...");
        try.get('https://api.openweathermap.org/data/2.5/weather', { params: { q: city {
            const usdaResponse = await axios.get('https://api.nal.usda.gov/fd, appid: process.env.WEATHER_API_KEY, units: 'metric' } });
        const weather = weatherResponse.data;
        const advicePrompt = `Based on this weather in ${city}: temperature is ${weatherc/v1/foods/search', { params: { query: food, api_key: process.env.USDA_API_KEY } });
            if (usdaResponse.data && usdaResponse.data.foods && usdaResponse.data.foods.length > 0) {
                return res.json({ source: 'USDA', data: usdaResponse.data.foods[0] });
            }
        } catch (usdaError) {
            console.error('USDA API Error:', usdaError);
        }
    }
    res.main.temp}°C, humidity is ${weather.main.humidity}%, and condition is ${weather.weather[0].description}. Provide a short, simple health tip in Hindi.`;
        const result = await aiModel.generateContent(advicePrompt);
        const advice = result.response.text();
        res.json({ advice });
    } catch (error) {
        console.error('Error getting weather advice:', error);
        res.status(404).json({ error: 'Could not find nutritional information for this item.' });
});

// ---.status(500).json({ error: 'Could not get weather advice.' });
    }
});

// --- LocationIQ से पता प्राप्त करने वाला Endpoint ---
app.get('/get-address-from-coords', async (req, res बारकोड से भोजन की जानकारी देने वाला Endpoint ---
app.get('/get-info-by-barcode', async (req, res) => {
    const { upc } = req.query;
    if (!upc) return res.status(400).json({ error: 'UPC (barcode) is required.' });
    ) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required.'try {
        const response = await axios.get('https://trackapi.nutritionix.com/v2/search/item', { params: { upc: upc }, headers: { 'x-app-id });
    try {
        const response = await axios.get('https://us1.locationiq.com/v': process.env.NUTRITIONIX_APP_ID, 'x-app-key': process.env.NUTRITIONIX_API_KEY } });
        if (response.data && response.data.foods1/reverse.php', { params: { key: process.env.LOCATIONIQ_API_KEY, lat && response.data.foods.length > 0) {
            res.json({ source: 'Nutritionix UPC', data: response.data.foods[0] });
        } else {
            res.status(4: lat, lon: lon, format: 'json' } });
        if (response.data && response.data.display04).json({ error: 'Could not find food item for this barcode.' });
        }
    } catch (error) {
        console.error('Error fetching data from Nutritionix UPC lookup:', error);
        res._name) {
            res.json({ address: response.data.display_name });
        } else {
            res.status(404).json({ error: 'Could not find address for these coordinates.' });
        status(500).json({ error: 'Failed to get data for barcode.' });
    }
});


}
    } catch (error) {
        console.error('Error fetching address from LocationIQ:', error.message// =================================================================
// 4. PAYMENT & SUBSCRIPTION ENDPOINTS
// =================================================================);
        res.status(500).json({ error: 'Failed to get address from location service.'

app.post('/create-payment', async (req, res) => {
    try {
        const { token, isSubscription } = req.body;
        if (!token) return res.status(400).json({ });
    }
});

// --- भोजन की पोषण जानकारी देने वाला Endpoint ---
app.get('/get-nutrition-info', async (req, res) => {
    const { food } = req.query;
     error: "User token is required." });

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDocif (!food) return res.status(400).json({ error: 'Food item is required.' });
    try {
        const nutritionixResponse = await axios.post('https://trackapi.nutritionix.com/v = await userRef.get();
        if (!userDoc.exists) return res.status(4042/natural/nutrients', { query: food }, { headers: { 'x-app-id': process.env.NUTRITIONIX_APP_ID, 'x-app-key': process.env.NUTR).json({ error: "User not found." });
        const userData = userDoc.data();

        if (isSubscription) {
            console.log("Subscription flow started. Using Auth Link method.");
            if (userData.razITIONIX_API_KEY } });
        if (nutritionixResponse.data && nutritionixResponse.data.foods && nutritionorpaySubscriptionId && userData.subscriptionStatus === 'active') {
                return res.status(400ixResponse.data.foods.length > 0) {
            return res.json({ source: 'Nutrition).json({ error: "User already has an active subscription." });
            }

            let customerId = userDataix', data: nutritionixResponse.data.foods[0] });
        }
    } catch (nutritionixError.razorpayCustomerId;
            const userEmail = userData.email || `${decodedToken.uid}@shubhmed-app.com`;
            
            if (!customerId) {
                try {
                    const customers = await razor) {
        console.log("Nutritionix failed, trying USDA...");
        try {
            const usdaResponse = await axios.get('https://api.nal.usda.gov/fdc/v1/foods/search', { params: { query: food, api_key: process.env.USDA_API_KEY } });
            if (usdaResponse.data && usdaResponse.data.foods && usdaResponse.data.foods.length > 0) {
                return res.json({ source: 'USDA', data: usdaResponse.pay.customers.all({ email: userEmail });
                    if (customers.items.length > 0) {
                        customerId = customers.items[0].id;
                        console.log(`Found existing customer on Razorpay: ${data.foods[0] });
            }
        } catch (usdaError) {
            console.error('USDA API Error:', usdaError);
        }
    }
    res.status(404).json({ error: 'Could not find nutritional information for this item.' });
});

// --- बारकोड से भोजन कीcustomerId}`);
                    }
                } catch (searchError) {
                    console.error("Error searching for customer, will create a new one.", searchError);
                }
            }
            
            if (!customerId) {
                console.log("No existing customer found. Creating a new one.");
                const customer = await razorpay.customers.create({
                    name: userData.name || 'Shubhmed User',
                    email: userEmail, जानकारी देने वाला Endpoint ---
app.get('/get-info-by-barcode', async (req, res) => {
    const { upc } = req.query;
    if (!upc) return res.status(400).json({ error: 'UPC (barcode) is required.' });
    try {
        const response =
                    contact: userData.phone || undefined
                });
                customerId = customer.id;
            }
            
            const startTime = new Date();
            startTime.setMinutes(startTime.getMinutes() + 10);
            const await axios.get('https://trackapi.nutritionix.com/v2/search/item', { params: { up startAtTimestamp = Math.floor(startTime.getTime() / 1000);

            const subscriptionOptions = {
c: upc }, headers: { 'x-app-id': process.env.NUTRITIONIX_APP_ID, 'x-app-key': process.env.NUTRITIONIX_API_KEY } });
        if (response.data && response.data.foods && response.data.foods.length > 0) {
            res.json({ source: 'Nutritionix UPC', data: response.data.foods[0] });                plan_id: process.env.RAZORPAY_PLAN_ID_A,
                customer_id: customerId,
                total_count: 12, 
                start_at: startAtTimestamp,
                customer_notify: 1,
                // === START: ZAROORI BADLAV (The Final Fix) ===

        } else {
            res.status(404).json({ error: 'Could not find food item for this barcode.' });
        }
    } catch (error) {
        console.error('Error                // Hum ab Addon ka istemal nahi karenge
                // Trial fee ab Auth Link ke through handle hogi
                // addons: [{ item: { name: "Trial Fee", amount: 100, currency: "INR" } }]
                // === END: ZAROORI BADLAV ===
            };

            const subscription = fetching data from Nutritionix UPC lookup:', error);
        res.status(500).json({ error: 'Failed to get data for barcode.' });
    }
});


// =================================================================
// 4. PAYMENT & SUBSCRIPTION ENDPOINTS
// =================================================================

app.post('/create-payment', async (req, await razorpay.subscriptions.create(subscriptionOptions);

            await userRef.update({ 
                razor res) => {
    try {
        const { token, isSubscription, amount } = req.body;payCustomerId: customerId,
                razorpaySubscriptionId: subscription.id,
                currentPlan: 'PlanA',
        if (!token) return res.status(400).json({ error: "User token is required." });

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.
                subscriptionStatus: 'created'
            });
            
            return res.json({
                auth_link: subscriptioncollection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
.short_url,
            });
        }
        else {
            const { amount } = req.body;
            if(!amount) return res.status(400).json({ error: "Amount is required for one        if (!userDoc.exists) return res.status(404).json({ error: "User not-time payments." });
            const options = { 
                amount, 
                currency: "INR", found." });
        const userData = userDoc.data();

        // One-Time Payments ke liye
        if (!isSubscription) {
            if(!amount) return res.status(400).json({ error: " 
                receipt: `rcpt_${Date.now()}`
            };
            const order = await razorpayAmount is required for one-time payments." });
            const options = { 
                amount, 
                currency.orders.create(options);
            return res.json({ id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
        }

    } catch (: "INR", 
                receipt: `rcpt_${Date.now()}`
            };
            const ordererror) {
        console.error("Error in /create-payment:", error);
        res.status(500 = await razorpay.orders.create(options);
            return res.json({ id: order.id, amount).json({ error: "Could not create payment/subscription." });
    }
});


app.post('/: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
        }
verify-payment', async (req, res) => {
    // Yeh function sirf one-time payments ke liye hai        
        // Subscription ke liye
        else {
            if (userData.razorpaySubscriptionId && userData.
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, token } = req.body;
        if (!token || !razorpay_order_id ||.subscriptionStatus === 'active') {
                return res.status(400).json({ error: "User already !razorpay_payment_id || !razorpay_signature) {
             return res.status( has an active subscription." });
            }

            let customerId = userData.razorpayCustomerId;
            const userEmail = userData.email || `${decodedToken.uid}@shubhmed-app.com`;
            
400).json({ status: 'failure', message: 'Missing payment details.' });
        }
        const decoded            if (!customerId) {
                try {
                    const customers = await razorpay.customers.all({ email:Token = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users userEmail });
                    if (customers.items.length > 0) {
                        customerId = customers.items[0].').doc(decodedToken.uid);

        let body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAid;
                    }
                } catch (searchError) {
                    console.error("Error searching for customer,ZORPAY_KEY_SECRET)
                                      .update(body.toString()).digest('hex');

        if (expected will create a new one.", searchError);
                }
            }
            
            if (!customerId) {
Signature === razorpay_signature) {
            
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            if (paymentDetails.status === 'authorized') {
                await razorpay.                const customer = await razorpay.customers.create({
                    name: userData.name || 'Shubhmedpayments.capture(razorpay_payment_id, { amount: paymentDetails.amount, currency: "INR User',
                    email: userEmail,
                    contact: userData.phone || undefined
                });
                customerId = customer." });
            }

            const orderDetails = await razorpay.orders.fetch(razorpay_order_idid;
            }

            // === START: ZAROORI BADLAV (The Final Simplified Logic) ===
);
            
            const amountPaid = orderDetails.amount / 100;
            let coinsToAdd =             // Hum ab ek saral ₹1 ka Order banayenge jisme mandate set hoga
            const mandateOrder0;
            if (amountPaid === 100) coinsToAdd = 520;
            else if (Options = {
                amount: 100, // ₹1
                currency: "INR",
                receipt: amountPaid === 200) coinsToAdd = 1030;
            else if (amountPaid`m_rcpt_${Date.now()}`,
                payment: {
                    capture: "automatic",
                    capture === 500) coinsToAdd = 2550;
            else if (amountPaid === 1000) coinsToAdd = 5200;

            if (coinsToAdd > 0) {
                _options: {
                        refund_speed: "normal"
                    }
                },
                customer_idawait userRef.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd) });
            }
: customerId,
                method: "upi",
                token: {
                    "recurring": true,
                    "auth_type": "debit",
                    "max_amount": 200000 //            return res.json({ status: 'success', message: `${coinsToAdd} coins added.` });
            
        } else {
            return res.status(400).json({ status: 'failure', message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error("Error in / ₹2000 in paise
                }
            };

            const order = await razorpay.orders.create(mandateOrderOptions);

            await userRef.update({ 
                razorpayCustomerId: customerId,
                verify-payment:", error);
        res.status(500).json({ error: "Verification failed on// Hum subscription ID ko verification ke baad save karenge
            });
            
            return res.json({
                id: server." });
    }
});


// =================================================================
// 5. WEBSITE SERVING & SERVER order.id,
                amount: order.amount,
                key_id: process.env.RAZORPAY_KEY_ID
            });
            // === END: ZAROORI BADLAV ===
         START
// =================================================================
app.use(express.static(path.join(__dirname, '..')));}

    } catch (error) {
        console.error("Error in /create-payment:", error);
        res.status(500).json({ error: "Could not create payment." });
    }
});



app.get('/Features/water.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'water.html')));
app.get('/Features/Diet.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Diet.htmlapp.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, token } = req.body;
')));
app.get('/Features/Health.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Health.html')));
app.get('*', (req,        if (!token || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
             return res.status(400).json({ status: 'failure', res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// =================================================================
// 6. सर्वर को चालू करें
// ================================================= message: 'Missing payment details.' });
        }
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
================
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()        const userData = (await userRef.get()).data();

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256 => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
