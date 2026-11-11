import "dotenv/config";
import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is missing. Please add it to your .env file.");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default groq;
