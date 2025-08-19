const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // Render जैसे प्लेटफॉर्म PORT एनवायरमेंट वेरिएबल का उपयोग करते हैं

app.get('/', (req, res) => {
  res.send('Hello from Soul Spark!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
