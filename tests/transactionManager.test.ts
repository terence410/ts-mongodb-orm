import { assert, expect } from "chai";
import {Connection, Document, Field, Index, ObjectId, Repository} from "../src/";
// @ts-ignore
import {addConnection} from "./share";

@Index({numberValue: -1})
@Document()
class TransactionManagerTest {
    @Field()
    public _id!: ObjectId;

    @Field()
    public stringValue: string = "hello world";

    @Field()
    public numberValue: number = Math.random();
}

describe("Transaction Manager Test", () => {
    const anotherCollectionName = "TransactionManagerTestAnother";

    let connection1!: Connection;
    let connection2!: Connection;
    let repository1!: Repository<typeof TransactionManagerTest>;
    let repository2!: Repository<typeof TransactionManagerTest>;

    before(async () => {
        connection1 = await addConnection();
        connection2 = await addConnection({dbName: process.env.MONGODB_DB_1});
        repository1 = connection1.getRepository(TransactionManagerTest);
        repository2 = connection2.getRepository(TransactionManagerTest, {collectionName: anotherCollectionName});

        await repository1.createCollection();
        await repository2.createCollection();
    });

    after(async () =>  {
        await repository1.dropCollection();
        await repository2.dropCollection();
        await connection1.close();
        await connection2.close();
    });

    it("basic usage", async () => {
        const transactionManager = connection1.getTransactionManager();
        const result = await transactionManager.startTransaction(async (session) => {
            const document = new TransactionManagerTest();
            await repository1.insert(document, {session});
            return 10;
        });
        assert.equal(result.value, 10);
        assert.isTrue(result.hasCommitted);
    });

    it("abort transaction", async () => {
        const transactionManager = connection1.getTransactionManager();
        const result = await transactionManager.startTransaction(async (session) => {
            await session.abortTransaction();
            return 10;
        });
        assert.equal(result.value, 10);
        assert.isFalse(result.hasCommitted);
    });

    it("rollback on error", async () => {
        let _id!: ObjectId;
        let hasDocumentInTransaction = false;
        let hasDocumentInNonTransaction = false;
        let totalInTransaction = 0;
        const throwError = new Error("Custom trigger error");
        let catchThrowError: any;
        const originalTotal = await repository1.query().count();

        const transactionManager = connection1.getTransactionManager();
        try {
            await transactionManager.startTransaction(async (session) => {
                const document1 = new TransactionManagerTest();
                await repository1.insert(document1, {session});
                _id = document1._id;

                // we get it again
                const document2 = await repository1.findOne(_id, {session});
                const document3 = await repository1.findOne(_id);

                // update the flag
                hasDocumentInTransaction = !!(document2);
                hasDocumentInNonTransaction = !!(document3);

                // use aggregate to get total
                const aggregateResult = await repository1.aggregate({session}).count("total").findOne();
                totalInTransaction = aggregateResult?.total;

                // throw error to cause roll back
                throw throwError;
            });
        } catch (err) {
            catchThrowError = err;
        }

        // check if we can new document during transaction
        assert.isTrue(throwError === catchThrowError);
        assert.isTrue(hasDocumentInTransaction);
        assert.isFalse(hasDocumentInNonTransaction);

        // document not exists
        const foundDocument2 = await repository1.findOne(_id);
        assert.isUndefined(foundDocument2);

        // assert.equal(totalInTransaction, 1);
        const total = await repository1.query().count();
        assert.equal(total, originalTotal);
    });

    it("abort transaction", async () => {
        let _id1!: ObjectId;
        let _id2!: ObjectId;

        const transactionManager = connection1.getTransactionManager();
        const transactionResult = await transactionManager.startTransaction(async (session) => {
            // save one
            const document1 = new TransactionManagerTest();
            await repository1.insert(document1, {session});
            _id1 = document1._id;

            await session.abortTransaction();

            // try to save another one (this will be successful)
            const document2 = new TransactionManagerTest();
            await repository1.insert(document2);
            _id2 = document2._id;

            return [1, 2, 3];
        });

        assert.isFalse(transactionResult.hasCommitted);

        // with strong type from the callback
        assert.equal(transactionResult.value.length, 3);

        // document1 is rollback
        assert.isUndefined(await repository1.findOne(_id1));

        // document2 is ok
        assert.isDefined(await repository1.findOne(_id2));
    });

    it("use different repository with different dbName", async () => {
        let _id1!: ObjectId;
        let _id2!: ObjectId;

        const transactionManager = connection1.getTransactionManager();
        await transactionManager.startTransaction(async (session) => {
            const document1 = new TransactionManagerTest();
            await repository1.insert(document1, {session});
            _id1 = document1._id;

            const document2 = new TransactionManagerTest();
            await repository2.insert(document2, {session});
            _id2 = document2._id;
        });

        assert.isDefined(await repository1.findOne(_id1));
        assert.isUndefined(await repository1.findOne(_id2));
        assert.isDefined(await repository2.findOne(_id2));
    });

    it("check atomic", async () => {
        const transactionManager = connection1.getTransactionManager();
        const document = repository1.create({numberValue: 0});
        await repository1.insert(document);
        const total = 10;

        const retryCallback = async () => {
            await transactionManager
                .startTransaction(async (session) => {
                    const document1 = await repository1.findOne(document._id, {session});
                    document1!.numberValue++;
                    await repository1.update(document1!, {session});
                });
        };

        await Promise.all(Array(total).fill(0).map((x, i) => retryCallback()));

        const findDocument = await repository1.findOne(document._id);
        assert.equal(findDocument!.numberValue, total);
    }).timeout(600 * 1000);

    it("query with transaction", async () => {
        const transactionManager = connection1.getTransactionManager();

        const documents: TransactionManagerTest[] = [];
        const numberValue = Math.random();
        await transactionManager.startTransaction(async (session) => {
            const document1 = new TransactionManagerTest();
            document1.numberValue = numberValue;
            await repository1.insert(document1);

            // use iterator
            const iterator = repository1
                .query({query: {numberValue}, session})
                .getAsyncIterator();
            for await (const document of iterator) {
                documents.push(document);
                await repository1.delete(document, {session});
            }
        });

        const foundDocument = await repository1.query({query: {numberValue}}).findOne();
        assert.isUndefined(foundDocument);

        assert.equal(documents.length, 1);
        assert.equal(documents[0].numberValue, numberValue);
    });

    it("check max retry", async () => {
        const transactionManager = connection1.getTransactionManager({maxRetry: 5});
        const document = await repository1.create({numberValue: 0});
        await repository1.insert(document);

        const retryCallback = async (): Promise<number> => {
            const result = await transactionManager
                .startTransaction(async (session) => {
                    const document1 = await repository1.findOne(document._id, {session});
                    document1!.numberValue++;
                    await repository1.update(document1!, {session});
                });

            return result.totalRetry;
        };

        // retry working
        const total1 = 5;
        const promisesResult = await Promise.all(Array(total1).fill(0).map((x, i) => retryCallback()));
        // validate the total retry
        assert.deepEqual(promisesResult.sort(), Array(total1).fill(0).map((_, i) => i));
        const foundDocument1 = await repository1.findOne(document._id);
        assert.equal(foundDocument1!.numberValue, total1);

        // try again that some item will have max retry error
        const total2 = 10;
        let error!: Error;
        try {
            await Promise.all(Array(total2).fill(0).map((x, i) => retryCallback()));
        } catch (err) {
            error = err;
        }
        assert.isDefined(error);
        assert.match(error.message, /Transaction aborted with a retry of .* times/);
        const foundDocument2 = await repository1.findOne(document._id);
        assert.isTrue(foundDocument2!.numberValue > total1 && foundDocument2!.numberValue < total1 + total2);
    }).timeout(600 * 1000);

    it("transaction with iterator", async () => {
        const transactionManager = connection1.getTransactionManager();

        const total = 15;
        let foundTotal = 0;
        const randomValue = Math.random();

        await transactionManager.startTransaction(async (session) => {
            for (let i = 0; i < total; i++) {
                const document1 = await repository1.create({numberValue: randomValue});
                await repository1.insert(document1, {session});
            }

            const iterator = repository1
                .query({session, query: {numberValue: randomValue}})
                .getAsyncIterator();
            const items: TransactionManagerTest[] = [];
            for await (const item of iterator) {
                items.push(item);
            }

            foundTotal = items.length;
            await session.abortTransaction();
        });

        // validate result
        assert.equal(total, foundTotal);

        // this should be 0 after abort transaction
        const count = await repository1
            .query({query: {numberValue: randomValue}})
            .count();
        assert.equal(count, 0);
    });
});
