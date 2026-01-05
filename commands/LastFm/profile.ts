import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getUserInfo, getImageUrl } from '../../libs/lastfm';
import { getUserData } from '../../libs/userdata';


export default {
    aliases: ['pr'],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Show Last.fm profile for you or another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to check (defaults to you)')
                .setRequired(false)
        ),
    async execute(context: any) {
        const targetUser = context.options.getUser('user') || context.user;
        const userData = await getUserData(targetUser.id);

        if (!userData) {
            await context.reply({
                content: `❌ ${targetUser.id === context.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} linked a Last.fm account yet. Use \`/setfm\` to link one.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await context.deferReply();

        try {
            const userInfo = await getUserInfo(userData.username);

            const scrobbles = parseInt(userInfo.playcount).toLocaleString();
            const profileImage = getImageUrl(userInfo.image);

            const embed = new EmbedBuilder()
                .setColor(0xba0000)
                .setAuthor({
                    name: `${targetUser.username}'s Last.fm Profile`,
                    iconURL: targetUser.displayAvatarURL(),
                })
                .setTitle(userInfo.name)
                .setURL(userInfo.url)
                .addFields(
                    { name: '📊 Total Scrobbles', value: scrobbles, inline: true },
                    { name: '📅 Member Since', value: `<t:${userInfo.registered.unixtime}:D>`, inline: true }
                );

            if (userInfo.country) {
                embed.addFields({ name: '🌍 Country', value: userInfo.country, inline: true });
            }

            if (userInfo.realname) {
                embed.addFields({ name: '👤 Real Name', value: userInfo.realname, inline: false });
            }

            if (profileImage) {
                embed.setThumbnail(profileImage);
            }

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
