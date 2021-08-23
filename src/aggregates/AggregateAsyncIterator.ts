import {AggregationCursor} from "mongodb";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {
    updateStack,
} from "../utils";

interface IAsyncIterator<R extends any> {
    next(value?: any): Promise<IteratorResult<R>>;
}

export class AggregateAsyncIterator<R extends any> {
    public readonly cursor: AggregationCursor;

    constructor(options: { cursor: AggregationCursor }) {
        this.cursor = options.cursor;
    }

    public [Symbol.asyncIterator](): IAsyncIterator<R> {

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

                // return
                return { value: data, done: !data};
            },
        };
    }
}
