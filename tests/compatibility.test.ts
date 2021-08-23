import { assert, expect } from "chai";
import {Contains, Max, Min, validate} from "class-validator";
import clone from "clone";
import {
    Connection,
    Document,
    Field,
    ObjectId
} from "../src";
// @ts-ignore
import {addConnection} from "./share";

@Document()
class CompatibilityTest {
    @Field()
    public _id!: ObjectId;

    @Field()
    @Contains("hello")
    public stringValue: string = "hello world";

    @Field()
    @Min(0)
    @Max(10)
    public numberValue: number = Math.random();
}

@Document()
class CompatibilityExtendTest extends CompatibilityTest {
    @Field()
    public newValue: string = "";
}

describe("Compatibility Test", () => {
    let connection!: Connection;

    before(async () => {
        connection = await addConnection();
    });
    after(async () => {
        await connection.getRepository(CompatibilityTest).dropCollection();
        await connection.getRepository(CompatibilityExtendTest).dropCollection();
        await connection.close();
    });

    it("class validator", async () => {
        const document1 = new CompatibilityTest();
        const errors1 = await validate(document1);
        assert.equal(errors1.length, 0);

        const document2 = connection.getRepository(CompatibilityTest).create({stringValue: "nothing", numberValue: 1000});
        const errors2 = await validate(document2);
        assert.equal(errors2.length, 2);
    });

    it("clone", async () => {
        const repository = connection.getRepository(CompatibilityTest);
        const document1 = repository.create();
        await repository.insert(document1);

        const document2 = clone(document1);
        assert.deepEqual(document1, document2);
    });

    it("class extend", async () => {
        const repository = connection.getRepository(CompatibilityExtendTest);
        await repository.createCollection();

        const newValue = "newValue";
        const document = repository.create({newValue});
        await repository.insert(document);

        const findDocument = await repository.findOne(document._id);
        assert.deepEqual(findDocument, document);
    });
});
