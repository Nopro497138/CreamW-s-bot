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
} = require("discord.js");
const path = require("path");

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION  ← only edit this block
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  token:    process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,

  // Channel ID for automatic welcome messages
  welcomeChannelId: "1406701856545177732",

  // ── Welcome message content ──────────────────────────────────
  // Placeholders: {user} = mention  |  {username} = plain name  |  {server} = server name
  // Use --- on its own line to insert a visible separator line in the body

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

  // Local GIF used for welcome messages (must be next to bot.js)
  gifPath: path.join(__dirname, "video.gif"),

  // Default GIF URL shown in the /send composer (can be any direct .gif link)
  defaultGifUrl:
    "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/video.gif",
};
// ═══════════════════════════════════════════════════════════════

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Build the raw Components V2 array for the actual public message.
 * - title          : string  (markdown OK, e.g. "# Heading")
 * - body           : string  (use --- on its own line for a separator)
 * - gifUrl         : string | null
 * - gifAttachment  : boolean  (true = use attachment://video.gif)
 */
function buildMessagePayload(title, body, gifUrl, gifAttachment = false) {
  const components = [];

  // 1. Big heading
  components.push({ type: 10, content: title });

  // 2. Divider below heading
  components.push({ type: 14, divider: true, spacing: 1 });

  // 3. Body – split on --- to insert separator lines
  const chunks = body.split(/^---$/m);
  chunks.forEach((chunk, i) => {
    const trimmed = chunk.trim();
    if (trimmed) components.push({ type: 10, content: trimmed });
    if (i < chunks.length - 1) {
      components.push({ type: 14, divider: true, spacing: 1 });
    }
  });

  // 4. Spacer before GIF
  components.push({ type: 14, divider: false, spacing: 2 });

  // 5. GIF
  components.push({
    type: 12,
    items: [{ media: { url: gifAttachment ? "attachment://video.gif" : gifUrl } }],
  });

  return components;
}

/**
 * Build the ephemeral Components V2 editor interface shown only to the admin.
 */
function buildEditorPayload(session) {
  const titlePreview = session.title.length > 80
    ? session.title.slice(0, 80) + "…"
    : session.title;
  const bodyPreview = session.body.length > 120
    ? session.body.slice(0, 120) + "…"
    : session.body;

  return [
    // Header
    { type: 10, content: "## 📝  Message Composer" },
    { type: 14, divider: true, spacing: 1 },

    // Current values preview
    { type: 10, content: `**Title**\n${titlePreview}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**Body**\n${bodyPreview}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**GIF URL**\n${session.gifUrl}` },
    { type: 14, divider: true, spacing: 1 },

    // Tip
    {
      type: 10,
      content: "-# 💡 Use `---` on its own line in the body to insert a separator line.",
    },

    // Edit buttons
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: "✏️  Edit Title",  custom_id: "edit_title" },
        { type: 2, style: 1, label: "✏️  Edit Body",   custom_id: "edit_body"  },
        { type: 2, style: 1, label: "✏️  Edit GIF",    custom_id: "edit_gif"   },
      ],
    },

    // Action buttons
    {
      type: 1,
      components: [
        { type: 2, style: 2, label: "👁  Preview",        custom_id: "preview_msg"  },
        { type: 2, style: 3, label: "✅  Send Message",   custom_id: "send_msg"     },
        { type: 2, style: 4, label: "✖  Cancel",         custom_id: "cancel_composer" },
      ],
    },
  ];
}

// Per-admin editor sessions: userId → { title, body, gifUrl, channelId, cmdInteraction }
const sessions = new Map();

// ── Bot setup ────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  console.log(`✅  Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Compose and send a custom message (admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(CONFIG.token);
  try {
    await rest.put(Routes.applicationCommands(CONFIG.clientId), { body: commands });
    console.log("✅  Slash commands registered");
  } catch (err) {
    console.error("❌  Failed to register slash commands:", err);
  }
});

// ── Interaction handler ──────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {

  // ── /send command ──────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "send") {
    const session = {
      title:          "# Your Title Here",
      body:           "Write your message body here.\n---\nYou can add separator lines using ---.",
      gifUrl:         CONFIG.defaultGifUrl,
      channelId:      interaction.channelId,
      cmdInteraction: interaction,
    };
    sessions.set(interaction.user.id, session);

    await interaction.reply({
      components: buildEditorPayload(session),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // ── Button interactions ────────────────────────────────────────
  if (interaction.isButton()) {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        components: [{ type: 10, content: "❌  Session expired. Run `/send` again." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    // ── Open modals ──────────────────────────────────────────────
    if (interaction.customId === "edit_title") {
      const modal = new ModalBuilder()
        .setCustomId("modal_title")
        .setTitle("Edit Title")
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("input")
            .setLabel("Title — markdown supported (e.g. # Heading)")
            .setStyle(TextInputStyle.Short)
            .setValue(session.title)
            .setRequired(true)
        ));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "edit_body") {
      const modal = new ModalBuilder()
        .setCustomId("modal_body")
        .setTitle("Edit Body")
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("input")
            .setLabel("Body text  (use --- on its own line for separator)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(session.body)
            .setRequired(true)
        ));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "edit_gif") {
      const modal = new ModalBuilder()
        .setCustomId("modal_gif")
        .setTitle("Edit GIF URL")
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("input")
            .setLabel("Direct GIF URL (.gif link)")
            .setStyle(TextInputStyle.Short)
            .setValue(session.gifUrl)
            .setRequired(true)
        ));
      await interaction.showModal(modal);
      return;
    }

    // ── Preview ──────────────────────────────────────────────────
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

    // ── Send the message publicly ────────────────────────────────
    if (interaction.customId === "send_msg") {
      const targetChannel = interaction.guild.channels.cache.get(session.channelId);
      if (!targetChannel) {
        await interaction.reply({
          components: [{ type: 10, content: "❌  Channel not found." }],
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
        components: [
          { type: 10, content: "✅  **Message sent successfully!**" },
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    // ── Cancel ───────────────────────────────────────────────────
    if (interaction.customId === "cancel_composer") {
      sessions.delete(interaction.user.id);
      await interaction.update({
        components: [{ type: 10, content: "✖  Composer cancelled." }],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }
  }

  // ── Modal submissions ──────────────────────────────────────────
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

// ── Welcome message on member join ──────────────────────────────
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
  if (!channel) {
    console.error("❌  Welcome channel not found. Check CONFIG.welcomeChannelId.");
    return;
  }

  const fill = (str) =>
    str
      .replace(/{user}/g,     `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g,   member.guild.name);

  const attachment = new AttachmentBuilder(CONFIG.gifPath, { name: "video.gif" });

  try {
    await channel.send({
      files:      [attachment],
      components: buildMessagePayload(
        fill(CONFIG.welcomeTitle),
        fill(CONFIG.welcomeBody),
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

client.login(CONFIG.token);
