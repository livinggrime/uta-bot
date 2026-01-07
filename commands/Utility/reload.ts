import {ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder} from "discord.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        
        if (!commandName) {
            return context.reply({ content: 'Please provide a command name to reload!', ephemeral: true });
        }

        const command = context.client.commands.get(commandName);
        if (!command) {
            return context.reply({ content: `There is no command with name \`${commandName}\`!`, ephemeral: true });
        }

        try {
            const commandsPath = path.join(__dirname, '..');
            const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            let folderName = '';
            let commandFilePath = '';

            for (const folder of commandFolders) {
                const folderPath = path.join(commandsPath, folder);
                const folderFiles = fs.readdirSync(folderPath);
                
                const commandFile = folderFiles.find(file => 
                    file === `${commandName}.ts` || file === `${commandName}.js`
                );

                if (commandFile) {
                    folderName = folder;
                    commandFilePath = path.join(folderPath, commandFile);
                    break;
                }
            }

            if (!commandFilePath) {
                return context.reply({ content: `Could not find command file for \`${commandName}\`!`, ephemeral: true });
            }

// Clear any existing module cache and import fresh module
            const moduleUrl = `file://${commandFilePath}`;
            const newCommand = await import(`${moduleUrl}?t=${Date.now()}`);
            
            if (!newCommand.default || !newCommand.default.data || !newCommand.default.execute) {
                throw new Error('Invalid command structure - missing required properties');
            }

            // Update the command in the client's command collection
            context.client.commands.set(newCommand.default.data.name, newCommand.default);
            
            await context.reply({ 
                content: `Command \`${newCommand.default.data.name}\` was reloaded successfully!`, 
                ephemeral: true 
            });

        } catch (error: any) {
            console.error(`Error reloading command ${commandName}:`, error);
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            await context.reply({ 
                content: `There was an error while reloading command \`${commandName}\`:\n\`\`\`${errorMessage}\`\`\``, 
                ephemeral: true 
            });
        }
    }
}