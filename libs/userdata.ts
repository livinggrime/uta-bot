import User from './models/User';

export interface UserData {
    username: string;
    sessionKey: string;
    authorizedAt: string;
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
}

/**
 * Loads all users from the database.
 * @returns A record of user data keyed by Discord User ID.
 */
export async function loadUsers(): Promise<Record<string, UserData>> {
    try {
        const users = await User.find({});
        const result: Record<string, UserData> = {};
        for (const user of users) {
            result[user.discordUserId] = {
                username: user.username,
                sessionKey: user.sessionKey,
                authorizedAt: user.authorizedAt,
            };
        }
        return result;
    } catch (error) {
        console.error('Error loading users from DB:', error);
        return {};
    }
}

/**
 * Saves a user's data to the database.
 * @param discordUserId The Discord user ID.
 * @param data The user data to save.
 */
export async function saveUser(discordUserId: string, data: UserData): Promise<void> {
    try {
        await User.findOneAndUpdate(
            { discordUserId },
            { $set: data },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error(`Error saving user ${discordUserId} to DB:`, error);
    }
}

/**
 * Gets a specific user's data.
 * @param discordUserId The Discord user ID.
 */
export async function getUserData(discordUserId: string): Promise<UserData | null> {
    try {
        const user = await User.findOne({ discordUserId });
        if (!user) return null;
        return {
            username: user.username,
            sessionKey: user.sessionKey,
            authorizedAt: user.authorizedAt,
            spotifyAccessToken: user.spotifyAccessToken,
            spotifyRefreshToken: user.spotifyRefreshToken,
        };
    } catch (error) {
        console.error(`Error fetching user ${discordUserId} from DB:`, error);
        return null;
    }
}

export async function saveSpotifyData(discordUserId: string, accessToken: string, refreshToken: string): Promise<void> {
    try {
        await User.findOneAndUpdate(
            { discordUserId },
            {
                $set: {
                    spotifyAccessToken: accessToken,
                    spotifyRefreshToken: refreshToken
                }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error(`Error saving Spotify data for ${discordUserId}:`, error);
    }
}

/**
 * Counts how many OTHER Discord users are linked to a specific Last.fm username.
 * Used for alt-detection/limit enforcement.
 */
export async function countAltsByFmUsername(username: string, excludeDiscordId: string): Promise<number> {
    try {
        return await User.countDocuments({
            username: { $regex: new RegExp(`^${username}$`, 'i') },
            discordUserId: { $ne: excludeDiscordId }
        });
    } catch (error) {
        console.error(`Error counting alts for ${username}:`, error);
        return 0;
    }
}
