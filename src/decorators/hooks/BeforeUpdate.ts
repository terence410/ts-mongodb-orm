import {tsMongodbOrm} from "../../tsMongodbOrm";

// tslint:disable-next-line:variable-name
export  const BeforeUpdate = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        tsMongodbOrm.addHookOfBeforeUpdate(target.constructor, propertyKey);
    };
};
