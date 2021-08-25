// https://docs.mongodb.com/manual/reference/change-events/

import {EventEmitter} from "events";
import {ChangeStream, Collection, MongoClient, MongoError} from "mongodb";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {
    IChangeDeleteResult,
    IChangeOtherResult,
    IChangeSaveResult,
    IDocumentClass,
    IRepositoryOptions,
} from "../types";

export class ChangeStreamWrapper<TD extends IDocumentClass> extends EventEmitter {
    public readonly changeStream: ChangeStream;
    public readonly mongoClient: MongoClient;
    public readonly classObject: TD;
    public readonly dbName: string;
    public readonly collectionName: string;

    constructor(options: IRepositoryOptions<TD>) {
        super();

        this.mongoClient = options.mongoClient;
        this.dbName = options.dbName;
        this.collectionName = options.collectionName;
        this.classObject = options.classObject;

        const collection =  this.getCollection();
        this.changeStream = collection.watch([], { fullDocument: "updateLookup"});
        this.changeStream.on("change", this._onChange.bind(this));
        this.changeStream.on("error", this._onError.bind(this));
        this.changeStream.on("end", this._onEnd.bind(this));
        this.changeStream.on("close", this._onClose.bind(this));
    }

    /** @internal */
    public getCollection(): Collection {
        return this.mongoClient.db(this.dbName).collection(this.collectionName);
    }

    public isClosed(): boolean {
        return this.changeStream.closed;
    }

    public async close(): Promise<void> {
        return this.changeStream.close();
    }

    // region private methods

    // this emit all kind of event
    private _onChange(changeEvent: any) {
        const result = this._parseChangeEvent(changeEvent);
        if (result) {
            this.emit("change", result);

            // other type of events
            if (result.operationType === "insert") {
                this.emit("insert", result);
            } else if (result.operationType === "update") {
                this.emit("update", result);
            } else if (result.operationType === "delete") {
                this.emit("delete", result);
            }
        }
    }

    // fired if collection is dropped
    private _onEnd() {
        this.emit("end");
    }

    // fired if stream is closed
    private _onClose() {
        this.emit("close");
    }

    // fire if has error
    private _onError(mongoError: MongoError) {
        this.emit("error", mongoError);
    }

    private _parseChangeEvent(changeEvent: any):
        IChangeSaveResult<InstanceType<TD>> | IChangeDeleteResult<InstanceType<TD>> | IChangeOtherResult | undefined {

        const {operationType, fullDocument, documentKey, ns} = changeEvent;
        if (operationType === "insert" || operationType === "update") {
            const document = tsMongodbOrm.loadDocument(this.classObject, fullDocument);

            return {
                operationType,
                documentKey,
                document,
            };

        } else if (operationType === "delete") {
            return {
                operationType,
                documentKey,
                document: undefined,
            };

        } else {
            return {
                operationType,
                documentKey: undefined,
                document: undefined,
            };

        }
}

// endregion

}
