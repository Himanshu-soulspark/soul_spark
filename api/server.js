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
const FormData = require('form-data');
const crypto = require('crypto');

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

const app = express();

// ########## START: YAHAN PAR SABSE ZAROORI BADLAV KIYA GAYA HAI ##########
// Purani line: app.use(cors());
// Hum server ko bata rahe hain ki sirf 'shubhzone.shop' se aane wali request ko hi allow karna hai.
// Yeh aapki website ko surakshit rakhta hai.
app.use(cors({
  origin: 'https://shubhzone.shop'
}));
// ########################## END BADLAV ##############################


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

// --- Razorpay को शुरू करें ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");


// =================================================================
// WEBHOOK ENDPOINT (इसमें कोई बदलाव नहीं)
// =================================================================

// Webhook के लिए raw body parser का इस्तेमाल करें
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
        
        console.log(`Received Webhook Event: ${event}`);

        // --- सब्सक्रिप्शन पहली बार एक्टिवेट होने पर ---
        if (event === 'subscription.activated') {
            const subscription = payload.subscription.entity;
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            
            if (!usersQuery.empty) {
                const userRef = usersQuery.docs[0].ref;
                await userRef.update({ subscriptionStatus: 'active' });
                console.log(`SUCCESS: Subscription ${subscription.id} for user ${userRef.id} is now ACTIVE.`);
            } else {
                 console.error(`Webhook Error: No user found for activated subscription ID ${subscription.id}`);
            }
        }
        // --- हर महीने की पेमेंट सफल होने पर ---
        else if (event === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.payment.entity;
            const amount = payment.amount / 100;

            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            if (usersQuery.empty) {
                console.error(`Webhook Error: No user found for charged subscription ID ${subscription.id}`);
                return res.json({ status: 'ok' });
            }
            const userRef = usersQuery.docs[0].ref;

            let coinsToAdd = 0;
            // यह आपके प्लान्स के अनुसार है
            if (amount === 2000) coinsToAdd = 11000;
            else if (amount === 200) coinsToAdd = 1000;

            if (coinsToAdd > 0) {
                await userRef.update({
                    coins: admin.firestore.FieldValue.increment(coinsToAdd),
                    subscriptionStatus: 'active' // सुनिश्चित करें कि स्टेटस एक्टिव है
                });
                console.log(`SUCCESS: Added ${coinsToAdd} coins to user ${userRef.id} for ₹${amount}.`);
            }
        }
        // --- जब सब्सक्रिप्शन रुक जाए (पेमेंट फेल) ---
        else if (event === 'subscription.halted') {
             const subscription = payload.subscription.entity;
             const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();

             if(!usersQuery.empty) {
                 const userRef = usersQuery.docs[0].ref;
                 await userRef.update({ subscriptionStatus: 'halted' });
                 console.log(`INFO: Subscription ${subscription.id} for user ${userRef.id} has been HALTED due to payment failure.`);
             } else {
                 console.error(`Webhook Error: No user found for halted subscription ID ${subscription.id}`);
             }
        }
        // --- जब सब्सक्रिप्शन खत्म हो जाए ---
        else if (event === 'subscription.completed' || event === 'subscription.cancelled') {
             const subscription = payload.subscription.entity;
             const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();

             if(!usersQuery.empty) {
                 const userRef = usersQuery.docs[0].ref;
                 await userRef.update({ subscriptionStatus: 'cancelled' });
                 console.log(`INFO: Subscription ${subscription.id} for user ${userRef.id} has been cancelled/completed.`);
             }
        }

        res.json({ status: 'ok' });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Webhook processing error.');
    }
});


// बाकी सभी routes के लिए JSON parser का इस्तेमाल करें
app.use(express.json({ limit: '10mb' }));

// =================================================================
// 3. API Endpoints (इसमें कोई बदलाव नहीं)
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


// --- AI MEDICAL ASSISTANT ENDPOINT ---
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

// --- AI डाइट प्लान बनाने वाला Endpoint ---
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


// --- FACE++ स्किन एनालिसिस ENDPOINT ---
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


// --- YouTube वीडियो खोजने वाला Endpoint ---
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


// --- मौसम के हिसाब से स्वास्थ्य सलाह देने वाला Endpoint ---
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


// --- LocationIQ से पता प्राप्त करने वाला Endpoint ---
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


// --- भोजन की पोषण जानकारी देने वाला Endpoint ---
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


// --- बारकोड से भोजन की जानकारी देने वाला Endpoint ---
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
// 4. PAYMENT & SUBSCRIPTION ENDPOINTS (इसमें कोई बदलाव नहीं)
// =================================================================

app.post('/create-payment', async (req, res) => {
    try {
        // Firebase auth disabled for this example for simplicity
        // const { token, isSubscription, amount } = req.body;
        // if (!token) return res.status(400).json({ error: "User token is required." });
        // const decodedToken = await admin.auth().verifyIdToken(token);
        
        const { isSubscription, amount } = req.body;

        if (isSubscription) {
            
            // NOTE: In a real app, you would fetch or create a Razorpay Customer ID
            // using user data from Firebase/your database.
            // For this example, we'll skip it. A customer will be created by Razorpay Checkout.
            
            const subscriptionOptions = {
                plan_id: process.env.RAZORPAY_PLAN_ID_A, // यह आपका ₹2000 वाला प्लान है
                total_count: 12, 
                quantity: 1,
                customer_notify: 1,
                addons: [{ item: { name: "Initial Authentication Fee", amount: 100, currency: "INR" }}],
            };

            const subscription = await razorpay.subscriptions.create(subscriptionOptions);

            // In a real app, you would save this subscription.id to your user's database record now.
            // await userRef.update({ 
            //     razorpaySubscriptionId: subscription.id,
            //     subscriptionStatus: 'created'
            // });

            return res.json({
                subscription_id: subscription.id,
                key_id: process.env.RAZORPAY_KEY_ID
            });

        } else {
            // One-time payment logic (not used in this flow)
            if(!amount) return res.status(400).json({ error: "Amount is required for one-time payments." });
            const options = { 
                amount, 
                currency: "INR", 
                receipt: `rcpt_one_time_${Date.now()}`
            };
            const order = await razorpay.orders.create(options);
            return res.json({ id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
        }

    } catch (error) {
        console.error("Error in /create-payment:", error);
        if (error.error && error.error.description) {
            return res.status(500).json({ error: error.error.description });
        }
        res.status(500).json({ error: "Could not create payment/subscription." });
    }
});


app.post('/verify-payment', async (req, res) => {
    try {
        // NOTE: Firebase token verification is removed for simplicity in this example.
        // In a real app, you would verify the user token here.
        // const { token } = req.body;
        // if (!token) return res.status(400).json({ error: "Token is required." });
        // const decodedToken = await admin.auth().verifyIdToken(token);
        
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, razorpay_subscription_id } = req.body;

        if (razorpay_order_id) {
            // One-time payment verification (not used in this flow)
            // ...
        } else if (razorpay_subscription_id) {
             // This is for the ₹1 subscription authentication
             const attributes = {
                 razorpay_payment_id: razorpay_payment_id,
                 razorpay_subscription_id: razorpay_subscription_id,
                 razorpay_signature: razorpay_signature
             };

             // This will throw an error if the signature is not valid
             razorpay.utils.verifyPaymentSignature(attributes);
             
             // Signature is valid!
             // In a real app, you would now update your database for the user.
             // For example, add 55 coins and set subscription status to 'authenticated'.
             // await userRef.update({ 
             //    coins: admin.firestore.FieldValue.increment(55),
             //    subscriptionStatus: 'authenticated'
             // });
             
             console.log(`Successfully authenticated subscription ${razorpay_subscription_id}.`);
             return res.json({ status: 'success', message: 'Subscription authenticated successfully! Your plan will auto-activate after the trial payment.' });
        } else {
            return res.status(400).json({ status: 'failure', message: 'Required Razorpay IDs not provided.' });
        }

    } catch (error) {
        console.error("Error in /verify-payment:", error);
        res.status(500).json({ status: 'failure', message: error.message || "Verification failed on server." });
    }
});


// =================================================================
// 5. WEBSITE SERVING & SERVER START (इसमें कोई बदलाव नहीं)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/Features/water.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'water.html')));
app.get('/Features/Diet.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Diet.html')));
app.get('/Features/Health.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Health.html')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// =================================================================
// 6. सर्वर को चालू करें
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
