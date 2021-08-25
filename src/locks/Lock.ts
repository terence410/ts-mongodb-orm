import {TsMongodbOrmError} from "../errors/TsMongodbOrmError";
import {Query} from "../queries/Query";
import {Repository} from "../Repository";
import {Transaction} from "../transactions/Transaction";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {ILockOptions, ILockResult} from "../types";
import {generateRandomString, timeout, updateStack} from "../utils";
import {LockDocument} from "./LockDocument";

export class Lock {
    public readonly _id: string;
    public readonly randomId: string;

    constructor(public options: ILockOptions) {
        this.randomId = generateRandomString(16);
        this._id = options.lockKey;
    }

    public async start<T extends any>(callback: () => Promise<T>): Promise<ILockResult<T>> {
        // friendlyErrorStack
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();

        try {
            const acquireResult = await this.acquire();
            const result = await callback();
            return {value: result, totalRetry: acquireResult.totalRetry};

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});

        } finally {
            // release the acquire
            await this.release();
        }
    }

    /** @internal */
    public async acquire() {
        let totalRetry = 0;
        let canLock = false;

        const lockRepository = new Repository({
            mongoClient: this.options.mongoClient,
            classObject: LockDocument,
            dbName: this.options.dbName,
            collectionName: this.options.collectionName,
        });

        // create a standard transaction
        const transaction = new Transaction({mongoClient: this.options.mongoClient, transactionOptions: {}, maxRetry: -1});

        do {
            try {
                canLock = false;
                const result = await transaction.start(async session => {
                    let lock = await lockRepository.findOne({_id: this._id}, {session});
                    const now = new Date();
                    if (!lock) {
                        lock = lockRepository.create();
                        lock._id = this._id;
                        lock.lockKey = this.options.lockKey;
                        lock.randomId = this.randomId;
                        lock.expiredAt.setTime(now.getTime() + this.options.expiresIn);
                        await lockRepository.insert(lock, {session});
                        return;

                    } else if (now > lock.expiredAt) {
                        // update it
                        lock.randomId = this.randomId;
                        lock.expiredAt.setTime(now.getTime() + this.options.expiresIn);
                        await lockRepository.update(lock, {session});
                        return;
                    }

                    await session.abortTransaction();
                });

                // we successfully acquired the acquire
                if (result.hasCommitted) {
                    canLock = true;
                    break;
                }
            } catch (err) {
                throw err;
            }

            // do retry
            if (!canLock) {
                // if we have retry delay
                if (this.options.retryDelay) {
                    await timeout(this.options.retryDelay);
                }
            }
        } while (totalRetry++ < this.options.maxRetry);

        if (!canLock) {
            throw new TsMongodbOrmError(`(MongodbLock) Failed to acquire the lock. lockKey: "${this.options.lockKey}".`);
        }

        return {totalRetry};
    }

    /** @internal */
    public async release(): Promise<void> {
        await new Query({
            mongoClient: this.options.mongoClient,
            classObject: LockDocument,
            dbName: this.options.dbName,
            collectionName: this.options.collectionName,
        }, {filter: {_id: this._id, randomId: this.randomId}})
            .getDeleter()
            .deleteOne();
    }
}
