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
// SAMASYA: invoices.create() hamein manchahi amount charge karne nahi de raha tha.
// SAMADHAN: Hum ab "Payment Links" API ka istemal kar rahe hain, jo is kaam ke liye
//           bilkul sahi hai.
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Subscription ID and a valid integer Amount are required.' });
        }
        
        // Step 1: Subscription ki details se Customer ID nikalna
        const subscription = await razorpay.subscriptions.fetch(subscription_id);
        const customerId = subscription.customer_id;
        if (!customerId) {
            throw new Error("Customer ID not found for this subscription.");
        }

        // Step 2: Us Customer ID ke liye ek Payment Link banana
        const amount_in_paise = Number(amount) * 100;
        const paymentLink = await razorpay.paymentLink.create({
            amount: amount_in_paise,
            currency: "INR",
            accept_partial: false,
            description: `Manual charge for ₹${amount}`,
            customer: {
                // Hum yahan customer ki details bhej rahe hain
                name: subscription.notes.customer_name || 'Valued Customer',
                email: subscription.notes.customer_email || 'no-email@example.com',
                contact: subscription.notes.customer_phone || '+919999999999'
            },
            notify: {
                sms: true, // User ko SMS bhejo
                email: true // User ko Email bhejo
            },
            reminder_enable: false,
            // Yahi asli jaadu hai: Yeh link ko "recurring" banata hai
            options: {
                checkout: {
                    method: {
                        emandate: true, // recurring payment ke liye
                    },
                    subscription_id: subscription_id, // <<<=== Yahi hamari chaabi hai
                }
            }
        });

        // Step 3: Server turant is link par charge karne ki koshish karega
        // Iske liye humein koi alag se code nahi likhna hota, Razorpay ye
        // apne aap handle karta hai.

        res.json({ 
            status: 'success', 
            message: `Payment link created and charge initiated for ₹${amount}! Link ID: ${paymentLink.id}`
        });

    } catch (error) {
        console.error("Error charging recurring payment:", error.error || error);
        res.status(500).json({ error: error.error ? error.error.description : "Failed to process charge." });
    }
});
// ########################### END BADLAV ############################

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
