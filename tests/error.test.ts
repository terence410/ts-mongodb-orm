import { assert, expect } from "chai";
import {Connection, Document, Field, Index, ObjectID, Repository, tsMongodbOrm} from "../src";
// @ts-ignore
import {addConnection, assertMongoError, assertTsMongodbOrmError} from "./share";

@Index({notExist: 1})
@Document()
class ErrorTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public value: number = 5;
}

describe("Error Test", () => {
    let connection!: Connection;
    let repository!: Repository<typeof ErrorTest>;

    before(async () => {
        connection = await addConnection();
        repository = connection.getRepository(ErrorTest);
    });

    after(async () => {
        await repository.dropCollection().catch(e => 0);
        await connection.close();
    });

    it("test on friendly error stack", async () => {
        const uri =  "mongodb+srv://username:password@dummy.gcp.mongodb.net";

        // disable friendlyErrorStack
        tsMongodbOrm.useFriendlyErrorStack = false;
        let stack1: string | undefined;
        try {
            await repository.dropCollection();
        } catch (e) {
            stack1 = e.stack;
        }
        assert.isDefined(stack1);
        assert.notMatch(stack1!, /error.test.ts/);

        // enable friendlyErrorStack
        tsMongodbOrm.useFriendlyErrorStack = true;
        let stack2: string | undefined;
        try {
            await repository.dropCollection();
        } catch (e) {
            stack2 = e.stack;
        }
        assert.isDefined(stack2);
        assert.match(stack2!, /error.test.ts/);
    });

    it("create collection", async () => {
        await repository.createCollection();
        await repository.createCollection();

        await assertMongoError(async () => {
            await repository.createCollection({strict: true});
        }, /Collection already exists/i);
    });

    it("document without _id", async () => {
        await assertTsMongodbOrmError(() => {
            @Document()
            class ErrorTest1 {
                public _id!: ObjectID;
            }
        }, /Document must define a _id field/);
    });

    it("new document with same _id", async () => {
        const document1 = new ErrorTest();
        await repository.insert(document1);

        await assertMongoError(async () => {
            const document2 = new ErrorTest();
            document2._id = document1._id;
            await repository.insert(document2);
        }, /duplicate key error/);
    });

    it("delete document multiple times", async () => {
        const document1 = new ErrorTest();
        await repository.insert(document1);
        await repository.delete(document1);

        await assertTsMongodbOrmError(async () => {
            await repository.delete(document1);
        }, /Document.* not exists for delete./);
    });

    it("update document after delete", async () => {
        const document1 = await new ErrorTest();
        await repository.insert(document1);
        await repository.delete(document1);

        await assertTsMongodbOrmError(async () => {
            await repository.update(document1);
        }, /Document.* not exists for save./);
    });

    it("manage index that not exist", async () => {
        const regex = /Index field: notExist not exists/;
        await assertTsMongodbOrmError(async () => {
            await repository.syncIndex();
        }, regex);

        await assertTsMongodbOrmError(async () => {
            await repository.compareIndex();
        }, regex);
    });

    it("findOne, findMany must provide object", async () => {
        await assertTsMongodbOrmError(async () => {
            await repository.findOne(1 as any);
        }, /filter must be in the type of object./);
    });
});
