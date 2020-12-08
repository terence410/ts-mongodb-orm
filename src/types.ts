/* tslint:disable:ban-types */
import {EventEmitter} from "events";
import {ClientSession, FilterQuery, MongoClient, MongoError, TransactionOptions, UpdateQuery} from "mongodb";
import {ChangeStreamWrapper} from "./watch/ChangeStreamWrapper";

// region decorators

export type IDocumentMeta = {
    validationAction?: "warn" | "error",
    validationLevel?: "off" | "strict" | "moderate",
    collectionName: string;
};
export type IDocumentFieldMeta = {
    expireAfterSeconds?: number;
    isRequired?: boolean;
    schema?: ISchema;
};
export type IIndexObject= {
    [key: string]: number | "text",
};
export type IIndexOptions= {
    unique?: boolean,
    expireAfterSeconds?: number,
    partialFilterExpression?: any,
    sparse?: boolean,
};
export type IDocumentIndexMeta = IIndexOptions & {
    key: IIndexObject,
};

// endregion

export type IObject = {[key: string]: any};
export type IDocumentInstance = {[key: string]: any, _id: any};
export type IDocumentClass = new(...args: any[]) => IDocumentInstance;
export type IDocumentObject<T> = {[P in keyof T]: T[P]};

// region index

export type IServerIndex = IDocumentIndexMeta & {
    name: string,
    ns: string,
    v: number,
};
export type ICompareIndexResult = {
    existingIndexes: IServerIndex[],
    dropIndexes: IServerIndex[],
    createIndexes: IDocumentIndexMeta[],
};

// endregion

export type ISchemaBsonType = "double" | "string" | "object" | "array" | "binData" | "undefined" | "objectId" | "bool" |
    "date" | "null" | "regex" | "dbPointer" | "javascript" | "symbol" | "javascriptWithScope" | "int" | "timestamp" |
    "long" | "decimal" | "minKey" | "maxKey" ;
export type ISchemaType = "object" | "array" | "number" | "boolean" | "string" | "null";
export type ISchema = Partial<{
    bsonType: ISchemaBsonType | ISchemaBsonType[],
    enum: any[],
    type: ISchemaType | ISchemaType[],
    allOf: ISchema[],
    anyOf: ISchema[],
    oneOf: ISchema[],
    not: ISchema,
    multipleOf: number,
    maximum: number,
    exclusiveMaximum: boolean,
    minimum: number,
    exclusiveMinimum: boolean,
    maxLength: number,
    minLength: number,
    pattern: RegExp | string,
    maxProperties: number,
    minProperties: number,
    required: string[],
    additionalProperties: boolean | {[key: string]: ISchema},
    properties: {[key: string]: ISchema},
    patternProperties: {[key: string]: RegExp | string },
    dependencies: any,
    additionalItems: boolean | {[key: string]: ISchema},
    items: {[key: string]: ISchema} | ISchema[],
    maxItems: number,
    minItems: number,
    uniqueItems: boolean,
    title: string,
    description: string,
}>;
export type IGetValidatorResult = {
    validator?: object,
    validationLevel?: "off" | "strict" | "moderate",
    validationAction?: "warn" | "error",
};

// region connection & repository operations

export type IConnectionOptions = {mongoClient: MongoClient, dbName: string};
export type ICreateCollectionOptions = { capped?: boolean, size?: number, max?: number, strict?: boolean};
export type IGetRepositoryOptions = {
    dbName?: string,
    collectionName?: string,
};
export type IRepositoryOptions<T extends IDocumentClass> = {
    classObject: T,
    mongoClient: MongoClient
    dbName: string,
    collectionName: string,
};
export type IGranularity = "R5" | "R10" | "$20" | "$40" | "R80" | "1-2-5" | "E6" | "E12" | "E24" | "E48" | "E96" | "E192" | "POWERSOF2";
export type IAggregateOptions = {
    weakType?: false,
    pipeline?: any[]
    session?: ClientSession,
};
export type IWeakTypeAggregateOptions = {
    weakType: true,
    pipeline?: any[]
    session?: ClientSession,
};
export type IQueryOptions<TD extends IDocumentClass> = {
    weakType?: false,
    query?: FilterQuery<IDocumentObject<InstanceType<TD>>>,
    session?: ClientSession,
};
export type IWeakTypeQueryOptions<TD extends IDocumentClass> = {
    weakType: true,
    query?: FilterQuery<IDocumentObject<InstanceType<TD>>>,
    session?: ClientSession,
};
export type IQueryUpdaterOptions<TD extends IDocumentClass> = {
    weakType?: false,
    query?: UpdateQuery<IDocumentObject<InstanceType<TD>>>;
};
export type IWeakTypeQueryUpdaterOptions<TD extends IDocumentClass> = {
    weakType: true,
    query?: UpdateQuery<IDocumentObject<InstanceType<TD>>>;
};

// endregion

// region document operation

export type IInsertOptions = {session?: ClientSession, bypassDocumentValidation?: boolean};
export type IUpdateOptions = {session?: ClientSession, upsert?: boolean, bypassDocumentValidation?: boolean};
export type IDeleteOptions = {session?: ClientSession};
export type IQueryUpdaterUpdateOptions =  {upsert?: boolean};

// endregion

// region change stream
export type IChangeStreamWrapper<TD extends IDocumentClass> =
    {[P in Exclude<keyof ChangeStreamWrapper<TD>, keyof EventEmitter>]: ChangeStreamWrapper<TD>[P]}
    & ITypedEventEmitter<IChangeStreamEvents<InstanceType<TD>>>;

export type IChangeSaveResult<D extends IDocumentInstance> = {
    operationType: "insert" | "update";
    documentKey: {_id: PropType<D, "_id">};
    document: D;
};
export type IChangeDeleteResult<D extends IDocumentInstance> = {
    operationType: "delete"
    documentKey: {_id: PropType<D, "_id">};
    document?: D;
};
export type IChangeOtherResult = {
    operationType: "replace" | "drop" | "dropDatabase" | "rename" | "invalidate";
    documentKey: undefined;
    document: undefined;
};
export interface IChangeStreamEvents<D extends IDocumentInstance> {
    insert: (next: IChangeSaveResult<D>) => void;
    update: (next: IChangeSaveResult<D>) => void;
    delete: (next: IChangeDeleteResult<D>) => void;
    change: (next: IChangeSaveResult<D> | IChangeDeleteResult<D> | IChangeOtherResult ) => void;
    close: () => void;
    end: () => void;
    error: (err: MongoError) => void;
}

// endregion

// region transaction

export type IGetTransactionManagerOptions = {
    maxRetry: number,
    transactionOptions: TransactionOptions,
};
export type ITransactionMangerOptions = IGetTransactionManagerOptions &  {
    mongoClient: MongoClient;
};
export type ITransactionOptions = ITransactionMangerOptions;
export type ITransactionCallback<T extends any> = (session: ClientSession) => Promise<T>;
export type ITransactionResult<T> = {
    value: T,
    hasCommitted: boolean,
    totalRetry: number,
};

// endregion

// region lock

export type IGetLockManagerOptions = {
    collectionName: string;
    expiresIn: number;
    maxRetry: number;
    retryDelay: number;
};
export type ILockManagerOptions = IGetLockManagerOptions &  {
    mongoClient: MongoClient;
    dbName: string
};
export type ILockOptions = ILockManagerOptions & {
    lockKey: string;
};
export type ILockCallback<T extends any> = () => Promise<T>;
export type ILockResult<T> = {
    value: T,
    totalRetry: number,
};

// endregion

// region utils

export type PropType<T, K extends keyof T> = T[K];
type EventArguments<T> = [T] extends [(...args: infer U) => any] ? U : [T] extends [undefined] ? [] : [T];
export interface ITypedEventEmitter<Events> {
    addListener<E extends keyof Events>(event: E, listener: Events[E]): this;
    on<E extends keyof Events>(event: E, listener: Events[E]): this;
    once<E extends keyof Events>(event: E, listener: Events[E]): this;
    prependListener<E extends keyof Events>(event: E, listener: Events[E]): this;
    prependOnceListener<E extends keyof Events>(event: E, listener: Events[E]): this;
    removeListener<E extends keyof Events>(event: E, listener: Events[E]): this;
    off<E extends keyof Events>(event: E, listener: Events[E]): this;
    removeAllListeners<E extends keyof Events>(event?: E): this;
    setMaxListeners(maxListeners: number): this;
    getMaxListeners(): number;
    listeners<E extends keyof Events>(event: E): Function[];
    rawListeners<E extends keyof Events>(event: E): Function[];
    emit<E extends keyof Events>(event: E, ...args: EventArguments<Events[E]>): boolean;
    eventNames(): Array<string | symbol>;
    listenerCount<E extends keyof Events>(event: E): number;
    // eventNames<E extends keyof Events>(): E[]; not working somehow
}

// endregion
