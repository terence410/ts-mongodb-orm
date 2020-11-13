import { assert, expect } from "chai";
import { Connection, Document, Field, ObjectID, Repository} from "../src";
// @ts-ignore
import {addConnection, assertMongoError} from "./share";

@Document()
class CappedTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public index: number = 0;

    @Field()
    public data: Buffer = Buffer.alloc(0);
}

describe("Capped Test", () => {
    let connection!: Connection;
    let repository!: Repository<typeof CappedTest>;

    before(async () => {
        connection = await addConnection();
        repository = connection.getRepository(CappedTest);
    });

    after(async () => {
        await repository.dropCollection();
        await connection.close();
    });

    it("new collection with max", async () => {
        // new capped collection
        const cappedMax = 8;
        const crappedBySize = 1024;
        const collection = await connection.getRepository(CappedTest).createCollection({capped: true, size: crappedBySize, max: cappedMax});
        assert.isTrue(await collection.isCapped());

        const total = 100;
        for (let i = 0; i < total; i++) {
            const document = new CappedTest();
            document.index = i;
            await repository.insert(document);
        }

        // check total
        const count1 = await repository.query().count();
        assert.equal(count1, cappedMax);

        // check default order
        const documents1 = await repository.query().findMany();
        assert.deepEqual(documents1.map(x => x.index), [92, 93, 94, 95, 96, 97, 98, 99]);

        // check sorting
        const documents2 = await repository.query()
            .filter("index", x => x.gte(95))
            .sort("$natural", -1)
            .findMany();
        assert.deepEqual(documents2.map(x => x.index), [99, 98, 97, 96, 95]);

        // insert one big document
        const document1 = new CappedTest();
        document1.data = Buffer.alloc(900);
        await repository.insert(document1);

        // this wil reduce the capped collection since the size is huge
        const count2 = await repository.query().count();
        assert.equal(count2, 2);

        // this will further reduce the capped collection
        const document2 = new CappedTest();
        document2.data = Buffer.alloc(977); // 977 is the max size of the data
        await repository.insert(document2);

        const count3 = await repository.query().count();
        assert.equal(count3, 1);
    });

    it("try to delete a document", async () => {
        await assertMongoError(async () => {
            await repository.query().getDeleter().deleteOne();
        }, /cannot remove from a capped collection/);
    });
});
