// https://docs.mongodb.com/manual/core/transactions/#count-operation
// https://docs.mongodb.com/manual/core/transactions/#w-1

import {ClientSession} from "mongodb";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {ITransactionOptions, ITransactionResult} from "../types";
import {updateStack} from "../utils";

export class Transaction {
    constructor(public options: ITransactionOptions) {
    }

    public async start<T extends any>(callback: (session: ClientSession) => Promise<T>): Promise<ITransactionResult<T>> {
        const session = this.options.mongoClient.startSession();
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();

        try {
            let totalRetry = -1;
            let value: any;

            const mongodbResponse = await session.withTransaction(async () => {
                totalRetry++; // this will be 0 or above according to the logic

                // if we wanted to limit the max retry
                if (this.options.maxRetry >= 0) {
                    if (totalRetry > this.options.maxRetry) {
                        throw new Error(`Transaction aborted with a retry of ${this.options.maxRetry} times.`);
                    }
                }

                value = await callback(session);
            }, this.options.transactionOptions);

            const hasCommitted = !!(mongodbResponse as any);
            return {value, hasCommitted, totalRetry};

        } catch (err) {
            // make sure it's Error
            if (err instanceof Error) {
                throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
            }

            throw err;

        } finally {
            session.endSession();
        }
    }
}
