import {REST, Routes} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TOKEN || '';
const clientId = process.env.CLIENT || '';
const guildId = process.env.GUILD || '';
const rest = new REST().setToken(token);

(async () => {
    try {
        console.log('Started deleting all application (/) commands.');

        // Delete all guild-based commands
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log('Successfully deleted all guild commands.');

        // Delete all global commands
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('Successfully deleted all global commands.');
    } catch (error) {
        console.error(error);
    }
})();