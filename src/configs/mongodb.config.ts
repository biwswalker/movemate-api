import mongoose, { ConnectOptions } from "mongoose";

export const connectToMongoDB = async () => {
  const url = process.env.DATABASE_URL || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "movemate-dev";

  const options: ConnectOptions = {
    dbName,
    readPreference: 'primary',
    retryWrites: true,
    writeConcern: {
      w: 'majority',
    },
  };

  try {
    await mongoose.connect(url, options);
    console.log("🍃 Connected to MongoDB", `${process.env.DATABASE_URL}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
