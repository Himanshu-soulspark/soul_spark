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
// PAYMENT & SUBSCRIPTION ENDPOINTS (सिर्फ यहीं पर एक ज़रूरी बदलाव है)
// =================================================================

// --- पेमेंट बनाने वाला फंक्शन ---
app.post('/create-payment', async (req, res) => {
    try {
        const PLAN_ID = process.env.RAZORPAY_PLAN_ID_A;
        if (!PLAN_ID) { 
            throw new Error("RAZORPAY_PLAN_ID_A is not set in environment variables."); 
        }
        
        console.log(`Attempting to create subscription with Plan ID: ${PLAN_ID}`); // बेहतर लॉगिंग के लिए

        // ########## यही एकमात्र और सबसे ज़रूरी बदलाव है (START) ##########
        // आपका सवाल: एडमिन 29 साल 5 महीने के अंदर कभी भी ₹999 काट सकता है?
        // जवाब: हाँ, बिल्कुल। नीचे total_count को 353 पर सेट किया गया है (29 * 12 + 5 = 353)।
        //         इसका मतलब है कि यह सब्सक्रिप्शन 353 महीनों तक एक्टिव रहेगी।
        //         इस दौरान, आप एडमिन पैनल से मैन्युअल रूप से कितनी भी बार और कोई भी अमाउंट (जैसे ₹999)
        //         काट सकते हैं, जब तक कि ग्राहक सब्सक्रिप्शन को रद्द न कर दे।
        const subscriptionOptions = {
            plan_id: PLAN_ID,
            total_count: 353, // 29 साल और 5 महीने
            quantity: 1,
            customer_notify: 1,
        };
        // ########## बदलाव (END) ##########

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        res.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID });
        
    } catch (error) {
        console.error("DETAILED ERROR creating subscription:", JSON.stringify(error, null, 2));
        res.status(error.statusCode || 500).json({ error: error.error ? error.error.description : "Subscription creation failed. Check Plan ID and API Keys." });
    }
});

// --- पेमेंट वेरीफाई करने वाला फंक्शन (यह पहले से ही सही है) ---
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            return res.status(400).json({ error: "Payment verification data is incomplete." });
        }
        const body_string = razorpay_payment_id + "|" + razorpay_subscription_id;
        const expected_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body_string).digest('hex');
        
        if (expected_signature === razorpay_signature) {
            res.json({ status: 'success', message: 'Payment verified successfully!', subscriptionId: razorpay_subscription_id });
        } else {
            throw new Error("Signature verification failed.");
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- एडमिन पैनल से चार्ज करने वाला फंक्शन (यह पहले से ही सही है) ---
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid integer Amount are required.' });
        }
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) { throw new Error("Customer ID could not be retrieved for this subscription."); }
        const amount_in_paise = Number(amount) * 100;
        const invoice = await razorpay.invoices.create({
            type: "invoice", customer_id: customerId, subscription_id: subscription_id,
            line_items: [{ name: "Manual Charge from Admin Panel", description: `Recurring charge for subscription: ${subscription_id}`, amount: amount_in_paise, currency: "INR", quantity: 1 }]
        });
        if (invoice && invoice.id) {
             res.json({ status: 'success', message: `Invoice for ₹${amount} created successfully! Razorpay will attempt to charge it.` });
        } else {
            throw new Error(`The invoice could not be created for an unknown reason.`);
        }
    } catch (error) {
        console.error("DETAILED ERROR charging recurring payment:", JSON.stringify(error, null, 2));
        const errorMessage = error.error && error.error.description ? error.error.description : "Failed to process the charge. Check server logs for details.";
        res.status(error.statusCode || 500).json({ error: errorMessage });
    }
});

// =================================================================
// BAAKI KE SARE API ENDPOINTS (अपरिवर्तित)
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
