import {ClientSession, MongoClient} from "mongodb";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {
    IDocumentClass, IDocumentInstance, IExplain,
    IQueryOptions, IQueryUpdaterOptions,
    IRepositoryOptions,
    IWeakTypeQueryUpdaterOptions,
} from "../types";
import {
    updateStack,
} from "../utils";
import {QueryAsyncIterator} from "./QueryAsyncIterator";
import {QueryDeleter} from "./QueryDeleter";
import {QueryLogic} from "./QueryLogic";
import {QueryUpdater} from "./QueryUpdater";

export class Query<TD extends IDocumentClass, D extends IDocumentInstance = InstanceType<TD>> extends QueryLogic<D> {
    public readonly mongoClient: MongoClient;
    public readonly classObject: TD;
    public readonly dbName: string;
    public readonly collectionName: string;
    public readonly session?: ClientSession;

    // region connection methods
    private _skip?: number;
    private _limit?: number;
    private _sort?: any;

    constructor(options: IRepositoryOptions<TD>, queryOptions: IQueryOptions<TD> = {}) {
        super(queryOptions.filter);

        this.mongoClient = options.mongoClient;
        this.classObject = options.classObject;
        this.dbName = options.dbName;
        this.collectionName = options.collectionName;
        this.session = queryOptions.session;
    }

    // region public internal methods

    /** @internal */
    public getCollection() {
        return this.mongoClient.db(this.dbName).collection(this.collectionName);
    }

    // endregion

    // region public operation methods

    public getUpdater(options?: IQueryUpdaterOptions<TD>): QueryUpdater<TD, InstanceType<TD>>;
    public getUpdater(options?: IWeakTypeQueryUpdaterOptions<TD>): QueryUpdater<TD, any>;
    public getUpdater(options: any) {
        return new QueryUpdater<any, any>(this, options);
    }

    public getDeleter(): QueryDeleter<TD> {
        return new QueryDeleter(this);
    }

    public sort<K extends keyof D>(fieldName: K | "$natural", value: 1 | -1): this {
        if (!this._sort) {
            this._sort = {};
        }

        this._sort[fieldName] = value;
        return this;
    }

    public skip(value: number) {
        this._skip = value;
        return this;
    }

    public limit(value: number) {
        this._limit = value;
        return this;
    }

    // endregion

    // region public methods

    public getAsyncIterator() {
        const collection = this.getCollection();
        const cursor = collection.find(this.nativeFilter,
            {session: this.session, skip: this._skip, limit: this._limit, sort: this._sort});
        return new QueryAsyncIterator({classObject: this.classObject, cursor});
    }

    public async findOne() {
        const collection = this.getCollection();
        const cursor = collection.find(this.nativeFilter,
            {session: this.session, skip: this._skip, limit: this._limit, sort: this._sort});

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const data = await cursor.next();
            if (data) {
                return tsMongodbOrm.loadDocument(this.classObject, data);
            }

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async findMany() {
        const collection = this.getCollection();
        const cursor = collection.find(this.nativeFilter,
            {session: this.session, skip: this._skip, limit: this._limit, sort: this._sort});

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const results = await cursor.toArray();
            const documents: Array<InstanceType<TD>> = [];
            for (const data of results) {
                const document = tsMongodbOrm.loadDocument(this.classObject, data);
                documents.push(document);
            }

            return documents;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async count(): Promise<number> {
        const collection = this.getCollection();
        const cursor =  collection.find(this.nativeFilter, {session: this.session});

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            return await cursor.count();

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async explain(): Promise<IExplain> {
        const collection = this.getCollection();
        const cursor = collection.find(this.nativeFilter,
            {session: this.session, skip: this._skip, limit: this._limit, sort: this._sort});

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            return await cursor.explain() as IExplain;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }
}
