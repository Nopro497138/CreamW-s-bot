require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Events, ActionRowBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

// Die Funktion, die den Content zusammenstellt
function getWelcomePayload(memberId) {
    const file = new AttachmentBuilder('./video.gif');

    // Der Textinhalt (Markdown für große Schrift)
    const content = `# Welcome, <@${memberId}>!\n\n` +
                    `Hey <@${memberId}>, we are thrilled to have you here! ☀️\n\n` +
                    `Feel free to explore the community and enjoy interacting with our members. ` +
                    `If you have questions, our team is always here to help.\n\n` +
                    `**Please read our rules** to ensure a fair environment for everyone.\n\n` +
                    `We wish you a great time! 🎉\n` +
                    `*Your Bundeswehr Roleplay Team*`;

    return {
        content: content,
        files: [file],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 4 // Der neue "Separator" (Divider) aus Components V2
                    }
                ]
            }
            // Hier könnten weitere ActionRows mit Buttons folgen
        ]
    };
}

// Event: User tritt bei
client.on(Events.GuildMemberAdd, async member => {
    const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
    if (!channel) return;
    await channel.send(getWelcomePayload(member.id));
});

// Test-Befehl
client.on(Events.MessageCreate, async message => {
    if (message.content === '!testwelcome') {
        await message.channel.send(getWelcomePayload(message.author.id));
    }
});

client.login(process.env.DISCORD_TOKEN);
