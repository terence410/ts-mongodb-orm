/* tslint:disable:unified-signatures */
import { IDocumentInstance} from "../types";
import {QueryOperator} from "./QueryOperator";

type ITextOptions = {
    search: string;
    language?: string;
    caseSensitive?: boolean;
    diacriticSensitive?: boolean;
};

export class QueryLogic<D extends IDocumentInstance> {
    constructor(public nativeQuery: any = {}) {
    }

    public filter<K extends keyof D>(name: K, expression: (query: QueryOperator<D>) => any): this;
    public filter<K extends keyof D>(name: K, value: D[K]): this;
    public filter(...args: any[]): this {
        const fieldName = args[0];
        if (typeof args[1] === "function") {
            const newFilterQuery = {};
            this.nativeQuery[fieldName] = newFilterQuery;
            const callback = args[1];
            const subQuery = new QueryOperator(newFilterQuery);
            callback(subQuery);

        } else {
            this.nativeQuery[fieldName] = args[1];
        }

        return this;
    }

    // region logical

    public nor<K extends keyof D>(fieldName: K, expression: (query: QueryOperator<D>) => any): this;
    public nor<K extends keyof D>(fieldName: K, value: D[K]): this;
    public nor(expression: (query: QueryLogic<D>) => any): this;
    public nor(...args: any[]): this {
        return this._createConditionFilter("$nor", ...args);
    }

    public and<K extends keyof D>(fieldName: K, expression: (query: QueryOperator<D>) => any): this;
    public and<K extends keyof D>(fieldName: K, value: D[K]): this;
    public and(expression: (query: QueryLogic<D>) => any): this;
    public and(...args: any[]): this {
        return this._createConditionFilter("$and", ...args);
    }

    // override (we must put callback at the top for ts to detect callback)
    public or<K extends keyof D>(fieldName: K, expression: (query: QueryOperator<D>) => any): this;
    public or<K extends keyof D>(fieldName: K, value: D[K]): this;
    public or(expression: (query: QueryLogic<D>) => any): this;
    public or(...args: any[]): this {
        return this._createConditionFilter("$or", ...args);
    }

    // endregion

    // region evaluation

    // https://docs.mongodb.com/manual/reference/operator/query/text/
    public text(value: string | ITextOptions): this {
        if (typeof value === "string") {
            this.nativeQuery.$text = {$search: value};
        } else {
            this.nativeQuery.$text = value;
        }

        return this;
    }

    // endregion

    private _createConditionFilter(key: string, ...args: any[]): this {
        if (!this.nativeQuery[key]) {
            this.nativeQuery[key] = [];
        }

        const subNativeQuery: any = {};
        this.nativeQuery[key].push(subNativeQuery);

        // if this is an expression
        if (typeof args[0] === "function") {
            const callback = args[0];
            const subBaseQuery = new QueryLogic(subNativeQuery);
            callback(subBaseQuery);
        } else {
            // if it has a field name and expression
            const fieldName = args[0];
            if (typeof args[1] === "function") {
                const subNewFilter: any = {};
                subNativeQuery[fieldName] = subNewFilter;
                const callback = args[1];
                const subQuery = new QueryOperator(subNewFilter);
                callback(subQuery);

            } else {
                subNativeQuery[fieldName] = args[1];
            }
        }

        return this;
    }
}
