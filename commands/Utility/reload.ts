import {SlashCommandBuilder} from "discord.js";
import path from "path";
import fs from "fs";

export default {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads a command')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload')
                .setRequired(true)),
    async execute(interaction: any) {
        const commandName = interaction.options.getString('command');
        const command = interaction.client.commands.get(commandName);

        if (!command) {
            return interaction.reply({ content: `There is no command with name \`${commandName}\`!`, ephemeral: true });
        }

        const commandFolders = fs.readdirSync(path.join(__dirname, '..'));
        const folderName = commandFolders.find(folder => fs.readdirSync(path.join(__dirname, '..', folder)).includes(`${commandName}.ts`) || fs.readdirSync(path.join(__dirname, '..', folder)).includes(`${commandName}.js`));
        if (!folderName) {
            return interaction.reply({ content: `Could not find the folder for command \`${commandName}\`!`, ephemeral: true });
        }

        const commandPath = path.join(__dirname, '..', folderName, `${commandName}.ts`);
        delete require.cache[require.resolve(commandPath)];
        try {
            const newCommand = await import(commandPath);
            interaction.client.commands.set(newCommand.default.data.name, newCommand.default);
            await interaction.reply({ content: `Command \`${commandName}\` was reloaded!`, ephemeral: true });
        } catch (error) {
            console.error(error);
            // @ts-ignore
            await interaction.reply({ content: `There was an error while reloading command \`${commandName}\`:\n\`${error.message}\``, ephemeral: true });
        }
    }
}