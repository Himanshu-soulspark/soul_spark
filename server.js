import express from 'express';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

let apiKey;
try {
    const secretFilePath = '/etc/secrets/dareplay_secrets.json';
    if (fs.existsSync(secretFilePath)) {
        apiKey = JSON.parse(fs.readFileSync(secretFilePath, 'utf8')).API_KEY;
    } else {
        console.warn("Secret file not found.");
    }
} catch (err) {
    console.error("Could not read or parse secret file:", err);
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/generate-dares', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: "AI Service is not configured." });
    }
    
    try {
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        
        // --- मास्टर प्रॉम्प्ट (MASTER PROMPT) ---
        const prompt = `Create a 5-step "Challenge Series" for a dare app in Hinglish. The series should feel like a psychological adventure, starting easy and becoming progressively harder. The challenges must be SAFE and must NOT involve suicide, self-harm, harm to others, illegal acts, or bullying. The goal is to push a user's comfort zone, creativity, and discipline. The dares should look simple but be mentally challenging. Provide the output ONLY as a valid JSON array of 5 strings.

        Here is the required structure:
        1.  **Easy (Warm-up):** A simple, slightly unusual public act. (e.g., "Public park mein 5 minute tak meditation karo.")
        2.  **Helpful (Empathy):** A task that involves helping someone or improving the community. (e.g., "Apne local area ke ek small shopkeeper ka business free mein promote karo social media par.")
        3.  **Hard (Discipline/Patience):** A challenge requiring self-control over 24 hours. (e.g., "24 ghante tak, har 1 ghante mein 1 glass paani piyo aur ek page book ka padho. Iska time-lapse video banao.")
        4.  **Harder (Creativity/Skill):** A challenge to create something new and share it. (e.g., "Ek social issue par ek short poem ya gaana likho, perform karo aur video post karo.")
        5.  **Master (Social/Fear):** A major public challenge that requires overcoming social anxiety but is positive. (e.g., "Ek busy street par 'Free Compliments' ka board lekar khade ho jao aur 10 anjaan logo ko genuine compliments do.")

        Do not include any other text or markdown like \`\`\`json. Just the raw JSON array.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (!response || !response.text) {
             throw new Error("AI response was blocked or empty.");
        }

        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dares = JSON.parse(text);

        if (!Array.isArray(dares) || dares.length !== 5) {
            throw new Error("AI did not return dares in the correct format.");
        }
        res.json({ dares });

    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ error: `AI Error: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
