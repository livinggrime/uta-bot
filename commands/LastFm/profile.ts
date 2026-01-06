import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {getImageUrl, getTopArtists, getUserInfo} from '../../libs/lastfm';
import {getUserData} from '../../libs/userdata';


export default {
    aliases: ['pr', 'p'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Show Last.fm profile for you or another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to check (defaults to you)')
                .setRequired(false)
        )
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
        const targetUser = context.options.getUser('user') || context.user;
        const userData = await getUserData(targetUser.id);

        if (!userData) {
            await context.reply({
                content: `❌ ${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} linked a Last.fm account yet. Use \`/link\` to link one.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await context.deferReply();

        try {
            const [userInfo, topArtists] = await Promise.all([
                getUserInfo(userData.username),
                getTopArtists(userData.username, 'overall', 3)
            ]);

            const scrobbles = parseInt(userInfo.playcount).toLocaleString();
            const profileImage = await getImageUrl(userInfo.image);

            const embed = new EmbedBuilder()
                .setColor(0xd51007)
                .setAuthor({
                    name: `${targetUser.username} (${userData.username})`,
                    iconURL: targetUser.displayAvatarURL(),
                    url: userInfo.url
                })
                .addFields(
                    { name: '📊 Scrobbles', value: `**${scrobbles}**`, inline: true },
                    { name: '📅 Member Since', value: `<t:${userInfo.registered.unixtime}:D>`, inline: true }
                );

            if (topArtists.length > 0) {
                const artistList = topArtists.map((a, i) => `${i + 1}. **${a.name}** (${parseInt(a.playcount).toLocaleString()} plays)`).join('\n');
                embed.addFields({ name: '🔝 Top Artists', value: artistList });
            }

            if (userInfo.country) {
                embed.addFields({ name: '🌍 Country', value: userInfo.country, inline: true });
            }

            if (profileImage) {
                embed.setThumbnail(profileImage);
            }

            embed.setFooter({ text: 'Last.fm Profile • Use /chart for a visual grid' });

            await context.editReply({ embeds: [embed] });

            embed.setFooter({ text: `Last.fm • ${userData.username}` });

            await context.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching user profile:', error);
            await context.editReply({
                content: '❌ Error fetching Last.fm profile. Please try again later.',
            });
        }
    }
};
