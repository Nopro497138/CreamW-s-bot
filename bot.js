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
  Events,
} = require("discord.js");
const path = require("path");

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION  ← edit only this block
// ═══════════════════════════════════════════════════════════════════════
const CONFIG = {
  token:    process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,

  welcomeChannelId: "1406701856545177732",
  gifPath:          path.join(__dirname, "video.gif"),
  defaultGifUrl:    "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/video.gif",
  moderatorRoleId:  "1470984903465238578",

  // ── Welcome message ─────────────────────────────────────────────────
  // Placeholders: {user} = mention  |  {username} = plain name  |  {server} = server name
  // Use --- on its own line to insert a visible separator line
  welcomeTitle: "# Welcome, {user}!",
  welcomeBody: [
    "Hey {user}, we're glad to have you here! ☀️",
    "",
    "Feel free to explore the community, introduce yourself and enjoy chatting with the other members.",
    "If you have any questions or need help, feel free to reach out to our team at any time.",
    "---",
    "Please make sure to read our **rules** before participating in roleplay or chat,",
    "so that a respectful and fair environment is guaranteed for everyone.",
    "",
    "We wish you a lot of fun and a great time with us! 🎉",
    "",
    "*– Your Server Team*",
  ].join("\n"),

  // ── Ban DM message ───────────────────────────────────────────────────
  // Placeholders: {user} {username} {server} {moderator} {reason}
  banTitle: "# 🔨 You were banned from {server}",
  banBody: [
    "Hello **{username}**,",
    "",
    "You have been permanently banned from **{server}**.",
    "---",
    "**Reason:** {reason}",
    "**Moderator:** {moderator}",
    "---",
    "If you believe this is a mistake, please contact the server staff.",
  ].join("\n"),

  // ── Kick DM message ──────────────────────────────────────────────────
  // Placeholders: {user} {username} {server} {moderator} {reason}
  kickTitle: "# 👢 You were kicked from {server}",
  kickBody: [
    "Hey **{username}**,",
    "",
    "You were kicked from **{server}**.",
    "---",
    "**Reason:** {reason}",
    "**Moderator:** {moderator}",
    "---",
    "You may rejoin the server if the link is still active.",
  ].join("\n"),

  // ── Mute / Timeout DM message ────────────────────────────────────────
  // Placeholders: {user} {username} {server} {moderator} {reason} {until}
  muteTitle: "# 🔇 You were timed out in {server}",
  muteBody: [
    "Hey **{username}**,",
    "",
    "You have been timed out (muted) in **{server}**.",
    "---",
    "**Reason:** {reason}",
    "**Moderator:** {moderator}",
    "**Until:** {until}",
    "---",
    "Please follow the server rules to avoid further action.",
  ].join("\n"),
};
// ═══════════════════════════════════════════════════════════════════════

// ── Fill placeholders ────────────────────────────────────────────────
function fill(str, data = {}) {
  let out = str;
  for (const [k, v] of Object.entries(data)) {
    out = out.replaceAll(`{${k}}`, v ?? "—");
  }
  return out;
}

// ── Build Components V2 array wrapped in a gray Container ────────────
// title        : string (markdown supported)
// body         : string (use --- on its own line for separator lines)
// gifUrl       : string | null
// useAttachment: boolean (use attachment://video.gif instead of URL)
function buildContainer(title, body, gifUrl, useAttachment = false) {
  const inner = [];

  // Big heading
  inner.push({ type: 10, content: title });

  // Divider below heading
  inner.push({ type: 14, divider: true, spacing: 1 });

  // Body — split on --- lines to insert separator components
  const chunks = body.split(/^---$/m);
  chunks.forEach((chunk, i) => {
    const trimmed = chunk.trim();
    if (trimmed) inner.push({ type: 10, content: trimmed });
    if (i < chunks.length - 1) inner.push({ type: 14, divider: true, spacing: 1 });
  });

  // Spacer + GIF
  if (gifUrl || useAttachment) {
    inner.push({ type: 14, divider: false, spacing: 2 });
    inner.push({
      type: 12,
      items: [{ media: { url: useAttachment ? "attachment://video.gif" : gifUrl } }],
    });
  }

  // Wrap everything in a Container (type 17) → renders as a gray box
  return [{ type: 17, components: inner }];
}

// ── Build editor UI (ephemeral, admin-only) ──────────────────────────
function buildEditor(session) {
  const t = session.title.length > 80  ? session.title.slice(0, 80)  + "…" : session.title;
  const b = session.body.length  > 120 ? session.body.slice(0, 120)  + "…" : session.body;

  return [
    { type: 10, content: "## 📝  Message Composer" },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: `**Title**\n${t}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**Body**\n${b}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**GIF URL**\n${session.gifUrl}` },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: "-# 💡 Tip: use `---` on its own line in the body to insert a visible separator." },
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: "✏️ Title",   custom_id: "edit_title" },
        { type: 2, style: 1, label: "✏️ Body",    custom_id: "edit_body"  },
        { type: 2, style: 1, label: "✏️ GIF URL", custom_id: "edit_gif"   },
      ],
    },
    {
      type: 1,
      components: [
        { type: 2, style: 2, label: "👁 Preview",     custom_id: "preview_msg"     },
        { type: 2, style: 3, label: "✅ Send",         custom_id: "send_msg"        },
        { type: 2, style: 4, label: "✖ Cancel",       custom_id: "cancel_composer" },
      ],
    },
  ];
}

// ── Per-user editor sessions ─────────────────────────────────────────
const sessions = new Map();

// ── Discord client ────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
  ],
});

// ── Register slash commands ───────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`✅  Logged in as ${c.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Compose and send a custom message (admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("test")
      .setDescription("DM yourself a preview of a message (admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) =>
        o.setName("type")
          .setDescription("Which message type to preview")
          .setRequired(true)
          .addChoices(
            { name: "Welcome",  value: "welcome" },
            { name: "Ban",      value: "ban"     },
            { name: "Kick",     value: "kick"    },
            { name: "Mute",     value: "mute"    },
          )
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(CONFIG.token);
  const appId = CONFIG.clientId || c.user.id;

  try {
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log("✅  Slash commands registered (/send, /test)");
  } catch (err) {
    console.error("❌  Failed to register slash commands:", err);
  }
});

// ── Interaction handler ───────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {

  // ── /send ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "send") {
    const session = {
      title:     "# Your Title Here",
      body:      "Write your message body here.\n---\nUse --- on its own line for a separator.",
      gifUrl:    CONFIG.defaultGifUrl,
      channelId: interaction.channelId,
    };
    sessions.set(interaction.user.id, session);

    await interaction.reply({
      components: buildEditor(session),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // ── /test ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "test") {
    const type = interaction.options.getString("type");
    const u = interaction.user;
    const g = interaction.guild;

    const placeholders = {
      user:      `<@${u.id}>`,
      username:  u.username,
      server:    g?.name ?? "Server",
      moderator: `<@${u.id}>`,
      reason:    "This is a test message.",
      until:     new Date(Date.now() + 3_600_000).toUTCString(),
    };

    let components;
    let files = [];

    if (type === "welcome") {
      const attachment = new AttachmentBuilder(CONFIG.gifPath, { name: "video.gif" });
      files = [attachment];
      components = buildContainer(
        fill(CONFIG.welcomeTitle, placeholders),
        fill(CONFIG.welcomeBody,  placeholders),
        null,
        true
      );
    } else if (type === "ban") {
      components = buildContainer(
        fill(CONFIG.banTitle, placeholders),
        fill(CONFIG.banBody,  placeholders),
        null
      );
    } else if (type === "kick") {
      components = buildContainer(
        fill(CONFIG.kickTitle, placeholders),
        fill(CONFIG.kickBody,  placeholders),
        null
      );
    } else if (type === "mute") {
      components = buildContainer(
        fill(CONFIG.muteTitle, placeholders),
        fill(CONFIG.muteBody,  placeholders),
        null
      );
    }

    // DM the admin who ran /test
    try {
      await u.send({ files, components, flags: MessageFlags.IsComponentsV2 });
      await interaction.reply({
        components: [{ type: 10, content: `✅  Test **${type}** message sent to your DMs!` }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } catch (err) {
      await interaction.reply({
        components: [{ type: 10, content: "❌  Could not send DM. Please enable DMs from server members." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // ── Buttons ────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        components: [{ type: 10, content: "❌  Session expired. Run `/send` again." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === "edit_title") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId("modal_title")
          .setTitle("Edit Title")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Title (markdown OK, e.g. # Heading)")  // max 45 chars ✓
              .setStyle(TextInputStyle.Short)
              .setValue(session.title)
              .setRequired(true)
          ))
      );
      return;
    }

    if (interaction.customId === "edit_body") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId("modal_body")
          .setTitle("Edit Body")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Body (use --- alone on a line for divider)")  // max 45 chars ✓
              .setStyle(TextInputStyle.Paragraph)
              .setValue(session.body)
              .setRequired(true)
          ))
      );
      return;
    }

    if (interaction.customId === "edit_gif") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId("modal_gif")
          .setTitle("Edit GIF URL")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Direct GIF URL (.gif link)")  // max 45 chars ✓
              .setStyle(TextInputStyle.Short)
              .setValue(session.gifUrl)
              .setRequired(true)
          ))
      );
      return;
    }

    if (interaction.customId === "preview_msg") {
      await interaction.reply({
        components: [
          { type: 10, content: "-# 👁  Preview — only you can see this" },
          { type: 14, divider: true, spacing: 1 },
          ...buildContainer(session.title, session.body, session.gifUrl),
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === "send_msg") {
      const ch = interaction.guild.channels.cache.get(session.channelId);
      if (!ch) {
        await interaction.reply({
          components: [{ type: 10, content: "❌  Channel not found." }],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }

      await ch.send({
        components: buildContainer(session.title, session.body, session.gifUrl),
        flags: MessageFlags.IsComponentsV2,
      });

      sessions.delete(interaction.user.id);
      await interaction.update({
        components: [{ type: 10, content: "✅  **Message sent successfully!**" }],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    if (interaction.customId === "cancel_composer") {
      sessions.delete(interaction.user.id);
      await interaction.update({
        components: [{ type: 10, content: "✖  Composer cancelled." }],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }
  }

  // ── Modal submit ───────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        components: [{ type: 10, content: "❌  Session expired. Run `/send` again." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const value = interaction.fields.getTextInputValue("input");
    if (interaction.customId === "modal_title") session.title  = value;
    if (interaction.customId === "modal_body")  session.body   = value;
    if (interaction.customId === "modal_gif")   session.gifUrl = value;
    sessions.set(interaction.user.id, session);

    await interaction.deferUpdate();
    await interaction.editReply({
      components: buildEditor(session),
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }
});

// ── Moderation DMs (Components V2, no embeds) ─────────────────────────

client.on("guildBanAdd", async (ban) => {
  const { user, guild } = ban;
  let moderator = "Server moderation";
  let reason    = "No reason provided";

  try {
    const logs  = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.targetId === user.id) {
      moderator = `<@${entry.executorId}>`;
      reason    = entry.reason ?? reason;
    }
  } catch { /* audit logs unavailable */ }

  const components = buildContainer(
    fill(CONFIG.banTitle, { user: `<@${user.id}>`, username: user.username, server: guild.name, moderator, reason }),
    fill(CONFIG.banBody,  { user: `<@${user.id}>`, username: user.username, server: guild.name, moderator, reason }),
    null
  );

  try {
    await user.send({ components, flags: MessageFlags.IsComponentsV2 });
    console.log(`✉️  Ban DM sent to ${user.tag}`);
  } catch { console.warn(`Could not DM banned user ${user.tag}`); }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const oldTimeout = oldMember.communicationDisabledUntilTimestamp ?? null;
  const newTimeout = newMember.communicationDisabledUntilTimestamp ?? null;
  if (oldTimeout || !newTimeout) return; // only fire when timeout is newly applied

  let moderator = "Server moderation";
  let reason    = "No reason provided";

  try {
    const logs  = await newMember.guild.fetchAuditLogs({ limit: 5 });
    const entry = logs.entries.find((e) => e.targetId === newMember.id);
    if (entry) { moderator = `<@${entry.executorId}>`; reason = entry.reason ?? reason; }
  } catch { /* ignore */ }

  const until = new Date(newTimeout).toUTCString();
  const components = buildContainer(
    fill(CONFIG.muteTitle, { user: `<@${newMember.id}>`, username: newMember.user.username, server: newMember.guild.name, moderator, reason, until }),
    fill(CONFIG.muteBody,  { user: `<@${newMember.id}>`, username: newMember.user.username, server: newMember.guild.name, moderator, reason, until }),
    null
  );

  try {
    await newMember.send({ components, flags: MessageFlags.IsComponentsV2 });
    console.log(`✉️  Mute DM sent to ${newMember.user.tag}`);
  } catch { console.warn(`Could not DM muted user ${newMember.user.tag}`); }
});

client.on("guildMemberRemove", async (member) => {
  try {
    const logs  = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
    const entry = logs.entries.find((e) => e.targetId === member.id && Date.now() - e.createdTimestamp < 10_000);
    if (!entry) return;

    const moderator = `<@${entry.executorId}>`;
    const reason    = entry.reason ?? "No reason provided";

    const components = buildContainer(
      fill(CONFIG.kickTitle, { user: `<@${member.id}>`, username: member.user.username, server: member.guild.name, moderator, reason }),
      fill(CONFIG.kickBody,  { user: `<@${member.id}>`, username: member.user.username, server: member.guild.name, moderator, reason }),
      null
    );

    try {
      await member.send({ components, flags: MessageFlags.IsComponentsV2 });
      console.log(`✉️  Kick DM sent to ${member.user.tag}`);
    } catch { /* DM unavailable after removal */ }
  } catch { /* audit logs unavailable */ }
});

// ── Welcome message ───────────────────────────────────────────────────
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
  if (!channel) { console.error("❌  Welcome channel not found."); return; }

  const data = {
    user:     `<@${member.id}>`,
    username: member.user.username,
    server:   member.guild.name,
  };

  const attachment = new AttachmentBuilder(CONFIG.gifPath, { name: "video.gif" });

  try {
    await channel.send({
      files:      [attachment],
      components: buildContainer(
        fill(CONFIG.welcomeTitle, data),
        fill(CONFIG.welcomeBody,  data),
        null,
        true  // use attachment://video.gif
      ),
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`📨  Welcome sent for ${member.user.tag}`);
  } catch (err) {
    console.error("❌  Failed to send welcome message:", err);
  }
});

// ── Start ─────────────────────────────────────────────────────────────
if (!CONFIG.token) {
  console.error("❌  DISCORD_TOKEN not set in .env");
  process.exit(1);
}

client.login(CONFIG.token).catch((err) => {
  console.error("❌  Login failed:", err);
});
