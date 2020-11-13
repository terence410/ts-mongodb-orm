import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentClass, IDocumentInstance, IQueryUpdaterOptions, IQueryUpdaterUpdateOptions} from "../types";
import {updateStack} from "../utils";
import {Query} from "./Query";
import {QueryBaseUpdater} from "./QueryBaseUpdater";

export class QueryUpdater<TD extends IDocumentClass, AD extends IDocumentInstance>  extends QueryBaseUpdater<AD> {
    constructor(protected query: Query<TD, AD>, options: IQueryUpdaterOptions<TD> = {}) {
        super(options.query);
    }

    public async findOneAndUpdate(options: IQueryUpdaterUpdateOptions = {}): Promise<InstanceType<TD> | undefined> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.findOneAndUpdate(this.query.nativeQuery,
                this.nativeQuery, {session: this.query.session, returnOriginal: false, ...options});

            // return a document
            if (mongodbResponse.value) {
                return this.query.create(mongodbResponse.value);
            }

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

    }

    public async updateOne(options: IQueryUpdaterUpdateOptions = {}): Promise<number> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.updateOne(this.query.nativeQuery,
                this.nativeQuery, {session: this.query.session, ...options});
            return mongodbResponse.result.n;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async updateMany(options: IQueryUpdaterUpdateOptions = {}): Promise<number> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse = await collection.updateMany(this.query.nativeQuery,
                this.nativeQuery, {session: this.query.session, ...options});
            return mongodbResponse.result.n;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }
}
