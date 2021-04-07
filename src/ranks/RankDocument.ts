import {Document} from "../decorators/Document";
import {Field} from "../decorators/Field";

@Document()
export class RankDocument {
    @Field()
    public _id: string = "";

    @Field()
    public values: {[key: string]: number} = {};
}
