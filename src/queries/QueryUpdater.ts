import {tsMongodbOrm} from "../tsMongodbOrm";
import {
    IDocumentClass,
    IDocumentInstance,
    IFindOneAndUpdateOptions,
    IQueryUpdaterOptions,
    IUpdateOptions,
} from "../types";
import {updateStack} from "../utils";
import {Query} from "./Query";
import {QueryBaseUpdater} from "./QueryBaseUpdater";

export class QueryUpdater<TD extends IDocumentClass, AD extends IDocumentInstance>  extends QueryBaseUpdater<AD> {
    constructor(protected query: Query<TD, AD>, options: IQueryUpdaterOptions<TD> = {}) {
        super(options.filter);
    }

    public async findOneAndUpdate(options: IFindOneAndUpdateOptions = {}): Promise<InstanceType<TD> | undefined> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.findOneAndUpdate(this.query.nativeFilter,
                this.nativeFilter, {session: this.query.session, returnDocument: "after", ...options});

            // return a document
            if (mongodbResponse.value) {
                return tsMongodbOrm.loadDocument(this.query.classObject, mongodbResponse.value);
            }

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

    }

    public async updateOne(options: IUpdateOptions = {}): Promise<number> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.updateOne(this.query.nativeFilter,
                this.nativeFilter, {session: this.query.session, ...options});
            return mongodbResponse.modifiedCount + mongodbResponse.upsertedCount;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async updateMany(options: IUpdateOptions = {}): Promise<number> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.updateMany(this.query.nativeFilter,
                this.nativeFilter, {session: this.query.session, ...options});
            return mongodbResponse.modifiedCount + mongodbResponse.upsertedCount;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }
}
