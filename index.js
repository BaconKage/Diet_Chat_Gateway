require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://diet-chat-bot.onrender.com/ai/chat';

app.use(cors());
app.use(express.json());

// MongoDB setup
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

// 🔥 Only this route
app.post('/chat/fromdb/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const user = await UserPlan.findOne({ name: username });

    if (!user) return res.status(404).json({ error: "User not found in database." });

    const { age, gender, goal, BMI, diet_type, duration } = user;

    const prompt = `A ${age}-year-old ${diet_type} ${gender} wants to ${goal}. BMI is ${BMI}.`;

    const response = await axios.post(
      FASTAPI_URL,
      { message: prompt, planType: duration },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const plan = response.data.reply || "⚠️ No reply";
    user.plan = plan;
    await user.save();

    res.json({ plan });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🧪 Health check
app.get('/', (req, res) => {
  res.send("✅ Minimal MongoDB-only Diet Plan Server is live.");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
