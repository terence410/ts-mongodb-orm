import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentClass} from "../types";
import {updateStack} from "../utils";
import {Query} from "./Query";

export class QueryDeleter<TD extends IDocumentClass> {
    constructor(protected query: Query<TD, any>) {
    }

    public async findOneAndDelete(): Promise<InstanceType<TD> | undefined> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse =  await collection.findOneAndDelete(this.query.nativeQuery,
                {session: this.query.session});

            // return a document
            if (mongodbResponse.value) {
                const document =  tsMongodbOrm.loadEntity(this.query.classObject, mongodbResponse.value);
                return document;
            }

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async deleteOne(): Promise<number> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse =  await collection.deleteOne(this.query.nativeQuery, {session: this.query.session});
            return mongodbResponse.deletedCount || 0;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async deleteMany(): Promise<number> {
        const collection = this.query.getCollection();

        const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
        try {
            const mongodbResponse =  await collection.deleteMany(this.query.nativeQuery, {session: this.query.session});
            return mongodbResponse.deletedCount || 0;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }
}
