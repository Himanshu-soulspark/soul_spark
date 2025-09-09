// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें (कोई बदलाव नहीं)
// =================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें (कोई बदलाव नहीं)
// =================================================================
const app = express();
const corsOptions = { origin: 'https://shubhzone.shop', optionsSuccessStatus: 200 };
app.use(cors(corsOptions));
app.use(express.json());

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("❌ FATAL ERROR: Firebase Admin SDK could not be initialized.", error.message);
  process.exit(1);
}
const db = admin.firestore();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");

// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (सिर्फ यहाँ ज़रूरी बदलाव है)
// =================================================================
app.post('/create-payment', async (req, res) => {
    try {
        // ########## START: YAHI FINAL AUR SABSE ZAROORI BADLAV HAI ##########
        // Hum ab aapke maujooda 'RAZORPAY_PLAN_ID_A' variable ka istemal kar rahe hain.
        const PLAN_ID = process.env.RAZORPAY_PLAN_ID_A;
        if (!PLAN_ID) {
            throw new Error("RAZORPAY_PLAN_ID_A is not set in the server's environment variables.");
        }

        // Hum frontend se user details nahi le rahe hain, kyonki prefill
        // ka kaam ab index.html karega. Isse server saral ho gaya hai.
        
        const subscriptionOptions = {
            plan_id: PLAN_ID,
            total_count: 60, // 5 saal ke liye
            quantity: 1,
            customer_notify: 1,
            // Yahi asli jaadu hai: Yeh plan ke amount ko override karke
            // user se sirf ₹3 ka authentication charge lega.
            addons: [{
                item: {
                    name: "One-time Authentication Fee",
                    amount: 300, // 300 paise = ₹3
                    currency: "INR"
                }
            }]
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        
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

// --- पेमेंट वेरीफाई करने वाला फंक्शन (कोई बदलाव नहीं) ---
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_payment_id + "|" + razorpay_subscription_id);
        if (hmac.digest('hex') === razorpay_signature) {
            res.json({ status: 'success', message: 'Payment verified successfully!', subscriptionId: razorpay_subscription_id });
        } else {
            throw new Error("Payment signature verification failed.");
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
});

// ... Baki ka code (admin charge, static files, etc.) aage waisa hi rahega ...

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
