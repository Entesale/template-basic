const baseTools = ["Read", "Write", "Edit", "Bash", "Glob", "Grep"];

/** Staged bundle path inside the Vercel sandbox (must match `claude-sandbox` writeFiles). */
export const SANDBOX_TELEGRAM_MCP_ENTRY =
  "/vercel/sandbox/mcp/telegram/dist/index.cjs";

/** Staged bundle path for the CRM MCP inside the Vercel sandbox. */
export const SANDBOX_CRM_MCP_ENTRY = "/vercel/sandbox/mcp/crm/dist/index.cjs";

export const CRM_MCP_TOOL_NAMES = ["crm_execute_sql", "crm_get_schema"];

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function getCrmMcpServersFromEnv(env) {
  if (!env.CRM_DATABASE_URL) {
    return undefined;
  }

  return {
    crm: {
      type: "stdio",
      command: "node",
      args: [SANDBOX_CRM_MCP_ENTRY],
      env: {
        CRM_DATABASE_URL: env.CRM_DATABASE_URL,
      },
    },
  };
}

const TELEGRAM_MCP_TOOL_NAMES_BASE = [
  "telegram_send_message",
  "telegram_get_dialogs",
  "telegram_get_history",
  "telegram_get_chat_info",
  "telegram_mark_as_read",
  "telegram_join_channel",
  "telegram_leave_channel",
  "telegram_create_channel",
  "telegram_edit_channel_info",
  "telegram_invite_to_channel",
  "telegram_get_admined_channels",
  "telegram_check_channel_username",
  "telegram_set_channel_username",
  "telegram_quote_reply",
  "telegram_get_replies",
  "telegram_edit_message",
  "telegram_schedule_message",
  "telegram_get_scheduled_messages",
  "telegram_delete_scheduled_message",
  "telegram_send_scheduled_now",
  "telegram_search_messages",
  "telegram_pin_message",
  "telegram_unpin_message",
  "telegram_forward_message",
  "telegram_delete_message",
  "telegram_get_me",
  "telegram_get_participants",
  "telegram_kick_user",
  "telegram_ban_user",
  "telegram_unban_user",
  "telegram_create_group",
  "telegram_set_chat_photo",
  "telegram_create_poll",
  "telegram_create_quiz",
  "telegram_reply_keyboard",
  "telegram_react",
  "telegram_send_dice",
  "telegram_send_photo",
  "telegram_send_voice",
  "telegram_send_sticker",
  "telegram_send_gif",
  "telegram_download_media",
  "telegram_transcribe_audio",
  "telegram_update_profile",
  "telegram_set_bio",
  "telegram_set_username",
  "telegram_set_personal_channel",
  "telegram_get_folders",
  "telegram_create_folder",
  "telegram_add_chat_to_folder",
  "telegram_block_user",
  "telegram_get_blocked",
  "telegram_get_common_chats",
  "telegram_get_user_info",
  "telegram_check_username",
  "telegram_send_story",
];

export const VISION_ANALYZE_TOOL_NAME = "vision_analyze";

export function getTelegramMcpToolNames(env) {
  if (!env?.OPENAI_API_KEY) {
    return [...TELEGRAM_MCP_TOOL_NAMES_BASE];
  }

  const insertBefore = "telegram_transcribe_audio";
  const insertIndex = TELEGRAM_MCP_TOOL_NAMES_BASE.indexOf(insertBefore);
  if (insertIndex === -1) {
    return [...TELEGRAM_MCP_TOOL_NAMES_BASE, VISION_ANALYZE_TOOL_NAME];
  }

  return [
    ...TELEGRAM_MCP_TOOL_NAMES_BASE.slice(0, insertIndex),
    VISION_ANALYZE_TOOL_NAME,
    ...TELEGRAM_MCP_TOOL_NAMES_BASE.slice(insertIndex),
  ];
}

export const TELEGRAM_MCP_TOOL_NAMES = getTelegramMcpToolNames(process.env);

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function getTelegramMcpServersFromEnv(env) {
  const hasTelegramMcp =
    Boolean(env.TELEGRAM_SESSION) &&
    Boolean(env.TELEGRAM_API_ID) &&
    Boolean(env.TELEGRAM_API_HASH);

  if (!hasTelegramMcp) {
    return undefined;
  }

  return {
    telegram: {
      type: "stdio",
      command: "node",
      args: [SANDBOX_TELEGRAM_MCP_ENTRY],
      env: {
        TELEGRAM_SESSION: env.TELEGRAM_SESSION,
        TELEGRAM_API_ID: env.TELEGRAM_API_ID,
        TELEGRAM_API_HASH: env.TELEGRAM_API_HASH,
        ...(env.OPENAI_API_KEY ? { OPENAI_API_KEY: env.OPENAI_API_KEY } : {}),
        ...(env.TELEGRAM_VISION_MODEL
          ? { TELEGRAM_VISION_MODEL: env.TELEGRAM_VISION_MODEL }
          : {}),
      },
    },
  };
}

/**
 * @param {{ hasTelegramMcp: boolean, hasCrmMcp: boolean, hasVisionAnalyze?: boolean }} params
 */
export function getAllowedToolsForRunner({
  hasTelegramMcp,
  hasCrmMcp,
  hasVisionAnalyze = false,
}) {
  const telegramToolNames = getTelegramMcpToolNames(
    hasVisionAnalyze ? { OPENAI_API_KEY: "enabled" } : {}
  );
  const tools = [...baseTools];
  if (hasTelegramMcp) {
    tools.push(...telegramToolNames.map((name) => `mcp__telegram__${name}`));
  }
  if (hasCrmMcp) {
    tools.push(...CRM_MCP_TOOL_NAMES.map((name) => `mcp__crm__${name}`));
  }
  return tools;
}
