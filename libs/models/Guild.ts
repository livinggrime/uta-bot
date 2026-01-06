import mongoose, {Document, Schema} from 'mongoose';

export interface IGuild extends Document {
    guildId: string;
    prefix: string;
}

const GuildSchema: Schema = new Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, required: true, default: '!' },
});

export default mongoose.model<IGuild>('Guild', GuildSchema);
