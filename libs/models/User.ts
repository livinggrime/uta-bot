import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    discordUserId: string;
    username: string;
    sessionKey: string;
    authorizedAt: string;
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
}

const UserSchema: Schema = new Schema({
    discordUserId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    sessionKey: { type: String, required: true },
    authorizedAt: { type: String, required: true },
    spotifyAccessToken: { type: String },
    spotifyRefreshToken: { type: String },
});

export default mongoose.model<IUser>('User', UserSchema);
