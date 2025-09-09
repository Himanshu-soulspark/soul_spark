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

// CORS को कॉन्फ़िगर करें ताकि यह सिर्फ आपकी वेबसाइट से बात करे (कोई बदलाव नहीं)
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
        // ########## START: YAHAN PAR ZAROORI BADLAV KIYA GAYA HAI ##########
        // SAMASYA: Pehle server check kar raha tha ki user मौजूद hai ya nahi.
        // SAMADHAN: Ab server ka kaam saral ho gaya hai. Use bas di gayi jankari se
        //           ek naya Razorpay Customer aur Order banana hai. Purana complex logic
        //           hata diya gaya hai.
        
        // Step 1: Frontend (index.html) se user ki details lena
        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
            return res.status(400).json({ error: "Name, email, and phone are required from frontend." });
        }

        // Step 2: Hamesha ek naya Razorpay Customer banana
        // (Kyonki profile pehle ban chuki hai, humein purane customer ko dhoondne ki zaroorat nahi hai)
        const customer = await razorpay.customers.create({ name, email, contact: phone });

        // Step 3: Naye Customer ID ka istemal karke Order banana
        const orderOptions = {
            amount: 300, 
            currency: "INR", 
            receipt: `rcpt_${Date.now()}`,
            customer_id: customer.id, 
            payment_capture: 1,
            token: { 
                max_amount: 99900,
                frequency: "as_presented"
            }
        };
        const order = await razorpay.orders.create(orderOptions);

        // Step 4: Frontend ko zaroori jankari wapas bhejna
        res.json({ 
            order_id: order.id, 
            key_id: process.env.RAZORPAY_KEY_ID,
            razorpayCustomerId: customer.id // Yeh bhejna zaroori hai
        });
        // ########################### END BADLAV ############################

    } catch (error) {
        console.error("Error creating payment:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Could not create payment." });
    }
});

// --- पेमेंट वेरीफाई करने वाला फंक्शन (इसमें कोई बदलाव नहीं) ---
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        if (hmac.digest('hex') === razorpay_signature) {
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            if (!paymentDetails.subscription_id) throw new Error("Subscription ID not found.");
            res.json({ status: 'success', message: 'Payment verified!', subscriptionId: paymentDetails.subscription_id });
        } else {
            throw new Error("Payment verification failed.");
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
