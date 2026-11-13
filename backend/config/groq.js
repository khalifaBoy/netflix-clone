import "dotenv/config";
import Groq from "groq-sdk";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_RERANK_TIMEOUT_MS = 5000;
const MIN_RERANK_TIMEOUT_MS = 250;
const MAX_RERANK_TIMEOUT_MS = 30000;

const isEnabled = (value) => value === undefined
  || ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());

const configuredTimeout = () => {
  const parsed = Number.parseInt(process.env.GROQ_RERANK_TIMEOUT_MS, 10);
  if (!Number.isSafeInteger(parsed)) return DEFAULT_RERANK_TIMEOUT_MS;
  return Math.max(MIN_RERANK_TIMEOUT_MS, Math.min(MAX_RERANK_TIMEOUT_MS, parsed));
};

export const getGroqRerankingConfig = () => ({
  enabled: isEnabled(process.env.GROQ_RERANKING_ENABLED),
  hasApiKey: Boolean(process.env.GROQ_API_KEY?.trim()),
  model: process.env.GROQ_MODEL || DEFAULT_MODEL,
  timeoutMs: configuredTimeout(),
});

/** Construct the optional provider client only when an endpoint needs it. */
export const getGroqClient = ({ reranking = false } = {}) => {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  return new Groq({
    apiKey,
    ...(reranking
      ? { timeout: configuredTimeout(), maxRetries: 0 }
      : {}),
  });
};

// Keep the legacy search controller's call shape, but defer key validation and
// client creation until that endpoint is actually requested.
const groq = {
  chat: {
    completions: {
      create: (...args) => {
        const client = getGroqClient();
        if (!client) throw new Error("Groq client is not configured");
        return client.chat.completions.create(...args);
      },
    },
  },
};

export default groq;
