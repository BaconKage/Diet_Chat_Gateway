require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
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

// ✅ Clear all users (for reset)
app.get('/debug/clear', async (req, res) => {
  try {
    await UserPlan.deleteMany({});
    res.json({ message: "🧹 All users deleted from MongoDB." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ /chat/fromdb/:username → Generate from MongoDB
app.post('/chat/fromdb/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const user = await UserPlan.findOne({ name: username });
    if (!user) return res.status(404).json({ error: "User not found in database." });

    const { age, gender, BMI, diet_type, goal, duration } = user;

    const profile = `Client Profile:\n- Age: ${age}\n- Gender: ${gender}\n- BMI: ${BMI}\n- Diet Preference: ${diet_type}\n- Goal: ${goal}\n- Duration: ${duration}`;

    const systemPrompt = `You are a certified AI nutritionist. Based on the following client profile, generate a personalized ${duration} diet plan.`;

    const formattedRequest = `\n📋 ${profile}\n\nGenerate a complete diet plan with:\n1. Personalized calorie targets\n2. Macronutrient breakdown (carbs, protein, fats)\n3. 3 meals + 2 snacks daily\n4. Variety of healthy food\n5. Hydration, exercise & supplements\n\nOutput format:\n- Weekly Summary\n- Daily Plan\n- Tips & Notes`;

    const response = await axios.post(
      FASTAPI_URL,
      { message: formattedRequest, planType: duration },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.reply?.trim();
    if (!reply || reply.includes("Client Profile") || reply.includes("You are a certified AI nutritionist")) {
      return res.status(500).json({ error: "Unexpected response format from AI." });
    }

    const updatedUser = await UserPlan.findOneAndUpdate(
      { name: username },
      { plan: reply },
      { new: true }
    );

    res.json({ reply });
  } catch (error) {
    console.error("❌ Error in /chat/fromdb:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send("✅ Diet Chat Gateway with MongoDB is running.");
});

// ✅ Debug: List all users
app.get('/debug/all-users', async (req, res) => {
  try {
    const users = await UserPlan.find({});
    res.json({ count: users.length, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Debug: Seed multiple users without plans
app.get('/debug/seed', async (req, res) => {
  try {
    const sampleUsers = [
      { name: "Riya Kapoor", age: 27, gender: "female", goal: "gain muscle", BMI: 21.4, diet_type: "vegetarian", duration: "month" },
      { name: "John Doe", age: 35, gender: "male", goal: "lose fat", BMI: 29.8, diet_type: "non-vegetarian", duration: "week" },
      { name: "Aarav Patel", age: 22, gender: "male", goal: "stay fit", BMI: 23.1, diet_type: "vegetarian", duration: "month" },
      { name: "Sneha Rao", age: 30, gender: "female", goal: "improve stamina", BMI: 20.2, diet_type: "vegan", duration: "week" },
      { name: "Kabir Mehra", age: 28, gender: "male", goal: "gain weight", BMI: 18.5, diet_type: "vegetarian", duration: "month" }
    ];

    const inserts = await Promise.all(sampleUsers.map(async (userData) => {
      return await UserPlan.findOneAndUpdate(
        { name: userData.name },
        userData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }));

    res.json({ message: "✅ Sample users added/updated", users: inserts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
