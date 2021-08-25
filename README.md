# ts-mongodb-orm (Typescript Orm wrapper for Mongodb)

ORM for MongoDB with 0 dependencies. Ready for production use. 

[![NPM version][npm-image]][npm-url]
[![Test coverage][codecov-image]][codecov-url]

[npm-image]: https://img.shields.io/npm/v/ts-mongodb-orm.svg
[npm-url]: https://npmjs.org/package/ts-mongodb-orm
[codecov-image]: https://codecov.io/gh/terence410/ts-mongodb-orm/branch/develop/graph/badge.svg?token=7RDPRFYETS
[codecov-url]: https://codecov.io/gh/terence410/ts-mongodb-orm

The codes are well written in consistency and intuitive with respect to the original [mongodb](https://www.npmjs.com/package/mongodb) library. 

Please check the examples below to check out all the amazing features!

# Prerequisite 
This library have zero dependencies, which means it works with your own mongodb package version. To start with, simply install the official mongodb package and its type.

```bash
npm install --save mongodb @types/mongodb
```

This library has been tested with the follow [mongodb](https://www.npmjs.com/package/mongodb) versions:
- v4.1.0
- v3.6.11 (please install ts-mongodb-orm@1.0.x for below versions)
- v3.6.9
- v3.6.3
- v3.6.0
- v3.5.10
- v3.4.1
- v3.3.5
- v3.2.7

# Project Setup
- npm install -s mongodb@latest
- npm install -s ts-mongodb-orm@latest
- In tsconfig.json
  - set "experimentalDecorators" to true. 
  - set "emitDecoratorMetadata" to true. 
  - set "strictNullChecks" to true.

# Example: Quick Start
```typescript

import { Binary, createConnection, Document, Field, Index, ObjectId } from "ts-mongodb-orm";

@Index({numberValue: -1})
@Document({collectionName: "CustomCollectionName"}) // default to Class name
class QuickStart {
    @Field()
    public _id!: ObjectId;

    @Field()
    public stringValue?: string;

    @Field()
    public numberValue: number = 0;

    @Field()
    public booleanValue: boolean = false;

    @Field({index: -1})
    public dateValue: Date = new Date();

    @Field()
    public arrayValue: number[] = [1, 2, 3];

    @Field()
    public objectArrayValue: any = {};

    @Field()
    public binary: Binary = new Binary(Buffer.alloc(0));
}

async function quickStartExample() {
    const connection = await createConnection({
        uri: "mongodb+srv://USERNAME:PASSWORD@xxxxxxx.gcp.mongodb.net",
        dbName: "DbName",
        mongoClientOptions: {
            w: "majority",
            ignoreUndefined: true, // preventing saving null value in server side
            serverSelectionTimeoutMS: 5000,
        },
    });

    // operations
    const repository = connection.getRepository(QuickStart);
    await repository.createCollection({strict: true}); // throw error if collection already exist
    await repository.syncIndex();
    await repository.dropCollection();

    // documents operations
    const document1 = new QuickStart();
    document1.stringValue = "hello world 1";
    document1.numberValue = 999;

    await repository.insert(document1);
    await repository.update(document1);
    await repository.delete(document1);

    // query
    const findDocument1 = await repository.findOne(document1._id);
    const findDocument2 = await repository.query().filter("_id", document1._id).findOne();
    const aggregate1 = await repository.aggregate().count("numberValue").findOne();

    // transaction
    const transactionManager = connection.getTransactionManager();
    await transactionManager.startTransaction(async (session) => {
        const document2 = repository.create({stringValue: "hello world 2"});
        await repository.insert(document2, {session});
    });

    // atomic lock
    const lockManager = connection.getLockManager();
    await lockManager.createCollection(); // this need to be called once to create the collection
    await lockManager.startLock("lockKey", async () => {
        //
    });
}
```

# Example: Query
```typescript
async function queryExample() {
    // findOne all documents
    const allDocuments = await repository.query().findMany();

    // async iterator
    const iterator = await repository.query().filter("numberValue", 1).getAsyncIterator();
    for await (const document1 of iterator) {
        // handle document
    }

    // delete many by condition
    const query2 = repository.query();
    const deletedTotal = await query2
        .filter("numberValue", 1)
        .getDeleter()
        .deleteMany();

    // update many by condition
    const query3 = repository.query();
    const updatedTotal = await query3
        .filter("numberValue", 1)
        .getUpdater()
        .inc("numberValue", 10)
        .updateMany();

    // all kind of complex query
    const query4 = repository.query({weakType: true})
        .filter("field1", x => x.elemMatchObject(y => y.filter("hello", 1)))
        .filter("field2", x => x.elemMatch(y => y.gt(5)))
        .filter("field3", x => x.gt(5).lt(3).lte(4).gte(6))
        .filter("field4", x => x.in([1, 2, 3]))
        .filter("field5", x => x.nin([1, 2, 3]))
        .filter("field6", x => x.size(3))
        .filter("field7", x => x.mod(10, 1))
        .filter("field8", x => x.not(y => y.gt(5)))
        .filter("field9", x => x.regex("/abcd/"))
        .text("hello-world")
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
}
```

# Example: Aggregate
```typescript
async function aggregateExample() {
    // iterator
    const iterator = await repository.aggregate({allowDiskUse: true, maxTimeMS: 5000})
        .match(x => x.filter("numberValue", 1))
        .project({_id: 1})
        .getAsyncIterator();

    for await (const item of iterator) {
    }
    
    // find total
    const result1 = await repository.aggregate()
        .match(x => x.filter("numberValue", 1))
        .count("total")
        .findOne();

    // skip
    const results2 = await repository.aggregate()
        .sort({index: 1})
        .skip(5)
        .limit(10)
        .findMany();

    // some field you may want weakType
    const result3 = await repository.aggregate({weakType: true})
        .match(x => x.filter("anyFieldName", 1))
        .findOne();

    // cast to document directly
        const result4 = await repository.aggregate()
            .toDocument()
            .findOne();
        const {stringValue} = result4!;
}

```

# Example: Transaction
```typescript
async function transactionExample() {
    const transactionManager1 = connection.getTransactionManager({maxRetry: 2});

    try {
        const result = await transactionManager1.startTransaction(async (session) => {
            const document1 = new QuickStart();
            await repository.insert(document1, {session});

            const foundDocument1 = await repository.findOne(document1._id, {session});
            const foundDocument2 = await repository.query({session})
                .filter("_id", document1._id)
                .findOne();

            // we can abort transaction
            if (1 < 2) {
                await session.abortTransaction();
            }

            return [1, 2, 3];
        });

        // value = [1, 2, 3];
        const {value, hasCommitted} = result;
    } catch (err) {
        // manage error
    }
}
```

# Example: Manage Index
```typescript
async function manageIndexExample() {
    @Index({name: 1, value: -1}, {sparse: true})
    @Index({uniqueField: 1}, {unique: true})
    @Index({dateField: 1}, {expireAfterSeconds: 10})
    @Index({filterField: 1}, {partialFilterExpression: {numberValue: {$gt: 5}}})
    @Index({textField: "text"})
    @Document()
    class IndexDocument {
        @Field()
        public _id!: ObjectId;

        @Field()
        public uniqueField?: string;

        @Field()
        public dateField?: Date;

        @Field()
        public filterField?: string;

        @Field()
        public textField?: string;

        @Field()
        public numberValue?: number;
    }

    const repository1 = connection.getRepository(IndexDocument);

    // syncIndexes will drop non exist index and then new a new one
    // this will also create collection if not exist
    await repository1.syncIndex();

    // addIndexes will only try to new new one
    // this will also create collection if not exist
    await repository1.addIndex();

    // drop all index
    await repository1.dropIndex();

    // compare the existing index with decorators
    await repository1.compareIndex();
}
```

# Example: Watch
```typescript
async function watchExample() {
    const stream = repository.watch();
    stream.on("error", err => {
        // any possible error
    });

    stream.on("insert", next => {
        const {document, documentKey, operationType} = next;
    });

    stream.on("update", next => {
    });

    stream.on("delete", next => {
    });

    stream.on("change", next => {
        // any type of operations includes insert, update, delete, replace, drop, dropDatabase, rename, invalidate
    });

    stream.on("end", () => {
        // steam is ended
    });

    stream.on("close", () => {
        // steam is closed
    });
}

```

# Example: Hook
```typescript
async function hookExample() {
    @Document()
    class HookDocument {
        @Field()
        public _id!: ObjectId;

        @AfterLoad()
        public afterLoad() {
            // this won't await for promise
        }

        @BeforeUpsert()
        @BeforeInsert()
        @BeforeUpdate()
        @BeforeDelete()
        public before(type: string) { // type: afterLoad, upsert, insert, update, delete
            // this won't await for promise
        }
    }

    const repository1 = connection.getRepository(HookDocument);
    const document1 = repository1.create();
    await repository1.insert(document1);
}
```

# Example: Schema Validation
```typescript
async function schemaValidationExample() {
    @Document()
    class SchemaValidationDocument {
        @Field()
        public _id!: ObjectId;

        @Field({isRequired: true, schema: {bsonType: "string"}})
        public stringField?: string;

        @Field({isRequired: true, schema: {bsonType: "date"}})
        public dateField?: Date;

        @Field({isRequired: true, schema: {type: "number", minimum: 10, exclusiveMinimum: true}})
        public numberField?: number;

        @Field({schema: {bsonType: "object", additionalProperties: true, properties: {name: {bsonType: "string"}}}})
        public objectField?: any;
    }

    const repository1 = connection.getRepository(SchemaValidationDocument);

    // this will also create collection with validation
    await repository1.createCollection();

    // or you can sync the validation later on (this need admin right)
    await repository1.syncSchemaValidation();

    // view existing validation
    const options = await repository1.getCollection().options();

    try {
        const document1 = repository1.create();
        await repository1.insert(document1);
    } catch (err) {
        // err.message === "Document failed validation"
    }
}

```

# Example: Error
```typescript
async function errorExample() {
    // allow you to debug async error more easily (default: true)
    tsMongodbOrm.useFriendlyErrorStack = true;

    const document1 = new QuickStart();
    await repository.insert(document1);
    await repository.delete(document1);

    try {
        await repository.update(document1);
    } catch (err) {
        if (err instanceof TsMongodbOrmError) {
            // error managed by this library

        } else if (err instanceof MongoError) {
            // error from the native mongodb library

        } else {
            // other error

        }
    }
}
```

# Example: Buffer
```typescript
async function bufferExample() {
    // for some reason, promoteBuffers will cause some initialize error in mongodb@v3.4.1
    const connection = await createConnection({
        uri: "mongodb+srv://USERNAME:PASSWORD@xxxxxxx.gcp.mongodb.net",
        dbName: "DbName",
        mongoClientOptions: {
            w: "majority",
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ignoreUndefined: true, // preventing saving null value in server side
            promoteBuffers: true, // if you wanted to use native JS buffer directly
        },
    });

    @Document()
    class BufferDocument {
        @Field()
        public _id!: ObjectId;

        @Field()
        public buffer: Buffer = Buffer.alloc(0);

        @Field()
        public bufferObject?: {buffer: Buffer};
    }

    const repository = connection.getRepository(BufferDocument);
    const document = await repository.create({buffer: Buffer.alloc(10)});
    await repository.insert(document);

    const findDocument = await repository.findOne(document._id);
    if (findDocument && findDocument.buffer instanceof Buffer) {
        // true
    }
}
```

# More Detailed Examples
Examples are in the [`tests/`](https://github.com/terence410/ts-mongodb-orm/tree/master/tests) directory.

| Sample                      | Source Code                       | 
| --------------------------- | --------------------------------- |
| General | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/general.test.ts) |
| Active Record | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/activeRecord.test.ts) |
| Aggregate | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/aggregate.test.ts) |
| Capped | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/capped.test.ts) |
| Compatibility | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/compatibility.test.ts) |
| Error | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/error.test.ts) |
| Index | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/index.test.ts) |
| LockManager | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/lockManager.test.ts) |
| RankManager | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/rankManager.test.ts) |
| Transaction Manager | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/transactionManager.test.ts) |
| Watch | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/watch.test.ts) |
| Query | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/query.test.ts) |
| Hook | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/hook.test.ts) |
| Schema Validation | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/schema.test.ts) |

# Useful links
- https://www.npmjs.com/package/mongodb
- https://docs.mongodb.com/manual/
- https://docs.mongodb.com/manual/core/schema-validation/

