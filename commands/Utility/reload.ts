import {ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder} from "discord.js";
import path from "path";
import fs from "fs";

export default {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads a command')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload')
                .setRequired(true))
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
        const commandName = context.options.getString('command');
        const command = context.client.commands.get(commandName);

        if (!command) {
            return context.reply({ content: `There is no command with name \`${commandName}\`!`, ephemeral: true });
        }

        const commandFolders = fs.readdirSync(path.join(__dirname, '..'));
        const folderName = commandFolders.find(folder => fs.readdirSync(path.join(__dirname, '..', folder)).includes(`${commandName}.ts`) || fs.readdirSync(path.join(__dirname, '..', folder)).includes(`${commandName}.js`));
        if (!folderName) {
            return context.reply({ content: `Could not find the folder for command \`${commandName}\`!`, ephemeral: true });
        }

        const commandPath = path.join(__dirname, '..', folderName, `${commandName}.ts`);
        delete require.cache[require.resolve(commandPath)];
        try {
            const newCommand = await import(commandPath);
            context.client.commands.set(newCommand.default.data.name, newCommand.default);
            await context.reply({ content: `Command \`${commandName}\` was reloaded!`, ephemeral: true });
        } catch (error) {
            console.error(error);
            // @ts-ignore
            await context.reply({ content: `There was an error while reloading command \`${commandName}\`:\n\`${error.message}\``, ephemeral: true });
        }
    }
}