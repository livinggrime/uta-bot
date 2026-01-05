import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const clientOptions: mongoose.ConnectOptions = {
    serverApi: { version: '1', strict: false, deprecationErrors: true }
};

export async function connectToDatabase() {
    const url = process.env.DATABASE_URL || 'mongodb+srv://bot:8nLn1KvvZHADJal4@cluster0.assciik.mongodb.net/uta?retryWrites=true&w=majority&appName=Cluster0';

    try {
        await mongoose.connect(url, clientOptions);
        await mongoose.connection.db?.admin().command({ ping: 1 });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error; // Re-throw to allow callers to handle failure
    }
}

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});
