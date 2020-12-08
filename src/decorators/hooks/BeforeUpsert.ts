import {tsMongodbOrm} from "../../tsMongodbOrm";

// tslint:disable-next-line:variable-name
export  const BeforeUpsert = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        tsMongodbOrm.addHookOfBeforeUpsert(target.constructor, propertyKey);
    };
};
