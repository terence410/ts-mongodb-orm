import {MongoClient, MongoClientOptions} from "mongodb";
import {Connection} from "../Connection";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {updateStack} from "./index";

export async function createConnection(options: {uri: string, mongoClientOptions: MongoClientOptions, dbName: string}) {
    const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
    try {
        const mongoClient = await MongoClient.connect(options.uri, options.mongoClientOptions);
        return new Connection({mongoClient, dbName: options.dbName});

    } catch (err) {
        throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
    }
}
