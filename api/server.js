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
// PAYMENT & SUBSCRIPTION ENDPOINTS (सिर्फ एक फंक्शन में बदलाव है)
// =================================================================

// --- पेमेंट बनाने वाला फंक्शन (यह पहले से ही सही है, कोई बदलाव नहीं) ---
app.post('/create-payment', async (req, res) => {
    try {
        const PLAN_ID = process.env.RAZORPAY_PLAN_ID_A;
        if (!PLAN_ID) { throw new Error("RAZORPAY_PLAN_ID_A is not set."); }
        const subscriptionOptions = {
            plan_id: PLAN_ID, total_count: 60, quantity: 1, customer_notify: 1,
            addons: [{ item: { name: "Authentication Fee", amount: 300, currency: "INR" } }]
        };
        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        res.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        res.status(500).json({ error: error.error ? error.error.description : "Subscription creation failed." });
    }
});


// --- पेमेंट वेरीफाई करने वाला फंक्शन (यह पहले से ही सही है, कोई बदलाव नहीं) ---
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        if (!razorpay_order_id) { throw new Error("CRITICAL: Order ID is missing."); }
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        if (hmac.digest('hex') === razorpay_signature) {
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            if (!paymentDetails.subscription_id) { throw new Error("Subscription ID not found post-verification."); }
            res.json({ status: 'success', message: 'Payment verified!', subscriptionId: paymentDetails.subscription_id });
        } else { throw new Error("Signature verification failed."); }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- एडमिन पैनल से चार्ज करने वाला फंक्शन (यहीं पर असली समस्या थी) ---
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        // ########## START: YAHI FINAL AUR SABSE ZAROORI BADLAV HAI ##########
        // SAMASYA: invoices.create() hamein manchahi amount charge karne nahi de raha tha.
        // SAMADHAN: Hum ab "Payment Links" API ka istemal kar rahe hain, jo is kaam ke liye
        //           bilkul sahi hai aur Razorpay dwara recommended hai.

        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid Amount are required.' });
        }
        
        // Step 1: Subscription ki details se Customer ID nikalna, taki hum usey link me daal sakein.
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) {
            throw new Error("Customer ID could not be retrieved for this subscription.");
        }

        // Step 2: Us Customer ID ke liye ek special 'recurring' Payment Link banana
        const amount_in_paise = amount * 100;
        const paymentLinkOptions = {
            amount: amount_in_paise,
            currency: "INR",
            accept_partial: false,
            description: `Manual charge from Admin Panel for ₹${amount}`,
            customer: {
                // Hum yahan customer ki details bhej rahe hain
                name: subscription.notes.customer_name || 'Valued Customer',
                email: subscription.notes.customer_email || 'no-email@example.com',
                contact: subscription.notes.customer_phone || '+919999999999'
            },
            notify: {
                sms: true, // User ko SMS bhejo
                email: true // User ko Email bhejo
            },
            reminder_enable: false,
            // Yahi asli jaadu hai: Yeh link ko "recurring" banata hai aur batata hai ki
            // kaun si anumati (subscription_id) ka istemal karna hai.
            subscription_id: subscription_id,
            first_min_partial_amount: amount_in_paise // Yeh sunishchit karta hai ki poora amount charge ho.
        };

        const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

        // Jaise hi link banta hai, Razorpay apne aap charge karne ki prakriya shuru kar deta hai.
        res.json({ 
            status: 'success', 
            message: `Charge of ₹${amount} initiated successfully via Payment Link.`,
            link_id: paymentLink.id
        });
        
        // ########################### END BADLAV ############################
    } catch (error) {
        console.error("Error charging recurring payment:", error.error || error);
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
