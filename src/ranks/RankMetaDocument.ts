import {Document} from "../decorators/Document";
import {Field} from "../decorators/Field";

@Document()
export class RankMetaDocument {
    @Field()
    public _id: string = "meta";

    @Field()
    public maxScore: number = 0;

    @Field()
    public minScore: number = 0;

    @Field()
    public branchFactor: number = 0;
}
