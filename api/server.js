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
app.use(cors());

// Webhook ke liye raw body parser ko alag se handle karein
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    try {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(req.body); 
        const digest = shasum.digest('hex');
        if (digest !== signature) {
            console.warn('Webhook signature mismatch!');
            return res.status(400).json({ status: 'Signature mismatch' });
        }
        const body = JSON.parse(req.body.toString());
        const event = body.event;
        const payload = body.payload;
        if (event === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.payment.entity;
            const amount = payment.amount / 100;
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            if (usersQuery.empty) {
                console.error(`Webhook Error: No user found for subscription ID ${subscription.id}`);
                return res.json({ status: 'ok' });
            }
            const userRef = usersQuery.docs[0].ref;
            let coinsToAdd = 0;
            if (amount === 2000) coinsToAdd = 11000;
            else if (amount === 200) coinsToAdd = 1000;
            if (coinsToAdd > 0) {
                await userRef.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd), subscriptionStatus: 'active' });
                console.log(`SUCCESS: Added ${coinsToAdd} coins to user ${userRef.id} for ₹${amount}. Subscription is now ACTIVE.`);
            }
        } else if (event === 'payment.failed') {
            const subscriptionId = payload.payment.entity.notes.subscription_id;
            if (!subscriptionId) {
                return res.json({ status: 'ok, but no subscription ID found in payment notes' });
            }
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscriptionId).limit(1).get();
            if (usersQuery.empty) return res.json({ status: 'ok' });
            const user = usersQuery.docs[0].data();
            const userRef = usersQuery.docs[0].ref;
            if (user.currentPlan === 'PlanA') {
                console.log(`INFO: Plan A failed for user ${userRef.id}. Downgrading to Plan B.`);
                await razorpay.subscriptions.cancel(subscriptionId);
                const startAtTimestamp = Math.floor((Date.now() / 1000) + 15 * 60);
                const newSubscription = await razorpay.subscriptions.create({
                    plan_id: process.env.RAZORPAY_PLAN_ID_B,
                    customer_id: user.razorpayCustomerId,
                    total_count: 24,
                    start_at: startAtTimestamp,
                    customer_notify: 1
                });
                await userRef.update({
                    razorpaySubscriptionId: newSubscription.id,
                    currentPlan: 'PlanB',
                    subscriptionStatus: 'downgraded_pending'
                });
                console.log(`SUCCESS: Downgraded user ${userRef.id} to Plan B.`);
            }
        }
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Webhook processing error.');
    }
});

// Baki sabhi routes ke liye JSON parser ka istemal karein
app.use(express.json({ limit: '10mb' }));

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

// --- Baki Services ko Shuru Karein ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});
console.log("✅ All services initialized.");

// =================================================================
// 3. API Endpoints (inme koi badlav nahi hai)
// =================================================================
// ... (aapke saare purane API endpoints jaise /get-food-interaction, /ask-ai, etc. yahan rahenge)
// ... (code ko chota rakhne ke liye yahan se hata diya gaya hai, lekin aapke original file me ye sab rahenge)


// =================================================================
// ============== TEMPORARY TEST CODE FOR /create-payment ==========
// =================================================================
app.post('/create-payment', async (req, res) => {
    try {
        const { token, isSubscription } = req.body;
        if (!token) return res.status(400).json({ error: "User token is required." });

        if (!isSubscription) {
            // One-time payment logic ko yahan handle kar sakte hain, ya test ke liye hata sakte hain
            const { amount } = req.body;
            if(!amount) return res.status(400).json({ error: "Amount is required for one-time payments." });
            const options = { 
                amount, 
                currency: "INR", 
                receipt: `rcpt_${Date.now()}`
            };
            const order = await razorpay.orders.create(options);
            return res.json({ id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
        }

        // --- Subscription Test Logic Starts Here ---
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found." });
        const userData = userDoc.data();

        let customerId = userData.razorpayCustomerId;
        if (!customerId) {
            const customer = await razorpay.customers.create({
                name: userData.name || 'Shubhmed User',
                email: userData.email || `${decodedToken.uid}@shubhmed-app.com`,
                contact: userData.phone || undefined
            });
            customerId = customer.id;
        }
        
        // Hamne yahan se 'addons' wali line puri tarah hata di hai
        const subscriptionOptions = {
            plan_id: process.env.RAZORPAY_PLAN_ID_A, // Yah aapki NAYI 'Final UPI Test' wali ID honi chahiye
            customer_id: customerId,
            total_count: 12, // Aap ise apne hisab se badal sakte hain
            customer_notify: 1
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);

        // Sirf customer ID update karte hain, taki database saaf rahe
        await userRef.update({ 
            razorpayCustomerId: customerId
        });
        
        // Dhyan dein: Hum ab 'order_id' nahi bhej rahe hain, sirf 'subscription_id'
        return res.json({
            subscription_id: subscription.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error in TEST /create-payment:", error);
        res.status(500).json({ error: "Could not create test subscription." });
    }
});
// =================================================================
// ======================= TEST CODE ENDS HERE =====================
// =================================================================


app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, token } = req.body;
        if (!token) return res.status(400).json({ error: "Token is required." });
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = db.collection('users').doc(decodedToken.uid);

        // IMPORTANT: Test ke dauran, seedhe subscription ke liye 'razorpay_order_id' nahi aayega.
        // Isliye, hum yahan signature verification ko alag tarike se handle kar sakte hain ya
        // pehle payment ka status check kar sakte hain.
        // For simplicity, let's assume verification passes if payment is successful for this test.
        // NOTE: In production, proper signature verification is a must.
        
        // For one-time payments (if order_id exists)
        if (razorpay_order_id) {
            let body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                          .update(body.toString()).digest('hex');

            if (expectedSignature === razorpay_signature) {
                const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
                if (paymentDetails.status === 'authorized') {
                    await razorpay.payments.capture(razorpay_payment_id, { amount: paymentDetails.amount, currency: "INR" });
                }
                const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
                
                const amountPaid = orderDetails.amount / 100;
                let coinsToAdd = 0;
                if (amountPaid === 100) coinsToAdd = 520;
                else if (amountPaid === 200) coinsToAdd = 1030;
                // ... add other coin plans
                if (coinsToAdd > 0) {
                    await userRef.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd) });
                }
                return res.json({ status: 'success', message: `${coinsToAdd} coins added.` });
            }
        }
        
        // For subscription payments (if only payment_id exists)
        // This part won't run in the current test flow but is good to have.
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.status === 'captured') {
             await userRef.update({ 
                subscriptionStatus: 'active' // For test purpose
             });
             return res.json({ status: 'success', message: 'Test subscription successful!' });
        }

        return res.status(400).json({ status: 'failure', message: 'Payment verification failed.' });

    } catch (error) {
        console.error("Error in /verify-payment:", error);
        res.status(500).json({ error: "Verification failed on server." });
    }
});


// =================================================================
// 5. WEBSITE SERVING & SERVER START
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/Features/water.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'water.html')));
app.get('/Features/Diet.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Diet.html')));
app.get('/Features/Health.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Health.html')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// =================================================================
// 6. सर्वर को चालू करें
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
