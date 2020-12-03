import {config} from "dotenv";
config();

import {createConnection, MongoClientOptions, MongoError, TsMongodbOrmError} from "../src";

const uri = process.env.MONGODB_URI as string;
const dbName = process.env.MONGODB_DB as string;
const mongoClientOptions: MongoClientOptions = {
    w: "majority",
    useNewUrlParser: true,
    ignoreUndefined: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
};

export const addConnection = async (options: {dbName?: string} = {}) => {
    return await createConnection({uri, dbName: options.dbName || dbName, mongoClientOptions});
};

export async function assertAsyncError(callback: () => void, options: {message: RegExp, errorType?: any}) {
    let error: Error | undefined;
    try {
        await callback();
    } catch (err) {
        error = err;
    }

    if (error === undefined) {
        throw new Error(`No error found. Expect to have an error with message: ${options.message}`);
    }

    if (typeof error.message !== "string") {
        throw new Error(`Error message is not a string`);
    }

    if (options.errorType) {
        if (!(error instanceof options.errorType)) {
            throw new Error(`Expect to have an error with type ${options.errorType.name}`);
        }
    }

    if (!error.message.match(options.message)) {
        throw new Error(`Error message: ${error.message} expects to match with ${options.message} `);
    }

    return error;
}

export async function assertTsMongodbOrmError(callback: () => void, message: RegExp) {
    return assertAsyncError(callback, {message, errorType: TsMongodbOrmError});
}

export async function assertMongoError(callback: () => void, message: RegExp) {
    return assertAsyncError(callback, {message, errorType: MongoError});
}
