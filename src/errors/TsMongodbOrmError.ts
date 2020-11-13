export class TsMongodbOrmError extends Error {
    public name = "TsMongodbOrmError";

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, TsMongodbOrmError.prototype);
    }
}
