import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getSpotifyAuthorizationUrl, SpotifyPlayer} from '../../libs/spotify';
import {getUserData} from '../../libs/userdata';

export default {
    data: new SlashCommandBuilder()
        .setName('spotify')
        .setDescription('Spotify commands ')
        .addSubcommand(sub => sub.setName('login').setDescription('Link your Spotify account'))
        .addSubcommand(sub => sub.setName('play').setDescription('Resume playback'))
        .addSubcommand(sub => sub.setName('pause').setDescription('Pause playback'))
        .addSubcommand(sub => sub.setName('resume').setDescription('Resume playback'))
        .addSubcommand(sub => sub.setName('nowplaying').setDescription('Show current track'))
        .addSubcommand(sub => sub.setName('like').setDescription('Like the current track'))
        .addSubcommand(sub => sub.setName('dislike').setDescription('Dislike the current track'))
        .addSubcommand(sub => sub.setName('vc').setDescription('play the current song in vc'))
        .addSubcommand(sub => sub.setName('topartist').setDescription('Checks you Top Artist for a definite period in weeks').addIntegerOption(option => option.setName('time').setDescription('Time period of which you wanna check').setRequired(false)))
        .addSubcommand(sub => sub.setName('queue').setDescription('Add song to Queue'))
        
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ]),

    async execute(context: any) {
        const subcommand = context.options.getSubcommand();

        if (!subcommand) {
            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setTitle('Spotify Commands')
                .setDescription('Control your Spotify playback from Discord.')
                .addFields(
                    { name: 'Login', value: '`/spotify login` - Link your account' },
                    { name: 'Playback', value: '`/spotify play`, `/spotify pause`, `/spotify resume`' },
                    { name: 'Info', value: '`/spotify nowplaying`' }
                );
            return context.reply({ embeds: [embed] });
        }

        if (subcommand === 'login') {
            const url = getSpotifyAuthorizationUrl(context.user.id);
            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setTitle('Connect Spotify')
                .setDescription(`[Click here to link your Spotify account](${url})`)
                .setFooter({ text: 'You will be redirected to authorize the bot.' });

            return context.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const userData = await getUserData(context.user.id);

        if (!userData || !userData.spotifyAccessToken) {
            return context.reply({
                content: '❌ You need to link your Spotify account first using `/spotify login`.',
                flags: MessageFlags.Ephemeral
            });
        }

        await context.deferReply();
        const token = userData.spotifyAccessToken;

        try {
            if (subcommand === 'play' || subcommand === 'resume') {
                await SpotifyPlayer.play(token);
                await context.editReply('▶️ Resumed playback.');
            } else if (subcommand === 'pause') {
                await SpotifyPlayer.pause(token);
                await context.editReply('⏸️ Paused playback.');
            } else if (subcommand === 'nowplaying') {
                const np = await SpotifyPlayer.getNowPlaying(token);
                if (!np || !np.item) {
                    return context.editReply('❌ Nothing is currently playing.');
                }
                const track = np.item;
                const embed = new EmbedBuilder()
                    .setColor(0x1DB954)
                    .setTitle('Now Playing')
                    .setDescription(`**[${track.name}](${track.external_urls.spotify})**\nby ${track.artists.map((a: any) => a.name).join(', ')}`)
                    .setThumbnail(track.album.images[0]?.url)
                    .setFooter({ text: `Album: ${track.album.name}` });

                await context.editReply({ embeds: [embed] });
            }
        } catch (error: any) {
            console.error('Spotify command error:', error);
            if (error.message.includes('401') || error.message.includes('token')) {
                await context.editReply({
                    content: '❌ Your Spotify session has expired. Please run `/spotify login` again.'
                });
            } else if (error.message.includes('403') || error.message.includes('Premium')) {
                await context.editReply('❌ logic error: This command typically requires Spotify Premium.');
            } else {
                await context.editReply('❌ Error executing Spotify command. Ensure Spotify is active on a device.');
            }
        }
    }
}
