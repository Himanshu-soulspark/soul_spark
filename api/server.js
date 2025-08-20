// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
// =================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Razorpay = require('razorpay');
const path = require('path'); // <<<--- यह नई लाइन है

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

// Express सर्वर बनाएँ
const app = express();
app.use(cors());
app.use(express.json());

// --- Firebase Admin SDK को शुरू करें ---
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
}
const db = admin.firestore();

// --- Google AI (Gemini) को शुरू करें ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
console.log("Google Generative AI initialized.");


// --- Razorpay को शुरू करें ---
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
  // (यह कोड वैसा ही रहेगा, कोई बदलाव नहीं)
  try {
    const { question, token } = req.body;
    if (!token || !question) {
      return res.status(400).json({ error: "User token and question are required." });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found." });
    }
    const userData = userDoc.data();
    const COIN_COST = 2;
    if (userData.coins < COIN_COST) {
      return res.status(403).json({ error: "You don't have enough coins (minimum 2 required)." });
    }
    const result = await aiModel.generateContent(question);
    const response = await result.response;
    const aiAnswer = response.text();
    await userRef.update({
      coins: admin.firestore.FieldValue.increment(-COIN_COST)
    });
    res.json({ answer: aiAnswer });
  } catch (error) {
    console.error("Error in /ask-ai endpoint:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});


// --- Razorpay पेमेंट ऑर्डर बनाने वाला Endpoint ---
app.post('/create-payment', async (req, res) => {
  // (यह कोड वैसा ही रहेगा, कोई बदलाव नहीं)
  try {
    const { amount, token } = req.body;
    if (!token || !amount) {
        return res.status(400).json({ error: "Amount and user token are required." });
    }
    await admin.auth().verifyIdToken(token);
    const options = {
      amount: amount,
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
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
    // (यह कोड वैसा ही रहेगा, कोई बदलाव नहीं)
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, token } = req.body;
        const crypto = require('crypto');
        if (!token) {
            return res.status(400).json({ error: "User token is required." });
        }
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        if (expectedSignature === razorpay_signature) {
            const userRef = db.collection('users').doc(uid);
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
// 5. वेबसाइट की फाइलों को दिखाने के लिए कोड (यह नया सेक्शन है)
// =================================================================
// यह Render को बताता है कि आपकी वेबसाइट की फाइलें कहाँ रखी हैं।
app.use(express.static(path.join(__dirname, '..')));

// यह सुनिश्चित करता है कि water.html का लिंक भी काम करे।
app.get('/water.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Features', 'water.html'));
});

// बाकी सभी रिक्वेस्ट के लिए index.html दिखाएं।
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// =================================================================
// 6. सर्वर को चालू करें
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
