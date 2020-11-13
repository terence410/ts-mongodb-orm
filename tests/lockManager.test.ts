import { assert, expect } from "chai";
import {Connection, Document, Field, LockManager, Repository} from "../src/";
import {generateRandomString, timeout} from "../src/utils";
// @ts-ignore
import {addConnection, assertTsMongodbOrmError} from "./share";

@Document()
class LockManagerTest {
    @Field()
    public _id: string = "";

    @Field()
    public date: Date = new Date();

    @Field()
    public increment: number = 0;
}

describe("Lock Manager Test", () => {
    const lockCollectionName = "LockTableName";
    let connection!: Connection;
    let repository!: Repository<typeof LockManagerTest>;
    let lockManager!: LockManager;

    before(async () => {
        connection = await addConnection();
        lockManager = connection.getLockManager({collectionName: lockCollectionName, expiresIn: 1000});
        await lockManager.createCollection();
        repository = connection.getRepository(LockManagerTest);
    });

    after(async () => {
        await lockManager.dropCollection();
        await repository.dropCollection();
        await connection.close();
    });

    it("basic usage", async () => {
        const lockKey = `testing1:${generateRandomString(16)}`;

        // try the lock first
        await lockManager.startLock(lockKey, () => {
            return timeout(1 * 1000);
        });
    });

    it("throw error in lock", async () => {
        const lockKey = `testing2:${generateRandomString(16)}`;

        // try the lock first
        let error!: Error;
        try {
            await lockManager.startLock(lockKey, async () => {
                throw new Error("hello world");
            });
        } catch (err) {
            error = err;
        }
        assert.equal(error.message, "hello world");
        assert.equal(error.name, "Error");
    });

    it("fail to lock an existing lock", async () => {
        const newLockManager = connection.getLockManager({
            collectionName: lockCollectionName,
            expiresIn: 3000,
        });

        const lockKey = `testing3:${generateRandomString(16)}`;
        const promise1 = newLockManager.startLock(lockKey, () => timeout(2 * 1000));
        await timeout(100); // delay a while to make sure lock is acquired

        await assertTsMongodbOrmError(async () => {
            await newLockManager.startLock(lockKey, () => timeout(100));
        }, /.*Failed to acquire the lock.*/);

        // let the previous lock to complete
        await promise1;
    }).timeout(60 * 1000);

    it("lock successfully acquire after lock expire", async () => {
        const lockKey = `testing4:${generateRandomString(16)}`;
        const promise1 = lockManager.startLock(lockKey, () => timeout(1 * 1000));
        await timeout(1100); // let the lock expires

        // we able to acquire the look now
        await lockManager.startLock(lockKey, () => timeout(100));
        await lockManager.startLock(lockKey, () => timeout(100));

        // let the previous lock to complete
        await promise1;
    }).timeout(60 * 1000);

    it("retry lock", async () => {
        const newLockManager = connection.getLockManager({
            collectionName: lockCollectionName,
            expiresIn: 1000,
            maxRetry: 10,
            retryDelay: 100,
        });
        const lockKey = `testing5:${generateRandomString(16)}`;

        // prepare document
        const _id = "testing";
        const document = await repository.create({_id});
        await repository.insert(document);

        // call back for increment
        const increment = async () => {
            const findDocument = await repository.findOne({_id});
            if (findDocument) {
                findDocument.increment++;
                await repository.update(findDocument);
                return findDocument.increment;
            }

            return 0;
        };

        // create retry
        const retryCallback = async () => {
            return await newLockManager.startLock(lockKey, () => increment());
        };

        const total = 5;
        const promisesResult = await Promise.all(Array(total).fill(0).map((x, i) => retryCallback()));

        // validate result
        assert.deepEqual(promisesResult.map(x => x.value).sort(), Array(total).fill(0).map((_, i) => i + 1));

        // validate total
        const findDocument1 = await repository.findOne({_id});
        assert.equal(findDocument1!.increment, total);
    });
});
