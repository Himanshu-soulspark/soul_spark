const express = require('express');
const cors = require('cors'); // CORS पैकेज
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');

const app = express();

// ########## START: ZAROORI BADLAV (CORS को ठीक करने के लिए) ##########
// सर्वर को बताएं कि सिर्फ आपकी वेबसाइट से आने वाली रिक्वेस्ट को ही स्वीकार करना है
const corsOptions = {
  origin: 'https://shubhzone.shop', // <<== यहाँ आपका डोमेन नाम है
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// ####################################################################

app.use(express.json({ limit: '10mb' }));

// --- Firebase Admin SDK (कोई बदलाव नहीं) ---
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin SDK initialized.");
} catch (error) {
  console.error("❌ FATAL ERROR: Firebase Admin SDK could not be initialized.", error.message);
  process.exit(1);
}
const db = admin.firestore();

// --- Razorpay (कोई बदलाव नहीं) ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");

// --- Create Payment Endpoint (कोई बदलाव नहीं, यह पहले से सही है) ---
app.post('/create-payment', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
            return res.status(400).json({ error: "Name, email, and phone are required." });
        }
        const customer = await razorpay.customers.create({ name, email, contact: phone });
        const orderOptions = {
            amount: 300, currency: "INR", receipt: `rcpt_${Date.now()}`,
            customer_id: customer.id, payment_capture: 1,
            token: { recurring: true, max_amount: 99900, frequency: "as_presented" }
        };
        const order = await razorpay.orders.create(orderOptions);
        res.json({ order_id: order.id, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error("Error creating payment:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Could not create payment." });
    }
});

// --- Verify Payment Endpoint (कोई बदलाव नहीं) ---
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

// --- Charge Recurring Payment Endpoint (कोई बदलाव नहीं) ---
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

// --- Server Start (कोई बदलाव नहीं) ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
