import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.join(__dirname, "..", ".pi");

function ensureRuntimeConfig(): void {
  const modelsPath = path.join(agentDir, "models.json");
  const authPath = path.join(agentDir, "auth.json");
  const templatesDir = path.join(__dirname, "..", "templates");

  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  if (!fs.existsSync(modelsPath)) {
    const templateModels = path.join(templatesDir, "models.json.example");
    if (fs.existsSync(templateModels)) {
      fs.copyFileSync(templateModels, modelsPath);
    }
  }

  if (!fs.existsSync(authPath)) {
    const templateAuth = path.join(templatesDir, "auth.json.example");
    if (fs.existsSync(templateAuth)) {
      fs.copyFileSync(templateAuth, authPath);
    } else {
      fs.writeFileSync(authPath, "{}\n", "utf8");
    }
  }
}

// Shared ModelRuntime – initialised once on startup
let modelRuntime: ModelRuntime | null = null;

async function getModelRuntime(): Promise<ModelRuntime> {
  if (!modelRuntime) {
    ensureRuntimeConfig();
    modelRuntime = await ModelRuntime.create({
      modelsPath: path.join(agentDir, "models.json"),
      authPath: path.join(agentDir, "auth.json"),
    });
    await modelRuntime.setRuntimeApiKey("openai", "dummy");
    if (process.env.GROQ_API_KEY) {
      await modelRuntime.setRuntimeApiKey("groq", process.env.GROQ_API_KEY);
    }
  }
  return modelRuntime;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  sessionId: string;
  message: string;
  history: Message[];
  disableTools?: boolean;
  provider?: string;
  model?: string;
}

export interface GenerateResponse {
  answer: string;
  provider: string;
  model: string;
  requestId: string;
}

/**
 * Approximate token count (4 chars ≈ 1 token) – good enough for budget.
 */
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Trim history to fit within the context budget.
 * Always keep the most-recent messages; drop oldest user/assistant pairs first.
 */
function trimHistory(history: Message[], budget: number): Message[] {
  const trimmed: Message[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const tokens = approxTokens(history[i].content);
    if (used + tokens > budget) break;
    trimmed.unshift(history[i]);
    used += tokens;
  }
  return trimmed;
}

/**
 * Build a system prompt appropriate for a business knowledge assistant.
 */
function buildSystemPrompt(): string {
  return `You are Lenny, a knowledgeable growth strategy assistant. \
You help founders and product teams with product-led growth, user acquisition, retention, monetisation, and go-to-market strategy. \
You give clear, concise, actionable advice. \
You do not write or execute code. \
You do not access the filesystem or run shell commands. \
Answer only questions relevant to business, product, and growth strategy.`;
}

export async function generateResponse(
  req: GenerateRequest,
  signal: AbortSignal
): Promise<GenerateResponse> {
  const requestId = `${req.sessionId}-${Date.now()}`;
  const runtime = await getModelRuntime();

  const providerName = req.provider || "ollama";
  const modelName = req.model || config.ollamaModel;
  
  // The local ollama is configured as "openai" in models.json, whereas groq is configured as "groq".
  // If providerName is ollama, map it to openai. Otherwise use providerName directly.
  const sdkProvider = providerName === "ollama" ? "openai" : providerName;
  
  const model = runtime.getModel(sdkProvider, modelName);
  if (!model) {
    throw new Error(
      `Model ${sdkProvider}/${modelName} not found. Check models.json or provider API keys.`
    );
  }

  // Trim history to context budget
  const trimmed = trimHistory(req.history, config.maxHistoryTokensApprox);

  // Build a single prompt string from history + current message
  // Pi SDK's `prompt()` takes the current user turn; prior history must be
  // injected via the system prompt or by reconstructing in-memory session messages.
  // The cleanest approach: prepend history as a formatted context block in system prompt.
  let historyBlock = "";
  if (trimmed.length > 0) {
    historyBlock =
      "\n\n--- Previous conversation (for context) ---\n" +
      trimmed
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n") +
      "\n--- End of history ---\n";
  }

  const systemPrompt = buildSystemPrompt() + historyBlock;

  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir,
    // No extension paths – we only use inline factories
    additionalExtensionPaths: [],
    extensionFactories: [
      // Minimal inline extension: registers only the harmless status tool
      (pi) => {
        pi.registerTool({
          name: "get_project_status",
          label: "Get Project Status",
          description:
            "Returns the current deployment status of the Lenny assistant service.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
          execute: async (_id, _params, _sig, _upd, _ctx) => ({
            content: [
              {
                type: "text",
                text: "Lenny Growth Assistant is running. All systems operational.",
              },
            ],
            details: {},
          }),
        });
      },
    ],
  });

  await resourceLoader.reload();

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
    defaultThinkingLevel: "off",
  });

  const { session } = await createAgentSession({
    model,
    modelRuntime: runtime,
    // Only allow the status tool – no coding/fs/shell tools
    tools: req.disableTools ? [] : ["get_project_status"],
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
    // @ts-ignore
    systemPrompt,
  });

  let answer = "";

  const unsubscribe = session.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      answer += event.assistantMessageEvent.delta;
    }
  });

  // Abort if caller cancels
  signal.addEventListener("abort", () => {
    session.dispose();
  });

  try {
    await session.prompt(req.message);
    if (!answer) {
      answer = session.getLastAssistantText() ?? "";
    }
  } finally {
    unsubscribe();
    session.dispose();
  }

  return {
    answer: answer.trim(),
    provider: providerName,
    model: modelName,
    requestId,
  };
}
