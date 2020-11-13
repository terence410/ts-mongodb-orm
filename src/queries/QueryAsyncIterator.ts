import {Cursor} from "mongodb";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentClass} from "../types";
import {
    updateStack,
} from "../utils";

interface IAsyncIterator<T> {
    next(value?: any): Promise<IteratorResult<T>>;
}

export class QueryAsyncIterator<TD extends IDocumentClass> {
    public readonly cursor: Cursor;
    public readonly classObject: TD;

    constructor(options: { classObject: TD, cursor: Cursor }) {
        this.cursor = options.cursor;
        this.classObject = options.classObject;
    }

    public [Symbol.asyncIterator](): IAsyncIterator<InstanceType<TD>> {

        return {
            next: async () => {
                // findOne next
                let data: any;

                const friendlyErrorStack = tsMongodbOrm.getFriendlyErrorStack();
                try {
                    data = await this.cursor.next();
                } catch (err) {
                    throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
                }

                let document!: InstanceType<TD>;
                if (data) {
                    document = new this.classObject() as InstanceType<TD>;
                    Object.assign(document, data);
                }

                return { value: document, done: !data};
            },
        };
    }
}
