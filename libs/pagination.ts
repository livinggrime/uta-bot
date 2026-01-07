import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, ButtonInteraction} from 'discord.js';

export async function paginate(context: any, embeds: EmbedBuilder[], timeout = 60000) {
	if (embeds.length === 0) return;
	if (embeds.length === 1) {
		return context.editReply({embeds: [embeds[0]], components: []});
	}

	let currentPage = 0;

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('first')
			.setLabel('First')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true)
			.setEmoji('⏮️'),
		new ButtonBuilder()
			.setCustomId('prev')
			.setLabel('Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true)
			.setEmoji('⬅️'),
		new ButtonBuilder()
			.setCustomId('next')
			.setLabel('Next')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(embeds.length === 1)
			.setEmoji('➡️'),
		new ButtonBuilder()
			.setCustomId('last')
			.setLabel('Last')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(embeds.length === 1)
			.setEmoji('⏭️')
	);

	const message = await context.editReply({
		embeds: [new EmbedBuilder(embeds[currentPage]!.toJSON()).setFooter({text: `Page ${currentPage + 1} of ${embeds.length}`})],
		components: [row]
	});

	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: timeout,
		filter: (interaction: ButtonInteraction) => interaction.user.id === (context.user?.id || context.author?.id)
	});

	collector.on('collect', async (interaction: ButtonInteraction) => {

		if (interaction.customId === 'first') {
			currentPage = 0;
		} else if (interaction.customId === 'prev') {
			currentPage--;
		} else if (interaction.customId === 'next') {
			currentPage++;
		} else if (interaction.customId === 'last') {
			currentPage = embeds.length - 1;
		}

		row.components[0]!.setDisabled(currentPage === 0);
		row.components[1]!.setDisabled(currentPage === 0);
		row.components[2]!.setDisabled(currentPage === embeds.length - 1);
		row.components[3]!.setDisabled(currentPage === embeds.length - 1);

		await interaction.update({
			embeds: [new EmbedBuilder(embeds[currentPage]!.toJSON()).setFooter({text: `Page ${currentPage + 1} of ${embeds.length}`})],
			components: [row]
		});
	});

	collector.on('end', async () => {
		try {
			await context.editReply({components: []});
		} catch (e) {
			// Message might have been deleted
		}
	});
}
