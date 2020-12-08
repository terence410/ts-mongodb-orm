import {TsMongodbOrmError} from "../errors/TsMongodbOrmError";
import {tsMongodbOrm} from "../tsMongodbOrm";
import {IDocumentMeta} from "../types";

export function Document(documentMeta: Partial<IDocumentMeta> = {}) {
    return (target: object) => {
        const newDocumentMeta: IDocumentMeta = Object.assign({
            connectionName: "default",
            dbName: "",
            collectionName: (target as any).name,
        }, documentMeta);

        // it has a subclass, add all it's column
        let subClassTarget = Object.getPrototypeOf(target);
        while (true) {
            // no more sub class
            if (!(subClassTarget instanceof Function)) {
                break;
            }

            // get the sub class fields
            const subClassFields = tsMongodbOrm.getDocumentFieldMetaList(subClassTarget);
            for (const [fieldName, documentFieldMeta] of Object.entries(subClassFields)) {
                tsMongodbOrm.addDocumentField(target, fieldName, documentFieldMeta);
            }

            // copy the hooks from subclass
            tsMongodbOrm.mergeHooks(target, subClassTarget);

            // continue to findOne sub class
            subClassTarget = Object.getPrototypeOf(subClassTarget);
        }

        // get existing entity columns
        const fieldNames = tsMongodbOrm.getFieldNames(target);

        // check if we have a id column
        if (!fieldNames.includes("_id")) {
            throw new TsMongodbOrmError(`(${(target as any).name}) Document must define a _id field.`);
        }

        tsMongodbOrm.addDocument(target, newDocumentMeta);
    };
}
