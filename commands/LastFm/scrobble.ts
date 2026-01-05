import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { scrobbleTrack } from '../../libs/oauth';
import { getUserData } from '../../libs/userdata';


export default {
    aliases: ['s'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('scrobble')
        .setDescription('Manually scrobble a track to Last.fm')
        .addStringOption(option =>
            option.setName('artist')
                .setDescription('The artist name')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('track')
                .setDescription('The track name')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('album')
                .setDescription('The album name (optional)')
                .setRequired(false)
        ),
    async execute(context: any) {
        const userData = await getUserData(context.user.id);

        if (!userData || !userData.sessionKey) {
            await context.reply({
                content: '❌ You haven\'t authorized the bot to scrobble tracks. Use `/setfm` to connect your account.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        let artist = context.options.getString('artist');
        let track = context.options.getString('track');
        let album = context.options.getString('album') || undefined;
        const timestamp = Math.floor(Date.now() / 1000);

        // Message-based parsing if needed (simple comma separation)
        if (!context.isInteraction && context.message) {
            const argsString = context.message.content.slice(context.message.content.indexOf(' ') + 1).split(',');
            if (argsString.length >= 2) {
                artist = argsString[0].trim();
                track = argsString[1].trim();
                album = argsString[2]?.trim();
            }
        }

        if (!artist || !track) {
            return context.reply({
                content: '❌ Please provide artist and track. Example: `!s Artist, Track, Album`'
            });
        }

        await context.deferReply();

        try {
            await scrobbleTrack(userData.sessionKey, track, artist, timestamp, album);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Track Scrobbled!')
                .setDescription(`Successfully scrobbled **${track}** by **${artist}**`)
                .addFields(
                    { name: '🎤 Artist', value: artist, inline: true },
                    { name: '🎵 Track', value: track, inline: true }
                );

            if (album) {
                embed.addFields({ name: '💿 Album', value: album, inline: true });
            }

            embed.setFooter({ text: `Scrobbled to ${userData.username}` });

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error scrobbling track:', error);
            await context.editReply({
                content: '❌ Error scrobbling track. Please ensure you have authorized the bot correctly.',
            });
        }
    }
};
