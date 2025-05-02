require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'my-secret-key';
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://diet-chat-bot.onrender.com/ai/chat';

const upload = multer({ dest: 'uploads/' });
const userPlans = {}; // In-memory plan store

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Route: Login → get JWT token
app.post('/login', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// ✅ Middleware: Token check
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  if (!token) return res.status(403).send("No token provided.");

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send("Unauthorized.");
  }
}

// ✅ Route: Chat → generate single plan
app.post('/chat', verifyToken, async (req, res) => {
  const { message, planType } = req.body;
  const username = req.user?.username || 'anonymous';

  try {
    const response = await axios.post(
      FASTAPI_URL,
      { message, planType },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.reply || "⚠️ No reply";
    userPlans[username] = reply;

    res.json({ reply });
  } catch (error) {
    console.error("❌ Chat error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Route: CSV upload → generate multiple plans
app.post('/chat/file', upload.single('file'), async (req, res) => {
  const token = req.body.token;
  const filePath = req.file.path;
  const results = [];

  const parseCSV = () =>
    new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', () => resolve(data))
        .on('error', (err) => reject(err));
    });

  try {
    const users = await parseCSV();

    for (const user of users) {
      const { name, age, gender, goal, BMI, diet_type, duration } = user;
      const prompt = `A ${age}-year-old ${diet_type} ${gender} wants to ${goal}. BMI is ${BMI}.`;

      try {
        const response = await axios.post(
          FASTAPI_URL,
          { message: prompt, planType: duration },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const plan = response.data.reply || "⚠️ No reply";
        userPlans[name] = plan;

        results.push({ name, plan });

      } catch (err) {
        results.push({
          name: user.name || 'Unknown',
          plan: `❌ Error: ${err.message}`
        });
      }
    }

    fs.unlinkSync(filePath);
    res.json({ plans: results });

  } catch (error) {
    console.error("❌ CSV processing error:", error.message);
    res.status(500).json({ error: "Failed to process CSV", details: error.message });
  }
});

// ✅ Route: User view → get diet plan by name
app.get('/plan/:username', (req, res) => {
  const username = req.params.username;
  const plan = userPlans[username];

  if (plan) {
    res.json({ plan });
  } else {
    res.status(404).json({ error: "No plan found for this user." });
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send("✅ Diet Chat Gateway is running.");
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
