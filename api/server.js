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
app.use(cors());
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

// --- पेमेंट बनाने वाला और वेरीफाई करने वाला फंक्शन (इनमें कोई बदलाव नहीं) ---
app.post('/create-payment', async (req, res) => { /* ... code unchanged ... */ });
app.post('/verify-payment', async (req, res) => { /* ... code unchanged ... */ });

// ########## START: YAHI FINAL AUR SABSE ZAROORI BADLAV HAI ##########
// SAMASYA: Hum ek extra field (charge_automatically) bhej rahe the.
// SAMADHAN: Humne us ek line ko hata diya hai.
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid integer Amount are required.' });
        }
        
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) {
            throw new Error("Customer ID could not be retrieved for this subscription.");
        }

        const amount_in_paise = Number(amount) * 100;
        const invoice = await razorpay.invoices.create({
            type: "invoice",
            customer_id: customerId,
            line_items: [{
                name: "Manual Charge from Admin Panel",
                description: `Recurring charge for subscription: ${subscription_id}`,
                amount: amount_in_paise,
                currency: "INR",
                quantity: 1
            }],
            subscription_id: subscription_id
            // 'charge_automatically: true' wali line yahan se hata di gayi hai
        });

        if (invoice.status === 'paid' || invoice.status === 'attempted') {
             res.json({ 
                status: 'success', 
                message: `Successfully charged ₹${amount}! Invoice status: ${invoice.status}`
             });
        } else {
            throw new Error(`Invoice was created but not charged automatically. Status: ${invoice.status}`);
        }
        
    } catch (error) {
        console.error("Error charging recurring payment:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Failed to process charge." });
    }
});
// ########################### END BADLAV ############################

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
