import mongoose, { ConnectOptions } from "mongoose";

const options: ConnectOptions = {
  // TODO: Configure any additional options
};

export const connectToMongoDB = async () => {
  const url = process.env.DATABASE_URL || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "movemate";

  try {
    await mongoose.connect(`${url}`, {
      dbName,
    });
    console.log("Connected to MongoDB", `${process.env.DATABASE_URL}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
