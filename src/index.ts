import {Binary, MongoClientOptions, MongoError, ObjectID} from "mongodb";
import {Connection} from "./Connection";
import {Document} from "./decorators/Document";
import {Field} from "./decorators/Field";
import {AfterLoad} from "./decorators/hooks/AfterLoad";
import {BeforeDelete} from "./decorators/hooks/BeforeDelete";
import {BeforeInsert} from "./decorators/hooks/BeforeInsert";
import {BeforeUpdate} from "./decorators/hooks/BeforeUpdate";
import {BeforeUpsert} from "./decorators/hooks/BeforeUpsert";
import {Index} from "./decorators/Index";
import {mongodbDataTypes} from "./enums/mongodbDataTypes";
import {TsMongodbOrmError} from "./errors/TsMongodbOrmError";
import {LockManager} from "./locks/LockManager";
import {Repository} from "./Repository";
import {TransactionManager} from "./transactions/TransactionManager";
import {tsMongodbOrm} from "./tsMongodbOrm";
import {requireMongo} from "./utils";
import {createConnection} from "./utils/createConnection";

// require client to install the dependencies directly
requireMongo();

export {
    // core
    tsMongodbOrm,
    Repository,
    Connection,
    TransactionManager,
    LockManager,
    createConnection,

    // decorators
    Document,
    Field,
    Index,
    AfterLoad,
    BeforeInsert,
    BeforeUpsert,
    BeforeUpdate,
    BeforeDelete,

    // errors
    TsMongodbOrmError,

    // misc
    mongodbDataTypes,

    // mongodb
    MongoClientOptions,
    MongoError,
    ObjectID,
    Binary,
};
