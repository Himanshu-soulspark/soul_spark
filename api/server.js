// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
// =================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Razorpay = require('razorpay');

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

// Express सर्वर बनाएँ
const app = express();
app.use(cors()); // CORS को इनेबल करें ताकि आपकी वेबसाइट इस सर्वर से बात कर सके
app.use(express.json()); // आने वाली JSON रिक्वेस्ट को पढ़ने के लिए

// --- Firebase Admin SDK को शुरू करें ---
// यह Render के Environment Variable से आपकी सर्विस अकाउंट की जानकारी पढ़ेगा
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  console.error("Please ensure FIREBASE_SERVICE_ACCOUNT environment variable is set correctly.");
}
const db = admin.firestore();

// --- Google AI (Gemini) को शुरू करें ---
// यह Render के Environment Variable से Gemini API Key पढ़ेगा
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
console.log("Google Generative AI initialized.");


// --- Razorpay को शुरू करें ---
// यह Render के Environment Variable से Razorpay Keys पढ़ेगा
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("Razorpay initialized.");


// =================================================================
// 3. API Endpoints (आपके सर्वर के रास्ते)
// =================================================================

// --- AI से सवाल पूछने और सिक्के काटने वाला Endpoint ---
app.post('/ask-ai', async (req, res) => {
  try {
    const { question, token } = req.body;

    if (!token || !question) {
      return res.status(400).json({ error: "User token and question are required." });
    }

    // यूजर के टोकन को वेरिफाई करें ताकि पता चले कि यह एक असली यूजर है
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found." });
    }

    const userData = userDoc.data();
    const COIN_COST = 2;

    // चेक करें कि यूजर के पास पर्याप्त सिक्के हैं या नहीं
    if (userData.coins < COIN_COST) {
      return res.status(403).json({ error: "You don't have enough coins (minimum 2 required)." });
    }

    // AI से जवाब मांगें
    const result = await aiModel.generateContent(question);
    const response = await result.response;
    const aiAnswer = response.text();

    // सिक्के काटें
    await userRef.update({
      coins: admin.firestore.FieldValue.increment(-COIN_COST)
    });

    // AI का जवाब भेजें
    res.json({ answer: aiAnswer });

  } catch (error) {
    console.error("Error in /ask-ai endpoint:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});


// --- Razorpay पेमेंट ऑर्डर बनाने वाला Endpoint ---
app.post('/create-payment', async (req, res) => {
  try {
    const { amount, token } = req.body;

    if (!token || !amount) {
        return res.status(400).json({ error: "Amount and user token are required." });
    }

    // यूजर को वेरिफाई करें
    await admin.auth().verifyIdToken(token);

    const options = {
      amount: amount, // अमाउंट पैसे में होना चाहिए (जैसे, ₹1 के लिए 100)
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    
    // ऑर्डर की जानकारी और आपकी Key ID वापस भेजें
    res.json({
        id: order.id,
        amount: order.amount,
        key_id: process.env.RAZORPAY_KEY_ID 
    });

  } catch (error) {
    console.error("Error in /create-payment endpoint:", error);
    res.status(500).json({ error: "Could not create payment order." });
  }
});


// --- Razorpay पेमेंट को वेरिफाई करने वाला Endpoint ---
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, token } = req.body;
        const crypto = require('crypto');

        if (!token) {
            return res.status(400).json({ error: "User token is required." });
        }

        // यूजर को वेरिफाई करें
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // पेमेंट सिग्नेचर को वेरिफाई करें
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // पेमेंट सही है, अब सिक्के जोड़ें
            const userRef = db.collection('users').doc(uid);
            // ₹1 में 5 सिक्के जोड़ें
            await userRef.update({
                coins: admin.firestore.FieldValue.increment(5)
            });
            res.json({ status: 'success', message: 'Payment verified and coins added.' });
        } else {
            res.status(400).json({ status: 'failure', message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error("Error in /verify-payment endpoint:", error);
        res.status(500).json({ error: "An internal server error occurred during verification." });
    }
});


// =================================================================
// 4. सर्वर को चालू करें
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
