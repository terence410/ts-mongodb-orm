import { assert, expect } from "chai";
import {Binary, Connection, Document, Field, Index, ObjectID, Repository} from "../src/";
import {AfterLoad} from "../src/decorators/hooks/AfterLoad";
// @ts-ignore
import {addConnection, assertMongoError} from "./share";

@Index({name: 1, value: -1})
@Document()
class GeneralTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public stringValue: string | undefined = "hello world";

    @Field()
    public numberValue: number = Math.random();

    @Field()
    public dateValue: Date = new Date();

    @Field()
    public booleanValue: boolean = false;

    @Field()
    public bufferValue: Binary = new Binary(Buffer.alloc(0));

    @Field()
    public arrayValue: number[] = [1, 2, 3];

    @Field()
    public objectArrayValue: Array<{value: number}> = [{value: 1}, {value: 2}, {value: 3}];

    @Field()
    public objectValue: {name?: string, age?: number, isHappy?: boolean, buffer?: Binary} = {};

    @Field()
    public nullableValue: null | number = null;

    @Field()
    public undefinedValue: undefined | number = undefined;

}

describe("General Test", () => {
    let connection1!: Connection;
    let connection2!: Connection;
    let repository1!: Repository<typeof GeneralTest>;
    let repository2!: Repository<typeof GeneralTest>;

    before(async () => {
        // create connection and create collection
        connection1 = await addConnection({dbName: process.env.MONGODB_DB_1});
        connection2 = await addConnection({dbName: process.env.MONGODB_DB_2});
        repository1 = connection1.getRepository(GeneralTest);
        repository2 = connection2.getRepository(GeneralTest);

        await repository1.createCollection();
        await repository2.createCollection();
    });

    after(async () => {
        await repository1.dropCollection();
        await repository2.dropCollection();
        await connection1.close();
        await connection2.close();
    });

    it("quick test", async () => {
        const document = repository1.create({
            objectValue: {name: "testing", buffer: new Binary(Buffer.alloc(10))},
        });
        await repository1.insert(document);
        assert.isDefined(document._id);

        const findDocument = await repository1.findOne(document._id);
        assert.isDefined(findDocument);
        assert.deepEqual(document, findDocument);
    });

    it("new document", async () => {
        const document = repository1.create();
        await repository1.insert(document);
        await repository1.update(document);

        // update single value
        document.stringValue = "testing";
        await repository1.update(document);

        const findDocument = await repository1.findOne(document._id);
        assert.isDefined(findDocument);

        // all values are same
        assert.deepEqual(document, findDocument!);
        
        // delete it
        const deletedDocument1 = await repository1.delete(document._id);
        assert.deepEqual(document._id, deletedDocument1);

        // delete again (nothing return, but no error)
        const deletedDocument2 = await repository1.query({query: {_id: document._id}}).getDeleter().findOneAndDelete();
        assert.isUndefined(deletedDocument2);
    });

    it("insert/update/delete array of documents", async () => {
        const total = 10;
        const documents: GeneralTest[] = [];

        for (let i = 0; i < total; i++) {
            const document = repository1.create({numberValue: i});
            documents.push(document);
        }

        // validate it has id created
        const results = await repository1.insertMany(documents);
        for (let i = 0; i < total; i++) {
            assert.isDefined(results[i]._id);
            const findDocument = await repository1.findOne(results[i]._id);
            assert.equal(findDocument!.numberValue, i);
        }
    });

    it("insert array of documents with error", async () => {
        const newDocument = repository1.create();
        await repository1.insert(newDocument);

        const total = 10;
        const existIndex = 6;
        const documents: GeneralTest[] = [];

        const random = Math.random();
        for (let i = 0; i < total; i++) {
            const document = repository1.create({numberValue: random});
            documents.push(document);
        }

        // assign an existing id
        documents[existIndex]._id = newDocument._id;

        // validate it has id created
        await assertMongoError(async () => {
            const results = await repository1.insertMany(documents);
        }, /duplicate key error/);

        // find how many documents inserted
        const findDocuments = await repository1.query().filter("numberValue", random).findMany();
        assert.equal(findDocuments.length, existIndex);
    });

    it("update document with null/undefined", async () => {
        const document = new GeneralTest();
        document.nullableValue = 111;
        document.undefinedValue = 222;
        await repository1.insert(document);

        document.nullableValue = null;
        document.undefinedValue = undefined;
        await repository1.update(document);

        const foundDocument = await repository1.findOne(document._id);
        assert.isDefined(foundDocument);
        assert.deepEqual(document, foundDocument!);
    });

    it("update document with atomic features", async () => {
        const document = repository1.create({
            stringValue: "abc",
            numberValue: 50,
            arrayValue: [1, 2, 3],
        });
        await repository1.insert(document);

        const query = repository1.query({query: {_id: document._id}});
        const findDocument1 = await query.getUpdater()
            .set("stringValue", "xyz")
            .inc("numberValue", 50)
            .sort("arrayValue", -1)
            .slice("arrayValue", 4)
            .push("arrayValue", 10, 11, 12) // this will be override by below
            .pushAt("arrayValue", 0, 4, 5, 6)
            .findOneAndUpdate();

        // both document are the same ref
        assert.isDefined(findDocument1);
        assert.deepEqual(findDocument1!._id, document._id);
        assert.equal(findDocument1!!.stringValue, "xyz");
        assert.equal(findDocument1!.numberValue, 100);
        assert.deepEqual(findDocument1!.arrayValue, [6, 5, 4, 3]);

        // more operation
        const findDocument2 = await query.getUpdater()
            .pop("arrayValue", -1)
            .findOneAndUpdate();
        assert.deepEqual(findDocument2!.arrayValue, [5, 4, 3]);

        // pull
        const findDocument3 = await query.getUpdater()
            .pullAll("arrayValue", 5)
            .findOneAndUpdate();
        assert.deepEqual(findDocument3!.arrayValue, [4, 3]);

        // add to set
        const findDocument4 = await query.getUpdater()
            .addToSet("arrayValue", 6, 5, 4)
            .findOneAndUpdate();
        assert.deepEqual(findDocument4!.arrayValue, [4, 3, 6, 5]);

        // set
        const findDocument5 = await query.getUpdater({weakType: true})
            .set("dummy", "dummy")
            .findOneAndUpdate();
        assert.deepEqual((findDocument5 as any).dummy, "dummy");

        // unset
        const findDocument6 = await query.getUpdater({weakType: true})
            .rename("dummy", "newDummy")
            .findOneAndUpdate();
        assert.deepEqual((findDocument6 as any).newDummy, "dummy");

        // unset
        const findDocument7 = await query.getUpdater({weakType: true})
            .unset("newDummy")
            .findOneAndUpdate();
        assert.deepEqual((findDocument7 as any).newDummy, undefined);

        const findDocument8 = await query.getUpdater()
            .currentDate("dateValue")
            .findOneAndUpdate();
        assert.isTrue((findDocument8!.dateValue instanceof Date));

        const findDocument9 = await query.getUpdater()
            .min("numberValue", -100)
            .findOneAndUpdate();
        assert.equal(findDocument9!.numberValue, -100);

        const findDocument10 = await query.getUpdater()
            .max("numberValue", 100)
            .findOneAndUpdate();
        assert.equal(findDocument10!.numberValue, 100);

        const findDocument11 = await query.getUpdater()
            .mul("numberValue", 1.5)
            .findOneAndUpdate();
        assert.equal(findDocument11!.numberValue, 150);
    });

    it("insert on new", async () => {
        const _id = ObjectID.createFromTime(new Date().getTime());
        const query = repository1.query({query: {_id}});
        const document1 = await query
            .getUpdater()
            .setOnInsert("stringValue", "upsert")
            .findOneAndUpdate({upsert: true});
        assert.equal(document1!.stringValue, "upsert");

        const document2 = await query
            .getUpdater()
            .setOnInsert("stringValue", "upsert 2")
            .findOneAndUpdate({upsert: true});
        assert.equal(document2!.stringValue, "upsert"); // value not updated
    });

    it("atomic won't have any conflict", async () => {
        const _id = ObjectID.createFromTime(new Date().getTime());
        const total = 50;
        const batch = 10;

        for (let j = 0; j < batch; j++) {
            const promises: Array<Promise<any>> = [];
            for (let i = 0; i < total; i++) {
                const promise = repository1.query()
                    .filter("_id", _id)
                    .getUpdater()
                    .inc("numberValue", 1)
                    .updateOne({upsert: true});
                promises.push(promise);
            }
            await Promise.all(promises);
        }

        const findDocument = await repository1.findOne(_id);
        assert.equal(findDocument!.numberValue, total * batch);
    });

    it("update document with atomic features (v2)", async () => {
        const document = repository1.create({
            stringValue: "abc",
            numberValue: 50,
            arrayValue: [1, 2, 3],
        });
        await repository1.insert(document);

        const updatedDocument = await repository1
            .query({query: {_id: document._id}})
            .getUpdater({query: {$inc: {numberValue: 50}}})
            .findOneAndUpdate();
        assert.equal(updatedDocument!.numberValue, 100);
    });

    it("new, query with getUpdater", async () => {
        const document1 = new GeneralTest();
        await repository1.insert(document1);

        const document2 = await repository1.query({query: document1._id}).findOne();
        assert.isDefined(document2);

        const document3 = await repository1.query({query: {_id: document1._id}})
            .getUpdater()
            .set("stringValue", "hello")
            .findOneAndUpdate();

        assert.isDefined(document3);
        assert.equal(document3!.stringValue, "hello");
        if (document3) {
            await repository1.update(document3);
        }
    });

    it("new, query and delete", async () => {
        const document1 = new GeneralTest();
        await repository1.insert(document1);

        const documents = await repository1.query().findMany();
        assert.isAtLeast(documents.length, 1);

        for (const document of documents) {
            await repository1.delete(document);
        }
    });

    it("new, delete and upsert", async () => {
        const document = new GeneralTest();
        await repository1.insert(document);
        await repository1.delete(document);

        // not found
        const findDocument1 = await repository1.findOne(document._id);
        assert.isUndefined(findDocument1);

        // save
        await repository1.update(document, {upsert: true});

        // found
        const findDocument2 = await repository1.findOne(document._id);
        assert.isDefined(findDocument2);
    });

    it("new, query and delete (in another db / setCollectionName)", async () => {
        const document1 = new GeneralTest();
        await repository2.insert(document1);

        const documents = await repository2.query().findMany();
        assert.isAtLeast(documents.length, 1);

        // delete all documents
        for (const document of documents) {
            await repository2.delete(document);
        }
    });

    it.only("new many and query by cursor", async () => {
        const total = 300;
        const limit = 100;
        for (let i = 0; i < total; i++) {
            await repository1.insert(new GeneralTest());
        }

        // get iterator
        const iterator = repository1.query()
            .limit(limit)
            .getAsyncIterator();

        // get all documents
        const documents: GeneralTest[] = [];
        for await (const document of iterator) {
            documents.push(document);
        }

        assert.isAtLeast(documents.length, limit);
    });

    it("delete all documents", async () => {
        const deletedTotal = await repository1.query().getDeleter().deleteMany();
        assert.isAtLeast(deletedTotal, 1);
    });

    it("options: ordered", async () => {
        const [document1] = await repository1.insertMany([repository1.create()]);
        const document2 = await repository1.insert(repository1.create());
        const document2a = repository1.create({_id: document1._id});
        const document2b = repository1.create({_id: ObjectID.createFromTime(new Date().getTime())});
        const document2c = repository1.create({_id: document2._id});
        const document2d = repository1.create();

        const error1 = await assertMongoError(() => {
            return repository1.insertMany([document2a, document2b, document2c, document2d]);
        }, /duplicate key error/);
        // only got 1 write error
        assert.equal((error1 as any).writeErrors.length, 1);

        // document not created
        const findDocument2b = await repository1.findOne(document2b._id);
        assert.isUndefined(findDocument2b);

        // id exist but document not created
        assert.isDefined(document2d._id);
        const findDocument2d = await repository1.findOne(document2d._id);
        assert.isUndefined(findDocument2d);

        const error2 = await assertMongoError(() => {
            return repository1.insertMany([document2a, document2b, document2c, document2d], {ordered: false});
        }, /duplicate key error/);
        // we got 2 write error
        assert.equal((error2 as any).writeErrors.length, 2);

        // document created
        const findDocument2bAgain = await repository1.findOne(document2b._id);
        assert.isDefined(findDocument2bAgain);

        // document created
        const findDocument2dAgain = await repository1.findOne(document2d._id);
        assert.isDefined(findDocument2dAgain);
    });
});
