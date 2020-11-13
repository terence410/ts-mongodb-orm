import {IDocumentInstance} from "../types";

export class QueryBaseUpdater<D extends IDocumentInstance> {
    constructor(public nativeQuery: any = {}) {
    }

    public set<K extends keyof D>(fieldName: K, value: D[K]) {
        this._createDefaultOperation("$set");
        this.nativeQuery.$set[fieldName] = value;

        return this;
    }

    public inc<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultOperation("$inc");
        this.nativeQuery.$inc[fieldName] = value;

        return this;
    }

    public pushAt<K extends keyof D>(fieldName: K, position: number, ...value: any[]): this {
        this._createDefaultPush(fieldName);
        this.nativeQuery.$push[fieldName].$each = value;
        this.nativeQuery.$push[fieldName].$position = position;
        return this;
    }

    public push<K extends keyof D>(fieldName: K, ...value: any[]): this {
        this._createDefaultPush(fieldName);
        this.nativeQuery.$push[fieldName].$each = value;
        return this;
    }

    public pop<K extends keyof D>(fieldName: K, total: 1 | -1) {
        this._createDefaultOperation("$pop");
        this.nativeQuery.$pop[fieldName] = total;
        return this;
    }

    public pullAll<K extends keyof D>(fieldName: K, ...value: any[]) {
        this._createDefaultOperation("$pullAll");
        this.nativeQuery.$pullAll[fieldName] = value;
        return this;
    }

    public addToSet<K extends keyof D>(fieldName: K, ...value: any[]) {
        this._createDefaultAddToSet(fieldName);
        this.nativeQuery.$addToSet[fieldName].$each = value;
        return this;
    }

    public sort<K extends keyof D>(fieldName: K, value: 1 | -1 | {[key: string]: 1 | 0}): this {
        this._createDefaultPush(fieldName);
        this.nativeQuery.$push[fieldName].$sort = value;

        return this;
    }

    public slice<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultPush(fieldName);
        this.nativeQuery.$push[fieldName].$slice = value;

        return this;

    }

    // region private methods

    protected resetUpdateQuery() {
        this.nativeQuery = {};
    }

    private _createDefaultOperation(key: string) {
        if (!this.nativeQuery[key]) {
            this.nativeQuery[key] = {};
        }
    }

    private _createDefaultPush<K extends keyof D>(fieldName: K) {
        if (!this.nativeQuery.$push) {
            this.nativeQuery.$push = {};
        }

        if (!this.nativeQuery.$push[fieldName]) {
            this.nativeQuery.$push[fieldName] = {$each: []};
        }
    }

    private _createDefaultAddToSet<K extends keyof D>(fieldName: K) {
        if (!this.nativeQuery.$addToSet) {
            this.nativeQuery.$addToSet = {};
        }

        if (!this.nativeQuery.$addToSet[fieldName]) {
            this.nativeQuery.$addToSet[fieldName] = {$each: []};
        }
    }

    // endregion
}
