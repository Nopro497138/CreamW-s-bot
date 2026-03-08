require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");
const path = require("path");

// ─────────────────────────────────────────────
//  CONFIGURATION  ← edit everything here
// ─────────────────────────────────────────────
const CONFIG = {
  token: process.env.DISCORD_TOKEN,

  // Channel where welcome messages will be sent
  welcomeChannelId: "1406701856545177732",

  // ── Big heading at the top (supports markdown: # ## **bold** etc.)
  // Placeholders: {user} = mention, {username} = plain name, {server} = server name
  welcomeTitle: "# Welcome, {user}!",

  // ── Body text below the separator (supports full markdown, \n for new lines)
  welcomeBody: [
    "Hey {user}, we're glad to have you here! ☀️",
    "",
    "Feel free to explore the community, introduce yourself, and enjoy chatting with the other members.",
    "If you have any questions or need help, feel free to reach out to our team at any time.",
    "",
    "Please make sure to read our **rules** before participating in roleplay or chat,",
    "so that a respectful and fair environment is guaranteed for everyone.",
    "",
    "We wish you a lot of fun and a great time with us! 🎉",
    "",
    "*– Your Server Team*",
  ].join("\n"),

  // Path to the local GIF file (relative to bot.js)
  gifPath: path.join(__dirname, "video.gif"),
};
// ─────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => {
  console.log(`✅  Logged in as ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);

  if (!channel) {
    console.error(`❌  Welcome channel not found! Check CONFIG.welcomeChannelId.`);
    return;
  }

  // Replace placeholders
  const fill = (text) =>
    text
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name);

  // Attach the local GIF so we can reference it as attachment://video.gif
  const gifAttachment = new AttachmentBuilder(CONFIG.gifPath, {
    name: "video.gif",
  });

  // ── Pure Components V2 – no container, no embed, no accent sidebar
  // Component types:
  //   10 = Text Display
  //   14 = Separator
  //   12 = Media Gallery
  const components = [
    // 1. Big welcome heading
    {
      type: 10,
      content: fill(CONFIG.welcomeTitle),
    },

    // 2. Visible divider line
    {
      type: 14,
      divider: true,
      spacing: 1, // 1 = small  |  2 = large
    },

    // 3. Body text (freely editable in CONFIG above)
    {
      type: 10,
      content: fill(CONFIG.welcomeBody),
    },

    // 4. Invisible spacer before GIF
    {
      type: 14,
      divider: false,
      spacing: 2,
    },

    // 5. GIF loaded from local file
    {
      type: 12,
      items: [
        {
          media: { url: "attachment://video.gif" },
        },
      ],
    },
  ];

  try {
    await channel.send({
      files: [gifAttachment],
      components,
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`📨  Welcome message sent for ${member.user.tag}`);
  } catch (err) {
    console.error("❌  Failed to send welcome message:", err);
  }
});

client.login(CONFIG.token);
