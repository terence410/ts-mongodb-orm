import {MongoClient} from "mongodb";
import {Repository} from "../Repository";
import {ILockCallback, ILockManagerOptions} from "../types";
import {Lock} from "./Lock";
import {LockDocument} from "./LockDocument";

export class LockManager {
    public readonly mongoClient: MongoClient;
    public readonly dbName: string;
    public readonly collectionName: string;
    public readonly expiresIn: number;
    public readonly maxRetry: number;
    public readonly retryDelay: number;

    constructor(options: ILockManagerOptions) {
        this.mongoClient = options.mongoClient;
        this.dbName = options.dbName;
        this.collectionName = options.collectionName;
        this.expiresIn = options.expiresIn;
        this.maxRetry = options.maxRetry;
        this.retryDelay = options.retryDelay;
    }

    public async startLock<T extends any>(lockKey: string, callback: ILockCallback<T>): Promise<{value: T}> {
        const lock = new Lock({
            lockKey,
            mongoClient: this.mongoClient,
            dbName: this.dbName,
            collectionName: this.collectionName,
            expiresIn: this.expiresIn,
            maxRetry: this.maxRetry,
            retryDelay: this.retryDelay,
        });
        return await lock.start(callback);
    }

    public async createCollection() {
        const repository = new Repository({
            mongoClient: this.mongoClient,
            classObject: LockDocument,
            dbName: this.dbName,
            collectionName: this.collectionName,
        });
        await repository.createCollection();
        await repository.syncIndex();
    }

    public async dropCollection() {
        const repository = new Repository({
            mongoClient: this.mongoClient,
            classObject: LockDocument,
            dbName: this.dbName,
            collectionName: this.collectionName,
        });
        await repository.dropCollection();
    }
}
