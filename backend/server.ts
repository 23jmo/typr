import OpenAI from "openai";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// CORS and body parsing first
app.use(cors());
app.use(express.json());

// Logging middleware after body parsing
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    body: req.body,
    query: req.query,
    params: req.params,
  });
  next();
});

// Error logging middleware
app.use((error, req, res, next) => {
  console.error("[Error]:", error);
  res.status(500).json({ error: error.message });
});

// use OpenAI to generate a sentence based on topic

const zod = require("zod");

const text_request_schema = zod.object({
  topic: zod.string(),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/openai", async (req, res, next) => {
  try {
    const { topic } = text_request_schema.parse(req.body); // zod parse to validate request body follows schema

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Generate a 30 word sentence based on the topic: ${topic}.`,
        },
      ],
    });
    res.json(response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error);
    next(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
