const {
  Client,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require("discord.js");

// ─────────────────────────────────────────────
//  CONFIGURATION  ← edit everything here
// ─────────────────────────────────────────────
const CONFIG = {
  // Bot token from .env or hardcoded (use .env in production!)
  token: process.env.DISCORD_TOKEN,

  // The channel ID where welcome messages should be sent
  welcomeChannelId: "YOUR_WELCOME_CHANNEL_ID",

  // Accent color of the container sidebar (hex number)
  accentColor: 0xe84040, // red – change to any hex color

  // ── Big heading shown at the top (supports markdown)
  // {user} = mention, {username} = plain name, {server} = server name
  welcomeTitle: "# Welcome, {user}!",

  // ── Body text shown below the separator (supports full markdown)
  // Keep it friendly and easy to read. Use \n for new lines.
  welcomeBody: [
    "Hey {user}, we're glad to have you here! ☀️",
    "",
    "Feel free to explore the community, introduce yourself, and enjoy chatting with other members.",
    "If you have any questions or need help, feel free to reach out to our team at any time.",
    "",
    "Please make sure to read our **rules** before participating in roleplay or chat,",
    "so that a respectful and fair environment is guaranteed for everyone.",
    "",
    "We wish you a lot of fun and a great time with us! 🎉",
    "",
    "*– Your Server Team*",
  ].join("\n"),

  // ── GIF shown at the bottom (direct URL to a .gif or tenor/giphy CDN link)
  welcomeGifUrl:
    "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif",
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
    console.error(
      `❌  Welcome channel not found! Check CONFIG.welcomeChannelId.`
    );
    return;
  }

  // Replace placeholders in text
  const replacePlaceholders = (text) =>
    text
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name);

  // ── Build the Components V2 message
  const container = new ContainerBuilder()
    .setAccentColor(CONFIG.accentColor)

    // 1. Big welcome heading
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        replacePlaceholders(CONFIG.welcomeTitle)
      )
    )

    // 2. Separator (visible divider line)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )

    // 3. Body text (the customizable block)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        replacePlaceholders(CONFIG.welcomeBody)
      )
    )

    // 4. Separator before GIF (no visible line, just spacing)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large)
    )

    // 5. GIF at the bottom
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(CONFIG.welcomeGifUrl)
      )
    );

  try {
    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(
      `📨  Sent welcome message for ${member.user.tag} in #${channel.name}`
    );
  } catch (err) {
    console.error("❌  Failed to send welcome message:", err);
  }
});

client.login(CONFIG.token);
