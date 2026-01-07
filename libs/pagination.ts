import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder} from 'discord.js';

export async function paginate(context: any, embeds: EmbedBuilder[], timeout = 60000) {
	if (embeds.length === 0) return;
	if (embeds.length === 1) {
		return context.editReply({embeds: [embeds[0]], components: []});
	}

	let currentPage = 0;

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('prev')
			.setLabel('Previous')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true)
			.setEmoji('⬅️'),
		new ButtonBuilder()
			.setCustomId('next')
			.setLabel('Next')
			.setStyle(ButtonStyle.Primary)
			.setEmoji('➡️'),
	);

	const message = await context.editReply({
		embeds: [new EmbedBuilder(embeds[currentPage]!.toJSON()).setFooter({text: `Page ${currentPage + 1} of ${embeds.length}`})],
		components: [row]
	});

	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: timeout
	});

	collector.on('collect', async (interaction: any) => {
		if (interaction.user.id !== (context.user?.id || context.author?.id)) {
			return interaction.reply({content: 'You cannot use these buttons.', ephemeral: true});
		}

		if (interaction.customId === 'prev') {
			currentPage--;
		} else if (interaction.customId === 'next') {
			currentPage++;
		}

		row.components[0]!.setDisabled(currentPage === 0);
		row.components[1]!.setDisabled(currentPage === embeds.length - 1);

		await interaction.update({
			embeds: [new EmbedBuilder(embeds[currentPage]!.toJSON()).setFooter({text: `Page ${currentPage + 1} of ${embeds.length}`})],
			components: [row]
		});
	});

	collector.on('end', async () => {
		try {
			const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				row.components[0]!.setDisabled(true),
				row.components[1]!.setDisabled(true)
			);
			await context.editReply({components: [disabledRow]});
		} catch (e) {
			// Message might have been deleted
		}
	});
}
