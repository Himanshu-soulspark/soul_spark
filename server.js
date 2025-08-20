// Local Development के लिए dotenv लोड करें (Render पर इसकी आवश्यकता नहीं है)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto'); // Razorpay signature verification के लिए
const admin = require('firebase-admin');
const fetch = require('node-fetch'); // AI API कॉल के लिए, आपको इसे npm install node-fetch करना होगा

const app = express();
const PORT = process.env.PORT || 3000;

// --- Firebase Admin SDK Initialization ---
// Make sure FIREBASE_SERVICE_ACCOUNT_KEY environment variable is set on Render
// as the JSON string of your Firebase service account key.
let serviceAccount;
try {
  // Attempt to parse the environment variable as JSON directly
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (e) {
  // If parsing fails, try base64 decoding (useful if you base64 encoded the JSON)
  try {
    const decodedKey = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decodedKey);
  } catch (e2) {
    console.error('Failed to parse Firebase service account key from environment variable:', e, e2);
    // यह महत्वपूर्ण है: अगर Firebase Admin SDK को सही ढंग से इनिशियलाइज़ नहीं किया जा सकता,
    // तो सर्वर को ठीक से काम करने से रोकने के लिए प्रोसेस को एग्जिट करना चाहिए।
    process.exit(1); 
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://conceptra-c1000-default-rtdb.firebaseio.com" // आपकी Firebase Database URL
});

const db = admin.database();

// --- Middleware ---
app.use(express.json()); // JSON request bodies को पार्स करने के लिए
app.use(express.urlencoded({ extended: true })); // URL-encoded bodies को पार्स करने के लिए

// Static files (your HTML, CSS, JS, images) serve करें
// यह मानता है कि आपकी सारी फ्रंटएंड फाइलें 'public' फोल्डर में हैं
app.use(express.static(path.join(__dirname, 'public')));
// अगर आपकी index.html और images सीधे रूट में हैं, तो आप यह उपयोग कर सकते हैं:
// app.use(express.static(__dirname));


// --- Razorpay Initialization ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// --- Routes ---

// 1. Razorpay ऑर्डर बनाने के लिए एंडपॉइंट
app.post('/create-razorpay-order', async (req, res) => {
  const { amount, currency, userId } = req.body;

  if (!amount || !currency || !userId) {
    return res.status(400).json({ success: false, message: 'Amount, currency, and userId are required.' });
  }

  const options = {
    amount: amount, // Amount in paise/sub-units
    currency: currency,
    receipt: `receipt_order_${userId}_${Date.now()}`,
    payment_capture: 1 // 1 = auto capture, 0 = manual capture
  };

  try {
    const order = await razorpay.orders.create(options);
    console.log('Razorpay Order Created:', order);
    res.status(200).json({ success: true, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, message: 'Failed to create Razorpay order', error: error.message });
  }
});

// 2. Razorpay भुगतान को सत्यापित करने और सिक्के अपडेट करने के लिए एंडपॉइंट
app.post('/verify-razorpay-payment', async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    userId,
    coinsToAdd // यह frontend से भेजा जाएगा
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || coinsToAdd === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required payment verification parameters.' });
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;

  // Signature verification using crypto module
  const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                  .update(body.toString())
                                  .digest('hex');

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    try {
      // Payment successful and verified. Now update user coins in Firebase.
      const userCoinsRef = db.ref(`users/${userId}/coins`);

      await userCoinsRef.transaction((currentCoins) => {
        // अगर currentCoins null या undefined है, तो उसे 0 मान लें
        const initialCoins = currentCoins === null ? 0 : currentCoins;
        return initialCoins + coinsToAdd;
      });

      console.log(`User ${userId} successfully added ${coinsToAdd} coins. Payment ID: ${razorpay_payment_id}`);
      res.status(200).json({ success: true, message: 'Payment verified and coins updated.' });

    } catch (error) {
      console.error('Error updating coins in Firebase:', error);
      res.status(500).json({ success: false, message: 'Payment verified, but failed to update coins.', error: error.message });
    }
  } else {
    console.warn('Payment signature verification failed for order:', razorpay_order_id);
    res.status(400).json({ success: false, message: 'Payment verification failed: Invalid signature.' });
  }
});

// 3. AI सवाल पूछने और सिक्के काटने के लिए नया एंडपॉइंट
app.post('/ask-ai', async (req, res) => {
  const { userId, question } = req.body;
  const AI_COST = 2; // AI फीचर के लिए 2 सिक्के

  if (!userId || !question) {
    return res.status(400).json({ success: false, message: 'User ID and question are required.' });
  }

  const userCoinsRef = db.ref(`users/${userId}/coins`);
  let currentCoins = 0;
  let transactionResult;

  try {
    // ट्रांजेक्शन का उपयोग करके सिक्के को सुरक्षित रूप से अपडेट करें
    transactionResult = await userCoinsRef.transaction((data) => {
      currentCoins = data === null ? 0 : data; // अगर कोई डेटा नहीं है तो 0 सिक्के मान लें

      if (currentCoins >= AI_COST) {
        return currentCoins - AI_COST; // सिक्के घटाएँ
      } else {
        return undefined; // ट्रांजेक्शन रद्द करें अगर पर्याप्त सिक्के नहीं हैं
      }
    });

    if (transactionResult.committed) {
      // सिक्के सफलतापूर्वक काट लिए गए हैं, अब AI को कॉल करें

      // Vertex AI API कॉल के लिए प्लेसहोल्डर
      // आपको इसे अपने वास्तविक Vertex AI इंटीग्रेशन से बदलना होगा
      const vertexAiEndpoint = 'YOUR_VERTEX_AI_API_ENDPOINT'; // उदाहरण: https://REGION-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/LOCATION/publishers/google/models/MODEL_ID:predict
      const accessToken = process.env.DAREPLAY_SECRETS; // Render environment variable से API कुंजी

      if (!vertexAiEndpoint || !accessToken) {
          console.error("Vertex AI endpoint or access token not configured.");
          return res.status(500).json({ success: false, message: "AI service is not configured properly on the server." });
      }

      try {
        const aiResponse = await fetch(vertexAiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, // या आपकी API कुंजी कैसे प्रमाणीकृत होती है
          },
          body: JSON.stringify({
            // यहाँ Vertex AI के लिए आपका इनपुट स्ट्रक्चर होगा
            // यह आपके द्वारा उपयोग किए जा रहे विशिष्ट मॉडल पर निर्भर करेगा
            instances: [{ prompt: question }], // Generative models के लिए उदाहरण
            parameters: {
              temperature: 0.7,
              maxOutputTokens: 200,
              topK: 40,
              topP: 0.95,
            },
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`Vertex AI API error: ${aiResponse.status} - ${errorText}`);
          throw new Error(`AI API failed with status ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        // AI रिस्पांस को पार्स करें (यह आपके AI मॉडल के आउटपुट फॉर्मेट पर निर्भर करेगा)
        const answer = aiData.predictions && aiData.predictions[0] && aiData.predictions[0].content ? aiData.predictions[0].content : "Could not get a clear answer from AI.";

        res.status(200).json({ success: true, answer: answer, coinsRemaining: currentCoins - AI_COST });

      } catch (aiApiError) {
        console.error('Error calling Vertex AI API:', aiApiError);
        // AI API कॉल विफल होने पर सिक्के वापस करने का विकल्प यहाँ जोड़ा जा सकता है,
        // लेकिन यह ट्रांजेक्शन लॉजिक को जटिल करेगा। सादगी के लिए, अभी सिक्के काट दिए जाएंगे।
        res.status(500).json({ success: false, message: 'Failed to get a response from AI.' });
      }

    } else {
      // ट्रांजेक्शन कमिट नहीं हुआ (मतलब पर्याप्त सिक्के नहीं थे)
      res.status(403).json({ success: false, message: `Not enough coins. ${AI_COST} coins required.` });
    }

  } catch (error) {
    console.error('Error during AI coin deduction transaction:', error);
    res.status(500).json({ success: false, message: 'Server error during AI request.' });
  }
});


// Root route (optional, if you're serving index.html directly)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
  // अगर आपकी index.html सीधे रूट में है, तो यह होगा:
  // res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Frontend served from: ${path.join(__dirname, 'public')}`);
});
