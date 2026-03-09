// bot.js
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  MessageFlags,
  AttachmentBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AuditLogEvent,
  EmbedBuilder,
  Events,
  PermissionsBitField,
} = require("discord.js");
const path = require("path");

// ===================== CONFIGURATION =====================
const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID, // optional; registration uses client.user.id if undefined
  // Channel ID for automatic welcome messages (kept from your original)
  welcomeChannelId: "1406701856545177732",
  // Local GIF for welcome messages (must sit next to this file)
  gifPath: path.join(__dirname, "video.gif"),
  // Default gif url for composer preview
  defaultGifUrl: "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/video.gif",

  // Moderator role ID you mentioned earlier (kept here but not required)
  moderatorRoleId: "1470984903465238578",
};

// ===================== EDITABLE EMBED TEMPLATES =====================
// Edit these templates as you like. Placeholders available:
// {user} (mention), {username}, {guild}, {moderator}, {reason}, {until}
const TEMPLATES = {
  banned: {
    title: "You were banned from {guild}",
    description:
      "Hello {username},\n\nYou have been banned from **{guild}**.\n\n**Reason:** {reason}\n\nIf you believe this is a mistake, please contact the server staff.",
    footer: "Server moderation • Ban notice",
    color: 0xff0000,
  },

  muted: {
    title: "You were muted in {guild}",
    description:
      "Hi {username},\n\nYou have been muted (timeout) in **{guild}**.\n\n**Reason:** {reason}\n**Until:** {until}\n\nPlease follow the server rules to avoid further action.",
    footer: "Server moderation • Mute / Timeout",
    color: 0x0099ff,
  },

  kicked: {
    title: "You were kicked from {guild}",
    description:
      "Hey {username},\n\nYou were kicked from **{guild}**.\n\n**Reason:** {reason}\n\nYou may rejoin if allowed by the server staff.",
    footer: "Server moderation • Kick notice",
    color: 0xff5500,
  },
};

// ===================== Helpers =====================
function fillTemplate(templateStr, data = {}) {
  let out = templateStr;
  for (const [k, v] of Object.entries(data)) {
    out = out.replaceAll(`{${k}}`, v ?? "");
  }
  return out;
}

function buildEmbedFromTemplate(templateObj, data = {}) {
  const embed = new EmbedBuilder()
    .setTitle(fillTemplate(templateObj.title ?? "", data))
    .setDescription(fillTemplate(templateObj.description ?? "", data))
    .setFooter({ text: fillTemplate(templateObj.footer ?? "", data) });
  if (templateObj.color) embed.setColor(templateObj.color);
  return embed;
}

// Keep hasModPermission if you want to use role checks elsewhere later
function hasModPermission(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.has(CONFIG.moderatorRoleId);
}

// ===================== Client setup =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildBans],
});

// Register commands AFTER client is ready. This avoids "application_id undefined".
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  // Build only the /send command (admin-only), as requested
  const sendCommand = new SlashCommandBuilder()
    .setName("send")
    .setDescription("Compose and send a custom message (admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON();

  const commands = [sendCommand];

  const rest = new REST({ version: "10" }).setToken(CONFIG.token);

  // Determine application id to use: prefer CONFIG.clientId, otherwise use client.user.id
  const appId = CONFIG.clientId || c.user?.id;
  if (!appId) {
    console.error("❌ No application id available. Set CLIENT_ID in env or ensure client logs in correctly.");
    return;
  }

  try {
    // 1) Delete all existing global application commands by replacing with empty array
    await rest.put(Routes.applicationCommands(appId), { body: [] });
    console.log("🗑️ Cleared all existing global application commands.");

    // 2) Register only the commands we want (here: /send)
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log("✅ Registered /send command (global).");
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
});

// ===================== Composer (original features) =====================
// Build message payload (Components V2)
function buildMessagePayload(title, body, gifUrl, gifAttachment = false) {
  const components = [];

  components.push({ type: 10, content: title });
  components.push({ type: 14, divider: true, spacing: 1 });

  const chunks = body.split(/^---$/m);
  chunks.forEach((chunk, i) => {
    const trimmed = chunk.trim();
    if (trimmed) components.push({ type: 10, content: trimmed });
    if (i < chunks.length - 1) components.push({ type: 14, divider: true, spacing: 1 });
  });

  components.push({ type: 14, divider: false, spacing: 2 });

  components.push({
    type: 12,
    items: [{ media: { url: gifAttachment ? "attachment://video.gif" : gifUrl } }],
  });

  return components;
}

function buildEditorPayload(session) {
  const titlePreview = session.title.length > 80 ? session.title.slice(0, 80) + "…" : session.title;
  const bodyPreview = session.body.length > 120 ? session.body.slice(0, 120) + "…" : session.body;

  return [
    { type: 10, content: "## 📝  Message Composer" },
    { type: 14, divider: true, spacing: 1 },

    { type: 10, content: `**Title**\n${titlePreview}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**Body**\n${bodyPreview}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**GIF URL**\n${session.gifUrl}` },
    { type: 14, divider: true, spacing: 1 },

    {
      type: 10,
      content: "-# 💡 Use `---` on its own line in the body to insert a separator line.",
    },

    {
      type: 1,
      components: [
        { type: 2, style: 1, label: "✏️  Edit Title", custom_id: "edit_title" },
        { type: 2, style: 1, label: "✏️  Edit Body", custom_id: "edit_body" },
        { type: 2, style: 1, label: "✏️  Edit GIF", custom_id: "edit_gif" },
      ],
    },

    {
      type: 1,
      components: [
        { type: 2, style: 2, label: "👁  Preview", custom_id: "preview_msg" },
        { type: 2, style: 3, label: "✅  Send Message", custom_id: "send_msg" },
        { type: 2, style: 4, label: "✖  Cancel", custom_id: "cancel_composer" },
      ],
    },
  ];
}

const sessions = new Map();

// ===================== Interaction handling =====================
client.on("interactionCreate", async (interaction) => {
  // Only command now is /send
  if (interaction.isChatInputCommand() && interaction.commandName === "send") {
    // Only admins can use — Discord enforces via default permissions but we still check
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "❌ You must be an administrator to use this command.", ephemeral: true });
      return;
    }

    const session = {
      title: "# Your Title Here",
      body: "Write your message body here.\n---\nYou can add separator lines using ---.",
      gifUrl: CONFIG.defaultGifUrl,
      channelId: interaction.channelId,
      cmdInteraction: interaction,
    };
    sessions.set(interaction.user.id, session);

    await interaction.reply({
      components: buildEditorPayload(session),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Buttons (composer)
  if (interaction.isButton()) {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        components: [{ type: 10, content: "❌ Session expired. Run `/send` again." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === "edit_title") {
      const modal = new ModalBuilder()
        .setCustomId("modal_title")
        .setTitle("Edit Title")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Title — markdown supported (e.g. # Heading)")
              .setStyle(TextInputStyle.Short)
              .setValue(session.title)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "edit_body") {
      const modal = new ModalBuilder()
        .setCustomId("modal_body")
        .setTitle("Edit Body")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Body text  (use --- on its own line for separator)")
              .setStyle(TextInputStyle.Paragraph)
              .setValue(session.body)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "edit_gif") {
      const modal = new ModalBuilder()
        .setCustomId("modal_gif")
        .setTitle("Edit GIF URL")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Direct GIF URL (.gif link)")
              .setStyle(TextInputStyle.Short)
              .setValue(session.gifUrl)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "preview_msg") {
      const preview = buildMessagePayload(session.title, session.body, session.gifUrl);
      await interaction.reply({
        components: [
          { type: 10, content: "-# 👁  Preview — only you can see this" },
          { type: 14, divider: true, spacing: 1 },
          ...preview,
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === "send_msg") {
      const targetChannel = interaction.guild.channels.cache.get(session.channelId);
      if (!targetChannel) {
        await interaction.reply({
          components: [{ type: 10, content: "❌ Channel not found." }],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }

      await targetChannel.send({
        components: buildMessagePayload(session.title, session.body, session.gifUrl),
        flags: MessageFlags.IsComponentsV2,
      });

      sessions.delete(interaction.user.id);

      await interaction.update({
        components: [{ type: 10, content: "✅ **Message sent successfully!**" }],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    if (interaction.customId === "cancel_composer") {
      sessions.delete(interaction.user.id);
      await interaction.update({
        components: [{ type: 10, content: "✖ Composer cancelled." }],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }
  }

  // Modal submit handling
  if (interaction.isModalSubmit()) {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        components: [{ type: 10, content: "❌ Session expired. Run `/send` again." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const value = interaction.fields.getTextInputValue("input");
    if (interaction.customId === "modal_title") session.title = value;
    if (interaction.customId === "modal_body") session.body = value;
    if (interaction.customId === "modal_gif") session.gifUrl = value;
    sessions.set(interaction.user.id, session);

    // Update the original editor message in place
    await session.cmdInteraction.editReply({
      components: buildEditorPayload(session),
      flags: MessageFlags.IsComponentsV2,
    });

    // Acknowledge the modal without creating a new visible message
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.deleteReply();
    return;
  }
});

// ===================== Moderation event handlers =====================
// 1) When a user gets banned (any method) -> send DM embed to the banned user ONLY (best-effort).
client.on("guildBanAdd", async (ban) => {
  const { user, guild } = ban;
  try {
    // Try to determine moderator from audit logs (best-effort). If unavailable, leave moderator generic.
    let moderator = "Server moderation";
    let reason = "No reason provided";

    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.targetId === user.id) {
        moderator = `<@${entry.executorId}>`;
        reason = entry.reason ?? reason;
      }
    } catch (err) {
      // non-fatal: audit logs may be unavailable if bot lacks VIEW_AUDIT_LOG
    }

    const embed = buildEmbedFromTemplate(TEMPLATES.banned, {
      user: `<@${user.id}>`,
      username: user.username,
      guild: guild.name,
      moderator,
      reason,
    });

    // DM the banned user. Do NOT post anything in guild channels.
    try {
      await user.send({ embeds: [embed] });
      console.log(`✉️ DM sent to banned user ${user.tag}`);
    } catch (err) {
      // If DM fails (closed DMs, etc.), swallow error — requirement is no public message.
      console.warn(`Could not DM banned user ${user.tag}:`, err?.message ?? err);
    }
  } catch (err) {
    console.error("Error in guildBanAdd handler:", err);
  }
});

// 2) When someone is timed out (muted) -> DM the user only (best-effort).
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp ?? null;
    const newTimeout = newMember.communicationDisabledUntilTimestamp ?? null;

    // If timeout was just added
    if (!oldTimeout && newTimeout) {
      let moderator = "Server moderation";
      let reason = "No reason provided";

      try {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 5 });
        const entry = logs.entries.find((e) => e.targetId === newMember.id);
        if (entry) {
          moderator = `<@${entry.executorId}>`;
          reason = entry.reason ?? reason;
        }
      } catch (err) {
        // ignore audit errors
      }

      const until = new Date(newTimeout).toUTCString();
      const embed = buildEmbedFromTemplate(TEMPLATES.muted, {
        user: `<@${newMember.id}>`,
        username: newMember.user.username,
        guild: newMember.guild.name,
        moderator,
        reason,
        until,
      });

      try {
        await newMember.send({ embeds: [embed] });
        console.log(`✉️ DM sent to muted user ${newMember.user.tag}`);
      } catch (err) {
        console.warn(`Could not DM ${newMember.user.tag} about mute:`, err?.message ?? err);
      }
    }
  } catch (err) {
    console.error("Error in guildMemberUpdate handler:", err);
  }
});

// 3) Detect kicks -> DM the kicked user only (best-effort).
client.on("guildMemberRemove", async (member) => {
  try {
    const guild = member.guild;
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      const entry = logs.entries.find((e) => e.targetId === member.id && Date.now() - e.createdTimestamp < 10_000);
      if (entry) {
        const moderator = `<@${entry.executorId}>`;
        const reason = entry.reason ?? "No reason provided";

        const embed = buildEmbedFromTemplate(TEMPLATES.kicked, {
          user: `<@${member.id}>`,
          username: member.user.username,
          guild: guild.name,
          moderator,
          reason,
        });

        try {
          await member.send({ embeds: [embed] });
          console.log(`✉️ DM sent to kicked user ${member.user.tag}`);
        } catch (err) {
          // cannot DM after removal, ignore
        }
      }
    } catch (err) {
      // Could not fetch audit logs; ignore per your requirement to send only DMs
      console.warn("Could not fetch audit logs for kick detection:", err?.message ?? err);
    }
  } catch (err) {
    console.error("Error in guildMemberRemove handler:", err);
  }
});

// ===================== Welcome message on join (unchanged) =====================
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
  if (!channel) {
    console.error("❌ Welcome channel not found. Check CONFIG.welcomeChannelId.");
    return;
  }

  const fill = (str) =>
    str.replace(/{user}/g, `<@${member.id}>`).replace(/{username}/g, member.user.username).replace(/{guild}/g, member.guild.name);

  const attachment = new AttachmentBuilder(CONFIG.gifPath, { name: "video.gif" });

  try {
    await channel.send({
      files: [attachment],
      components: buildMessagePayload(fill(CONFIG.welcomeTitle ?? "# Welcome, {user}!"), fill(CONFIG.welcomeBody ?? ""), null, true),
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`📨 Welcome sent for ${member.user.tag}`);
  } catch (err) {
    console.error("❌ Failed to send welcome message:", err);
  }
});

// ===================== Start bot =====================
if (!CONFIG.token) {
  console.error("❌ DISCORD_TOKEN not set in environment. Please add it and restart.");
  process.exit(1);
}

client.login(CONFIG.token).catch((err) => {
  console.error("❌ Failed to login:", err);
});
