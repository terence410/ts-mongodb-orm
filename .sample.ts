import {config} from "dotenv";
config();

import { Binary, Connection, createConnection, Document, Field, Index, mongodbDataTypes, MongoError, ObjectID, tsMongodbOrm, TsMongodbOrmError} from "./src";

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
        uri: process.env.MONGODB_URI || "mongodb+srv://USERNAME:PASSWORD@xxxxxxx.gcp.mongodb.net",
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
    const document = new QuickStart();
    document.stringValue = "hello world 1";
    document.numberValue = 999;

    await repository.insert(document);
    await repository.update(document);
    await repository.delete(document);

    // query
    const findDocument1 = await repository.findOne(document._id);
    const findDocument2 = await repository.query().filter("_id", document._id).findOne();
    const aggregate1 = await repository.aggregate().count("numberValue").findOne();

    // transaction
    const transactionManager = connection.getTransactionManager();
    await transactionManager.startTransaction(async (session) => {
        const newDocument = repository.create({stringValue: "hello world 2"});
        await repository.insert(newDocument, {session});
    });

    // atomic lock
    const lockManager = connection.getLockManager();
    await lockManager.createCollection(); // this need to be called once to create the collection
    await lockManager.startLock("lockKey", async () => {
        //
    });

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
                // error from the mongodb library

            } else {
                // other error

            }
        }
    }

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
        const nativeQuery = query4.nativeQuery;
    }

    async function transactionExample() {
        const transactionManager1 = connection.getTransactionManager(
            {maxRetry: 2, transactionOptions: {readPreference: "primary"}});

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

    async function manageIndexExample() {
        @Index({name: 1, value: -1}, {sparse: true})
        @Index({uniqueField: 1}, {unique: true})
        @Index({dateField: 1}, {expireAfterSeconds: 10})
        @Index({filterField: 1}, {partialFilterExpression: {numberValue: {$gt: 5}}})
        @Index({textField: "text"})
        @Document()
        class IndexDocument {
            @Field()
            public _id!: ObjectID;

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
}

async function bufferExample() {
    // for some reason, promoteBuffers will cause some initialize error in mongodb@v3.4.1
    const connection = await createConnection({
        uri: "mongodb+srv://USERNAME:PASSWORD@xxxxxxx.gcp.mongodb.net",
        dbName: "DbName",
        mongoClientOptions: {
            w: "majority",
            useNewUrlParser: true,
            ignoreUndefined: true, // preventing saving null value in server side
            promoteBuffers: true, // if you wanted to use buffer directly
            useUnifiedTopology: true,
        },
    });

    @Document()
    class BufferDocument {
        @Field()
        public _id!: ObjectID;

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

quickStartExample();
