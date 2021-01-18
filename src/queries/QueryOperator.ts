import {mongodbDataTypes} from "../enums/mongodbDataTypes";
import {IDocumentInstance} from "../types";
import {QueryLogic} from "./QueryLogic";

type IComparisonType = number | string | Date;
type IComparisonKeys = "eq" | "ne" | "gte" | "gt" | "lt" | "lte" | "in" | "nin" | "regex";

export class QueryOperator<D extends IDocumentInstance> {
    constructor(public nativeQuery: any) {
        //
    }

    // region logical

    // https://docs.mongodb.com/manual/reference/operator/query/not/#op._S_not
    public not(expression: (query: QueryOperator<D>) => void) {
        this.nativeQuery.$not = {};
        const subFilter = new QueryOperator<D>(this.nativeQuery.$not);
        expression(subFilter);
    }

    // endregion

    // region comparisons

    public eq(value: IComparisonType | boolean): Pick<this, IComparisonKeys> {
        this.nativeQuery.$eq = value;
        return this;
    }

    public ne(value: IComparisonType | boolean): Pick<this, IComparisonKeys> {
        this.nativeQuery.$ne = value;
        return this;
    }

    public gt(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeQuery.$gt = value;
        return this;
    }

    public gte(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeQuery.$gte = value;
        return this;
    }

    public lte(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeQuery.$lte = value;
        return this;
    }

    public lt(value: IComparisonType): Pick<this, IComparisonKeys> {
        this.nativeQuery.$lt = value;
        return this;
    }

    public in(values: any[]): Pick<this, IComparisonKeys> {
        this.nativeQuery.$in = values;
        return this;
    }

    public nin(values: any[]): Pick<this, IComparisonKeys> {
        this.nativeQuery.$nin = values;
        return this;
    }

    // endregion

    // region element

    // https://docs.mongodb.com/manual/reference/operator/query/exists/
    public exists(isExist: boolean = true) {
        this.nativeQuery.$exists = isExist;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/type/
    public type(type: mongodbDataTypes | mongodbDataTypes[]) {
        this.nativeQuery.$type = type;
    }

    // endregion

    // region evaluation

    // Not supported
    // https://docs.mongodb.com/manual/reference/operator/query/expr/#op._S_expr
    // https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/

    // https://docs.mongodb.com/manual/reference/operator/query/mod/#op._S_mod
    public mod(divisor: number, reminder: number) {
        this.nativeQuery.$mod = [divisor, reminder];
    }

    // https://docs.mongodb.com/manual/reference/operator/query/regex/
    public regex(value: string, options?: string): Pick<this, IComparisonKeys> {
        this.nativeQuery.$regex = value;
        if (options !== undefined) {
            this.nativeQuery.$options = options;
        }
        return this;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/where/
    public where(value: string) {
        this.nativeQuery.$where = value;
    }

    // endregion

    // region array

    // https://docs.mongodb.com/manual/reference/operator/query/all/#op._S_all
    public all(values: any[]) {
        this.nativeQuery.$all = values;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/size/
    public size(value: number) {
        this.nativeQuery.$size = value;
    }

    // https://docs.mongodb.com/manual/reference/operator/query/elemMatch/#op._S_elemMatch
    public elemMatch(expression: (query: QueryOperator<D>) => void) {
        this.nativeQuery.$elemMatch = {};
        const subFilter = new QueryOperator<D>(this.nativeQuery.$elemMatch);
        expression(subFilter);
    }

    public elemMatchObject(expression: (query: QueryLogic<D>) => void) {
        this.nativeQuery.$elemMatch = {};
        const subBaseQuery = new QueryLogic<D>(this.nativeQuery.$elemMatch);
        expression(subBaseQuery);
    }

    // endregion

    // region bitwise

    public bitsAllClear(value: number | number[]) {
        this.nativeQuery.$bitsAllClear = value;
    }

    public bitsAllSet(value: number | number[]) {
        this.nativeQuery.$bitsAllClear = value;
    }

    public bitsAnyClear(value: number | number[]) {
        this.nativeQuery.$bitsAllClear = value;
    }

    public bitsAnySet(value: number | number[]) {
        this.nativeQuery.$bitsAllClear = value;
    }

    // endregion

    // geometry
    // https://docs.mongodb.com/manual/reference/operator/query/
}
