import {AggregationCursor} from "mongodb";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentClass} from "../types";
import {
    updateStack,
} from "../utils";

interface IAsyncIterator<R extends any> {
    next(value?: any): Promise<IteratorResult<R>>;
}

export class AggregateAsyncIterator<TD extends IDocumentClass, RD extends any> {
    public readonly classObject: TD;
    public readonly cursor: AggregationCursor;
    private _toDocument: boolean;

    constructor(options: { cursor: AggregationCursor, classObject: TD, toDocument: boolean }) {
        this.cursor = options.cursor;
        this.classObject = options.classObject;
        this._toDocument = options.toDocument;
    }

    public [Symbol.asyncIterator](): IAsyncIterator<RD> {

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

                if (this._toDocument) {
                    if (data) {
                        const document = tsMongodbOrm.loadDocument(this.classObject, data);
                        return {value: document, done: !data};
                    }

                    return {value: undefined, done: !data};
                }

                // return
                return { value: data, done: !data};
            },
        };
    }
}
