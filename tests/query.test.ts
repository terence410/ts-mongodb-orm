import {assert} from "chai";
import {Connection, Document, Field, Index, mongodbDataTypes, ObjectId, Repository} from "../src/";
// @ts-ignore
import {addConnection} from "./share";

@Index({stringValue: "text"})
@Document()
class QueryTest {
    @Field()
    public _id!: ObjectId;

    @Field()
    public sequence: number = 0;

    @Field()
    public modSequence: number = 0;

    @Field()
    public intValue: number = 0;

    @Field()
    public stringValue: string = "";

    @Field()
    public booleanValue: boolean = false;

    @Field()
    public dateValue: Date = new Date();

    @Field()
    public numberValue: number = Math.random();
}

describe("Query Test", () => {
    const total = 100;
    const documents: QueryTest[] = [];
    let connection!: Connection;
    let repository!: Repository<typeof QueryTest>;

    before(async () => {
        connection = await addConnection();
        repository = connection.getRepository(QueryTest);
        await repository.syncIndex();

        const promises = [];
        for (let i = 0; i < total; i++) {
            const document = new QueryTest();
            document.sequence = i;
            document.intValue = Math.random() * 10 | 0;
            document.numberValue = Math.random() * 1000;
            document.stringValue = `abcXYZ:${i}`;
            documents.push(document);
            promises.push(repository.insert(document));
        }
        await Promise.all(promises);
    });

    after(async () => {
        await repository.dropCollection();
        await connection.close();
    });

    it("simple count", async () => {
        // simple count
        const query = repository.query();
        const total1 = await query.count();
        assert.equal(total, total1);

        assert.deepEqual(query.nativeQuery, {});
    });

    it("count", async () => {
        const targetValue = 0;

        // we can create the Query object directly
        const query = repository.query();
        query.filter("intValue", targetValue);
        const total1 = await query.count();

        const total2 = documents.filter(x => x.intValue === targetValue).length;
        assert.equal(total1, total2);
    });

    it("simple query with offset and sort (using weakType)", async () => {
        const targetValue = 0;

        const skip = 5;
        const limit = 10;
        const fieldName = "se" + "quence";
        const query = repository.query({weakType: true})
            .sort(fieldName, 1)
            .skip(skip)
            .limit(limit);

        const queryDocuments = await query.findMany();
        assert.equal(queryDocuments.length, limit);
        for (let i = 0; i < queryDocuments.length; i++) {
            assert.equal(queryDocuments[i].sequence, skip + i);
        }

        const queryDocument = await query.findOne();
        assert.isDefined(queryDocument);
        assert.equal(queryDocument!.sequence, skip);
    });

    it("regex", async () => {
        // simple count
        const total1 = await repository
            .query()
            .filter("stringValue", x => x.regex("abcxyz", "i"))
            .count();
        assert.equal(total1, total);

        const total2 = await repository
            .query()
            .filter("stringValue", x => x.regex("abcxyz"))
            .count();
        assert.equal(total2, 0);
    });

    it("complex query and count", async () => {
        const targetValue1 = 100;
        const targetValue2 = 500;

        const query = repository.query()
            .or(x => x
                .filter("intValue", 1)
                .filter("numberValue", y => y.exists()))
            .or("intValue", x => x.eq(2))
            .filter("numberValue", x => x.gt(targetValue1).lte(targetValue2))
            .and(x => x.filter("numberValue", y => y.exists()));

        const total1 = await query.count();
        const total2 = documents.filter(x =>
            ((x.intValue === 1 && "numberValue" in x) || x.intValue === 2) &&
            (x.numberValue > targetValue1 && x.numberValue <= targetValue2) &&
            ("numberValue" in x)
        ).length;
        assert.equal(total1, total2);
    });

    it("query and updater", async () => {
        const query1 = repository
            .query()
            .filter("intValue", 1);

        // get the first batch of results
        const documents1 = await query1.findMany();
        const sum1 = documents1.reduce((a, b) => a + b.numberValue, 0);

        // find one and update with weak type
        const updater1 = query1.getUpdater({weakType: false});
        const foundDocument = await updater1
            .set("booleanValue", true)
            .findOneAndUpdate();
        assert.isDefined(foundDocument);

        const updater2 = query1.getUpdater();
        const totalUpdated2 = await updater2
            .inc("numberValue", 2)
            .updateOne();
        assert.equal(totalUpdated2, 1);

        // update many
        const updater3 = query1.getUpdater();
        const totalUpdated3 = await updater3
            .inc("numberValue", 2)
            .updateMany();
        assert.isAtLeast(totalUpdated3, 1);
        assert.equal(totalUpdated3, documents1.length);

        // compare the result again
        const documents2 = await query1.findMany();
        const sum2 = documents2.reduce((a, b) => a + b.numberValue, 0);
        assert.approximately(sum1, sum2 - (totalUpdated2 + totalUpdated3) * 2, 0.00001);
    });

    it("query and updater with upsert", async () => {
        const updater = repository
            .query()
            .filter("intValue", Math.random() * 10000000 | 0)
            .getUpdater();
        const totalUpdated = await updater
            .inc("numberValue", 2)
            .updateMany({upsert: true});
        assert.equal(totalUpdated, 1);
    });

    it("complex query", async () => {
        const query1 = repository
            .query({weakType: true})
            .filter("field1", x => x.elemMatchObject(y => y.filter("hello", 1)))
            .filter("field2", x => x.elemMatch(y => y.gt(5)))
            .filter("field3", x => x.gt(5).lt(3).lte(4).gte(6))
            .filter("field4", x => x.in([1, 2, 3]))
            .filter("field5", x => x.nin([1, 2, 3]))
            .filter("field6", x => x.size(3))
            .filter("field7", x => x.mod(10, 1))
            .filter("field8", x => x.not(y => y.gt(5)))
            .filter("field9", x => x.regex("/abcd/"))
            // .text("helloworld")
            .or(x => {
                x.filter("fieldA.a", 5)
                    .or("fieldA.b", y => y.exists(false))
                    .or("fieldA.c", y => y.type(mongodbDataTypes.array));
            })
            .and(x => {
                x.filter("fieldB.a", y => y.bitsAllClear(1))
                .filter("fieldB.b", y => y.bitsAllSet([1, 2]))
                .filter("fieldB.c", y => y.bitsAnyClear(1))
                .filter("fieldB.d", y => y.bitsAnySet([1, 2]));
            })
            .nor(x => {
                x.filter("fieldC.a", 7);
            });

        const documents1 = await query1.findMany();
    });

    it("pass filter query directly", async () => {
        const targetValue = 0;
        const query = repository.query({query: {intValue: targetValue}});
        const total1 = await query.count();

        const total2 = documents.filter(x => x.intValue === targetValue).length;
        assert.equal(total1, total2);
    });

    it("pass update query directly", async () => {
        const targetValue = 0;
        const documents1 = await repository.query({query: {intValue: targetValue}}).findMany();
        const sum1 = documents1.reduce((a, b) => a + b.numberValue, 0);

        const query1 = repository.query({query: {intValue: targetValue}});
        const totalUpdated = await query1.getUpdater({query: {$inc: {numberValue: 2}}}).updateMany();

        // compare the result again
        const documents2 = await query1.findMany();
        const sum2 = documents2.reduce((a, b) => a + b.numberValue, 0);
        assert.approximately(sum1, sum2 - totalUpdated * 2, 0.00001);
    });

    it("text query", async () => {
        const document = new QueryTest();
        document.stringValue = "coffee shop apple";
        await repository.insert(document);

        const document1 = await repository.query().text("coffee apple").findOne();
        assert.isDefined(document1);

        const document2 = await repository.query().text("coff").findOne();
        assert.isUndefined(document2);

        const document3 = await repository.query().text("\"coffee shop\"").findOne();
        assert.isDefined(document3);

        const document4 = await repository.query().text("\"coffee apple\"").findOne();
        assert.isUndefined(document4);
    });

    // explain will actually run the query and give you more details
    it("explain", async () => {
        const targetValue1 = 100;
        const targetValue2 = 500;
        const query = repository.query()
            .filter("numberValue", x => x.gt(targetValue1).lte(targetValue2));
        const explain = await query.explain();
        assert.containsAllKeys(explain, ["queryPlanner", "executionStats"]);
    });
});
