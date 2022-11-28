import { assert, expect } from "chai";
import { Connection, Document, Field, ObjectId, Repository} from "../src";
// @ts-ignore
import {addConnection, assertMongoError} from "./share";

@Document()
class AggregateTest {
    @Field()
    public _id!: ObjectId;

    @Field()
    public index: number = 0;

    @Field()
    public mod: number = 0;

    @Field()
    public sequenceArray: number[] = [];

    @Field()
    public numberValue: number = Math.random();

    @Field()
    public secondValue: number = Math.random();

    @Field()
    public stringValue: string | undefined = "hello world";

    @Field()
    public items: Array<{value: number}> = [];

    @Field()
    public values: number[] = [];

    @Field()
    public name: string = "";

    @Field()
    public reportTo?: string = "";
}

describe("Aggregate Test", () => {
    const names = ["John", "Raymond", "Mary", "Tom", "Alex"];
    const anotherCollectionName = "aggregateAnother";
    const total = 30;
    const mod = 5;
    const numberValue = Math.random();

    let connection!: Connection;
    let repository1!: Repository<typeof AggregateTest>;
    let repository2!: Repository<typeof AggregateTest>;

    before(async () => {
        connection = await addConnection();
        repository1 = connection.getRepository(AggregateTest);
        repository2 = connection.getRepository(AggregateTest, {collectionName: anotherCollectionName});

        for (let i = 0; i < total; i++) {
            const document1 = await repository1
                .create({
                    index: i,
                    mod: i % mod,
                    sequenceArray: Array(i).fill(0).map((x, v) => v),
                    numberValue,
                    items: [{value: i}, {value: i * 100}],
                    values: [i, i * 100],
                    name: names[Math.random() * names.length | 0],
                    reportTo: names[i],
                });
            await repository1.insert(document1);

            // insert into one more collection
            const document2 = await repository2
                .create({
                    numberValue,
                    name: names[Math.random() * names.length | 0],
                    reportTo: names[i],
                });
            await repository2.insert(document2);
        }
    });

    after(async () => {
        await repository1.dropCollection();
        await repository2.dropCollection();
        await connection.close();
    });

    it("simple aggregate", async () => {
        const result1 = await repository1.aggregate()
            .match(x => x.filter("index", 0))
            .project({_id: 1})
            .findOne();
        assert.isDefined(result1);
        assert.isUndefined(result1!.index);

        const result2 = await repository1.aggregate()
            .match(x => x.filter("index", 0))
            .project({_id: 1})
            .toDocument()
            .findOne();
        assert.isDefined(result2);
        assert.isDefined(result2!.index);
    });

    it("aggregate with weakType", async () => {
        const result = await repository1.aggregate({weakType: true})
            .match(x => x.filter("anyFieldName", 1))
            .findOne();
    });

    it("async iterator", async () => {
        const iterator = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .project({_id: 1})
            .toDocument()
            .getAsyncIterator();

        const results: any[] = [];
        for await (const item of iterator) {
            results.push(item);
            assert.isObject(item._id);
            assert.isDefined(item.index);
        }
        assert.equal(results.length, total);
        assert.containsAllKeys(results[0], ["_id", "index", "mod", "name"]);
    });

    it("error", async () => {
        await assertMongoError(async () => {
            const result8 = await repository1.aggregate()
                .limit(-1)
                .findMany();
        }, /the limit must be positive|Expected a positive number/);

        await assertMongoError(async () => {
            const iterator = await repository1.aggregate()
                .limit(-1)
                .getAsyncIterator();

            for await (const item of iterator) {
                // do nothing
            }
        }, /the limit must be positive|Expected a positive number/);
    });

    it("addFields / set", async () => {
        const results = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .addFields({v1: "$numberValue", v2: "$numberValue"})
            .addFields({v3: {$sum: ["$v1", "$v2", 1]}})
            .skip(3)
            .limit(3)
            .set({values: [], values1: []})
            .findMany();
        assert.equal(results.length, 3);
        assert.equal(results[0].v3,  results[0].v1 + results[0].v2 + 1);
    });

    it("bucket", async () => {
        const results = await repository1.aggregate()
            .bucket({
                groupBy: "$mod",
                boundaries: [0, 1, 3],
                default: "other",
                output: {
                    total: {$sum: 1},
                    values: {
                        $push: "$mod",
                    },
                },
            })
            .findMany();
        assert.isDefined(results);
        assert.equal(results.length, 3);
        assert.equal(results[0].values.length, 6);
        assert.equal(results[1].values.length, 12);
        assert.equal(results[2].values.length, 12);
        assert.deepEqual(results.map(x => x.total), [6, 12, 12]);
    });

    it("bucketAuto", async () => {
        const results = await repository1.aggregate()
            .bucketAuto({
                groupBy: "$mod",
                buckets: 3,
                output: {
                    total: {$sum: 1},
                    values: {
                        $push: "$mod",
                    },
                },
                granularity: "R10",
            })
            .findMany();
        assert.equal(results.length, 3);
    });

    it("collStats", async () => {
        const result = await repository1.aggregate()
            .collStats({latencyStats: {histograms: true}, count: {}, storageStats: {scale: 1}})
            .findOne();
        assert.isDefined(result);
    });

    it("count", async () => {
        const result = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .count("total")
            .findOne();
        assert.deepEqual(result, {total});
    });

    it("currentOp", async () => {
        // not able to test
        await assertMongoError(async () => {
            const result = await repository1.aggregate()
                .match(x => x.filter("numberValue", Math.random()))
                .currentOp({allUsers: true})
                .findOne();
        }, /is not allowed/);
    });

    it("facet", async () => {
        const result = await repository1.aggregate()
            .facet({
                a1: [{$match: {mod: 1}}, {$project: {_id: 1, mod: 1}}],
                a2: [{$match: {mod: 2}}, {$project: {_id: 1, mod: 1}}],
                a3: [{$match: {mod: 3}}, {$project: {_id: 1, mod: 1}}],
            })
            .facet({
                a4: [{$project: {a1: 1, a2: 1}}],
            })
            .findOne();
        assert.isArray(result!.a4);
        assert.hasAllKeys(result!.a4[0], ["a1", "a2"]);
    });

    it("geoNear", async () => {
        // TBC
    });

    it("graphLookup", async () => {
        const result = await repository1.aggregate()
            .graphLookup({
                from: anotherCollectionName,
                startWith: "$reportTo",
                connectFromField: "reportTo",
                connectToField: "name",
                as: "reportingHierarchy",
            })
            .project({_id: 1, name: 1, reportTo: 1, reportingHierarchy: 1})
            .findMany();
        assert.equal(result.length, total);
    });

    it("group", async () => {
        const results = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .group({_id: {mod: "$mod"}, total: {$sum: "$index"}, multiply: {$sum: {$multiply: ["$index", 10]}}})
            .findMany();
        assert.equal(results.length, mod);
        assert.isDefined(results[0]._id.mod);
    });

    it("indexStats", async () => {
        const result = await repository1.aggregate()
            .indexStats()
            .findOne();
    });

    it("limit", async () => {
        const results = await repository1.aggregate()
            .limit(2)
            .findMany();
        assert.equal(results.length, 2);
    });

    it("listLocalSessions", async () => {
        // not able to test
        await assertMongoError(async () => {
            const result = await repository1.aggregate()
                .listLocalSessions({allUsers: true})
                .findOne();
        }, /is not allowed/);
    });

    it("listSessions", async () => {
        // not able to test
        await assertMongoError(async () => {
            const result = await repository1.aggregate()
                .listSessions({allUsers: true})
                .findOne();
        }, /is not allowed/);
    });

    it("lookup", async () => {
        const results = await  repository1.aggregate()
            .lookup({
                from: anotherCollectionName,
                let: {newField: "$numberValue"},
                pipeline: [{$project: {_id: 1, hello: "$$newField"}}],
                as: "child",
            })
            .findMany();
        assert.equal(results.length, total);
        assert.isArray(results[0].child);
        assert.equal(results[0].child.length, total);
        assert.hasAllKeys(results[0].child[0], ["_id", "hello"]);
    });

    it("match", async () => {
        // unwind the sum
        const results = await repository1.aggregate()
            .match(x => x.filter("secondValue", y => y.gt(0.5)))
            .findMany();
        assert.isTrue(results.length < total * 0.8);
    });

    it("merge", async () => {
        const limit = 8;

        const resultBefore = await repository2.aggregate()
            .count("total")
            .findOne();

        const result = await repository1.aggregate()
            .limit(limit)
            .merge({into: anotherCollectionName})
            .findOne();
        assert.isNull(result);

        const resultAfter = await repository2.aggregate()
            .count("total")
            .findOne();
        assert.deepEqual(resultAfter!.total - resultBefore!.total, limit);
    });

    it("out", async () => {
        const limit = 5;

        const result = await repository1.aggregate()
            .limit(limit)
            .out(anotherCollectionName)
            .findOne();
        assert.isNull(result);

        const resultAfter = await repository2.aggregate()
            .count("total")
            .findOne();
        assert.deepEqual(resultAfter!.total, limit);
    });

    it("planCacheStats", async () => {
        // not able to test
        await assertMongoError(async () => {
            const result7 = await repository1.aggregate()
                .planCacheStats()
                .findOne();
        }, /is not allowed/);
    });

    it("project", async () => {
        const results = await repository1.aggregate()
            .project({_id: 1, numberValue: 1})
            .project({numberValue: 0})
            .findMany();
        assert.hasAllKeys(results[0], ["_id"]);
    });

    it("redact", async () => {
        const results = await repository1.aggregate()
            .redact({$cond: {
                    if: { $lt: [ "$secondValue", 0.5 ] },
                    then: "$$PRUNE",
                    else: "$$DESCEND",
                },
            })
            .findMany();
        assert.isTrue(results.length < total * 0.8);
    });

    it("replaceRoot / replaceWith", async () => {
        const results1 = await repository1.aggregate()
            .replaceRoot({newRoot: {$mergeObjects: [{_id: "$_id"}, {newName: "$name"}]}})
            .findMany();
        assert.hasAllKeys(results1[0], ["_id", "newName"]);

        const results2 = await repository1.aggregate()
            .replaceWith({$mergeObjects: [{_id: "$_id"}, {newName: "$name"}]})
            .findMany();
        assert.hasAllKeys(results2[0], ["_id", "newName"]);
    });

    it("sample", async () => {
        const results = await repository1.aggregate()
            .sample(3)
            .findMany();
        assert.equal(results.length, 3);
    });

    it("skip", async () => {
        const results = await repository1.aggregate()
            .sort({index: 1})
            .skip(5)
            .limit(10)
            .findMany();
        assert.deepEqual(results.map(x => x.index), Array(10).fill(0).map((x, i) => i + 5));
    });

    it("sort", async () => {
        const result = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .sort({index: -1})
            .findOne();
        assert.equal(result!.index, total - 1);
    });

    it("sortByCount", async () => {
        const result = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .unwind("$sequenceArray")
            .sortByCount("$sequenceArray")
            .findOne();
        assert.deepEqual(result, {_id: 0, count: total - 1});
    });

    it.skip("unionWith", async () => {
        // got some minor errors
        const results = await repository1.aggregate()
            .unionWith(anotherCollectionName)
            .findMany();
        assert.isArray(results);
    });

    it("unset", async () => {
        const result = await repository1.aggregate()
            .unset("_id")
            .unset(["_id", "numberValue"])
            .findOne();
        assert.isUndefined(result!._id);
        assert.isUndefined(result!.numberValue);
    });

    it("unwind", async () => {
        const result = await repository1.aggregate()
            .match(x => x.filter("numberValue", numberValue))
            .unwind("$items")
            .group({_id: 1, itemsSum: {$sum: "$items.value"}})
            .project({total: "$itemsSum"})
            .unset("_id")
            .unset(["_id"])
            .findOne();
        assert.deepEqual(result, {total: ((total - 1) * total) / 2 * 101});
    });
});
