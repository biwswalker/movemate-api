import mongoose, { ConnectOptions } from 'mongoose'

const url = process.env.DATABASE_URL || 'mongodb://localhost:27017'
const dbName = process.env.DATABASE_NAME || 'movemate'

const options: ConnectOptions = {
    // TODO: Configure any additional options
}

export const connectToMongoDB = async () => {
    try {
        await mongoose.connect(`${url}/${dbName}`, options)
        console.log('Connected to MongoDB')
    } catch (error) {
        console.error('Error connecting to MongoDB:', error)
        process.exit(1)
    }
}