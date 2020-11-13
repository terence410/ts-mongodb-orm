import { assert, expect } from "chai";
import {Connection, Document, Field, Index, ObjectID} from "../src/";
import {timeout} from "../src/utils";
// @ts-ignore
import {addConnection} from "./share";

const indexSyncTestCollectionName1 = "IndexSyncTest1";
const indexSyncTestCollectionName2 = "IndexSyncTest2";

@Index({preName: -1, textName: "text", sfterName: "text", aName: 1}, {sparse: true})
@Index({name: 1, value: -1}, {})
@Index({name: -1, value: 1}, {})
@Index({newPartialName: -1}, {partialFilterExpression: { rating: { $gt: 5 } }})
@Index({["array.field"]: -1}, {})
@Index({["array.subField.$**"]: 1}, {})
@Index({extraSparseName: -1}, {sparse: true})
@Index({extraExpireName: -1}, {expireAfterSeconds: 10})
@Index({extraUniqueName: 1}, {unique: true})
@Index({uniqueName: 1}, {})
@Document()
class IndexTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public intValue: number = 0;

    @Field()
    public numberValue: number = Math.random();
}

@Index({date: 1}, {expireAfterSeconds: 1})
@Document()
class IndexExpireTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public date: Date = new Date();
}

@Index({date: 1})
@Document({collectionName: indexSyncTestCollectionName1})
class IndexSyncTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public date: Date = new Date();
}

@Index({date1: 1})
@Document()
class IndexAddTest1 {
    @Field()
    public _id!: ObjectID;

    @Field()
    public date1: Date = new Date();
}

@Index({date2: 1})
@Document()
class IndexAddTest2 {
    @Field()
    public _id!: ObjectID;

    @Field()
    public date2: Date = new Date();
}

const total = 1000;
const documents: IndexTest[] = [];

describe("Index Test", () => {
    let connection!: Connection;
    before(async () => { connection = await addConnection(); });
    after(async () =>  {
        await connection.getRepository(IndexTest).dropCollection();
        await connection.getRepository(IndexSyncTest).dropCollection();
        await connection.getRepository(IndexSyncTest, {collectionName: indexSyncTestCollectionName2}).dropCollection();
        await connection.getRepository(IndexAddTest1).dropCollection();
        await connection.getRepository(IndexExpireTest).dropCollection().catch(e => 0);
        await connection.close();
    });

    it("sync index", async () => {
        const repository = connection.getRepository(IndexTest);
        const compareResult1 = await repository.compareIndex();
        assert.equal(compareResult1.createIndexes.length, 10);
        assert.equal(compareResult1.existingIndexes.length, 1);

        await repository.syncIndex();

        // after
        const compareResult2 = await repository.compareIndex();
        assert.equal(compareResult2.createIndexes.length, 0);
        assert.equal(compareResult2.existingIndexes.length, 11);
    });

    it("sync index test", async () => {
        const repository1 = connection.getRepository(IndexSyncTest);
        const repository2 = connection.getRepository(IndexSyncTest, {collectionName: indexSyncTestCollectionName2});

        // new document 1
        await repository1.syncIndex();
        const document1 = new IndexSyncTest();
        await repository1.insert(document1);

        // new document in another collection
        await repository2.syncIndex();
        const document2 = new IndexSyncTest();
        await repository2.insert(document1);

        // index automatically created
        const compareResult1 = await repository1.compareIndex();
        assert.equal(compareResult1.existingIndexes.length, 2);

        // compare index in another collection
        const compareResult2 = await repository2.compareIndex();
        assert.equal(compareResult2.existingIndexes.length, 2);

        // drop the index (only one index, default _id index, left)
        await repository1.dropIndex();
        const compareResult1a = await repository1.compareIndex();
        assert.equal(compareResult1a.existingIndexes.length, 1);
    });

    it("add index test", async () => {
        const repository1 = connection.getRepository(IndexAddTest1);
        const repository2 = connection.getRepository(IndexAddTest2, {collectionName: IndexAddTest1.name});

        // new document 1
        await repository1.addIndex();
        const document1 = new IndexAddTest1();
        await repository1.insert(document1);

        // index automatically created
        const compareResult1 = await repository1.compareIndex();
        assert.equal(compareResult1.existingIndexes.length, 2);

        // we add index via another repository
        await repository2.addIndex();
        const compareResult2 = await repository1.compareIndex();
        assert.equal(compareResult2.existingIndexes.length, 3);
    });

    // the mongodb probably will do clean up every 60 seconds
    it.skip("check index expired", async () => {
        const repository1 = connection.getRepository(IndexExpireTest);
        await repository1.syncIndex();

        const document1 = repository1.create({date: new Date()});
        await repository1.insert(document1);

        const foundDocument1 = await repository1.findOne(document1._id);
        assert.isDefined(foundDocument1);

        const indexes = await repository1.compareIndex();
        console.log(indexes);

        console.log("wait for document to be expired");
        // expired (need to wait for a longer while)
        await timeout(60 * 1000);

        const foundDocument2 = await repository1.findOne(document1._id);
        assert.isUndefined(foundDocument2);
    }).timeout(65 * 1000);

    it("Check sync index works on different options", async () => {
        // TODO:
        // change ordering
        // change to text
        // change options (sparse, expireAfterSeconds, partialFilter)
    });

    it("Add unique index afterward", async () => {
        // TODO: unique index
    });
});
