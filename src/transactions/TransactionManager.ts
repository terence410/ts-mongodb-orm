import {MongoClient, TransactionOptions} from "mongodb";
import {ITransactionCallback, ITransactionMangerOptions, ITransactionResult} from "../types";
import {Transaction} from "./Transaction";

export class TransactionManager {
    public readonly mongoClient: MongoClient;
    public readonly maxRetry: number;
    public readonly transactionOptions: TransactionOptions;

    constructor(options: ITransactionMangerOptions) {
        this.mongoClient = options.mongoClient;
        this.maxRetry = options.maxRetry;
        this.transactionOptions = options.transactionOptions;
    }

    public async startTransaction<T extends any>(callback: ITransactionCallback<T>): Promise<ITransactionResult<T>> {
        const transaction = new Transaction({
            mongoClient: this.mongoClient,
            maxRetry: this.maxRetry,
            transactionOptions: this.transactionOptions,
        });

        return await transaction.start(callback);
    }
}
