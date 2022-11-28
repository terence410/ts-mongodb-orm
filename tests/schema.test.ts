import { assert, expect } from "chai";
import { Connection, Document, Field, ObjectId, Repository} from "../src";
import {timeout} from "../src/utils";
// @ts-ignore
import {addConnection, assertMongoError} from "./share";

@Document({collectionName: "SchemaTest", validationLevel: "strict"})
class SchemaTest {
    @Field()
    public _id!: ObjectId;

    @Field({isRequired: true, schema: {minLength: 5}})
    public requiredValue?: string;

    @Field({schema: {type: "number", description: "need to be greater than 10", minimum: 10, exclusiveMinimum: true}})
    public numberValue?: any;

    @Field({schema: {bsonType: "date"}})
    public dateValue?: any;

    // public objectValue?: {name: string}; // you can use stronger type type here, schema is for server side type protection
    @Field({schema: {bsonType: "object", additionalProperties: true, properties: {name: {bsonType: "string"}}}})
    public objectValue?: any;

    @Field({schema: {bsonType: "object", additionalProperties: false, properties: {name: {bsonType: "string"}}}})
    public exactObjectValue?: any;
}

@Document({collectionName: "SchemaTest", validationLevel: "moderate"})
class SchemaModerateTest extends SchemaTest {

}

@Document({collectionName: "SchemaTest"})
class SchemaNoneTest {
    @Field()
    public _id!: ObjectId;
}

describe("Validator Test", () => {
    let connection!: Connection;
    let repository!: Repository<typeof SchemaTest>;
    let repositoryNone!: Repository<typeof SchemaNoneTest>;
    let repositoryModerate!: Repository<typeof SchemaModerateTest>;

    before(async () => {
        connection = await addConnection();
        repository = connection.getRepository(SchemaTest);
        repositoryNone = connection.getRepository(SchemaNoneTest);
        repositoryModerate = connection.getRepository(SchemaModerateTest);
        await repository.createCollection();
    });

    after(async () => {
        await repository.dropCollection();
        await connection.close();
    });

    it("syncSchemaValidation", async () => {
        await repositoryNone.dropCollection();
        await repositoryNone.createCollection();

        const options1 = await repositoryNone.getCollection().options();
        assert.deepEqual(options1, {});

        // sync
        await repositoryNone.syncSchemaValidation();

        // this is the default value
        const options2 = await repositoryNone.getCollection().options();
        assert.deepEqual(options2, {validationLevel: "strict", validationAction: "error"});

        // fallback to the original settings
        await repository.syncSchemaValidation();
    });

    it("validator: requiredValue", async () => {
        const document = repository.create();
        await assertMongoError(async () => {
            await repository.insert(document);
        }, /Document failed validation/);
    });

    it("validator: numberValue minimum", async () => {
        const document = repository.create({requiredValue: "hello", numberValue: 20});
        await repository.insert(document);

        // ok until 11
        for (let i = 0; i < 9; i++) {
            await repository.query().filter("_id", document._id).getUpdater().inc("numberValue", -1).updateOne();
        }

        const findDocument = await repository.findOne(document._id);
        assert.equal(findDocument!.numberValue, 11);

        // will trigger error now
        await assertMongoError(async () => {
            await repository.query().filter("_id", document._id).getUpdater().inc("numberValue", -1).updateOne();
        }, /Document failed validation/);
    });

    it("validator: numberValue minimum/type", async () => {
        await assertMongoError(async () => {
            const document = repository.create({requiredValue: "hello", numberValue: "10"});
            await repository.insert(document);
        }, /Document failed validation/);

        await assertMongoError(async () => {
            const document = repository.create({requiredValue: "hello", numberValue: 10});
            await repository.insert(document);
        }, /Document failed validation/);
    });

    it("validator: dateValue", async () => {
        await assertMongoError(async () => {
            const document = repository.create({requiredValue: "hello", dateValue: new Date().toISOString()});
            await repository.insert(document);
        }, /Document failed validation/);

        await assertMongoError(async () => {
            const document = repository.create({requiredValue: "hello", dateValue: new Date().getTime()});
            await repository.insert(document);
        }, /Document failed validation/);
    });

    it("validator: objectValue", async () => {
        await assertMongoError(async () => {
            const document = repository.create({requiredValue: "hello", objectValue: {name: 5, height: 180}});
            await repository.insert(document);
        }, /Document failed validation/);

        await assertMongoError(async () => {
            const document = repository.create({requiredValue: "hello", exactObjectValue: {name: "Paul", height: 180}});
            await repository.insert(document);
        }, /Document failed validation/);
    });

    it("bypassDocumentValidation", async () => {
        const document = repository.create({numberValue: 10});
        await assertMongoError(async () => {
            await repository.insert(document);
        }, /Document failed validation/);
        await repository.insert(document, {bypassDocumentValidation: true});
    });

    it("validationAction: moderate", async () => {
        // insert a valid document
        const documentValid = repository.create({requiredValue: "hello", numberValue: 11});
        await repository.insert(documentValid);

        // no schema and insert a document
        await repositoryNone.syncSchemaValidation();
        const documentInvalid = repository.create({requiredValue: "", numberValue: 5});
        await repository.insert(documentInvalid);

        // goes into moderate level
        await repositoryModerate.syncSchemaValidation();

        // (moderate) insert is not valid
        await assertMongoError(async () => {
            const document2 = repository.create({requiredValue: "hello", numberValue: 10});
            await repository.insert(document2);
        }, /Document failed validation/);

        // (moderate) updating a valid document is not ok
        await assertMongoError(async () => {
            documentValid.numberValue = -15;
            documentValid.requiredValue = "a";
            await repository.update(documentValid);
        }, /Document failed validation/);

        // (moderate) updating a document which is invalid already
        documentInvalid.numberValue = -10;
        documentInvalid.requiredValue = undefined;
        await repository.update(documentInvalid);

        // back to original settings
        await repository.syncSchemaValidation();

        // (strict) update will be checked anyway
        documentValid.numberValue = 20;
        documentValid.requiredValue = "helloWorld";
        await repository.update(documentValid);
    });
});
