#!/usr/bin/env node
/**
 * ACP Runner — Entesale basic template.
 *
 * conv.json shape:
 *   { modelId, cwd, systemPrompt, sessionId: string|null, newMessage: string,
 *     agentToken: string, convexSiteUrl: string }
 *
 * Session strategy (capabilities from initialize):
 *   1. sessionId + canResume  → session/resume  (no history replay)
 *   2. sessionId + canLoad    → session/load    (suppress replay notifications)
 *   3. no sessionId           → session/new     → emit _entesale:"session_created"
 *
 * session/prompt always carries only the single new user message.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const readline = require("readline");

const conversationPath = process.argv[2];
if (!conversationPath) {
  process.stderr.write("Usage: acp-runner.js <conversation.json>\n");
  process.exit(1);
}

const conv = JSON.parse(fs.readFileSync(conversationPath, "utf8"));
const CWD = conv.cwd || "/vercel/sandbox";

const opencode = spawn("opencode", ["acp"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
});

const rl = readline.createInterface({ input: opencode.stdout, crlfDelay: Infinity });

let pendingResolve = null;
let pendingReject = null;
let suppressOutput = false; // suppresses session/load history replay

rl.on("line", (line) => {
  if (!line.trim()) return;

  let msg = null;
  try { msg = JSON.parse(line); } catch { /* non-JSON line */ }

  // Resolve in-flight RPC; reset suppress on any response
  if (msg && msg.id !== undefined && pendingResolve) {
    const [res, rej] = [pendingResolve, pendingReject];
    pendingResolve = pendingReject = null;
    suppressOutput = false;
    if (msg.error) rej(new Error(msg.error.message));
    else res(msg.result);
  }

  if (!suppressOutput) {
    process.stdout.write(line + "\n");
  }
});

let _id = 0;
function rpc(method, params) {
  const id = ++_id;
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    opencode.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  opencode.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

async function run() {
  // 1. Initialize — negotiate protocol and discover capabilities
  const initResult = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "entesale", version: "1.0" },
  });
  notify("notifications/initialized", {});

  const caps = initResult?.agentCapabilities ?? {};
  const canLoad   = caps.loadSession === true;
  const canResume = caps.sessionCapabilities?.resume != null;

  // 2. MCP servers — Unipile proxy if credentials are available
  const mcpServers = [];
  if (conv.agentToken && conv.convexSiteUrl) {
    mcpServers.push({
      type: "stdio",
      command: "/vercel/sandbox/mcp/unipile/dist/index.cjs",
      args: [],
      env: {
        CONVEX_PROXY_URL: conv.convexSiteUrl + "/unipile",
        CONVEX_AGENT_TOKEN: conv.agentToken,
        UNIPILE_ACCOUNT_IDS: "all",
      },
    });
  }

  // 3. Session setup
  let sessionId = conv.sessionId || null;

  if (sessionId && canResume) {
    await rpc("session/resume", { sessionId, cwd: CWD, mcpServers });
  } else if (sessionId && canLoad) {
    suppressOutput = true;
    await rpc("session/load", { sessionId, cwd: CWD, mcpServers });
  } else {
    const result = await rpc("session/new", { cwd: CWD, mcpServers });
    sessionId = result?.sessionId;
    if (!sessionId) throw new Error("No sessionId in session/new response");
    process.stdout.write(JSON.stringify({ _entesale: "session_created", sessionId }) + "\n");
  }

  // 4. Send only the new user message
  await rpc("session/prompt", {
    sessionId,
    prompt: [{ type: "text", text: conv.newMessage }],
  });

  process.stdout.write(JSON.stringify({ _entesale: "done" }) + "\n");
  process.exit(0);
}

opencode.on("error", (err) => {
  process.stderr.write("opencode spawn error: " + err.message + "\n");
  process.exit(1);
});
opencode.on("close", (code) => {
  if (code !== 0) {
    process.stderr.write("opencode exited: " + code + "\n");
    process.exit(1);
  }
});
run().catch((err) => {
  process.stderr.write("ACP runner fatal: " + err.message + "\n");
  process.exit(1);
});
