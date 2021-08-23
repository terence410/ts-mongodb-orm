import { assert, expect } from "chai";
import {Connection, Document, Field, ObjectId} from "../src/";
// @ts-ignore
import {addConnection} from "./share";

let activeRecordConnection!: Connection;

class BaseDocument {
    public static async findOne<TD extends typeof BaseDocument>(this: TD, filter: ObjectId) {
        const repository = activeRecordConnection.getRepository(this);
        return await repository.findOne(filter);
    }

    public static async dropCollection() {
        return await activeRecordConnection.getRepository(this).dropCollection();
    }

    public _id: any;

    public async insert<TD extends typeof BaseDocument>(this: InstanceType<TD>): Promise<InstanceType<TD>> {
        const repository = activeRecordConnection.getRepository(this.constructor as TD);
        await repository.insert(this);
        return this;
    }

    public async update<TD extends typeof BaseDocument>(this: InstanceType<TD>): Promise<InstanceType<TD>> {
        const repository = activeRecordConnection.getRepository(this.constructor as TD);
        await repository.update(this);
        return this;
    }

    public async delete<TD extends typeof BaseDocument>(this: InstanceType<TD>): Promise<InstanceType<TD>> {
        const repository = activeRecordConnection.getRepository(this.constructor as TD);
        await repository.delete(this);
        return this;
    }
}

@Document()
class SimpleActiveRecordTest extends BaseDocument {
    @Field()
    public _id!: ObjectId;
}

describe("Active Record Test", () => {
    before(async () => {
        activeRecordConnection = await addConnection();
    });
    after(async () => {
        await SimpleActiveRecordTest.dropCollection();
        await activeRecordConnection.close();
    });

    it("test", async () => {
        const document = new SimpleActiveRecordTest();
        await document.insert();
        await document.update();

        let findDocument = await SimpleActiveRecordTest.findOne(document._id);
        assert.isDefined(findDocument);

        await document.delete();
        findDocument = await SimpleActiveRecordTest.findOne(document._id);
        assert.isUndefined(findDocument);
    });
});
