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
    let callbackError: Error | undefined;
    const stack = new Error().stack;

    try {
        await callback();
    } catch (err) {
        callbackError = err;
    }

    if (callbackError === undefined) {
        throw Object.assign(new Error(`No error found. Expect to have an error with message: ${options.message}`), {stack});
    }

    if (typeof callbackError.message !== "string") {
        throw Object.assign(new Error(`Error message is not a string`), {stack});
    }

    if (options.errorType) {
        if (!(callbackError instanceof options.errorType)) {
            throw Object.assign(new Error(`Expect to have an error with type ${options.errorType.name}`), {stack});
        }
    }

    if (!callbackError.message.match(options.message)) {
        throw Object.assign(new Error(`Error message: ${callbackError.message} expects to match with ${options.message} `), {stack});
    }

    return callbackError;
}

export async function assertTsMongodbOrmError(callback: () => void, message: RegExp) {
    return assertAsyncError(callback, {message, errorType: TsMongodbOrmError});
}

export async function assertMongoError(callback: () => void, message: RegExp) {
    return assertAsyncError(callback, {message, errorType: MongoError});
}
