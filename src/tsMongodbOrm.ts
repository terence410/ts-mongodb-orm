// https://docs.mongodb.com/manual/reference/method/js-collection/

import {
    IDocumentClass,
    IDocumentFieldMeta,
    IDocumentIndexMeta,
    IDocumentInstance,
    IDocumentMeta,
    IGetValidatorResult
} from "./types";

class TsMongodbOrm {
    public useFriendlyErrorStack = true;

    /** @internal */
    public documentMetaMap = new Map<object, IDocumentMeta>();
    /** @internal */
    public documentIndexMetaListMap = new Map<object, IDocumentIndexMeta[]>();
    /** @internal */
    public documentFieldMetaListMap = new Map<object, {[key: string]: IDocumentFieldMeta}>();

    /** @internal */
    public entityHookOfAfterLoadMap = new Map<object, string | symbol>();
    /** @internal */
    public entityHookOfBeforeInsertMap = new Map<object, string | symbol>();
    /** @internal */
    public entityHookOfBeforeUpsertMap = new Map<object, string | symbol>();
    /** @internal */
    public entityHookOfBeforeUpdateMap = new Map<object, string | symbol>();
    /** @internal */
    public entityHookOfBeforeDeleteMap = new Map<object, string | symbol>();

    /** @internal */
    public getFriendlyErrorStack(): string | undefined {
        if (this.useFriendlyErrorStack) {
            return new Error().stack;
        }
    }

    /** @internal */
    public addDocument(target: object, documentMeta: IDocumentMeta) {
        if (!this.documentMetaMap.has(target)) {
            this.documentMetaMap.set(target, documentMeta);
        }

        // also add composite indexes default if not exists
        if (!this.documentIndexMetaListMap.has(target)) {
            this.documentIndexMetaListMap.set(target, []);
        }
    }

    /** @internal */
    public addDocumentField(target: object, fieldName: string, documentFieldMeta: IDocumentFieldMeta) {
        let documentFieldMetaList = this.documentFieldMetaListMap.get(target);
        if (!documentFieldMetaList) {
            documentFieldMetaList = {};
            this.documentFieldMetaListMap.set(target, documentFieldMetaList);
        }
        documentFieldMetaList[fieldName] = documentFieldMeta;
    }

    /** @internal */
    public addDocumentIndex(target: object, documentIndexMeta: IDocumentIndexMeta) {
        let documentIndexMetaList = this.documentIndexMetaListMap.get(target);
        if (!documentIndexMetaList) {
            documentIndexMetaList = [];
            this.documentIndexMetaListMap.set(target, documentIndexMetaList);
        }

        documentIndexMetaList.push(documentIndexMeta);
    }

    /** @internal */
    public getDocumentMeta(target: object) {
        return this.documentMetaMap.get(target) as IDocumentMeta;
    }

    /** @internal */
    public getDocumentFieldMetaList(target: object): {[key: string]: IDocumentFieldMeta} {
        return this.documentFieldMetaListMap.get(target) || {};
    }

    /** @internal */
    public getFieldNames(target: object): string[] {
        const documentFieldMetaList = this.documentFieldMetaListMap.get(target) || {};
        return Object.keys(documentFieldMetaList);
    }

    /** @internal */
    public getDocumentIndexMetaList(target: object): IDocumentIndexMeta[] {
        const list1 = tsMongodbOrm.documentIndexMetaListMap.get(target) || [];
        const list2: IDocumentIndexMeta[] = [];
        const documentFieldMetaList = this.getDocumentFieldMetaList(target);

        for (const [key, documentFieldMeta] of Object.entries(documentFieldMetaList)) {
            if (documentFieldMeta.index) {
                list2.push({
                    key: {[key]: documentFieldMeta.index},
                    ...documentFieldMeta.indexOptions,
                });
            }
        }

        return [...list1, ...list2];
    }

    /** @internal */
    public getSchemaValidation(target: object): IGetValidatorResult {
        const documentFieldMetaList = this.getDocumentFieldMetaList(target);
        const documentMeta = this.getDocumentMeta(target);
        const required: string[] = [];
        const properties: {[key: string]: any} = {};
        let hasSchema = false;

        for (const [key, documentFieldMeta] of Object.entries(documentFieldMetaList)) {
            if (documentFieldMeta.isRequired) {
                required.push(key);
                hasSchema = true;
            }

            if (documentFieldMeta.schema) {
                properties[key] = documentFieldMeta.schema;
                hasSchema = true;
            }
        }

        const validator = {
            $jsonSchema: {
                bsonType: "object",
                required: required.length ? required : ["_id"],
                properties,
            },
        };

        return {
            validator: hasSchema ? validator : undefined,
            validationLevel: documentMeta.validationLevel,
            validationAction: documentMeta.validationAction,
        };
    }

    /** @internal */
    public loadDocument<T extends IDocumentClass>(classObject: T, data: any): InstanceType<T> {
        const document = new classObject() as InstanceType<T>;
        Object.assign(document, data);

        this.runHookOfAfterLoad(document);
        return document;
    }

    // endregion

    // region hooks

    /** @internal */
    public addHookOfBeforeInsert(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeInsertMap.set(classObject, propertyKey);
    }

    /** @internal */
    public getHookOfBeforeInsert(classObject: object) {
        return this.entityHookOfBeforeInsertMap.get(classObject);
    }

    /** @internal */
    public addHookOfBeforeUpsert(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeUpsertMap.set(classObject, propertyKey);
    }

    /** @internal */
    public getHookOfBeforeUpsert(classObject: object) {
        return this.entityHookOfBeforeUpsertMap.get(classObject);
    }

    /** @internal */
    public addHookOfBeforeUpdate(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeUpdateMap.set(classObject, propertyKey);
    }

    /** @internal */
    public getHookOfBeforeUpdate(classObject: object) {
        return this.entityHookOfBeforeUpdateMap.get(classObject);
    }

    /** @internal */
    public addHookOfBeforeDelete(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeDeleteMap.set(classObject, propertyKey);
    }

    /** @internal */
    public getHookOfBeforeDelete(classObject: object) {
        return this.entityHookOfBeforeDeleteMap.get(classObject);
    }

    /** @internal */
    public addHookOfAfterLoad(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfAfterLoadMap.set(classObject, propertyKey);
    }

    /** @internal */
    public getHookOfAfterLoad(classObject: object) {
        return this.entityHookOfAfterLoadMap.get(classObject);
    }

    /** @internal */
    public mergeHooks(classObject: object, subClassObject: object) {
        for (const map of [this.entityHookOfAfterLoadMap, this.entityHookOfBeforeInsertMap,
            this.entityHookOfBeforeUpsertMap, this.entityHookOfBeforeUpdateMap, this.entityHookOfBeforeDeleteMap]) {
            if (!map.has(classObject)) {
                const propertyKey = map.get(subClassObject);
                if (propertyKey) {
                    map.set(classObject, propertyKey);
                }
            }
        }
    }

    /** @internal */
    public runHookOfBeforeInsert(document: IDocumentInstance) {
        const hook = this.getHookOfBeforeInsert(document.constructor);
        if (hook) {
            (document as any)[hook]("beforeInsert");
        }
    }

    /** @internal */
    public runHookOfBeforeUpsert(document: IDocumentInstance) {
        const hook = this.getHookOfBeforeUpsert(document.constructor);
        if (hook) {
            (document as any)[hook]("beforeUpsert");
        }
    }

    /** @internal */
    public runHookOfBeforeUpdate(document: IDocumentInstance) {
        const hook = this.getHookOfBeforeUpdate(document.constructor);
        if (hook) {
            (document as any)[hook]("beforeUpdate");
        }
    }

    /** @internal */
    public runHookOfBeforeDelete(document: IDocumentInstance) {
        const hook = this.getHookOfBeforeDelete(document.constructor);
        if (hook) {
            (document as any)[hook]("beforeDelete");
        }
    }

    /** @internal */
    public runHookOfAfterLoad(document: IDocumentInstance) {
        const hook = this.getHookOfAfterLoad(document.constructor);
        if (hook) {
            (document as any)[hook]("afterLoad");
        }
    }

    // endregion
}

export const tsMongodbOrm = new TsMongodbOrm();
