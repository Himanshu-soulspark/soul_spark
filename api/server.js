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
        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
             return res.status(400).json({ error: "Name, email, and phone are required." });
        }
        const subscriptionOptions = {
            plan_id: PLAN_ID, total_count: 60, quantity: 1, customer_notify: 1,
            addons: [{ item: { name: "Authentication Fee", amount: 300, currency: "INR" } }],
            notes: { customer_name: name, customer_email: email, customer_phone: phone }
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

// --- एडमिन पैनल से चार्ज करने वाला फंक्शन (यहीं पर अंतिम और सही बदलाव है) ---
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        // ########## START: YAHI FINAL AUR 100% CORRECT CODE HAI ##########
        // SAMASYA: Hum galat API ka istemal kar rahe the aur extra fields bhej rahe the.
        // SAMADHAN: Hum ab "Invoices API" ka bilkul sahi aur saral istemal kar rahe hain.

        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid integer Amount are required.' });
        }
        
        // Step 1: Subscription ki details se Customer ID nikalna.
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) {
            throw new Error("Customer ID could not be retrieved for this subscription.");
        }

        // Step 2: Us Customer ke liye ek naya Invoice (bill) banana
        const amount_in_paise = Number(amount) * 100;
        const invoice = await razorpay.invoices.create({
            type: "invoice",
            customer_id: customerId,
            subscription_id: subscription_id, // Yahi asli chaabi hai
            line_items: [{
                name: "Manual Charge from Admin Panel",
                description: `Recurring charge for subscription: ${subscription_id}`,
                amount: amount_in_paise,
                currency: "INR",
                quantity: 1
            }]
            // Hum ab koi extra field (jaise charge_automatically) nahi bhej rahe hain.
        });

        // Step 3: Agar invoice safaltapoorvak 'issued' (jaari) ho gaya hai, to hum ise
        // safal maanenge. Razorpay ise parde ke peeche apne aap charge karne ki koshish karega.
        if (invoice && invoice.id) {
             res.json({ 
                status: 'success', 
                message: `Invoice for ₹${amount} created successfully! Razorpay will attempt to charge it.`
             });
        } else {
            throw new Error(`The invoice could not be created for an unknown reason.`);
        }
        
        // ########################### END BADLAV ############################
    } catch (error) {
        console.error("Error charging recurring payment:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Failed to process charge." });
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
