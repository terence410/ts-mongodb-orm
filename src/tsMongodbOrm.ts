// https://docs.mongodb.com/manual/reference/method/js-collection/

import {IDocumentFieldMeta, IDocumentIndexMeta, IDocumentMeta} from "./types";

class TsMongodbOrm {
    public useFriendlyErrorStack = true;

    /** @internal */
    public documentMetaMap = new Map<object, IDocumentMeta>();
    /** @internal */
    public documentIndexMetaListMap = new Map<object, IDocumentIndexMeta[]>();
    /** @internal */
    public documentFieldMetaListMap = new Map<object, {[key: string]: IDocumentFieldMeta}>();

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

    // endregion
}

export const tsMongodbOrm = new TsMongodbOrm();
