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
app.use(cors({ origin: 'https://shubhzone.shop' }));

// --- Firebase Admin SDK को शुरू करें ---
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("\n❌ FATAL ERROR: Firebase Admin SDK initialization failed.", error.message);
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
// WEBHOOK ENDPOINT
// =================================================================
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // ... (Aapka original webhook code yahan hai) ...
});

app.use(express.json({ limit: '10mb' }));

// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS
// =================================================================

// ########## START: ZAROORI BADLAV - FINAL PAYMENT LOGIC ##########
app.post('/create-payment', async (req, res) => {
    try {
        const { isSubscription } = req.body;
        if (isSubscription) {
            
            // Step 1: Agle billing cycle ki shuruaat ki tarikh nikalen (e.g., agle mahine ki pehli tarikh)
            const now = new Date();
            const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const startAtTimestamp = Math.floor(startOfNextMonth.getTime() / 1000);

            const subscriptionOptions = {
                plan_id: process.env.RAZORPAY_PLAN_ID_A, 
                total_count: 36,
                quantity: 1,
                // YAHI ASLI JAADU HAI: Hum Razorpay ko bata rahe hain ki asli billing agle mahine se shuru karna.
                start_at: startAtTimestamp,
                // Isliye, aaj woh sirf addon ka paisa lega.
                addons: [{ item: { name: "Mandate Authentication Fee", amount: 100, currency: "INR" }}],
                customer_notify: 1,
                notes: {
                    mandate_type: "on_demand_with_base_plan_final"
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
});

app.post('/charge-user-manually', async (req, res) => {
    // ... (Aapka admin panel wala code yahan hai, isme koi badlav nahi) ...
});

// =================================================================
// BAAKI KE SARE API ENDPOINTS
// =================================================================
// ... (Aapke AI, YouTube, Weather, etc. wale saare functions yahan hain) ...

// =================================================================
// 5. WEBSITE SERVING & SERVER START
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
// ... (Aapka original static serving code yahan hai) ...

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
