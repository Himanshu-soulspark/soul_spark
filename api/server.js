const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// एक टेस्ट रास्ता बनाएँ
app.get('/', (req, res) => {
  res.send('Shubhmed Test Server is running successfully!');
});

// सर्वर को चालू करें
app.listen(PORT, () => {
  console.log(`✅✅✅ Shubhmed Test Server is listening on port ${PORT} ✅✅✅`);
});
