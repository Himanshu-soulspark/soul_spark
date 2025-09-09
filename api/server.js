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

// --- पेमेंट बनाने वाला और वेरीफाई करने वाला फंक्शन (इनमें कोई बदलाव नहीं) ---
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
        // SAMASYA: Humara pichhla code 'extra fields' bhej raha tha.
        // SAMADHAN: Hum ab Razorpay ke niyam ke anusaar bilkul sahi format ka istemal
        //           kar rahe hain jise "first payment" kehte hain.

        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid integer Amount are required.' });
        }
        
        // Step 1: Subscription ki details se Customer ID nikalna
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) {
            throw new Error("Customer ID could not be retrieved for this subscription.");
        }

        // Step 2: Us Customer ID ke liye ek "first payment" order banana
        const amount_in_paise = Number(amount) * 100;
        const orderOptions = {
            amount: amount_in_paise,
            currency: "INR",
            payment_capture: 1,
            // Yahi asli jaadu hai: Yeh order ko batata hai ki yeh ek recurring
            // payment ka pehla hissa hai.
            method: {
                emandate: true,
            },
            customer_id: customerId,
            receipt: `receipt_charge_${Date.now()}`,
            notes: {
                charge_reason: "Manual charge from Admin Panel"
            }
        };

        // Yeh Razorpay ka naya, sahi aur recommended tarika hai
        // recurring payments ko charge karne ka.
        const order = await razorpay.orders.create(orderOptions);

        // Jab yeh order ban jaata hai, Razorpay apne aap isey
        // customer ke mandate (anumati) ke khilaaf charge karne ki koshish karta hai.
        res.json({ 
            status: 'success', 
            message: `Charge of ₹${amount} initiated successfully. Order ID: ${order.id}`
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
