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
const corsOptions = { origin: 'https://shubhzone.shop', optionsSuccessStatus: 200 };
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("❌ FATAL ERROR: Firebase Admin SDK could not be initialized.", error.message);
  process.exit(1);
}
const db = admin.firestore();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");

// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (सिर्फ यहाँ ज़रूरी बदलाव है)
// =================================================================
app.post('/create-payment', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
            return res.status(400).json({ error: "Name, email, and phone are required." });
        }

        // ########## START: YAHI FINAL AUR SABSE ZAROORI BADLAV HAI ##########
        // SAMASYA: Hum hamesha naya customer banane ki koshish kar rahe the.
        // SAMADHAN: Hum pehle search karenge ki customer मौजूद hai ya nahi.
        
        let customer;
        
        // Step 1: Razorpay se pucho ki is email/phone ka customer hai kya?
        const customers = await razorpay.customers.all({ email: email });
        
        if (customers.items && customers.items.length > 0) {
            // Haan, customer mil gaya, usi ka istemal karo
            customer = customers.items[0];
            console.log(`Found existing Razorpay customer: ${customer.id}`);
        } else {
            // Nahi mila, ab naya customer banao
            customer = await razorpay.customers.create({ name, email, contact: phone });
            console.log(`Created new Razorpay customer: ${customer.id}`);
        }
        // ########################### END BADLAV ############################

        // Step 2: On-the-fly (bina plan ID ke) ek subscription banana
        const subscriptionOptions = {
            plan: {
                interval: 1,
                period: "monthly",
                item: { name: "Shubhzone Base Subscription", description: "Base plan", amount: 100, currency: "INR" }
            },
            total_count: 60,
            quantity: 1,
            customer_notify: 1,
            addons: [{ item: { name: "One-time Authentication Fee", amount: 300, currency: "INR" } }],
            customer_id: customer.id
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        
        res.json({ 
            subscription_id: subscription.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error creating subscription:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Subscription creation failed." });
    }
});

// --- पेमेंट वेरीफाई करने वाला फंक्शन (कोई बदलाव नहीं) ---
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_payment_id + "|" + razorpay_subscription_id);
        if (hmac.digest('hex') === razorpay_signature) {
            res.json({ status: 'success', message: 'Payment verified successfully!', subscriptionId: razorpay_subscription_id });
        } else {
            throw new Error("Payment signature verification failed.");
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- एडमिन पैनल से चार्ज करने वाला फंक्शन (कोई बदलाव नहीं) ---
app.post('/charge-recurring-payment', async (req, res) => { /* ... unchanged ... */ });

// =================================================================
// BAAKI KE SARE API ENDPOINTS (कोई बदलाव नहीं)
// =================================================================
// ... (Your AI, YouTube, etc. functions here) ...

// =================================================================
// 5. WEBSITE SERVING & SERVER START (कोई बदलाव नहीं)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
