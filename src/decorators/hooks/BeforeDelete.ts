import {tsMongodbOrm} from "../../tsMongodbOrm";

// tslint:disable-next-line:variable-name
export  const BeforeDelete = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        tsMongodbOrm.addHookOfBeforeDelete(target.constructor, propertyKey);
    };
};
