import {Document} from "../decorators/Document";
import {Field} from "../decorators/Field";
import {Index} from "../decorators/Index";

@Document()
@Index({expiredAt: -1}, {expireAfterSeconds: 60})
export class LockDocument {
    @Field()
    public _id: string = "";

    @Field()
    public lockKey: string = "";

    @Field()
    public randomId: string = "";

    @Field()
    public expiredAt: Date = new Date();
}
