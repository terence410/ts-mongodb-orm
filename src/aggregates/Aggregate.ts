// https://docs.mongodb.com/manual/reference/operator/aggregation/count/
import {AggregationCursor, ClientSession, MongoClient} from "mongodb";
import {QueryLogic} from "../queries/QueryLogic";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {
    IAggregateOptions,
    IDocumentClass,
    IDocumentInstance, 
    IGranularity,
    IRepositoryOptions,
} from "../types";
import { updateStack} from "../utils";
import {AggregateAsyncIterator} from "./AggregateAsyncIterator";

type IExpression = any;
type IMapExpression = {[key: string]: IExpression};
type IMapArrayExpression = {[key: string]: IExpression[]};

//  the functional programming is to make things strong type and ease of use, while the nativeFilter
// will not be structurally the same as the functional callback
export class Aggregate<TD extends IDocumentClass, D extends IDocumentInstance = InstanceType<TD>, RD extends any = {[key: string]: any}> {
    public readonly mongoClient: MongoClient;
    public readonly classObject: TD;
    public readonly dbName: string;
    public readonly collectionName: string;
    public readonly aggregateOptions: IAggregateOptions;
    public nativePipeline: Array<{[key: string]: any}>;

    private _toDocument = false;

    constructor(options: IRepositoryOptions<TD>, aggregateOptions: IAggregateOptions = {}) {
        this.mongoClient = options.mongoClient;
        this.classObject = options.classObject;
        this.dbName = options.dbName;
        this.collectionName = options.collectionName;
        this.aggregateOptions = aggregateOptions;
        this.nativePipeline = aggregateOptions.pipeline || [];
    }

    // region public internal methods

    /** @internal */
    public getCollection() {
        return this.mongoClient.db(this.dbName).collection(this.collectionName);
    }

    // endregion

    // region pipeline methods

    // tested
    public addFields(expression: IMapExpression) {
        this._createPipeline("$addFields", expression);
        return this;
    }

    // tested
    public bucket(options: {groupBy: IExpression, boundaries: any[], default?: string, output?: IMapExpression}) {
        this._createPipeline("$bucket", options);
        return this;
    }

    // tested
    public bucketAuto(options: {groupBy: IExpression, buckets: number, output?: IMapExpression, granularity?: IGranularity}) {
        this._createPipeline("$bucketAuto", options);
        return this;
    }

    // tested
    public collStats(options: {latencyStats?: {histograms?: boolean}, storageStats?: {scale?: number}, count?: {}, queryExecStats?: {}}) {
        this._createPipeline("$collStats", options);
        return this;
    }

    // tested
    public count<K extends keyof D>(fieldName: K | string) {
        this._createPipeline("$count", fieldName);
        return this;
    }

    // not tested yet
    public currentOp(options: {allUsers?: boolean, idleConnections?: boolean, idleCursors?: boolean, idleSessions?: boolean, localOps?: boolean}) {
        this._createPipeline("$currentOp", options);
        return this;
    }

    // tested
    public facet(options: IMapArrayExpression) {
        this._createPipeline("$facet", options);
        return this;
    }

    // not tested yet
    public geoNear(options: {near: object, distanceField: string, spherical?: boolean, maxDistance?: number, query?: any,
        distanceMultiplier?: number, includeLocs?: string, uniqueDocs?: boolean, minDistance?: number, key?: string}) {
        this._createPipeline("$geoNear", options);
        return this;
    }

    // tested
    public graphLookup(options: {from: string, startWith: IExpression, connectFromField: string, connectToField: string, as: string,
        maxDepth?: number, depthField?: string, restrictSearchWithMatch?: string}) {
        this._createPipeline("$graphLookup", options);
        return this;
    }

    // tested
    public group(expression: IMapExpression) {
        this._createPipeline("$group", expression);
        return this;
    }

    // not tested yet
    public indexStats() {
        this._createPipeline("$indexStats", {});
        return this;
    }

    // tested
    public limit(value: number) {
        this._createPipeline("$limit", value);
        return this;
    }

    // not tested yet
    public listLocalSessions(options: {users?: Array<{user: string, db: string}>, allUsers?: true}) {
        this._createPipeline("$listLocalSessions", options);
        return this;
    }

    // not tested yet
    public listSessions(options: {users?: Array<{user: string, db: string}>, allUsers?: true}) {
        this._createPipeline("$listSessions", options);
        return this;
    }

    // tested
    public lookup(options: {from: string, as: string, localField?: string, foreignField?: string, let?: IMapExpression, pipeline?: any[], }) {
        this._createPipeline("$lookup", options);
        return this;
    }

    // tested
    public match(expression: (query: QueryLogic<D>) => any) {
        // execute the expression first
        const baseQuery = new QueryLogic({});
        expression(baseQuery);

        this._createPipeline("$match", baseQuery.nativeFilter);
        return this;
    }

    // tested
    public merge(options: {
        into: string | {db: string, coll: string},
        on?: string | string[],
        let?: IMapExpression,
        whenMatched?: "replace" | "keepExisting" | "merge" | "fail" | "pipeline",
        whenNotMatched?: "insert" | "discard" | "fail"}) {

        this._createPipeline("$merge", options);
        return this;
    }

    // tested
    public out(options: string | {db: string, coll: string}) {
        this._createPipeline("$out", options);
        return this;
    }

    // not tested yet
    public planCacheStats() {
        this._createPipeline("planCacheStats", {});
        return this;
    }

    // tested
    public project(expression: {[key: string]: 1 | 0 | boolean | IExpression}) {
        this._createPipeline("$project", expression);
        return this;
    }

    // tested
    public redact(expression: IExpression) {
        this._createPipeline("$redact", expression);
        return this;
    }

    // tested
    public replaceRoot(expression: {newRoot: IExpression}) {
        this._createPipeline("$replaceRoot", expression);
        return this;
    }

    // tested
    public replaceWith(expression: IExpression) {
        this._createPipeline("$replaceWith", expression);
        return this;
    }

    // tested
    public sample(value: number) {
        this._createPipeline("$sample", {size: value});
        return this;
    }

    // tested
    public set(expression: IMapExpression) {
        return this.addFields(expression);
    }

    // tested
    public skip(value: number) {
        this._createPipeline("$skip", value);
        return this;
    }

    // tested
    public sort(expression: {[key: string]: 1 | -1 | { $meta: "textScore" }}): this {
        this._createPipeline("$sort", expression);
        return this;
    }

    // tested
    public sortByCount(fieldName: IExpression): this {
        this._createPipeline("$sortByCount", fieldName);
        return this;
    }

    public unionWith(options: string | {coll: string, pipeline: any[]}): this {
        this._createPipeline("$unionWith", options);
        return this;
    }

    // tested
    public unset(fieldNames: string | string []) {
        this._createPipeline("$unset", fieldNames);
        return this;
    }

    // tested
    public unwind(fieldName: string | {path: string, includeArrayIndex?: string, preserveNullAndEmptyArrays?: boolean}) {
        this._createPipeline("$unwind", fieldName);
        return this;
    }

    // endregion

    // region public methods

    public toDocument(): Aggregate<TD, D, InstanceType<TD>> {
        this._toDocument = true;
        return this as any;
    }

    public getAsyncIterator() {
        const cursor = this._getCursor();
        return new AggregateAsyncIterator<TD, RD>({cursor, classObject: this.classObject, toDocument: this._toDocument});
    }

    public async explain(): Promise<any> {
        const cursor = this._getCursor();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            return await cursor.explain();
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async findOne(): Promise<RD | null | undefined> {
        const cursor = this._getCursor();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        let result: any;
        try {
            result = await cursor.next();
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

        if (this._toDocument) {
            if (result) {
                return tsMongodbOrm.loadDocument(this.classObject, result) as any;
            } else {
                return undefined;
            }
        } else {
            return result;
        }
    }

    public async findMany(): Promise<RD[]> {
        const cursor = this._getCursor();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        let result: any;
        try {
            result = await cursor.toArray();
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

        if (this._toDocument) {
            return result.map((x: any) => tsMongodbOrm.loadDocument(this.classObject, x));
        }

        return result;
    }

    // endregion

    // region private methods

    private _getCursor(): AggregationCursor {
        const collection = this.getCollection();
        return collection.aggregate(this.nativePipeline, {
            session: this.aggregateOptions.session,
            allowDiskUse: this.aggregateOptions.allowDiskUse,
            bypassDocumentValidation: this.aggregateOptions.bypassDocumentValidation,
            maxTimeMS: this.aggregateOptions.maxTimeMS,
        });
    }

    private _createPipeline(type: string, data: any): void {
        const pipeline = {[type]: data};
        this.nativePipeline.push(pipeline);
        return data;
    }

    // endregion
}
