import {tsMongodbOrm} from "../../tsMongodbOrm";

// tslint:disable-next-line:variable-name
export  const AfterLoad = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        tsMongodbOrm.addHookOfAfterLoad(target.constructor, propertyKey);
    };
};
