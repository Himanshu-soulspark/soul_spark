import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const port = process.env.PORT || 3001;

// --- सीक्रेट्स को अलग-अलग फ़ाइलों से लोड करें ---
console.log("Server starting up. Attempting to load secrets from separate files...");
let apiKey, razorpayKeyId, razorpayKeySecret;

function readSecretFromFile(fileName) {
    try {
        // Render सीक्रेट फ़ाइलों को /etc/secrets/ डायरेक्टरी में रखता है
        const filePath = path.join('/etc/secrets', fileName);
        if (fs.existsSync(filePath)) {
            // .trim() किसी भी अतिरिक्त खाली जगह को हटा देता है
            return fs.readFileSync(filePath, 'utf8').trim();
        }
        console.error(`Secret file not found: ${fileName}`);
        return null;
    } catch (error) {
        console.error(`Error reading secret file ${fileName}:`, error);
        return null;
    }
}

// हर की को उसकी अपनी फ़ाइल से पढ़ें
apiKey = readSecretFromFile('dareplay_secrets.json'); // यह JSON नहीं है, सिर्फ टेक्स्ट है
razorpayKeyId = readSecretFromFile('RAZORPAY_KEY_ID');
razorpayKeySecret = readSecretFromFile('RAZORPAY_KEY_SECRET');


// जाँचें कि कीज़ लोड हुई हैं या नहीं
console.log(`Google AI Key loaded: ${!!apiKey}`);
console.log(`Razorpay Key ID loaded: ${!!razorpayKeyId}`);
console.log(`Razorpay Key Secret loaded: ${!!razorpayKeySecret}`);

if (!razorpayKeyId || !razorpayKeySecret) {
    console.error("FATAL: One or more required Razorpay keys are missing. Server cannot start.");
    process.exit(1);
}
console.log("All required keys loaded successfully. Initializing services...");


const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });

// बाकी का सर्वर कोड वैसा ही रहेगा...

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/get-key', (req, res) => res.json({ keyId: razorpayKeyId }));

app.post('/api/create-order', async (req, res) => {
    const options = { amount: 10 * 100, currency: "INR", receipt: `receipt_dare_${Date.now()}` };
    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).send("Error creating payment order.");
    }
});

app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body.toString()).digest('hex');
    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed." });
    }
    if (!genAI) return res.status(500).json({ error: "AI Service is not configured." });

    try {
        const safetySettings = [/*...safety settings...*/];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        const prompt = `Generate 5 creative, psychologically challenging dares...`; // प्रॉम्प्ट वही है
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dares = JSON.parse(text);
        res.json({ success: true, dares });
    } catch (error) {
        res.status(500).json({ error: "Payment successful, but failed to generate dares." });
    }
});

app.listen(port, () => console.log(`Server is running successfully on port ${port}`));
