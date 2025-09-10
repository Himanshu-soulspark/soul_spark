// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें (कोई बदलाव नहीं)
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
// 2. सर्वर और सर्विसेज़ को शुरू करें (कोई बदलाव नहीं)
// =================================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Firebase Admin SDK को शुरू करें (कोई बदलाव नहीं) ---
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
  console.error("❌ FATAL ERROR: Firebase Admin SDK could not be initialized.", error.message);
  process.exit(1);
}
const db = admin.firestore();

// --- Razorpay को शुरू करें (कोई बदलाव नहीं) ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");

// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (सिर्फ यहीं पर बदलाव हैं)
// =================================================================

// --- पेमेंट बनाने वाला फंक्शन ---
app.post('/create-payment', async (req, res) => {
    try {
        // ########## पहला ज़रूरी बदलाव (START) ##########
        // समस्या: आपका कोड ग्राहक से नाम, ईमेल और फोन मांग रहा था, जबकि इसकी यहाँ ज़रूरत नहीं थी।
        //         इससे "Name, email, and phone are required" वाला एरर आ रहा था।
        // समाधान: हमने नाम, ईमेल और फोन की चेकिंग और उनका इस्तेमाल यहाँ से हटा दिया है।
        //          अब यह फंक्शन बिना किसी अतिरिक्त जानकारी के सिर्फ एक सब्सक्रिप्शन बनाएगा।
        
        const PLAN_ID = process.env.RAZORPAY_PLAN_ID_A;
        if (!PLAN_ID) { 
            throw new Error("RAZORPAY_PLAN_ID_A is not set in environment variables."); 
        }

        // अब हम req.body से कुछ भी नहीं ले रहे हैं।
        const subscriptionOptions = {
            plan_id: PLAN_ID,
            total_count: 60, // आप इसे अपनी ज़रूरत के हिसाब से बदल सकते हैं (e.g., 12 for 1 year)
            quantity: 1,
            customer_notify: 1,
             // हमने यहाँ से 'notes' और 'addons' को हटा दिया है क्योंकि उनकी ज़रूरत नहीं है।
        };
        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        res.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID });
        
        // ########## पहला ज़रूरी बदलाव (END) ##########

    } catch (error) {
        // बेहतर एरर रिपोर्टिंग ताकि आपको असली समस्या पता चले
        console.error("Error creating subscription:", error);
        res.status(500).json({ error: error.error ? error.error.description : "Subscription creation failed." });
    }
});

app.post('/verify-payment', async (req, res) => {
    try {
        // ########## दूसरा ज़रूरी बदलाव (START) ##########
        // समस्या: पेमेंट वेरिफिकेशन का तरीका गलत था। आप order_id का इस्तेमाल कर रहे थे,
        //         जबकि सब्सक्रिप्शन के लिए payment_id और subscription_id का इस्तेमाल होता है।
        //         इसी वजह से "Payment verification failed" का एरर आ रहा था।
        // समाधान: हमने वेरिफिकेशन के लिए सही IDs का इस्तेमाल किया है।

        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

        // हम अब सही IDs की जाँच कर रहे हैं।
        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            return res.status(400).json({ error: "Payment verification data is incomplete." });
        }
        
        // यह सही स्ट्रिंग है जिसे Razorpay को वेरीफाई करने के लिए चाहिए।
        const body_string = razorpay_payment_id + "|" + razorpay_subscription_id;

        const expected_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body_string)
            .digest('hex');
        
        if (expected_signature === razorpay_signature) {
            // वेरिफिकेशन सफल! अब हम subscription_id को वापस भेजेंगे।
            // हमें paymentDetails को दोबारा fetch करने की ज़रूरत नहीं है क्योंकि हमारे पास पहले से ही subscription_id है।
            res.json({ 
                status: 'success', 
                message: 'Payment verified successfully!', 
                subscriptionId: razorpay_subscription_id // यही ID हमें Firebase में सेव करनी है।
            });
        } else {
            // अगर सिग्नेचर मैच नहीं होता है।
            throw new Error("Signature verification failed.");
        }
        // ########## दूसरा ज़रूरी बदलाव (END) ##########

    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- एडमिन पैनल से चार्ज करने वाला फंक्शन ---
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        // इस फंक्शन का लॉजिक (Invoice बनाना) रेकरिंग पेमेंट के लिए सही है,
        // इसलिए हमने 'try' ब्लॉक में कोई बदलाव नहीं किया है।
        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid integer Amount are required.' });
        }
        
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) {
            throw new Error("Customer ID could not be retrieved for this subscription.");
        }

        const amount_in_paise = Number(amount) * 100;
        const invoice = await razorpay.invoices.create({
            type: "invoice",
            customer_id: customerId,
            subscription_id: subscription_id,
            line_items: [{
                name: "Manual Charge from Admin Panel",
                description: `Recurring charge for subscription: ${subscription_id}`,
                amount: amount_in_paise,
                currency: "INR",
                quantity: 1
            }]
        });

        if (invoice && invoice.id) {
             res.json({ 
                status: 'success', 
                message: `Invoice for ₹${amount} created successfully! Razorpay will attempt to charge it.`
             });
        } else {
            throw new Error(`The invoice could not be created for an unknown reason.`);
        }
        
    } catch (error) {
        // ########## तीसरा ज़रूरी बदलाव (START) ##########
        // समस्या: आपका कोड Razorpay से आने वाली असली गलती को छुपा रहा था और आपको
        //         झूठा सक्सेस मैसेज मिल रहा था।
        // समाधान: हमने 'catch' ब्लॉक को बेहतर बनाया है ताकि यह Razorpay की असली एरर को
        //          पकड़े और आपको बताए। अब आपको झूठा मैसेज नहीं, बल्कि असली कारण पता चलेगा।

        console.error("DETAILED ERROR charging recurring payment:", JSON.stringify(error, null, 2));
        
        // हम अब क्लाइंट को एक विस्तृत और उपयोगी एरर मैसेज भेजेंगे।
        const errorMessage = error.error && error.error.description 
            ? error.error.description 
            : "Failed to process the charge. Check server logs for details.";
            
        res.status(error.statusCode || 500).json({ error: errorMessage });
        
        // ########## तीसरा ज़रूरी बदलाव (END) ##########
    }
});


// =================================================================
// BAAKI KE SARE API ENDPOINTS (आपके सारे पुराने फंक्शन्स, अपरिवर्तित)
// =================================================================
// ... (Your AI, YouTube, etc. functions here) ...

// =================================================================
// 5. WEBSITE SERVING & SERVER START (अपरिवर्तित)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
