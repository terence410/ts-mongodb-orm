import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentIndexMeta, IIndexObject, IIndexOptions} from "../types";

export function Index(indexObject: IIndexObject = {}, indexOptions: IIndexOptions = {}) {
    return (target: object) => {
        const documentIndexMeta: IDocumentIndexMeta = {
            key: indexObject,
            ...indexOptions,
        };
        tsMongodbOrm.addDocumentIndex(target, documentIndexMeta);
    };
}
