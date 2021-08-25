import {mongodbDataTypes} from "../enums/mongodbDataTypes";
import {IDocumentInstance} from "../types";
import {QueryLogic} from "./QueryLogic";

type IComparisonType = number | string | Date;
type IComparisonKeys = "eq" | "ne" | "gte" | "gt" | "lt" | "lte" | "in" | "nin" | "regex";

export class QueryOperator<D extends IDocumentInstance> {
    constructor(public nativeFilter: any) {
        //
    }

    // region logical

    // https://docs.mongodb.com/manual/reference/operator/query/not/#op._S_not
    public not(expression: (query: QueryOperator<D>) => void) {
        this.nativeFilter.$not = {};
        const subFilter = new QueryOperator<D>(this.nativeFilter.$not);
        expression(subFilter);
    }

    // endregion

    // region comparisons

    public eq(value: IComparisonType | boolean): Pick<this, IComparisonKeys> {
        this.nativeFilter.$eq = value;
        return this;
    }

    public ne(value: IComparisonType | boolean): Pick<this, IComparisonKeys> {
        this.nativeFilter.$ne = value;
        return this;
    }

    public gt(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeFilter.$gt = value;
        return this;
    }

    public gte(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeFilter.$gte = value;
        return this;
    }

    public lte(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeFilter.$lte = value;
        return this;
    }

    public lt(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeFilter.$lt = value;
        return this;
    }

    public in(values: any[]): Pick<this, IComparisonKeys> {
        this.nativeFilter.$in = values;
        return this;
    }

    public nin(values: any[]): Pick<this, IComparisonKeys> {
        this.nativeFilter.$nin = values;
        return this;
    }

    // endregion

    // region element

    // https://docs.mongodb.com/manual/reference/operator/query/exists/
    public exists(isExist: boolean = true) {
        this.nativeFilter.$exists = isExist;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/type/
    public type(type: mongodbDataTypes | mongodbDataTypes[]) {
        this.nativeFilter.$type = type;
    }

    // endregion

    // region evaluation

    // Not supported
    // https://docs.mongodb.com/manual/reference/operator/query/expr/#op._S_expr
    // https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/

    // https://docs.mongodb.com/manual/reference/operator/query/mod/#op._S_mod
    public mod(divisor: number, reminder: number) {
        this.nativeFilter.$mod = [divisor, reminder];
    }

    // https://docs.mongodb.com/manual/reference/operator/query/regex/
    public regex(value: string, options?: string): Pick<this, IComparisonKeys> {
        this.nativeFilter.$regex = value;
        if (options !== undefined) {
            this.nativeFilter.$options = options;
        }
        return this;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/where/
    public where(value: string) {
        this.nativeFilter.$where = value;
    }

    // endregion

    // region array

    // https://docs.mongodb.com/manual/reference/operator/query/all/#op._S_all
    public all(values: any[]) {
        this.nativeFilter.$all = values;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/size/
    public size(value: number) {
        this.nativeFilter.$size = value;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/elemMatch/#op._S_elemMatch
    public elemMatch(expression: (query: QueryOperator<D>) => void) {
        this.nativeFilter.$elemMatch = {};
        const subFilter = new QueryOperator<D>(this.nativeFilter.$elemMatch);
        expression(subFilter);
    }

    public elemMatchObject(expression: (query: QueryLogic<D>) => void) {
        this.nativeFilter.$elemMatch = {};
        const subBaseQuery = new QueryLogic<D>(this.nativeFilter.$elemMatch);
        expression(subBaseQuery);
    }

    // endregion

    // region bitwise

    public bitsAllClear(value: number | number[]) {
        this.nativeFilter.$bitsAllClear = value;
    }

    public bitsAllSet(value: number | number[]) {
        this.nativeFilter.$bitsAllClear = value;
    }

    public bitsAnyClear(value: number | number[]) {
        this.nativeFilter.$bitsAllClear = value;
    }

    public bitsAnySet(value: number | number[]) {
        this.nativeFilter.$bitsAllClear = value;
    }

    // endregion

    // geometry
    // https://docs.mongodb.com/manual/reference/operator/query/
}
