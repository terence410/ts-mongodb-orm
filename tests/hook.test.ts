import { assert, expect } from "chai";
import {Length, validateSync} from "class-validator";
import { Connection, Document, Field, ObjectId, Repository} from "../src";
import {AfterLoad} from "../src/decorators/hooks/AfterLoad";
import {BeforeDelete} from "../src/decorators/hooks/BeforeDelete";
import {BeforeInsert} from "../src/decorators/hooks/BeforeInsert";
import {BeforeUpdate} from "../src/decorators/hooks/BeforeUpdate";
import {BeforeUpsert} from "../src/decorators/hooks/BeforeUpsert";
// @ts-ignore
import {addConnection, assertAsyncError, assertMongoError} from "./share";

@Document()
export class HookClass1 {
    @Field()
    public _id!: ObjectId;

    @Field()
    public updatedAt: Date = new Date();

    // @IsDate()
    @Length(10, 20)
    @Field()
    public name: string = "";

    public states: string[] = [];

    @BeforeInsert()
    public beforeInsert() {
        this.states.push("beforeInsert");

        const errors = validateSync(this);
        if (errors.length) {
            throw new Error(JSON.stringify(errors.map(x => x.constraints)));
        }
    }

    @BeforeUpsert()
    public beforeUpsert() {
        this.states.push("beforeUpsert");
    }

    @BeforeUpdate()
    public beforeUpdate() {
        this.states.push("beforeUpdate");
    }

    @AfterLoad()
    public afterLoad() {
        this.states.push("afterLoad");
    }

    @BeforeDelete()
    public beforeDelete() {
        this.states.push("beforeDelete");
    }
}

@Document()
export class HookClass2 {
    @Field()
    public _id!: ObjectId;

    public states: string[] = [];

    @AfterLoad()
    @BeforeInsert()
    @BeforeUpsert()
    @BeforeUpdate()
    @BeforeDelete()
    public async hook(type: string) {
        this.states.push(type);
    }
}

@Document()
export class ExtendHookClass extends HookClass2 {
    @AfterLoad()
    public async newAfterLoad(type: string) {
        this.states.push("newAfterLoad");
    }
}

describe("Validator Test", () => {
    let connection!: Connection;
    let repository1!: Repository<typeof HookClass1>;
    let repository2!: Repository<typeof HookClass2>;
    let repositoryExtended!: Repository<typeof ExtendHookClass>;

    before(async () => {
        connection = await addConnection();
        repository1 = connection.getRepository(HookClass1);
        repository2 = connection.getRepository(HookClass2);
        repositoryExtended = connection.getRepository(ExtendHookClass);
    });

    after(async () => {
        await repository1.dropCollection().catch(e => 0);
        await repository2.dropCollection().catch(e => 0);
        await repositoryExtended.dropCollection().catch(e => 0);
        await connection.close();
    });

    it("all hooks", async () => {
        const entity = repository1.create({name: "abcdefghijklmnop"});
        await repository1.insert(entity);
        await repository1.update(entity, {upsert: true});
        await repository1.update(entity);

        const findEntity = await repository1.findOne(entity._id);
        await repository1.delete(entity);

        assert.deepEqual(entity.states, [ "beforeInsert", "beforeUpsert", "beforeUpdate", "beforeDelete" ]);
        assert.deepEqual(findEntity!.states, [ "afterLoad"]);
    });

    it("all hooks 2", async () => {
        const entity = repository2.create();
        await repository2.insert(entity);
        await repository2.update(entity, {upsert: true});
        await repository2.update(entity);

        const findEntity = await repository2.findOne(entity._id);
        await repository2.delete(entity);

        assert.deepEqual(entity.states, [ "beforeInsert", "beforeUpsert", "beforeUpdate", "beforeDelete" ]);
        assert.deepEqual(findEntity!.states, [ "afterLoad"]);
    });

    it("all hooks 3 (extended class)", async () => {
        const entity = repositoryExtended.create();
        await repositoryExtended.insert(entity);
        await repositoryExtended.update(entity, {upsert: true});
        await repositoryExtended.update(entity);

        const findEntity = await repositoryExtended.findOne(entity._id);
        await repositoryExtended.delete(entity);

        assert.deepEqual(entity.states, [ "beforeInsert", "beforeUpsert", "beforeUpdate", "beforeDelete" ]);
        assert.deepEqual(findEntity!.states, [ "newAfterLoad"]);
    });

    it("transaction", async () => {
        const entity1 = repository1.create({name: "abcdefghijklmnop"});
        const entity2 = repository1.create({name: "abcdefghijklmnop"});
        const entity3 = repository1.create({name: "abcdefghijklmnop"});
        await repository1.insert(entity1);
        await repository1.insert(entity2);
        await repository1.insert(entity3);

        const transactionManager = connection.getTransactionManager();
        const result = await transactionManager.startTransaction(async session => {
            const newEntity1 = repository1.create({name: "abcdefghijklmnop"});
            const findEntity2 = await repository1.findOne(entity1._id, {session});
            const findEntity3 = await repository1.findOne(entity2._id, {session});

            await repository1.insert(newEntity1, {session});
            await repository1.update(entity1, {session, upsert: true});
            await repository1.update(findEntity2!, {session});
            await repository1.delete(findEntity3!, {session});

            return [newEntity1, entity1, findEntity2, findEntity3];
        });

        const values = result.value.map(x => x!.states);
        assert.deepEqual(values, [["beforeInsert"], ["beforeInsert", "beforeUpsert"], ["afterLoad", "beforeUpdate"], ["afterLoad", "beforeDelete"]]);
    });

    it("auto validate before insert", async () => {
        const entity = repository1.create({name: "abcd"});
        await assertAsyncError(async () => {
            await repository1.insert(entity);
        }, {message: /name must be longer than or equal/});
    });
});
