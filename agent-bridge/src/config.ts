export const config = {
  port: parseInt(process.env.PI_BRIDGE_PORT ?? "3001", 10),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
  // Max tokens of conversation history to send (qwen3:1.7b has 4096 ctx)
  maxHistoryTokensApprox: 2000,
  requestTimeoutMs: parseInt(process.env.MODEL_REQUEST_TIMEOUT ?? "120000", 10),
} as const;
