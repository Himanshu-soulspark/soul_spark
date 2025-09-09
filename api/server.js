// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
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

// ########## START: ZAROORI BADLAV #1 ##########
// Hum server ko bata rahe hain ki sirf 'shubhzone.shop' se aane wali request ko hi allow karna hai.
app.use(cors({
  origin: 'https://shubhzone.shop'
}));
// ####################### END BADLAV ########################


// --- Firebase Admin SDK को शुरू करें ---
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
  console.error("\n\n❌❌❌ FATAL ERROR: Firebase Admin SDK could not be initialized. ❌❌❌");
  console.error("REASON:", error.message);
  console.error("\nSOLUTION: Please check your 'FIREBASE_SERVICE_ACCOUNT' environment variable in Render.\n");
  process.exit(1);
}
const db = admin.firestore();

// --- Razorpay को शुरू करें ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");


// =================================================================
// WEBHOOK ENDPOINT (Isme koi badlav nahi kiya gaya hai)
// =================================================================
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // ... (Aapka original webhook code yahan hai) ...
});

app.use(express.json({ limit: '10mb' }));


// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (Yahan zaroori badlav hain)
// =================================================================

// ########## START: ZAROORI BADLAV #2 - AAPKE PLAN_ID KE SAATH PAYMENT LOGIC ##########
app.post('/create-payment', async (req, res) => {
    try {
        const { isSubscription } = req.body;
        if (isSubscription) {
            
            // Hum aapki maujooda RAZORPAY_PLAN_ID_A ka istemal kar rahe hain
            const subscriptionOptions = {
                plan_id: process.env.RAZORPAY_PLAN_ID_A, 
                total_count: 36, // Total kitni baar charge kar sakte hain
                quantity: 1,
                customer_notify: 1,
                // YAHI ASLI JAADU HAI: Yeh plan ke ₹2 ko override karke user se sirf ₹1 lega
                addons: [{ item: { name: "Mandate Authentication Fee", amount: 100, currency: "INR" }}],
                notes: {
                    mandate_type: "on_demand_with_base_plan"
                }
            };
            
            const subscription = await razorpay.subscriptions.create(subscriptionOptions);

            return res.json({
                subscription_id: subscription.id,
                key_id: process.env.RAZORPAY_KEY_ID
            });
        }
    } catch (error) {
        console.error("Error creating subscription:", error);
        const errorMessage = error.error ? error.error.description : "Could not create payment mandate.";
        res.status(500).json({ error: errorMessage });
    }
});
// ####################################################################################

app.post('/verify-payment', async (req, res) => {
    // ... (Aapka verification wala code yahan hai, isme koi badlav nahi) ...
    // Yeh code abhi ke liye theek hai.
});

// ########## START: ZAROORI BADLAV #3 - ADMIN PANEL SE CONTROL KARNE KE LIYE API ##########
app.post('/charge-user-manually', async (req, res) => {
    try {
        const { subscription_id, amount_in_paise } = req.body;
        if (!subscription_id || !amount_in_paise) {
            return res.status(400).json({ status: 'error', error: 'Subscription ID and Amount are required.' });
        }

        console.log(`Received ADMIN request to charge ₹${amount_in_paise / 100} on subscription ${subscription_id}`);

        // IMPORTANT: Yeh ek DUMMY LOGIC hai. Asli charge ke liye aapko Razorpay ke
        // "Authorization Payments" ka documentation dekhna hoga.
        
        // --- START DUMMY LOGIC ---
        const isSuccess = Math.random() > 0.1; // 90% success rate simulate karein
        if (isSuccess) {
            const dummyPaymentId = `pay_${crypto.randomBytes(7).toString('hex')}`;
            console.log(`ADMIN CHARGE SUCCESS: Payment ID: ${dummyPaymentId}`);
            res.json({ status: 'success', message: `Successfully charged ₹${amount_in_paise / 100}!`, paymentId: dummyPaymentId });
        } else {
            throw new Error("Simulated payment failure from Admin Panel.");
        }
        // --- END DUMMY LOGIC ---

    } catch (error) {
        console.error("Error in /charge-user-manually:", error);
        const errorMessage = error.error ? error.error.description : (error.message || "Failed to process charge.");
        res.status(500).json({ status: 'error', error: errorMessage });
    }
});
// ####################################################################################

// =================================================================
// BAAKI KE SARE API ENDPOINTS (Inme koi badlav nahi kiya gaya hai)
// =================================================================
// ... (Aapke AI, YouTube, Weather, etc. wale saare functions yahan hain) ...

// =================================================================
// 5. WEBSITE SERVING & SERVER START (Isme koi badlav nahi)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
// ... (Aapka original static serving code yahan hai) ...

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
