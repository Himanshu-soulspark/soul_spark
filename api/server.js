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

// Express सर्वर बनाएँ
const app = express();
app.use(cors());
// बॉडी पार्सर की लिमिट बढ़ाएँ ताकि base64 इमेज आसानी से आ सके
app.use(express.json({ limit: '10mb' }));

// --- Firebase Admin SDK को शुरू करें ---
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("\n\n❌❌❌ FATAL ERROR: Firebase Admin SDK could not be initialized. ❌❌❌");
  console.error("REASON:", error.message);
  console.error("\nSOLUTION: Please check your 'FIREBASE_SERVICE_ACCOUNT' environment variable in Render.\n");
  process.exit(1);
}
const db = admin.firestore();

// --- Google AI (Gemini) को शुरू करें ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
console.log("✅ Google Generative AI initialized.");

// --- Razorpay को शुरू करें ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");

// --- YouTube API को शुरू करें ---
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});
console.log("✅ YouTube API initialized.");

console.log("🔑 Face++ API Key Loaded:", process.env.FACEPP_API_KEY ? "Yes" : "No");


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
      "avoid": An array of objects for foods to completely avoid. Each object must have "item" and "reason" keys.
      "limit": An array of objects for foods to eat in limited quantity. Each object must also have "item" and "reason" keys.
      "safe": An array of strings listing at least 5 examples of safe foods in Hindi.
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

      Immediate Relief: Start by suggesting some simple, safe home remedies or general advice for initial comfort. For example, for a stomach ache, suggest warm water, ginger tea, or avoiding spicy food.

      General Medication: Suggest ONLY common, general-purpose, over-the-counter (OTC) medicines that are typically used for the symptom. For a stomach ache, you could mention an antacid. Be very generic.

      Crucial Disclaimer: ALWAYS end your response with a strong, clear disclaimer. You must state: 'यह सलाह केवल शुरुआती राहत के लिए है। किसी भी दवा को लेने से पहले कृपया डॉक्टर से सलाह ज़रूर लें। आपकी सही स्थिति का मूल्यांकन एक योग्य चिकित्सक ही कर सकते हैं।' (This advice is for initial relief only. Please consult a doctor before taking any medication. Only a qualified physician can properly evaluate your condition.)

      User's question is: "${question}"
    `;

    const result = await aiModel.generateContent(assistantPrompt);
    const aiAnswer = result.response.text();

    const responseLength = aiAnswer.length;
    let coinCost = Math.ceil(responseLength / 1000) * 2;

    if (coinCost === 0 && responseLength > 0) {
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


// =================================================================
// --- !!! नया FACE++ स्किन एनालिसिस ENDPOINT !!! ---
// =================================================================
app.post('/analyze-skin', async (req, res) => {
    try {
        const { imageBase64, token } = req.body;

        if (!token || !imageBase64) {
            return res.status(400).json({ error: "Token and image data are required." });
        }
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: "User not found." });
        }

        const userData = userDoc.data();
        const COIN_COST = 1;
        if (userData.coins < COIN_COST) {
            return res.status(403).json({ error: "You don't have enough credits for a Quick Scan." });
        }

        const apiKey = process.env.FACEPP_API_KEY;
        const apiSecret = process.env.FACEPP_API_SECRET;
        if (!apiKey || !apiSecret) {
            throw new Error("Face++ API credentials are not set on the server.");
        }

        const formData = new FormData();
        formData.append('api_key', apiKey);
        formData.append('api_secret', apiSecret);
        formData.append('image_base64', imageBase64);
        formData.append('return_attributes', 'skinstatus');
        
        const faceppResponse = await axios.post('https://api-us.faceplusplus.com/facepp/v3/detect', formData, {
            headers: formData.getHeaders()
        });

        if (faceppResponse.data && faceppResponse.data.faces && faceppResponse.data.faces.length > 0) {
            
            await userRef.update({ coins: admin.firestore.FieldValue.increment(-COIN_COST) });

            const skinStatus = faceppResponse.data.faces[0].attributes.skinstatus;
            
            const analysisResult = {
                health: skinStatus.health,
                blemishes: skinStatus.acne.length + skinStatus.stain.length,
                darkCircle: skinStatus.dark_circle,
            };

            res.json({ success: true, data: analysisResult });

        } else {
            res.status(404).json({ error: "Could not detect a face in the image. Please try again with a clearer picture." });
        }

    } catch (error) {
        console.error("Error in /analyze-skin:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "An error occurred during skin analysis." });
    }
});


// --- (मौजूदा) YouTube वीडियो खोजने वाला Endpoint ---
app.get('/get-youtube-videos', async(req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({error: 'Search query is required.' });
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
        const weatherResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
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
        const nutritionixResponse = await axios.post('https://trackapi.nutritionix.com/v2/natural/nutrients', { query: food }, {
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
        const response = await axios.get('https://trackapi.nutritionix.com/v2/search/item', {
            params: { upc: upc },
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


// =================================================================
// --- PAYMENT ENDPOINTS (नए प्लान्स के लिए अपडेट किए गए) ---
// =================================================================

// --- (ZAROORI BADLAV) यह Endpoint अब अलग-अलग अमाउंट को हैंडल कर सकता है ---
app.post('/create-payment', async(req, res) => {
    try {
        const { amount, token, isSubscription } = req.body;
        if (!token || !amount) return res.status(400).json({ error: "Amount and user token are required." });
        
        // यूजर को वेरिफाई करें
        await admin.auth().verifyIdToken(token);
        
        // --- सब्सक्रिप्शन का लॉजिक यहाँ आएगा ---
        if (isSubscription) {
            // यह एक एडवांस टॉपिक है। यहाँ आपको Razorpay का 'plan' बनाना होगा और फिर 'subscription' बनाना होगा।
            // अभी के लिए, हम इसे एक सामान्य पेमेंट की तरह ही प्रोसेस करेंगे।
            // असल में, आपको यहाँ यह कोड लिखना होगा:
            // 1. razorpay.plans.create(...) से एक प्लान बनाएँ (e.g., ₹100 हर 18 घंटे में)।
            // 2. razorpay.subscriptions.create(...) से उस प्लान के लिए सब्सक्रिप्शन बनाएँ।
            // 3. क्लाइंट को subscription_id भेजें।
            console.log("Subscription flow initiated, but acting as a normal payment for now.");
        }

        const options = { 
            amount: amount, // अमाउंट अब क्लाइंट से आ रहा है (पैसों में)
            currency: "INR", 
            receipt: `receipt_order_${Date.now()}` 
        };

        const order = await razorpay.orders.create(options);
        res.json({ id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });

    } catch (error) {
        console.error("Error in /create-payment endpoint:", error);
        res.status(500).json({ error: "Could not create payment order." });
    }
});

// --- (ZAROORI BADLAV) यह Endpoint अब प्लान के हिसाब से सही सिक्के क्रेडिट करेगा ---
app.post('/verify-payment', async(req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, token } = req.body;
        
        if (!token || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: "All payment details and token are required." });
        }
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                      .update(body.toString())
                                      .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // सिग्नेचर सही है, अब पेमेंट की डिटेल्स Razorpay से प्राप्त करें
            const paymentDetails = await razorpay.orders.fetch(razorpay_order_id);
            const amountPaid = paymentDetails.amount / 100; // रकम को रुपये में बदलें

            let coinsToAdd = 0;
            // प्लान के हिसाब से सिक्के तय करें
            switch(amountPaid) {
                case 1:
                    coinsToAdd = 55;
                    break;
                case 100:
                    coinsToAdd = 520;
                    break;
                case 200:
                    coinsToAdd = 1030;
                    break;
                case 500:
                    coinsToAdd = 2550;
                    break;
                case 1000:
                    coinsToAdd = 5200;
                    break;
                default:
                    console.log(`No specific coin plan for amount: ₹${amountPaid}`);
                    // आप चाहें तो यहाँ एक डिफ़ॉल्ट लॉजिक भी लगा सकते हैं
            }
            
            // यूजर के अकाउंट में सिक्के अपडेट करें
            if (coinsToAdd > 0) {
                const userRef = db.collection('users').doc(decodedToken.uid);
                await userRef.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd) });
            }

            res.json({ status: 'success', message: `Payment verified. ${coinsToAdd} coins added.` });

        } else {
            res.status(400).json({ status: 'failure', message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error("Error in /verify-payment endpoint:", error);
        res.status(500).json({ error: "An internal server error occurred during verification." });
    }
});


// --- (Naya Placeholder) ऑटो-पेमेंट को हैंडल करने के लिए Webhook Endpoint ---
/*
app.post('/razorpay-webhook', (req, res) => {
    // यह फंक्शन तब चलेगा जब Razorpay 18 घंटे बाद ऑटो-पेमेंट करेगा
    
    // 1. Webhook की सीक्रेट की (Secret Key) को वेरिफाई करें
    // यह पक्का करने के लिए कि रिक्वेस्ट सच में Razorpay से आई है
    const secret = 'AAPKA_WEBHOOK_SECRET'; // इसे Razorpay डैशबोर्ड में सेट करें
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest === req.headers['x-razorpay-signature']) {
        console.log('Request is legitimate');
        
        // 2. देखें कि कौनसा इवेंट आया है
        const event = req.body.event;
        if (event === 'subscription.charged') {
            const subscriptionData = req.body.payload.subscription.entity;
            const customerId = subscriptionData.customer_id; // यहाँ से आपको यूजर की पहचान करनी होगी

            // 3. डेटाबेस में उस यूजर को खोजें और सिक्के क्रेडिट करें
            // उदाहण:
            // const userRef = db.collection('users').doc(USER_ID_FROM_DB);
            // await userRef.update({ coins: admin.firestore.FieldValue.increment(520) });

            console.log('Subscription charged successfully for customer:', customerId);
        }
    } else {
        console.log('Invalid webhook signature');
    }
    
    res.json({ status: 'ok' });
});
*/

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
    console.log(`🚀 Server is running on port ${PORT}`);
});
