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

// --- सीक्रेट्स लोड करें और जाँचें ---
console.log("Server starting up. Attempting to load secrets...");
let apiKey, razorpayKeyId, razorpayKeySecret;
try {
    const secretFilePath = '/etc/secrets/dareplay_secrets.json';
    if (fs.existsSync(secretFilePath)) {
        const secretFile = fs.readFileSync(secretFilePath, 'utf8');
        console.log("Secret file read successfully.");
        const secrets = JSON.parse(secretFile);
        
        // हर की को अलग-अलग लोड करें
        apiKey = secrets.API_KEY;
        razorpayKeyId = secrets.RAZORPAY_KEY_ID;
        razorpayKeySecret = secrets.RAZORPAY_KEY_SECRET;

        // जाँचें कि कौन सी की मिली है और कौन सी नहीं
        console.log(`Google AI Key loaded: ${!!apiKey}`);
        console.log(`Razorpay Key ID loaded: ${!!razorpayKeyId}`);
        console.log(`Razorpay Key Secret loaded: ${!!razorpayKeySecret}`);

    } else {
         console.error("CRITICAL: Secret file not found at path:", secretFilePath);
    }
} catch (err) {
    console.error("CRITICAL: Could not read or parse secret file:", err);
}

// यह जांचना कि कीज़ लोड हुई हैं या नहीं
if (!razorpayKeyId || !razorpayKeySecret) {
    console.error("FATAL: One or more required Razorpay keys are missing. Server cannot start.");
    process.exit(1); // अगर कीज़ नहीं हैं तो सर्वर बंद कर दें
}
console.log("All required keys loaded successfully. Initializing services...");

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });

// बाकी का कोड वही है...

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/get-key', (req, res) => res.json({ keyId: razorpayKeyId }));
app.post('/api/create-order', async (req, res) => { /* ... */ });
app.post('/api/verify-payment', async (req, res) => { /* ... */ });
app.listen(port, () => console.log(`Server is running successfully on port ${port}`));
