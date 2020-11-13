
// https://docs.mongodb.com/manual/tutorial/expire-data/

import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentFieldMeta} from "../types";

export function Field(documentFieldMeta: Partial<IDocumentFieldMeta> = {}) {
    return (target: object, fieldName: string) => {
        const newDocumentFieldMeta: IDocumentFieldMeta = Object.assign({
        }, documentFieldMeta);

        tsMongodbOrm.addDocumentField(target.constructor, fieldName, newDocumentFieldMeta);
    };
}
