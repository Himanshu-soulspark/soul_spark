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

// ########## पहला सबसे बड़ा और ज़रूरी बदलाव (START) ##########
// समस्या: रिक्वेस्ट सर्वर तक पहुँच ही नहीं रही थी और हमें पता नहीं चल रहा था (CORS Error)।
// समाधान: हमने CORS को बहुत उदार बना दिया है ताकि कोई भी रिक्वेस्ट ब्लॉक न हो।
//          यह किसी भी छिपे हुए CORS एरर को खत्म कर देगा।
const corsOptions = {
  origin: '*', // किसी भी डोमेन से आने वाली रिक्वेस्ट को अनुमति दो।
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // सभी तरह के मेथड्स को अनुमति दो।
  allowedHeaders: ['Content-Type', 'Authorization'], // ज़रूरी हेडर्स को अनुमति दो।
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ब्राउज़र द्वारा भेजी गई pre-flight रिक्वेस्ट को हैंडल करो।
// ########## पहला सबसे बड़ा और ज़रूरी बदलाव (END) ##########

app.use(express.json({ limit: '10mb' }));

// ########## दूसरा सबसे बड़ा और ज़रूरी बदलाव (START) ##########
// समस्या: "Logs में कुछ नहीं आ रहा है"।
// समाधान: यह एक ग्लोबल "जासूस" (middleware) है। कोई भी रिक्वेस्ट सर्वर तक पहुँचेगी,
//          तो यह फंक्शन सबसे पहले चलेगा और उसकी पूरी जानकारी Logs में प्रिंट कर देगा।
//          अब ऐसा हो ही नहीं सकता कि आप बटन दबाएँ और Logs में कुछ भी न दिखे।
app.use((req, res, next) => {
  console.log('--- [INCOMING REQUEST RECEIVED] ---');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Request Method: ${req.method}`);
  console.log(`Request URL: ${req.originalUrl}`);
  console.log(`Client IP Address: ${req.ip}`);
  console.log('---------------------------------');
  next(); // अब रिक्वेस्ट को उसके असली रास्ते पर आगे जाने दो।
});
// ########## दूसरा सबसे बड़ा और ज़रूरी बदलाव (END) ##########


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
// PAYMENT & SUBSCRIPTION ENDPOINTS (पहले वाले सुधारों के साथ)
// =================================================================

// --- पेमेंट बनाने वाला फंक्शन ---
app.post('/create-payment', async (req, res) => {
    console.log("-> /create-payment endpoint hit.");
    try {
        const PLAN_ID = process.env.RAZORPAY_PLAN_ID_A;
        if (!PLAN_ID) { throw new Error("RAZORPAY_PLAN_ID_A is not set in environment variables."); }
        const subscriptionOptions = { plan_id: PLAN_ID, total_count: 60, quantity: 1, customer_notify: 1 };
        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        res.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error("Error creating subscription:", error);
        res.status(500).json({ error: error.error ? error.error.description : "Subscription creation failed." });
    }
});

// --- पेमेंट वेरीफाई करने वाला फंक्शन ---
app.post('/verify-payment', async (req, res) => {
    console.log("-> /verify-payment endpoint hit.");
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

// --- एडमिन पैनल से चार्ज करने वाला फंक्शन ---
app.post('/charge-recurring-payment', async (req, res) => {
    console.log("-> /charge-recurring-payment endpoint hit.");
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
            type: "invoice",
            customer_id: customerId,
            subscription_id: subscription_id,
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
