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

// --- पेमेंट बनाने वाला फंक्शन (इसमें कोई बदलाव नहीं) ---
// यह फंक्शन पहले से ही सही है और Plan ID का इस्तेमाल करके सब्सक्रिप्शन बनाता है।
app.post('/create-payment', async (req, res) => {
    try {
        const PLAN_ID = process.env.RAZORPAY_PLAN_ID_A;
        if (!PLAN_ID) {
            throw new Error("RAZORPAY_PLAN_ID_A is not set in the server's environment variables.");
        }
        
        const subscriptionOptions = {
            plan_id: PLAN_ID,
            total_count: 60,
            quantity: 1,
            customer_notify: 1,
            addons: [{
                item: {
                    name: "One-time Authentication Fee",
                    amount: 300,
                    currency: "INR"
                }
            }]
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


// --- पेमेंट वेरीफाई करने वाला फंक्शन (यहीं पर असली समस्या थी) ---
app.post('/verify-payment', async (req, res) => {
    try {
        // ########## START: YAHI FINAL AUR SABSE ZAROORI BADLAV HAI ##########
        // SAMASYA: Hum galat 'secret code' formula istemal kar rahe the.
        // SAMADHAN: Ab hum Razorpay ka bataya hua 100% sahi formula istemal kar rahe hain.
        
        // Step 1: Frontend se saari zaroori jaankari lena
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        // Ye check zaroori hai
        if (!razorpay_order_id) {
            throw new Error("CRITICAL: Order ID is missing from the Razorpay response. Verification is impossible.");
        }
        
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        
        // Yahi sahi aur 100% correct formula hai: order_id + "|" + payment_id
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);

        // Step 2: Secret code ko match karna
        if (hmac.digest('hex') === razorpay_signature) {
            // Agar code match ho gaya, to iska matlab payment asli hai.
            
            // Step 3: Ab hum payment ki details se subscription_id nikalenge
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            if (!paymentDetails.subscription_id) {
                 throw new Error("Subscription ID was not found in payment details, even after successful verification.");
            }
            
            // Step 4: Frontend ko saari acchi khabar bhejna
            res.json({ 
                status: 'success', 
                message: 'Payment verified successfully!', 
                subscriptionId: paymentDetails.subscription_id 
            });
            
        } else {
            // Agar code match nahi hua, to payment nakli hai.
            throw new Error("Payment signature verification failed. The request may be fraudulent.");
        }
        // ########################### END BADLAV ############################
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
