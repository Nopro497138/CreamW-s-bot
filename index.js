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
  PermissionsBitField,
} = require("discord.js");
const path = require("path");

// ===================== CONFIGURATION =====================
const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Channel ID for automatic welcome messages (left unchanged)
  welcomeChannelId: "1406701856545177732",
  // Local GIF for welcome messages (must sit next to this file)
  gifPath: path.join(__dirname, "video.gif"),
  // Default gif url for composer preview
  defaultGifUrl:
    "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/video.gif",

  // Role ID allowed to use moderation/test commands (in addition to admins)
  moderatorRoleId: "1470984903465238578",
};

// ===================== EDITABLE EMBED TEMPLATES =====================
// Edit these if you want to change the DM text the bot sends.
// Placeholders: {user}, {username}, {guild}, {moderator}, {reason}, {until}
const TEMPLATES = {
  banned: {
    title: "You were banned from {guild}",
    description:
      "Hello {username},\n\nYou have been banned from **{guild}** by **{moderator}**.\n\n**Reason:** {reason}\n\nIf you believe this is a mistake, please contact the server staff.",
    footer: "Server moderation • Ban notice",
    color: 0xff0000,
  },

  alreadyBanned: {
    title: "Ban attempt — user already banned",
    description:
      "Hello {moderator},\n\nThe user {user} is already banned from **{guild}**. No new ban was applied.",
    footer: "Server moderation • Already banned",
    color: 0xffa500,
  },

  muted: {
    title: "You were muted in {guild}",
    description:
      "Hi {username},\n\nYou have been muted (timeout) in **{guild}** by **{moderator}**.\n\n**Reason:** {reason}\n**Until:** {until}\n\nPlease follow the server rules to avoid further action.",
    footer: "Server moderation • Mute / Timeout",
    color: 0x0099ff,
  },

  kicked: {
    title: "You were kicked from {guild}",
    description:
      "Hey {username},\n\nYou were kicked from **{guild}** by **{moderator}**.\n\n**Reason:** {reason}\n\nYou may rejoin if allowed by the server staff.",
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

function hasModPermission(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.has(CONFIG.moderatorRoleId);
}

// ===================== Bot setup =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register commands: /send (composer), /testmsg, /ban
  const commands = [
    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Compose and send a custom message (admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("testmsg")
      .setDescription("Test moderation DM templates (allowed role or admin)")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Which template to test")
          .setRequired(true)
          .addChoices(
            { name: "banned", value: "banned" },
            { name: "already_banned", value: "alreadyBanned" },
            { name: "muted", value: "muted" },
            { name: "kicked", value: "kicked" }
          )
      )
      .addUserOption((opt) =>
        opt.setName("target").setDescription("User to DM (defaults to you)").setRequired(false)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a user (bot will DM them with the ban message).")
      .addUserOption((opt) => opt.setName("target").setDescription("User to ban").setRequired(true))
      .addStringOption((opt) => opt.setName("reason").setDescription("Ban reason").setRequired(false))
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(CONFIG.token);
  try {
    await rest.put(Routes.applicationCommands(CONFIG.clientId), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
});

// ===================== Editor / Composer (original features) =====================
// Build message payload (Components V2)
function buildMessagePayload(title, body, gifUrl, gifAttachment = false) {
  const components = [];

  components.push({ type: 10, content: title });
  components.push({ type: 14, divider: true, spacing: 1 });

  const chunks = body.split(/^---$/m);
  chunks.forEach((chunk, i) => {
    const trimmed = chunk.trim();
    if (trimmed) components.push({ type: 10, content: trimmed });
    if (i < chunks.length - 1) {
      components.push({ type: 14, divider: true, spacing: 1 });
    }
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
  // /send (composer) — admin only (original behavior)
  if (interaction.isChatInputCommand() && interaction.commandName === "send") {
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

  // /testmsg — sends a DM of the template to a user (for testing)
  if (interaction.isChatInputCommand() && interaction.commandName === "testmsg") {
    const invoker = interaction.member;
    if (!hasModPermission(invoker)) {
      await interaction.reply({ content: "❌ You don't have permission to use this.", ephemeral: true });
      return;
    }

    const type = interaction.options.getString("type", true);
    const targetUser = interaction.options.getUser("target") ?? interaction.user;

    try {
      const data = {
        user: `<@${targetUser.id}>`,
        username: targetUser.username,
        guild: interaction.guild?.name ?? "this server",
        moderator: `<@${interaction.user.id}>`,
        reason: "Test message",
        until: "—",
      };

      let embed;
      if (type === "banned") embed = buildEmbedFromTemplate(TEMPLATES.banned, data);
      else if (type === "alreadyBanned") embed = buildEmbedFromTemplate(TEMPLATES.alreadyBanned, data);
      else if (type === "muted") embed = buildEmbedFromTemplate(TEMPLATES.muted, data);
      else if (type === "kicked") embed = buildEmbedFromTemplate(TEMPLATES.kicked, data);
      else embed = new EmbedBuilder().setDescription("Unknown template");

      await targetUser.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Test message (${type}) sent to ${targetUser.tag}.`, ephemeral: true });
    } catch (err) {
      console.error("Failed to send test DM:", err);
      await interaction.reply({
        content: "❌ Failed to send DM (the user might have DMs closed).",
        ephemeral: true,
      });
    }
    return;
  }

  // /ban - bans a user. The bot will DM the banned user (best-effort) and will NOT post anything public in the guild.
  if (interaction.isChatInputCommand() && interaction.commandName === "ban") {
    const invoker = interaction.member;
    if (!hasModPermission(invoker)) {
      await interaction.reply({ content: "❌ You don't have permission to use this.", ephemeral: true });
      return;
    }

    const target = interaction.options.getUser("target", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    try {
      // Check if already banned
      const bans = await interaction.guild.bans.fetch();
      const isBanned = bans.has(target.id);

      if (isBanned) {
        // Do NOT DM the guild or post anything public; reply ephemeral to moderator only
        await interaction.reply({ content: "⚠️ That user is already banned.", ephemeral: true });
        return;
      } else {
        // Build the ban embed and attempt to DM the target (best-effort)
        const banEmbed = buildEmbedFromTemplate(TEMPLATES.banned, {
          user: `<@${target.id}>`,
          username: target.username,
          guild: interaction.guild.name,
          moderator: `<@${interaction.user.id}>`,
          reason,
        });

        try {
          await target.send({ embeds: [banEmbed] });
        } catch (e) {
          // DM failed (user closed DMs) — continue with ban anyway
        }

        // Perform ban silently (no public channel messages)
        await interaction.guild.members.ban(target.id, { reason });

        // Reply ephemeral to invoker confirming action (invisible to others)
        await interaction.reply({ content: `✅ ${target.tag} has been banned. A DM was attempted.`, ephemeral: true });
        return;
      }
    } catch (err) {
      console.error("Error during ban operation:", err);
      await interaction.reply({ content: "❌ Error while checking bans or performing ban.", ephemeral: true });
      return;
    }
  }

  // Button interactions from composer (unchanged behavior)
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

  // Modal submissions for composer (unchanged)
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

    await session.cmdInteraction.editReply({
      components: buildEditorPayload(session),
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.deleteReply();
    return;
  }
});

// ===================== Moderation event handlers =====================

// 1) When a user gets banned (any method) -> DM the banned user only (best-effort).
client.on("guildBanAdd", async (ban) => {
  const { user, guild } = ban;
  try {
    // Try to get moderator from audit logs (best-effort)
    let moderator = "Server moderation";
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.targetId === user.id) moderator = `<@${entry.executorId}>`;
    } catch (err) {
      // ignore audit fetch errors
    }

    const embed = buildEmbedFromTemplate(TEMPLATES.banned, {
      user: `<@${user.id}>`,
      username: user.username,
      guild: guild.name,
      moderator,
      reason: "No reason provided",
    });

    // DM the banned user. Do NOT post anything in guild channels.
    try {
      await user.send({ embeds: [embed] });
    } catch (err) {
      // If DM fails, there's nothing else to do — we explicitly do not send any guild messages.
      console.warn(`Could not DM user ${user.tag} about ban:`, err?.message ?? err);
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
        // ignore
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
      } catch (err) {
        console.warn(`Could not DM ${newMember.user.tag} about mute:`, err?.message ?? err);
      }
    }
  } catch (err) {
    console.error("Error in guildMemberUpdate handler:", err);
  }
});

// 3) Detect kicks (guildMemberRemove + audit logs) -> DM the kicked user only (best-effort).
client.on("guildMemberRemove", async (member) => {
  try {
    const guild = member.guild;
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      const entry = logs.entries.find(
        (e) => e.targetId === member.id && (Date.now() - e.createdTimestamp) < 10_000
      );
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
        } catch (err) {
          // can't DM after they were removed; ignore
        }
      }
    } catch (err) {
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
      components: buildMessagePayload(
        fill(CONFIG.welcomeTitle ?? "# Welcome, {user}!"),
        fill(CONFIG.welcomeBody ?? ""),
        null,
        true
      ),
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`📨 Welcome sent for ${member.user.tag}`);
  } catch (err) {
    console.error("❌ Failed to send welcome message:", err);
  }
});

client.login(CONFIG.token);
