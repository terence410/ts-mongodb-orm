# ts-mongodb-orm (Typescript Orm wrapper for Mongodb)

The codes are well written in consistency and intuitive with respect to the original [mongodb](https://www.npmjs.com/package/mongodb) library. 

Please check the examples below to check out all the amazing features!

# Prerequisite 
This library have zero dependencies, which means it works with your own mongodb package version. To start with, simply install the official mongodb package and its type.

```bash
npm install --save mongodb @mongodbDataTypes/mongodb
```

This library is being tested with the follow [mongodb](https://www.npmjs.com/package/mongodb) versions:
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

# Quick Start
```typescript

import { Binary, createConnection, Document, Field, Index, ObjectID } from "ts-mongodb-orm";

@Index({numberValue: -1})
@Document({collectionName: "CustomCollectionName"}) // default to Class name
class QuickStart {
    @Field()
    public _id!: ObjectID;

    @Field()
    public stringValue?: string;

    @Field()
    public numberValue: number = 0;

    @Field()
    public binary: Binary = new Binary(Buffer.alloc(0));
}

async function quickStartExample() {
    const connection = await createConnection({
        uri: "mongodb+srv://USERNAME:PASSWORD@xxxxxxx.gcp.mongodb.net",
        dbName: "DbName",
        mongoClientOptions: {
            w: "majority",
            useNewUrlParser: true,
            ignoreUndefined: true, // preventing saving null value in server side
            useUnifiedTopology: true,
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

# Examples


# More Examples
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
| Transaction Manager | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/transactionManager.test.ts) |
| Watch | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/watch.test.ts) |
| Query | [source code](https://github.com/terence410/ts-mongodb-orm/blob/master/tests/query.test.ts) |

# Useful links
- https://www.npmjs.com/package/mongodb
- https://docs.mongodb.com/manual/

# TODO
- Complete query on geo
- Support updating mongodb server side validation
- Support collation
