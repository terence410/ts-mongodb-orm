import {MongoClient} from "mongodb";
import {TsMongodbOrmError} from "./errors/TsMongodbOrmError";
import {LockManager} from "./locks/LockManager";
import {RankManager} from "./ranks/RankManager";
import {Repository} from "./Repository";
import {TransactionManager} from "./transactions/TransactionManager";
import {tsMongodbOrm} from "./tsMongodbOrm";
import {
    IConnectionOptions,
    IDocumentClass,
    IGetLockManagerOptions, IGetRankManagerOptions,
    IGetRepositoryOptions,
    IGetTransactionManagerOptions,
} from "./types";
import {updateStack} from "./utils";

export class Connection {
    public readonly mongoClient: MongoClient;
    public readonly dbName: string;

    constructor(options: IConnectionOptions) {
        this.mongoClient = options.mongoClient;
        this.dbName = options.dbName;
    }

    public get isConnected() {
        return this.mongoClient.isConnected();
    }

    public async close() {
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            await this.mongoClient.close();
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public getRepository<T extends IDocumentClass>(classObject: T, options: IGetRepositoryOptions = {}): Repository<T> {
        const documentMeta = tsMongodbOrm.getDocumentMeta(classObject);

        return new Repository<T>({
            mongoClient: this.mongoClient,
            classObject,
            dbName: options.dbName || this.dbName,
            collectionName: options.collectionName || documentMeta.collectionName,
        });
    }

    public getTransactionManager<T extends any>(options: Partial<IGetTransactionManagerOptions> = {}) {
        return new TransactionManager(Object.assign({
            mongoClient: this.mongoClient,
            transactionOptions: {},
            maxRetry: options.maxRetry || -1,
        }, options));
    }

    public getLockManager<T extends any>(options: Partial<IGetLockManagerOptions> = {}) {
        if (options.expiresIn && options.expiresIn > 60 * 1000) {
            throw new TsMongodbOrmError(`You cannot expiresIn more than 60000.`);
        }

        return new LockManager(Object.assign({
            mongoClient: this.mongoClient,
            dbName: this.dbName,
            collectionName: "Lock",
            expiresIn: 1000,
            maxRetry: 0,
            retryDelay: 0,
        }, options));
    }

    public getRankManager<T extends any>(options: IGetRankManagerOptions) {
        return new RankManager(Object.assign({
            mongoClient: this.mongoClient,
            skipTransaction: !!options.skipTransaction,
            transaction: {
                maxRetry: options.transaction?.maxRetry || -1,
                transactionOptions: options.transaction?.transactionOptions || {},
            },
            dbName: this.dbName,
            collectionName: "Rank",
        }, options));
    }
}
