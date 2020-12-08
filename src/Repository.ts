import {ClientSession, Collection, MongoClient, MongoError, ObjectID} from "mongodb";
import {Aggregate} from "./aggregates/Aggregate";
import {TsMongodbOrmError} from "./errors/TsMongodbOrmError";
import {Query} from "./queries/Query";
import {tsMongodbOrm} from "./tsMongodbOrm";
import {
    IAggregateOptions,
    IChangeStreamWrapper,
    ICompareIndexResult,
    ICreateCollectionOptions,
    IDeleteOptions,
    IDocumentClass,
    IDocumentIndexMeta,
    IDocumentObject, IInsertOptions,
    IObject,
    IQueryOptions,
    IRepositoryOptions,
    IUpdateOptions,
    IWeakTypeAggregateOptions,
    IWeakTypeQueryOptions, PropType,
} from "./types";
import {updateStack} from "./utils";
import {ChangeStreamWrapper} from "./watch/ChangeStreamWrapper";

export class Repository<TD extends IDocumentClass> {
    public readonly mongoClient: MongoClient;
    public readonly classObject: TD;
    public readonly dbName: string;
    public readonly collectionName: string;

    constructor(options: IRepositoryOptions<TD>) {
        this.mongoClient = options.mongoClient;
        this.classObject = options.classObject;
        this.dbName = options.dbName;
        this.collectionName = options.collectionName;
    }

    // region index

    public async dropIndex() {
        const collection = this.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            await collection.dropIndexes();
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async addIndex() {
        // get the compare first
        const compareResult = await this.compareIndex();
        const collection = this.getCollection();

        // new index
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            for (const createIndex of compareResult.createIndexes) {
                const {key, ...params} = createIndex;
                await collection.createIndex(key, params);
            }
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

    }

    public async syncIndex() {
        // get the compare first
        const compareResult = await this.compareIndex();
        const collection = this.getCollection();

        // drop index
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            for (const dropIndex of compareResult.dropIndexes) {
                await collection.dropIndex(dropIndex.name);
            }

            // new index
            for (const createIndex of compareResult.createIndexes) {
                const {key, ...params} = createIndex;
                await collection.createIndex(key, params);
            }
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async compareIndex(): Promise<ICompareIndexResult> {
        const collection = await this.createCollection();

        // get existing index
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        let existingServerIndexes: any[];
        try {
            existingServerIndexes = await collection.indexes();
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

        // prepare results
        const documentIndexMetaList = tsMongodbOrm.documentIndexMetaListMap.get(this.classObject) || [];
        const createIndexes: any[] = [];
        const dropIndexes: any[] = [];

        // check extra Index from server
        for (const serverIndex of existingServerIndexes) {
            const serverKeyString = JSON.stringify(serverIndex.key);
            const serverTextIndex = this._parseServerTextIndex(serverIndex);

            // skip _id index
            if (serverKeyString === `{"_id":1}`) {
                continue;
            }

            let hasIndex = false;
            for (const documentIndexMeta of documentIndexMetaList) {
                const clientKeyString = JSON.stringify(documentIndexMeta.key);
                let isKeyMatch = false;

                // if it's text index, we use another approach to check
                if (serverTextIndex) {
                    const clientTextIndex = this._parseClientTextIndex(documentIndexMeta);
                    isKeyMatch = serverTextIndex.index === clientTextIndex?.index && serverTextIndex.keyString === clientTextIndex?.keyString;
                } else {
                    isKeyMatch = clientKeyString === serverKeyString;
                }

                // if key are the same, we check other options are the same or not
                if (isKeyMatch) {
                    // if options are not the same, we need to drop this index and recreate one
                    if (serverIndex.unique !== documentIndexMeta.unique
                        || serverIndex.expireAfterSeconds !== documentIndexMeta.expireAfterSeconds
                        || serverIndex.sparse !== documentIndexMeta.sparse
                        || JSON.stringify(serverIndex.partialFilterExpression) !== JSON.stringify(documentIndexMeta.partialFilterExpression)
                    ) {
                        createIndexes.push(documentIndexMeta);
                    } else {
                        hasIndex = true;
                    }

                    break;
                }
            }

            // update array
            if (!hasIndex) {
                dropIndexes.push(serverIndex);
            }
        }

        // check missed index from client
        for (const documentIndexMeta of documentIndexMetaList) {
            const clientKeyString = JSON.stringify(documentIndexMeta.key);
            const clientTextIndex = this._parseClientTextIndex(documentIndexMeta);

            let hasIndex = false;
            for (const serverIndex of existingServerIndexes) {
                if (clientTextIndex) {
                    const serverTextIndex = this._parseServerTextIndex(serverIndex);
                    if (serverTextIndex) {
                        hasIndex = serverTextIndex?.index === clientTextIndex.index && serverTextIndex?.keyString === clientTextIndex.keyString;
                        break;
                    }
                } else {
                    const serverKeyString = JSON.stringify(serverIndex.key);
                    if (clientKeyString === serverKeyString) {
                        hasIndex = true;
                        break;
                    }
                }
            }

            // update array
            if (!hasIndex) {
                createIndexes.push(documentIndexMeta);
            }
        }

        return {
            existingIndexes: existingServerIndexes,
            dropIndexes,
            createIndexes,
        };
    }

    // endregion

    // region collection & db

    public async createCollection(options: ICreateCollectionOptions = {}) {
        const db = this.getDb();
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        const validation = tsMongodbOrm.getSchemaValidation(this.classObject);

        try {
            const collection = await db.createCollection(this.collectionName, {
                validator: validation.validator,
                validationAction: validation.validationAction,
                validationLevel: validation.validationLevel,
                capped: options.capped,
                size: options.size,
                max: options.max,
            });
            return collection;

        } catch (err) {
            if (!options.strict) {
                // in case this still prompt for error in strict mode
                if ((err instanceof MongoError) && err.message.match(/already exists/)) {
                    return this.getCollection();
                }
            }

            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async dropCollection() {
        const db = this.getDb();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            return await db.dropCollection(this.collectionName);
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public getCollection(): Collection {
        return this.mongoClient.db(this.dbName).collection(this.collectionName);
    }

    public async syncSchemaValidation() {
        const db = this.getDb();
        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        const validation = tsMongodbOrm.getSchemaValidation(this.classObject);

        try {
            const collection = await db.command({
                collMod: this.collectionName,
                validator: validation.validator || {},
                validationAction: validation.validationAction || "error", // default
                validationLevel: validation.validationLevel || "strict", // default
            });

            return validation;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public getDb() {
        return this.mongoClient.db(this.dbName);
    }

    // endregion

    // region operations

    public async findOne(filter: Partial<IDocumentObject<InstanceType<TD>>> | ObjectID,
                         options: {session?: ClientSession} = {}): Promise<InstanceType<TD> | undefined> {
        const collection = this.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.findOne(filter, options);

            if (mongodbResponse) {
                return tsMongodbOrm.loadEntity(this.classObject, mongodbResponse);
            }

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public watch(): IChangeStreamWrapper<TD> {
        return new ChangeStreamWrapper({
            mongoClient: this.mongoClient,
            classObject: this.classObject,
            dbName: this.dbName,
            collectionName: this.collectionName,
        });
    }

    public aggregate(options?: IAggregateOptions): Aggregate<TD, InstanceType<TD>>;
    public aggregate(options?: IWeakTypeAggregateOptions): Aggregate<TD, any>;
    public aggregate(options: any): any {
        return new Aggregate({
            mongoClient: this.mongoClient,
            classObject: this.classObject,
            dbName: this.dbName,
            collectionName: this.collectionName,
        }, options || {});
    }

    public query(options?: IQueryOptions<TD>): Query<TD, InstanceType<TD>>;
    public query(options?: IWeakTypeQueryOptions<TD>): Query<TD, any>;
    public query(options: any): any {
        return new Query({
            mongoClient: this.mongoClient,
            classObject: this.classObject,
            dbName: this.dbName,
            collectionName: this.collectionName,
        }, options || {});
    }

    // endregion

    // region documents operations
    public create(values: Partial<InstanceType<TD>> = {}): InstanceType<TD> {
        const document = new this.classObject() as InstanceType<TD>;
        Object.assign(document, values);
        return document;
    }

    public async insertMany(documents: Array<InstanceType<TD>>, options?: IInsertOptions): Promise<Array<InstanceType<TD>>> {
        const collection = this.getCollection();

        const setList: any[] = [];
        for (const document of documents) {
            const saveData = this._getSaveData(document);
            setList.push(saveData.$set);
        }

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.insertMany(setList, options);
            for (const [index, id] of Object.entries(mongodbResponse.insertedIds)) {
                documents[Number(index)]._id = id;
            }

            return documents;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async insert(document: InstanceType<TD>, options: IInsertOptions = {}) {
        const collection = this.getCollection();
        const saveData = this._getSaveData(document);

        // hook
        tsMongodbOrm.runHookOfBeforeInsert(document);

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.insertOne(saveData.$set, options);

            // update the id
            document._id = mongodbResponse.insertedId;
            return document;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async update(document: InstanceType<TD>, options: IUpdateOptions = {}) {
        const collection = this.getCollection();
        const _id = document._id;
        const saveData: any = this._getSaveData(document);

        // hook
        if (options.upsert) {
            tsMongodbOrm.runHookOfBeforeUpsert(document);
        } else {
            tsMongodbOrm.runHookOfBeforeUpdate(document);
        }

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.updateOne({_id}, saveData, options);

            // if document not exist for update
            if (mongodbResponse.result.n === 0) {
                throw new TsMongodbOrmError(`Document, _id: ${_id}, not exists for save.`);
            }

            return document;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async delete(document: InstanceType<TD>, options?: IDeleteOptions): Promise<InstanceType<TD>>;
    public async delete(objectId: ObjectID, options?: IDeleteOptions): Promise<ObjectID>;
    public async delete(documentOrObjectId: any, options: IDeleteOptions = {}) {
        const collection = this.getCollection();
        const _id = (documentOrObjectId instanceof ObjectID) ? documentOrObjectId : documentOrObjectId._id;

        // hook
        if (!(documentOrObjectId instanceof ObjectID)) {
            tsMongodbOrm.runHookOfBeforeDelete(documentOrObjectId);
        }

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.deleteOne({_id}, options);

            if (mongodbResponse.result.n === 0) {
                throw new TsMongodbOrmError(`Document, _id: ${_id}, not exists for delete.`);
            }

            return documentOrObjectId;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    // endregion

    // region private methods

    private _getSaveData(document: IObject) {
        let $unset: IObject | undefined;
        const $set: IObject = {};

        const fieldNames = tsMongodbOrm.getFieldNames(this.classObject);
        for (const fieldName of fieldNames) {
            if (document[fieldName] === undefined) {
                if ($unset === undefined) {
                    $unset = {};
                }

                $unset[fieldName] = "";
            } else {
                $set[fieldName] = document[fieldName];
            }
        }

        return {$set, $unset};
    }

    private _parseServerTextIndex(serverIndex: any): {index: number, keyString: string} | undefined {
        if (serverIndex.textIndexVersion && serverIndex.weights && serverIndex.key._fts === "text") {
            const index = Object.keys(serverIndex.key).indexOf("_fts");
            const keyString = JSON.stringify(Object.entries(serverIndex.key).filter(x => x[0] !== "_fts" && x[0] !== "_ftsx"));
            return {index, keyString};
        }
    }

    private _parseClientTextIndex(documentIndexMeta: IDocumentIndexMeta): {index: number, keyString: string} | undefined {
        const index = Object.values(documentIndexMeta.key).indexOf("text");
        if (index >= 0) {
            const keyString = JSON.stringify(Object.entries(documentIndexMeta.key).filter(x => x[1] !== "text"));
            return {index, keyString};
        }
    }

    // endregion
}
