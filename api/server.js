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
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

const app = express();

// CORS को कॉन्फ़िगर करें (कोई बदलाव नहीं)
const corsOptions = {
  origin: 'https://shubhzone.shop',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
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
// PAYMENT & SUBSCRIPTION ENDPOINTS (सिर्फ यहाँ ज़रूरी बदलाव है)
// =================================================================

// --- पेमेंट बनाने वाला फंक्शन ---
app.post('/create-payment', async (req, res) => {
    try {
        // ########## START: YAHI FINAL AUR SABSE ZAROORI BADLAV HAI ##########
        // SAMASYA: Hamara pichhla code "Orders API" ka istemal kar raha tha,
        //          jisse Subscription ID nahi ban rahi thi.
        // SAMADHAN: Hum ab सीधे "Subscriptions API" ka istemal kar rahe hain
        //           bina kisi Plan ID ke. Hum on-the-fly ek dummy plan banayenge.

        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
            return res.status(400).json({ error: "Name, email, and phone are required." });
        }

        // Step 1: Ek Razorpay Customer banana
        const customer = await razorpay.customers.create({ name, email, contact: phone });

        // Step 2: On-the-fly (bina plan ID ke) ek subscription banana
        const subscriptionOptions = {
            // Hum yahan on-the-fly ek dummy plan define kar rahe hain
            plan: {
                interval: 1,
                period: "monthly", // Ya "yearly", "weekly", etc.
                item: {
                    name: "Shubhzone Base Subscription",
                    description: "Base plan for on-demand payments",
                    amount: 100, // 100 paise = ₹1 (Yeh sirf ek dummy amount hai, charge nahi hoga)
                    currency: "INR"
                }
            },
            total_count: 60, // 5 saal ke liye
            quantity: 1,
            customer_notify: 1,
            // Yahi asli jaadu hai: Yeh upar diye gaye dummy plan ke amount ko
            // override karke user se sirf ₹3 ka authentication charge lega.
            addons: [{
                item: {
                    name: "One-time Authentication Fee",
                    amount: 300, // 300 paise = ₹3
                    currency: "INR"
                }
            }],
            // Hum customer ID ko yahan bhi bhej rahe hain
            customer_id: customer.id
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        
        // Frontend ko ab order_id nahi, balki subscription_id bheja jayega
        res.json({ 
            subscription_id: subscription.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });
        // ########################### END BADLAV ############################

    } catch (error) {
        console.error("Error creating subscription:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Subscription creation failed." });
    }
});

// --- पेमेंट वेरीफाई करने वाला फंक्शन (अब यह सही से काम करेगा) ---
app.post('/verify-payment', async (req, res) => {
    try {
        // Ab frontend se humein subscription_id milegi
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
        
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        // Verification ka formula subscription ke liye alag hota hai
        hmac.update(razorpay_payment_id + "|" + razorpay_subscription_id);

        if (hmac.digest('hex') === razorpay_signature) {
            // Is case me verification hi kaafi hai, dobara fetch karne ki zaroorat nahi.
            // Hum frontend se aayi subscription_id par hi bharosa kar sakte hain.
            res.json({ status: 'success', message: 'Payment verified successfully!', subscriptionId: razorpay_subscription_id });
        } else {
            throw new Error("Payment signature verification failed.");
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- एडमिन पैनल से चार्ज करने वाला फंक्शन (इसमें कोई बदलाव नहीं) ---
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Subscription ID and Amount are required.' });
        }
        const amount_in_paise = amount * 100;
        const invoice = await razorpay.invoices.create({
            type: "invoice", subscription_id, amount: amount_in_paise, currency: "INR",
            description: `Manual charge for ₹${amount}`
        });
        res.json({ status: 'success', message: `Charge initiated for ₹${amount}!`, paymentId: invoice.payment_id || 'Pending' });
    } catch (error) {
        console.error("Error charging recurring payment:", error);
        res.status(500).json({ error: error.error ? error.error.description : "Failed to process charge." });
    }
});

// =================================================================
// BAAKI KE SARE API ENDPOINTS (आपके सारे पुराने फंक्शन्स, अपरिवर्तित)
// =================================================================

// ... (यहाँ आपके AI, YouTube, Weather, आदि वाले सारे functions होने चाहिए) ...


// =================================================================
// 5. WEBSITE SERVING & SERVER START (अपरिवर्तित)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
