require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    AttachmentBuilder,
    MessageFlags 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Bot ist online als ${client.user.tag}`);
});

function getWelcomePayload(memberId) {
    const file = new AttachmentBuilder('./video.gif');

    // Wir bauen die Nachricht mit Components V2 (Raw-Objekte für maximale Kompatibilität)
    return {
        // Das Flag 32768 (1 << 15) ist ENTSCHEIDEND für Components V2
        flags: [MessageFlags.IsComponentsV2], 
        files: [file],
        components: [
            {
                type: 17, // CONTAINER (Die "graue Box" mit dem farbigen Rand)
                color: 0x2b2d31, // Die Farbe des linken Randes
                components: [
                    {
                        type: 9, // SECTION
                        components: [
                            {
                                type: 10, // TEXT_DISPLAY
                                content: `# Welcome, <@${memberId}>!`
                            }
                        ]
                    },
                    {
                        type: 14, // SEPARATOR (Die Trennlinie)
                        divider: true,
                        spacing: 1 // 1 = Small, 2 = Large
                    },
                    {
                        type: 9, // SECTION für den Haupttext
                        components: [
                            {
                                type: 10, // TEXT_DISPLAY
                                content: `Hey <@${memberId}>, we are thrilled to have you here! ☀️\n\nFeel free to explore the community and enjoy interacting with our members. If you have questions, our team is always here to help.\n\n**Please read our rules** to ensure a fair environment for everyone.\n\nWe wish you a great time! 🎉\n\n*Your Bundeswehr Roleplay Team*`
                            }
                        ]
                    },
                    {
                        type: 1, // ACTION_ROW für Buttons innerhalb des Containers
                        components: [
                            {
                                type: 2, // BUTTON
                                style: 2, // Secondary (Grau)
                                label: "Get Started",
                                custom_id: "start_btn"
                            }
                        ]
                    }
                ]
            },
            {
                type: 12, // MEDIA_GALLERY (Zeigt das GIF/Video sauber an)
                items: [
                    {
                        media: "attachment://video.gif"
                    }
                ]
            }
        ]
    };
}

// Event: User tritt bei
client.on(Events.GuildMemberAdd, async member => {
    const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
    if (!channel) return;

    try {
        await channel.send(getWelcomePayload(member.id));
    } catch (err) {
        console.error("Fehler beim Senden der Willkommensnachricht:", err);
    }
});

// Test-Befehl
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (message.content === '!testwelcome') {
        try {
            await message.channel.send(getWelcomePayload(message.author.id));
        } catch (err) {
            console.error("Fehler beim Test-Befehl:", err);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
