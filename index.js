import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import mongoose from 'mongoose';

dotenv.config();

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

// ✅ /chat/fromdb/:username → Generate from MongoDB
app.post('/chat/fromdb/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const user = await UserPlan.findOne({ name: username });
    if (!user) return res.status(404).json({ error: "User not found in database." });

    const { age, gender, BMI, diet_type, goal, duration } = user;

    const profile = `Age: ${age}, Gender: ${gender}, BMI: ${BMI}, Diet: ${diet_type}, Goal: ${goal}`;

    const formattedRequest = `Create a ${duration} diet plan using ONLY foods from the MongoDB 'foods' collection. Personalize it for ${profile}. Focus on meals, hydration, workouts, and one motivational tip. Return only the plan.`;

    const response = await axios.post(
      FASTAPI_URL,
      { message: formattedRequest, planType: duration },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.reply?.trim();
    if (!reply || reply.toLowerCase().includes("client profile") || reply.toLowerCase().includes("you are a certified")) {
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

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
