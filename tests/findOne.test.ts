import { assert, expect } from "chai";
import {Binary, Connection, Document, Field, Repository} from "../src";
import {generateRandomString} from "../src/utils";
// @ts-ignore
import {addConnection} from "./share";

@Document()
class FindOne1 {
    @Field()
    public _id: string = "";
}

@Document()
class FindOne2 {
    @Field()
    public _id: number = 0;
}

@Document()
class FindOne3 {
    @Field()
    public _id: any;
}

describe("Find One Test", () => {
    let connection!: Connection;
    let repository1!: Repository<typeof FindOne1>;
    let repository2!: Repository<typeof FindOne2>;
    let repository3!: Repository<typeof FindOne3>;

    before(async () => {
        connection = await addConnection();
        repository1 = connection.getRepository(FindOne1);
        repository2 = connection.getRepository(FindOne2);
        repository3 = connection.getRepository(FindOne3);
    });
    after(async () =>  {
        await repository1.dropCollection();
        await repository2.dropCollection();
        await repository3.dropCollection();
        await connection.close();
    });

    it("simple findOne1", async () => {
        const _id = "hello";
        const document1 = repository1.create({_id});
        await repository1.insert(document1);

        const findDocument1 = await repository1.findOne({_id: document1._id});
        const findDocument2 = await repository1.getCollection().findOne({_id});
        assert.deepEqual(document1, findDocument1);
        assert.deepEqual(Object.entries(document1), Object.entries(findDocument2));
    });

    it("findOne1", async () => {
        const _ids = ["", generateRandomString(16), Array(1024).fill(0).join("")];
        for (const _id of _ids) {
            const document1 = repository1.create({_id});
            await repository1.insert(document1);
            const findDocument1 = await repository1.findOne({_id: document1._id});
            assert.deepEqual(document1, findDocument1);
            assert.deepEqual(findDocument1!._id, _id);
        }
    });

    it("findOne2", async () => {
        const _ids = [0, Number.NaN, Math.random(), Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.MAX_VALUE, Number.MIN_VALUE];
        for (const _id of _ids) {
            const document1 = repository2.create({_id});
            await repository2.insert(document1);
            const findDocument1 = await repository2.findOne({_id: document1._id});
            assert.deepEqual(document1, findDocument1);
            assert.deepEqual(findDocument1!._id, _id);
        }
    });

    it("findOne3", async () => {
        const _ids = [new Date(), true, false, {a: 1}, {a: {b: 1}}, new Binary(Buffer.alloc(5))];
        for (const _id of _ids) {
            const document1 = repository3.create({_id});
            await repository3.insert(document1);
            const findDocument1 = await repository3.findOne({_id: document1._id});
            assert.deepEqual(document1, findDocument1);
            assert.deepEqual(findDocument1!._id, _id);
        }
    });
});
