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
app.use(express.json()); // JSON बॉडी को पार्स करने के लिए
const port = process.env.PORT || 3001;

// --- सीक्रेट्स को अलग-अलग फ़ाइलों से लोड करें ---
console.log("Server starting up. Attempting to load secrets from separate files...");
let apiKey, razorpayKeyId, razorpayKeySecret;

function readSecretFromFile(fileName) {
    try {
        const filePath = path.join('/etc/secrets', fileName);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        }
        console.error(`Secret file not found: ${fileName}`);
        return null;
    } catch (error) {
        console.error(`Error reading secret file ${fileName}:`, error);
        return null;
    }
}

apiKey = readSecretFromFile('dareplay_secrets.json');
razorpayKeyId = readSecretFromFile('RAZORPAY_KEY_ID');
razorpayKeySecret = readSecretFromFile('RAZORPAY_KEY_SECRET');

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

// --- मुख्य वेब पेज को सर्व करें ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API: फ्रंटएंड को सुरक्षित रूप से की आईडी दें ---
app.get('/api/get-key', (req, res) => {
    res.json({ keyId: razorpayKeyId });
});


// --- API: Razorpay ऑर्डर बनाएँ (अब उपयोगकर्ता की जानकारी के साथ) ---
app.post('/api/create-order', async (req, res) => {
    // फ्रंटएंड से उपयोगकर्ता का नाम और ईमेल प्राप्त करें
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: "Name and Email are required." });
    }

    let amountInPaise;

    // विशेष छूट की शर्त
    const specialEmail = "udbhavscience12@gmail.com";
    const specialName = "himanshu maurya";

    // नाम और ईमेल को केस-इनसेंसिटिव बनाने के लिए लोअरकेस में बदलें
    if (email.toLowerCase() === specialEmail && name.toLowerCase() === specialName) {
        // विशेष उपयोगकर्ता के लिए कीमत: ₹1
        amountInPaise = 1 * 100;
        console.log(`Special user detected: ${name}. Applying discounted price of ₹1.`);
    } else {
        // अन्य सभी उपयोगकर्ताओं के लिए कीमत: ₹10
        amountInPaise = 10 * 100;
        console.log(`Regular user detected: ${name}. Applying standard price of ₹10.`);
    }

    const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_dare_${Date.now()}`
    };
    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay order creation failed:", error);
        res.status(500).send("Error creating payment order.");
    }
});

// --- API: भुगतान की पुष्टि करें और डेयर जनरेट करें ---
app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body.toString()).digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    }

    if (!genAI) return res.status(500).json({ error: "AI Service is not configured." });

    try {
        const safetySettings = [/*...safety settings...*/];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        const prompt = `Generate 5 creative, psychologically challenging dares for a social media app in Hinglish...`; // प्रॉम्प्ट वही है
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dares = JSON.parse(text);

        res.json({ success: true, dares });
    } catch (error) {
        console.error("AI Generation Error after payment:", error);
        res.status(500).json({ error: "Payment was successful, but failed to generate dares." });
    }
});

app.listen(port, () => {
    console.log(`Server is running successfully on port ${port}`);
});
