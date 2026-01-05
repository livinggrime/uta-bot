import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { loveTrack } from '../../libs/oauth';
import { getUserData } from '../../libs/userdata';
import { getNowPlaying } from '../../libs/lastfm';


export default {
    aliases: ['l', 'heart'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('love')
        .setDescription('Love the currently playing track or a specific track')
        .addStringOption(option =>
            option.setName('artist')
                .setDescription('The artist name (optional, defaults to now playing)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('track')
                .setDescription('The track name (optional, defaults to now playing)')
                .setRequired(false)
        ),
    async execute(context: any) {
        const userData = await getUserData(context.user.id);

        if (!userData || !userData.sessionKey) {
            await context.reply({
                content: '❌ You haven\'t authorized the bot to manage your tracks. Use `/setfm` to connect your account.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        let artist = context.options.getString('artist');
        let track = context.options.getString('track');

        await context.deferReply();

        try {
            // If artist/track not provided, get now playing
            if (!artist || !track) {
                const np = await getNowPlaying(userData.username);
                if (!np) {
                    await context.editReply({
                        content: '❌ Could not find a currently playing track to love. Please specify artist and track.',
                    });
                    return;
                }
                artist = (np.artist as any)['#text'] || np.artist;
                track = np.name;
            }

            await loveTrack(userData.sessionKey, track!, artist!);

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❤️ Track Loved!')
                .setDescription(`Successfully loved **${track}** by **${artist}**`)
                .setFooter({ text: `Loved on ${userData.username}` });

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error loving track:', error);
            await context.editReply({
                content: '❌ Error loving track. Please ensure you have authorized the bot correctly.',
            });
        }
    }
};
