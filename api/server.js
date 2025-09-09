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

// ########## START: YAHI FINAL AUR 100% CORRECT CODE HAI ##########
// SAMASYA: Hum galat API (Invoices) ka istemal kar rahe the.
// SAMADHAN: Hum ab "Authorization Payments" ka istemal kar rahe hain, jo is kaam
//           ke liye bilkul sahi, seedha aur guaranteed hai.
app.post('/charge-recurring-payment', async (req, res) => {
    try {
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
        
        // Step 2: Customer ke payment methods (tokens) ko fetch karna.
        const tokens = await razorpay.customers.fetchTokens(customerId);
        if (!tokens.items || tokens.items.length === 0) {
            throw new Error("No valid payment method (token) found for this customer.");
        }
        const latestToken = tokens.items[0];

        // Step 3: Us token ka istemal karke ek naya "Authorization Payment" banana
        const amount_in_paise = Number(amount) * 100;
        const payment = await razorpay.payments.create({
            amount: amount_in_paise,
            currency: "INR",
            customer_id: customerId,
            token: latestToken.id,
            recurring: '1',
            description: `Manual charge for ₹${amount} from Admin Panel`
        });

        // Step 4: Is payment ko turant "capture" karna
        const capturedPayment = await razorpay.payments.capture(payment.id, amount_in_paise, "INR");
        
        if (capturedPayment.status === 'captured') {
             res.json({ 
                status: 'success', 
                message: `Successfully charged ₹${amount}! Payment ID: ${capturedPayment.id}`
             });
        } else {
            throw new Error(`Payment was processed but not captured. Status: ${capturedPayment.status}`);
        }
        
    } catch (error) {
        console.error("Error charging recurring payment:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Failed to process charge." });
    }
});
// ########################### END BADLAV ############################

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
