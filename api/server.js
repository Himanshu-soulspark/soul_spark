// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
// =================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Razorpay = require('razorpay');
const path = require('path');
const axios = require('axios'); // <<<--- मौसम और पोषण की जानकारी के लिए नया पैकेज
const { google } = require('googleapis'); // <<<--- YouTube वीडियो खोजने के लिए नया पैकेज

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

// Express सर्वर बनाएँ
const app = express();
app.use(cors());
app.use(express.json());

// --- Firebase Admin SDK को शुरू करें (API Key 1: FIREBASE_SERVICE_ACCOUNT) ---
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

// --- Google AI (Gemini) को शुरू करें (API Key 2: GEMINI_API_KEY) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
console.log("Google Generative AI initialized.");


// --- Razorpay को शुरू करें (API Key 3 & 4: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("Razorpay initialized.");

// --- YouTube API को शुरू करें (API Key 5: YOUTUBE_API_KEY) ---
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});
console.log("YouTube API initialized.");

// Nutritionix और Weather API Keys को सीधे इस्तेमाल किया जाएगा, उनके लिए अलग से ऑब्जेक्ट बनाने की ज़रूरत नहीं है।
// (API Key 6: NUTRITIONIX_API_KEY, API Key 7: USDA_API_KEY, API Key 8: WEATHER_API_KEY)


// =================================================================
// 3. API Endpoints (आपके सर्वर के रास्ते)
// =================================================================

// --- (मौजूदा) AI से दवा-भोजन इंटरेक्शन पूछने वाला Endpoint ---
app.post('/get-food-interaction', async (req, res) => {
  try {
    const { medicines, token } = req.body;
    if (!token || !medicines) return res.status(400).json({ error: "Token and medicines are required." });
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
    
    const userData = userDoc.data();
    const COIN_COST = 2;
    if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don't have enough coins (minimum 2 required)." });

    const promptForJson = `Analyze food interactions for: ${medicines}. Respond ONLY with a valid JSON object. The JSON must have three keys: "avoid", "limit", and "safe", each with an array of strings. If a category is empty, provide an empty array. Example: {"avoid": ["Alcohol"], "limit": [], "safe": ["Vegetables"]}`;
    const result = await aiModel.generateContent(promptForJson);
    const aiAnswer = result.response.text();

    await userRef.update({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });
    res.json({ answer: aiAnswer });
  } catch (error) {
    console.error("Error in /get-food-interaction:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- (मौजूदा) AI से सामान्य सवाल और आर्टिकल पूछने वाला Endpoint ---
app.post('/ask-ai', async (req, res) => {
  try {
    const { question, token } = req.body;
    if (!token || !question) return res.status(400).json({ error: "Token and question are required." });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found." });

    const userData = userDoc.data();
    const COIN_COST = 1;
    if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don't have enough coins (minimum 1 required)." });

    const result = await aiModel.generateContent(question);
    const aiAnswer = result.response.text();

    await userRef.update({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });
    res.json({ answer: aiAnswer });
  } catch (error) {
    console.error("Error in /ask-ai:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- (मौजूदा) AI डाइट प्लान बनाने वाला Endpoint ---
app.post('/generate-diet-plan', async (req, res) => {
  try {
    const { prompt, token } = req.body;
    if (!token || !prompt) return res.status(400).json({ error: "Token and prompt are required." });
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
    
    const userData = userDoc.data();
    const COIN_COST = 1; 
    if (userData.coins < COIN_COST) return res.status(403).json({ error: "You don't have enough coins (minimum 1 required)." });
    
    const result = await aiModel.generateContent(prompt);
    const aiAnswer = result.response.text();
    
    await userRef.update({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });
    res.json({ answer: aiAnswer });
  } catch (error) {
    console.error("Error in /generate-diet-plan:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- (नया) YouTube वीडियो खोजने वाला Endpoint ---
app.get('/get-youtube-videos', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query is required.' });
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: `${query} exercise tutorial hindi`,
            maxResults: 5,
            type: 'video'
        });
        res.json(response.data.items);
    } catch (error) {
        console.error('Error fetching YouTube videos:', error);
        res.status(500).json({ error: 'Could not fetch YouTube videos.' });
    }
});

// --- (नया) मौसम के हिसाब से स्वास्थ्य सलाह देने वाला Endpoint ---
app.get('/get-weather-advice', async (req, res) => {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required.' });
    try {
        const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
            params: {
                q: city,
                appid: process.env.WEATHER_API_KEY,
                units: 'metric'
            }
        });
        const weather = weatherResponse.data;
        const advicePrompt = `Based on this weather in ${city}: temperature is ${weather.main.temp}°C, humidity is ${weather.main.humidity}%, and condition is ${weather.weather[0].description}. Provide a short, simple health tip in Hindi.`;
        
        const result = await aiModel.generateContent(advicePrompt);
        const advice = result.response.text();
        res.json({ advice });
    } catch (error) {
        console.error('Error getting weather advice:', error);
        res.status(500).json({ error: 'Could not get weather advice.' });
    }
});

// --- (नया) भोजन की पोषण जानकारी देने वाला Endpoint ---
app.get('/get-nutrition-info', async (req, res) => {
    const { food } = req.query;
    if (!food) return res.status(400).json({ error: 'Food item is required.' });
    try {
        // सबसे पहले Nutritionix (ब्रांडेड भोजन) से खोजने की कोशिश करें
        const nutritionixResponse = await axios.post('https://trackapi.nutritionix.com/v2/natural/nutrients', {
            query: food
        }, {
            headers: {
                'x-app-id': process.env.NUTRITIONIX_APP_ID, // ज़रूरी: Render में NUTRITIONIX_APP_ID भी डालें
                'x-app-key': process.env.NUTRITIONIX_API_KEY
            }
        });
        if (nutritionixResponse.data && nutritionixResponse.data.foods && nutritionixResponse.data.foods.length > 0) {
            return res.json({ source: 'Nutritionix', data: nutritionixResponse.data.foods[0] });
        }
    } catch (nutritionixError) {
        console.log("Nutritionix failed, trying USDA...");
        // अगर Nutritionix से नहीं मिला, तो USDA (साधारण भोजन) से खोजें
        try {
            const usdaResponse = await axios.get('https://api.nal.usda.gov/fdc/v1/foods/search', {
                params: {
                    query: food,
                    api_key: process.env.USDA_API_KEY
                }
            });
            if (usdaResponse.data && usdaResponse.data.foods && usdaResponse.data.foods.length > 0) {
                return res.json({ source: 'USDA', data: usdaResponse.data.foods[0] });
            }
        } catch (usdaError) {
            console.error('USDA API Error:', usdaError);
        }
    }
    // अगर कहीं से भी जानकारी नहीं मिली
    res.status(404).json({ error: 'Could not find nutritional information for this item.' });
});

// --- (मौजूदा) Razorpay पेमेंट बनाने वाले Endpoints ---
app.post('/create-payment', async (req, res) => {
    try {
      const { amount, token } = req.body;
      if (!token || !amount) return res.status(400).json({ error: "Amount and user token are required." });
      await admin.auth().verifyIdToken(token);
      const options = { amount, currency: "INR", receipt: `receipt_order_${Date.now()}` };
      const order = await razorpay.orders.create(options);
      res.json({ id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
      console.error("Error in /create-payment endpoint:", error);
      res.status(500).json({ error: "Could not create payment order." });
    }
});
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, token } = req.body;
        const crypto = require('crypto');
        if (!token) return res.status(400).json({ error: "User token is required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex');
        if (expectedSignature === razorpay_signature) {
            const userRef = db.collection('users').doc(decodedToken.uid);
            await userRef.update({ coins: admin.firestore.FieldValue.increment(5) });
            res.json({ status: 'success', message: 'Payment verified and coins added.' });
        } else {
            res.status(400).json({ status: 'failure', message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error("Error in /verify-payment endpoint:", error);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// =================================================================
// 5. वेबसाइट की फाइलों को दिखाने के लिए कोड
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/Features/water.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'water.html')));
app.get('/Features/Diet.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Diet.html')));
app.get('/Features/Health.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Health.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// =================================================================
// 6. सर्वर को चालू करें
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
