require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'my-secret-key';
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://diet-chat-bot.onrender.com/ai/chat';
const upload = multer({ dest: 'uploads/' });

// ✅ MongoDB Setup
mongoose.connect(process.env.CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
  gender: String,
  goal: String,
  BMI: Number,
  diet_type: String,
  duration: String,
  plan: String
});

const UserPlan = mongoose.model("UserPlan", userSchema);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ /login → Get JWT token
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username is required" });

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// ✅ Token Middleware
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

// ✅ /chat → Manual plan generation
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

    await UserPlan.findOneAndUpdate(
      { name: username },
      { name: username, plan: reply },
      { upsert: true, new: true }
    );

    res.json({ reply });
  } catch (error) {
    console.error("❌ Chat error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ /chat/file → Bulk CSV Upload
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

        await UserPlan.findOneAndUpdate(
          { name },
          { name, age, gender, goal, BMI, diet_type, duration, plan },
          { upsert: true, new: true }
        );

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

// ✅ /chat/fromdb/:username → Generate Plan from DB
app.post('/chat/fromdb/:username', verifyToken, async (req, res) => {
  const username = req.params.username;

  try {
    const user = await UserPlan.findOne({ name: username });

    if (!user) return res.status(404).json({ error: "User not found in database." });

    const { age, gender, goal, BMI, diet_type, duration } = user;

    const prompt = `A ${age}-year-old ${diet_type} ${gender} wants to ${goal}. BMI is ${BMI}.`;

    const response = await axios.post(
      FASTAPI_URL,
      { message: prompt, planType: duration },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers['authorization']
        }
      }
    );

    const plan = response.data.reply || "⚠️ No reply";
    user.plan = plan;
    await user.save();

    res.json({ plan });

  } catch (err) {
    console.error("❌ Error generating plan from MongoDB:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ /plan/:username → View Plan
app.get('/plan/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const user = await UserPlan.findOne({ name: username });
    if (!user || !user.plan) {
      return res.status(404).json({ error: "No plan found for this user." });
    }
    res.json({ plan: user.plan });
  } catch (err) {
    res.status(500).json({ error: "Error fetching plan", details: err.message });
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send("✅ Diet Chat Gateway with MongoDB is running.");
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
