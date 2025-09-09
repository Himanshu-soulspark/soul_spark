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


// ########## START: ZAROORI BADLAV #2 - AUTOMATION KE LIYE HELPER FUNCTION ##########
// Yeh function paise kaatne ki asli koshish karega
async function tryChargingUser(subscriptionId, amountInPaise) {
    try {
        console.log(`Attempting to charge ₹${amountInPaise / 100} on subscription ${subscriptionId}`);
        // IMPORTANT: Yahan par Razorpay ki asli API call aayegi. Abhi ke liye yeh DUMMY hai.
        const isSuccess = Math.random() > 0.5; // 50% success rate simulate karein
        if (isSuccess) {
            const dummyPaymentId = `pay_${crypto.randomBytes(7).toString('hex')}`;
            console.log(`SUCCESS: Dummy charge successful for ₹${amountInPaise / 100}. Payment ID: ${dummyPaymentId}`);
            return { status: 'success', paymentId: dummyPaymentId };
        } else {
            throw new Error("Simulated payment failure (e.g., Insufficient Funds).");
        }
    } catch (error) {
        console.error(`ERROR: Dummy charge failed for ₹${amountInPaise / 100}. Reason: ${error.message}`);
        return { status: 'failed', error: error.message };
    }
}
// ##########################################################################


// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (Yahan zaroori badlav hain)
// =================================================================

app.post('/create-payment', async (req, res) => {
    // ... (Aapka naya 'On-Demand' wala /create-payment code yahan hai, isme koi badlav nahi) ...
    try {
        const { isSubscription } = req.body;
        if (isSubscription) {
            const subscriptionOptions = { total_count: 20, quantity: 1, customer_notify: 1, addons: [{ item: { name: "Mandate Authentication Fee", amount: 100, currency: "INR" }}], notes: { mandate_type: "on_demand_for_shubhzone" } };
            const subscription = await razorpay.subscriptions.create(subscriptionOptions);
            return res.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID });
        }
    } catch (error) {
        console.error("Error creating on-demand subscription:", error);
        res.status(500).json({ error: "Could not create payment mandate." });
    }
});

// ########## START: ZAROORI BADLAV #3 - FINAL VERIFICATION LOGIC (KAAM SAUNPNE WALA) ##########
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

        if (razorpay_subscription_id) {
             const attributes = { razorpay_payment_id, razorpay_subscription_id, razorpay_signature };
             razorpay.utils.verifyPaymentSignature(attributes);
             console.log(`Successfully authenticated subscription ${razorpay_subscription_id}.`);

             // Firebase me ek naya 'task' bana rahe hain.
             const chargeTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minute baad
             await db.collection('automationTasks').add({
                subscriptionId: razorpay_subscription_id,
                status: 'pending_2000',
                chargeAt: admin.firestore.Timestamp.fromDate(chargeTime),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
             });
             
             console.log(`Task created in Firebase to charge ₹2000 for ${razorpay_subscription_id} at ${chargeTime.toLocaleTimeString()}`);
             return res.json({ status: 'success', message: 'Subscription setup successful! Your plan will be activated shortly.' });
        }
    } catch (error) {
        console.error("Error in /verify-payment:", error);
        res.status(500).json({ status: 'failure', message: error.message || "Verification failed on server." });
    }
});
// ####################################################################################


// ########## START: ZAROORI BADLAV #4 - FINAL CRON JOB LOGIC (UPTIME ROBOT KE LIYE) ##########
app.get('/run-automation-tasks', async (req, res) => { // app.post se app.get kar diya
    // Ab hum header ki jagah query se secret lenge
    const cronSecret = req.query.secret; 
    if (cronSecret !== process.env.CRON_JOB_SECRET) {
        return res.status(401).send('Unauthorized');
    }

    console.log("Uptime Robot running to process tasks...");
    const now = admin.firestore.Timestamp.now();

    try {
        const tasksSnapshot = await db.collection('automationTasks').where('chargeAt', '<=', now).where('status', 'in', ['pending_2000', 'pending_200']).get();

        if (tasksSnapshot.empty) {
            return res.status(200).send('No tasks to run right now.');
        }

        for (const doc of tasksSnapshot.docs) {
            const task = doc.data();
            const taskId = doc.id;

            if (task.status === 'pending_2000') {
                const result = await tryChargingUser(task.subscriptionId, 200000);
                if (result.status === 'success') {
                    console.log(`Task ${taskId} SUCCESS: Charged ₹2000.`);
                    await db.collection('automationTasks').doc(taskId).delete();
                } else {
                    console.log(`Task ${taskId} FAILED: Could not charge ₹2000. Scheduling fallback.`);
                    const newChargeTime = new Date(Date.now() + 15 * 60 * 1000);
                    await db.collection('automationTasks').doc(taskId).update({
                        status: 'pending_200',
                        chargeAt: admin.firestore.Timestamp.fromDate(newChargeTime)
                    });
                }
            } 
            else if (task.status === 'pending_200') {
                const result = await tryChargingUser(task.subscriptionId, 20000);
                if (result.status === 'success') {
                    console.log(`Task ${taskId} SUCCESS (Fallback): Charged ₹200.`);
                    await db.collection('automationTasks').doc(taskId).delete();
                } else {
                    console.log(`Task ${taskId} FAILED: Both charges failed. Marking as completed_failed.`);
                    await db.collection('automationTasks').doc(taskId).update({ status: 'completed_failed' });
                }
            }
        }
        res.status(200).send('Tasks processed successfully.');
    } catch (error) {
        console.error("Error in Cron Job:", error);
        res.status(500).send('Error processing tasks.');
    }
});
// #################################################################################

// =================================================================
// BAAKI KE SARE API ENDPOINTS (Inme koi badlav nahi kiya gaya hai)
// =================================================================
// ... (Aapke AI, YouTube, Weather, Face++, etc. wale saare functions yahan hain) ...

// =================================================================
// 5. WEBSITE SERVING & SERVER START (Isme koi badlav nahi)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
// ... (Aapka original static serving code yahan hai) ...

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
