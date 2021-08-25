import {IDocumentInstance} from "../types";

export class QueryBaseUpdater<D extends IDocumentInstance> {
    constructor(public nativeFilter: any = {}) {
    }

    // region field update operations

    public set<K extends keyof D>(fieldName: K, value: D[K]) {
        this._createDefaultOperation("$set");
        this.nativeFilter.$set[fieldName] = value;

        return this;
    }

    public setOnInsert<K extends keyof D>(fieldName: K, value: D[K]) {
        this._createDefaultOperation("$setOnInsert");
        this.nativeFilter.$setOnInsert[fieldName] = value;

        return this;
    }

    public unset<K extends keyof D>(fieldName: K) {
        this._createDefaultOperation("$unset");
        this.nativeFilter.$unset[fieldName] = 1;

        return this;
    }

    public rename<K extends keyof D>(fieldName: K, newFiledName: string) {
        this._createDefaultOperation("$rename");
        this.nativeFilter.$rename[fieldName] = newFiledName;

        return this;
    }

    public currentDate<K extends keyof D>(fieldName: K) {
        this._createDefaultOperation("$currentDate");
        this.nativeFilter.$currentDate[fieldName] = { $type: "date" };

        return this;
    }

    public inc<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultOperation("$inc");
        this.nativeFilter.$inc[fieldName] = value;

        return this;
    }

    public mul<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultOperation("$mul");
        this.nativeFilter.$mul[fieldName] = value;

        return this;
    }

    public min<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultOperation("$min");
        this.nativeFilter.$min[fieldName] = value;

        return this;
    }

    public max<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultOperation("$max");
        this.nativeFilter.$max[fieldName] = value;

        return this;
    }

    // endregion

    // region array update operations

    public pushAt<K extends keyof D>(fieldName: K, position: number, ...value: any[]): this {
        this._createDefaultPush(fieldName);
        this.nativeFilter.$push[fieldName].$each = value;
        this.nativeFilter.$push[fieldName].$position = position;
        return this;
    }

    public push<K extends keyof D>(fieldName: K, ...value: any[]): this {
        this._createDefaultPush(fieldName);
        this.nativeFilter.$push[fieldName].$each = value;
        return this;
    }

    public pop<K extends keyof D>(fieldName: K, total: 1 | -1) {
        this._createDefaultOperation("$pop");
        this.nativeFilter.$pop[fieldName] = total;
        return this;
    }

    public pullAll<K extends keyof D>(fieldName: K, ...value: any[]) {
        this._createDefaultOperation("$pullAll");
        this.nativeFilter.$pullAll[fieldName] = value;
        return this;
    }

    public addToSet<K extends keyof D>(fieldName: K, ...value: any[]) {
        this._createDefaultAddToSet(fieldName);
        this.nativeFilter.$addToSet[fieldName].$each = value;
        return this;
    }

    public sort<K extends keyof D>(fieldName: K, value: 1 | -1 | {[key: string]: 1 | 0}): this {
        this._createDefaultPush(fieldName);
        this.nativeFilter.$push[fieldName].$sort = value;

        return this;
    }

    public slice<K extends keyof D>(fieldName: K, value: number): this {
        this._createDefaultPush(fieldName);
        this.nativeFilter.$push[fieldName].$slice = value;

        return this;
    }

    // endregion

    // region private methods

    protected resetUpdateQuery() {
        this.nativeFilter = {};
    }

    private _createDefaultOperation(key: string) {
        if (!this.nativeFilter[key]) {
            this.nativeFilter[key] = {};
        }
    }

    private _createDefaultPush<K extends keyof D>(fieldName: K) {
        if (!this.nativeFilter.$push) {
            this.nativeFilter.$push = {};
        }

        if (!this.nativeFilter.$push[fieldName]) {
            this.nativeFilter.$push[fieldName] = {$each: []};
        }
    }

    private _createDefaultAddToSet<K extends keyof D>(fieldName: K) {
        if (!this.nativeFilter.$addToSet) {
            this.nativeFilter.$addToSet = {};
        }

        if (!this.nativeFilter.$addToSet[fieldName]) {
            this.nativeFilter.$addToSet[fieldName] = {$each: []};
        }
    }

    // endregion
}
