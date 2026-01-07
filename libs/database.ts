import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const clientOptions: mongoose.ConnectOptions = {
    serverApi: { version: '1', strict: false, deprecationErrors: true },
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
};

export async function connectToDatabase() {
    const url = process.env.DATABASE_URL || 'mongodb://localhost:27017/mydatabase';

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
