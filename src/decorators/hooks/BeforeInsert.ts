import {tsMongodbOrm} from "../../tsMongodbOrm";

// tslint:disable-next-line:variable-name
export  const BeforeInsert = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        tsMongodbOrm.addHookOfBeforeInsert(target.constructor, propertyKey);
    };
};
