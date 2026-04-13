// export const claudeAgentRunnerScript = String.raw`
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getAllowedToolsForRunner,
  getCrmMcpServersFromEnv,
  getTelegramMcpServersFromEnv,
} from "./runner-config.mjs";

const prompt = process.env.CLAUDE_AGENT_PROMPT ?? "";
const telegramMcpServers = getTelegramMcpServersFromEnv(process.env);
const hasTelegramMcp = Boolean(telegramMcpServers);
const crmMcpServers = getCrmMcpServersFromEnv(process.env);
const hasCrmMcp = Boolean(crmMcpServers);

process.stderr.write(
  `${JSON.stringify({
    type: "runner-bootstrap",
    hasAnthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    claudeCodeExecutable: process.env.CLAUDE_CODE_EXECUTABLE ?? null,
    promptLength: prompt.length,
  })}\n`
);

const options = {
  includePartialMessages: true,
  maxTurns: 12,
  allowedTools: getAllowedToolsForRunner({
    hasTelegramMcp,
    hasCrmMcp,
    hasVisionAnalyze: Boolean(process.env.OPENAI_API_KEY),
  }),
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true,
  mcpServers: {},
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append:
      "You are answering inside an isolated Vercel Sandbox. Reply to the user with plain helpful text. Stream your response naturally. Do not emit markdown code fences unless the answer needs code.",
  },
};

if (process.env.CLAUDE_CODE_EXECUTABLE) {
  options.pathToClaudeCodeExecutable = process.env.CLAUDE_CODE_EXECUTABLE;
}

if (telegramMcpServers) {
  options.mcpServers = {
    ...options.mcpServers,
    ...telegramMcpServers,
  };
}

if (crmMcpServers) {
  options.mcpServers = {
    ...options.mcpServers,
    ...crmMcpServers,
  };
}

let stream;

try {
  stream = query({
    prompt,
    options,
  });
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      type: "runner-query-init-error",
      error: error instanceof Error ? error.message : String(error),
    })}\n`
  );
  throw error;
}

let exitCode = 0;

try {
  for await (const message of stream) {
    process.stdout.write(
      `${JSON.stringify({ type: "sdk-message", message })}\n`
    );

    if (message.type === "result" && message.is_error) {
      exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      type: "runner-stream-error",
      error: error instanceof Error ? error.message : String(error),
    })}\n`
  );
  throw error;
}

process.stdout.write(`${JSON.stringify({ type: "runner-complete" })}\n`);
process.exit(exitCode);
// `;
