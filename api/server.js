async function getAIResponseFromGemini(prompt) {
    // ... सारा नकली (simulation) कोड ...
}```

इस **नए और असली फ़ंक्शन** से बदल दें:

```javascript
async function getAIResponseFromGemini(logData) {
    try {
        // Firebase से वर्तमान यूज़र का टोकन प्राप्त करें
        const user = auth.currentUser;
        if (!user) {
            throw new Error("User not authenticated. Please sign in again.");
        }
        const token = await user.getIdToken();

        // अपने Render सर्वर पर नए endpoint को कॉल करें
        const response = await fetch('/analyze-self-exam-log', { // यह आपके सर्वर का सही रास्ता है
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                logData: logData, // लॉग डेटा भेजें
                token: token      // यूज़र का टोकन भेजें
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            // अगर सर्वर से कोई त्रुटि आती है (जैसे 'सिक्के कम हैं'), तो उसे दिखाएं
            throw new Error(data.answer || data.error || 'An error occurred.');
        }

        return data.answer; // सर्वर से आया AI का जवाब वापस करें

    } catch (error) {
        console.error("Error fetching AI response from server:", error);
        // यूज़र को त्रुटि दिखाएं
        return `Error: ${error.message}`;
    }
}

// *** सुनिश्चित करें कि आप handleAiFormSubmit को भी थोड़ा बदलें ***
async handleAiFormSubmit(event) {
    event.preventDefault();
    const // =================================================================
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
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
console.log("Google Generative AI initialized.");

// --- Razorpay को शुरू करें ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("Razorpay initialized.");

// --- YouTube API को शुरू करें ---
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});
console.log("YouTube API initialized.");

// =================================================================
// 3. API Endpoints (आपके सर्वर के रास्ते)
// =================================================================

// --- (सुधारा हुआ) AI से दवा-भोजन इंटरेक्शन पूछने वाला Endpoint ---
app.post('/get-food-interaction', async(req, res) => {
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

        const improvedPrompt = `
          You are an expert AI Health Assistant. A user is taking these medicines: ${medicines}.

          Your task is to provide a detailed food interaction guide. The response MUST be a valid JSON object ONLY, with no extra text or markdown. The entire response, including all food names and reasons, MUST be in simple Hindi (Devanagari script).

          The JSON object must have three keys: "avoid", "limit", and "safe".

          1. "avoid": An array of objects for foods to completely avoid. Each object must have "item" and "reason" keys.
          2. "limit": An array of objects for foods to eat in limited quantity. Each object must also have "item" and "reason" keys.
          3. "safe": An array of strings listing at least 5 examples of safe foods in Hindi.

          For the medicines ${medicines}, be sure to include critical interactions. If there's no specific info for a category, provide an empty array [].
        `;

        const result = await aiModel.generateContent(improvedPrompt);
        const aiAnswer = result.response.text();

        await userRef.update({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });
        res.json({ answer: aiAnswer });

    } catch (error) {
        console.error("Error in /get-food-interaction:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- (मौजूदा) AI से सामान्य सवाल और आर्टिकल पूछने वाला Endpoint ---
app.post('/ask-ai', async(req, res) => {
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

// =================================================================
// --- (नया और अपडेट किया गया) AI MEDICAL ASSISTANT के लिए विशेष ENDPOINT ---
// =================================================================
app.post('/assistant-chat', async(req, res) => {
    try {
        const { question, token } = req.body;
        if (!token || !question) {
            return res.status(400).json({ error: "Token and question are required." });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found." });

        const userData = userDoc.data();

        const assistantPrompt = `
          You are a caring and empathetic female AI medical assistant named 'Shubh'. 
          Respond in the same language as the user's question. 
          You can generate a detailed response, up to 4500 characters if needed.

          When a user mentions a medical symptom or illness (like 'पेट दर्द', 'fever', 'headache', etc.), you MUST follow this three-part structure in your response:
          1.  **Immediate Relief:** Start by suggesting some simple, safe home remedies or general advice for initial comfort. For example, for a stomach ache, suggest warm water, ginger tea, or avoiding spicy food.
          2.  **General Medication:** Suggest ONLY common, general-purpose, over-the-counter (OTC) medicines that are typically used for the symptom. For a stomach ache, you could mention an antacid. Be very generic.
          3.  **Crucial Disclaimer:** ALWAYS end your response with a strong, clear disclaimer. You must state: 'यह सलाह केवल शुरुआती राहत के लिए है। किसी भी दवा को लेने से पहले कृपया डॉक्टर से सलाह ज़रूर लें। आपकी सही स्थिति का मूल्यांकन एक योग्य चिकित्सक ही कर सकते हैं।' (This advice is for initial relief only. Please consult a doctor before taking any medication. Only a qualified physician can properly evaluate your condition.)

          User's question is: "${question}"
        `;

        const result = await aiModel.generateContent(assistantPrompt);
        const aiAnswer = result.response.text();

        const responseLength = aiAnswer.length;
        let coinCost = Math.ceil(responseLength / 1000) * 2;
        
        if (responseLength > 0 && coinCost === 0) {
             coinCost = 2;
        }
        
        if (coinCost > 0) {
            if (userData.coins < coinCost) {
                return res.status(403).json({ answer: `इस जवाब के लिए ${coinCost} सिक्कों की ज़रूरत है, लेकिन आपके पास पर्याप्त सिक्के नहीं हैं।` });
            }
            await userRef.update({ coins: admin.firestore.FieldValue.increment(-coinCost) });
        }

        res.json({ answer: aiAnswer });

    } catch (error) {
        console.error("Error in /assistant-chat:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});


// =================================================================
// --- (नया फंक्शन सिर्फ Women's Health के लिए) ---
// =================================================================
app.post('/analyze-self-exam-log', async (req, res) => {
    try {
        // 1. फ्रंटएंड से लॉग डेटा और टोकन प्राप्त करें
        const { logData, token } = req.body;
        if (!token || !logData) {
            return res.status(400).json({ error: "User token and log data are required." });
        }

        // 2. यूज़र को प्रमाणित करें और उसका डेटा प्राप्त करें
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: "User not found." });
        }
        const userData = userDoc.data();

        // 3. AI के लिए एक विस्तृत प्रॉम्प्ट तैयार करें
        let logSummary = '';
        for (const key in logData) {
            if (logData[key]) { // केवल वही डेटा भेजें जो मौजूद है
                 const formattedKey = key.replace(/_/g, ' ').replace('log q', 'Question ');
                 logSummary += `- ${formattedKey}: ${logData[key]}\n`;
            }
        }

        const analysisPrompt = `
          You are a supportive and professional AI Health Assistant. Your task is to analyze a breast self-exam log from a user.
          Your entire response MUST be in simple, empathetic Hindi.

          Based on the following user log, provide a clear health analysis:
          --- User Log ---
          ${logSummary}
          ----------------

          Follow these three strict rules for your response structure:
          1.  If the log contains any high-risk indicators like "lump: yes" or "nipple discharge: yes", your primary message MUST be to strongly and immediately recommend consulting a doctor. Start your response with the heading 'अत्यंत महत्वपूर्ण सलाह:'.
          2.  If the log contains moderate-risk indicators like "skin changes: yes" or "asymmetry: yes" (but no high-risk signs), recommend monitoring the changes and scheduling a routine check-up with a doctor soon. Start your response with the heading 'ध्यान देने योग्य जानकारी:'.
          3.  If the log contains no risk indicators at all, provide positive reinforcement for performing the self-exam and encourage them to continue doing it monthly. Start your response with the heading 'बहुत अच्छी रिपोर्ट:'.
          
          ALWAYS include this exact disclaimer at the very end of your response, on a new line: 'कृपया ध्यान दें: यह AI विश्लेषण किसी भी तरह से मेडिकल सलाह का विकल्प नहीं है। किसी भी चिंता के लिए कृपया डॉक्टर से परामर्श करें।'
        `;

        // 4. Gemini AI को कॉल करें
        const result = await aiModel.generateContent(analysisPrompt);
        const aiAnswer = result.response.text();

        // 5. जवाब की लंबाई के आधार पर सिक्के की लागत की गणना करें
        const responseLength = aiAnswer.length;
        let coinCost = Math.ceil(responseLength / 1000) * 2;

        if (responseLength > 0 && coinCost === 0) {
            coinCost = 2;
        }

        // 6. यूज़र के सिक्के जांचें और काटें
        if (coinCost > 0) {
            if (userData.coins < coinCost) {
                return res.status(403).json({ answer: `इस विश्लेषण के लिए ${coinCost} सिक्कों की आवश्यकता है, लेकिन आपके पास पर्याप्त सिक्के नहीं हैं।` });
            }
            await userRef.update({ coins: admin.firestore.FieldValue.increment(-coinCost) });
        }

        // 7. जवाब वापस भेजें
        res.json({ answer: aiAnswer });

    } catch (error) {
        console.error("Error in /analyze-self-exam-log:", error);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});


// --- (मौजूदा) AI डाइट प्लान बनाने वाला Endpoint ---
app.post('/generate-diet-plan', async(req, res) => {
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

// --- (मौजूदा) YouTube वीडियो खोजने वाला Endpoint ---
app.get('/get-youtube-videos', async(req, res) => {
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

// --- (मौजूदा) मौसम के हिसाब से स्वास्थ्य सलाह देने वाला Endpoint ---
app.get('/get-weather-advice', async(req, res) => {
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

// --- (नया) LocationIQ से पता प्राप्त करने वाला Endpoint ---
app.get('/get-address-from-coords', async(req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required.' });
    }

    try {
        const response = await axios.get('https://us1.locationiq.com/v1/reverse.php', {
            params: {
                key: process.env.LOCATIONIQ_API_KEY,
                lat: lat,
                lon: lon,
                format: 'json'
            }
        });

        if (response.data && response.data.display_name) {
            res.json({ address: response.data.display_name });
        } else {
            res.status(404).json({ error: 'Could not find address for these coordinates.' });
        }
    } catch (error) {
        console.error('Error fetching address from LocationIQ:', error.message);
        res.status(500).json({ error: 'Failed to get address from location service.' });
    }
});


// --- (मौजूदा) भोजन की पोषण जानकारी देने वाला Endpoint ---
app.get('/get-nutrition-info', async(req, res) => {
    const { food } = req.query;
    if (!food) return res.status(400).json({ error: 'Food item is required.' });
    try {
        const nutritionixResponse = await axios.post('https://trackapi.nutritionix.com/v2/natural/nutrients', {
            query: food
        }, {
            headers: {
                'x-app-id': process.env.NUTRITIONIX_APP_ID,
                'x-app-key': process.env.NUTRITIONIX_API_KEY
            }
        });
        if (nutritionixResponse.data && nutritionixResponse.data.foods && nutritionixResponse.data.foods.length > 0) {
            return res.json({ source: 'Nutritionix', data: nutritionixResponse.data.foods[0] });
        }
    } catch (nutritionixError) {
        console.log("Nutritionix failed, trying USDA...");
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
    res.status(404).json({ error: 'Could not find nutritional information for this item.' });
});

// --- (नया और अत्यंत आवश्यक) बारकोड से भोजन की जानकारी देने वाला Endpoint ---
app.get('/get-info-by-barcode', async(req, res) => {
    const { upc } = req.query;
    if (!upc) {
        return res.status(400).json({ error: 'UPC (barcode) is required.' });
    }
    try {
        const response = await axios.get(`https://trackapi.nutritionix.com/v2/search/item`, {
            params: {
                upc: upc
            },
            headers: {
                'x-app-id': process.env.NUTRITIONIX_APP_ID,
                'x-app-key': process.env.NUTRITIONIX_API_KEY
            }
        });

        if (response.data && response.data.foods && response.data.foods.length > 0) {
            res.json({ source: 'Nutritionix UPC', data: response.data.foods[0] });
        } else {
            res.status(404).json({ error: 'Could not find food item for this barcode.' });
        }
    } catch (error) {
        console.error('Error fetching data from Nutritionix UPC lookup:', error);
        res.status(500).json({ error: 'Failed to get data for barcode.' });
    }

});

// --- (मौजूदा) Razorpay पेमेंट बनाने वाले Endpoints ---
app.post('/create-payment', async(req, res) => {
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

app.post('/verify-payment', async(req, res) => {
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
