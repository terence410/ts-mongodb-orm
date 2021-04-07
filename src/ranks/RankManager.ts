import {ClientSession, MongoClient, TransactionOptions} from "mongodb";
import {TransactionManager, TsMongodbOrmError} from "..";
import {Repository} from "../Repository";
import {IRankManagerOptions, ITransactionCallback} from "../types";
import {RankDocument} from "./RankDocument";
import {RankMetaDocument} from "./RankMetaDocument";

// TODO: only accept integers
// TODO: block invalid range of scores

type IDocumentMeta = {
    _id: string,
    fields: Array<{fieldName: string, start: number, end: number}>;
};

type IRankMeta = {
    layer: number,
    start: number,
    end: number,
    documentId: string,
    fields: Array<{fieldName: string, start: number, end: number, hasChild: boolean}>,
};

type IGetScoreByRankOptions = {useHighest?: boolean};

export class RankManager {
    public readonly mongoClient: MongoClient;
    public readonly dbName: string;
    public readonly collectionName: string;
    public readonly maxScore: number;
    public readonly minScore: number;
    public readonly branchFactor: number;
    public readonly skipTransaction: boolean;
    public readonly transaction: {maxRetry: number, transactionOptions: TransactionOptions};
    public hasInit = false;

    constructor(options: IRankManagerOptions) {
        this.mongoClient = options.mongoClient;
        this.dbName = options.dbName;
        this.collectionName = options.collectionName;
        this.maxScore = options.maxScore;
        this.minScore = options.minScore;
        this.branchFactor = options.branchFactor;
        this.skipTransaction = options.skipTransaction;
        this.transaction = options.transaction;
    }

    public async init() {
        await this._validate();
    }

    public async addScore(score: number) {
        await this._validate({score});

        const documentMetaList: IDocumentMeta[] = [];
        this.getSaveDocumentMetaList(this.minScore, this.maxScore, 0, score, documentMetaList);

        const repository = this.getRepository();
        await this._runWithTransaction(async session => {
            const promises: any[] = [];
            for (const documentItem of documentMetaList) {
                const query = repository.query()
                    .filter("_id", documentItem._id);
                const updater = query.getUpdater({weakType: true});

                // increment the column
                for (const field of documentItem.fields) {
                    updater.inc(`values.${field.fieldName}`, 1);
                }

                // create if not exist
                const promise = updater.updateOne({upsert: true, session});
                promises.push(promise);
            }

            await Promise.all(promises);
        });
    }

    public async removeScore(score: number) {
        await this._validate({score});

        const documentMetaList: IDocumentMeta[] = [];
        this.getSaveDocumentMetaList(this.minScore, this.maxScore, 0, score, documentMetaList);

        const repository = this.getRepository();
        await this._runWithTransaction(async session => {
            const promises: any[] = [];

            const documents = await repository
                .query()
                .filter("_id", x => x.in(documentMetaList.map(y => y._id)))
                .findMany();
            
            for (const documentMeta of documentMetaList) {
                const document = documents.find(x => x._id === documentMeta._id);
                if (!document) {
                    throw new TsMongodbOrmError(`No such score: ${score}`);
                }

                for (const field of documentMeta.fields) {
                    if (Number(document.values[field.fieldName] || 0) <= 0) {
                        throw new TsMongodbOrmError(`No such score: ${score}`);
                    }
                }
            }

            for (const documentMeta of documentMetaList) {
                const query = repository.query()
                    .filter("_id", documentMeta._id);
                const updater = query.getUpdater({weakType: true});

                // increment the column
                for (const field of documentMeta.fields) {
                    updater.inc(`values.${field.fieldName}`, -1);
                }

                // create if not exist
                const promise = updater.findOneAndUpdate({upsert: true, session});
                promises.push(promise);
            }

            await Promise.all(promises);
        });
    }

    public async countByScore(score: number) {
        await this._validate({score});

        const documentMetaList: IDocumentMeta[] = [];
        this.getSaveDocumentMetaList(this.minScore, this.maxScore, 0, score, documentMetaList);

        // we must able to find one
        const documentMeta = documentMetaList.find(x => x.fields.some(y => y.start === score && y.end === score))!;
        const field = documentMeta.fields.find(x => x.start === score && x.end === score)!;

        // find the document
        const repository = this.getRepository();
        const document = await repository.findOne({_id: documentMeta._id});

        return document ? document.values[field.fieldName] || 0 : 0;
    }

    public async getRankByScore(score: number) {
        await this._validate({score});

        const documentMetaList: IDocumentMeta[] = [];
        this.getRankDocumentMetaList(this.minScore, this.maxScore, 0, score, documentMetaList);

        const repository = this.getRepository();
        const documentIds = documentMetaList.filter(x => x.fields.length).map(x => x._id);

        // push for the sum
        const groupExpression: any = { _id: 1, total: { $sum: { $add: [ ] } } };
        for (const documentMeta of documentMetaList) {
            for (const field of documentMeta.fields) {
                groupExpression.total.$sum.$add.push({$ifNull: [`$values.${field.fieldName}`, 0]});
            }
        }

        const aggregate = await repository
            .aggregate()
            .match(x => x.filter("_id", y => y.in(documentIds)))
            .group(groupExpression)
            .findOne();

        return (aggregate?.total || 0) + 1;
    }

    // the min. score u need to have that rank (use start instead of end)
    public async getScoreByRank(rank: number, options: IGetScoreByRankOptions = {}) {
        await this._validate({rank});

        return await this._getScoreByRankInternal(this.minScore, this.maxScore, 0, rank, options);
    }

    public async count() {
        await this._validate();

        const rankMeta = this._getRankMeta(this.minScore, this.maxScore, 0);
        const repository = this.getRepository();
        const document = await repository.findOne({_id: rankMeta.documentId});
        if (document) {
            return Object.values(document.values).reduce((a, b) => a + b, 0);

        }

        return 0;
    }

    public getRepository(): Repository<typeof RankDocument> {
        return new Repository({
            mongoClient: this.mongoClient,
            classObject: RankDocument,
            dbName: this.dbName,
            collectionName: this.collectionName,
        });
    }

    /** @internal */
    public getFullRankMetaList() {
        const rankMetaList: IRankMeta[] = [];
        this._getRankMetaListInternal(this.minScore, this.maxScore, 0, rankMetaList);
        return rankMetaList;

    }

    private getSaveDocumentMetaList(start: number, end: number, layer: number, score: number, documentMetaList: IDocumentMeta[]) {
        const rankMeta = this._getRankMeta(start, end, layer);
        const documentMeta: IDocumentMeta = {
            _id: rankMeta.documentId,
            fields: [],
        };
        documentMetaList.push(documentMeta);

        for (const field of rankMeta.fields) {
            if (score >= field.start && score <= field.end) {
                documentMeta.fields.push({fieldName: field.fieldName, start: field.start, end: field.end});

                if (field.hasChild) {
                    this.getSaveDocumentMetaList(field.start, field.end, rankMeta.layer + 1, score, documentMetaList);

                }
            }
        }
    }

    private getRankDocumentMetaList(start: number, end: number, layer: number, score: number, documentMetaList: IDocumentMeta[]) {
        const rankMeta = this._getRankMeta(start, end, layer);
        const documentMeta: IDocumentMeta = {
            _id: rankMeta.documentId,
            fields: [],
        };
        documentMetaList.push(documentMeta);

        for (const field of rankMeta.fields) {
            if (score < field.start) {
                documentMeta.fields.push({fieldName: field.fieldName, start: field.start, end: field.end});

            } else if (score >= field.start) {
                if (field.hasChild) {
                    this.getRankDocumentMetaList(field.start, field.end, rankMeta.layer + 1, score, documentMetaList);
                }
            }
        }
    }

    // region private methods

    private async _validate(options: {score?: number, rank?: number} = {}) {
        if (typeof options.rank === "number") {
            if (options.rank < 1) {
                throw new TsMongodbOrmError(`Rank must be >= 1`);
            }
        }

        if (typeof options.score === "number") {
            if (options.score < this.minScore || options.score > this.maxScore) {
                throw new TsMongodbOrmError(`Score must be >= ${this.minScore} and <= ${this.maxScore}`);
            }
        }

        if (!this.hasInit) {
            const metaRepository = this._getMetaRepository();
            const metaDocument = await metaRepository
                .query()
                .filter("_id", "meta")
                .getUpdater()
                .setOnInsert("maxScore", this.maxScore)
                .setOnInsert("minScore", this.minScore)
                .setOnInsert("branchFactor", this.branchFactor)
                .findOneAndUpdate({upsert: true});

            if (metaDocument?.minScore !== this.minScore) {
                throw new TsMongodbOrmError(`minScore mismatch with exiting data. Existing minScore is ${metaDocument?.minScore}, current minScore is ${this.minScore}`);
            }

            if (metaDocument?.maxScore !== this.maxScore) {
                throw new TsMongodbOrmError(`maxScore mismatch with exiting data. Existing maxScore is ${metaDocument?.maxScore}, current maxScore is ${this.maxScore}`);
            }

            if (metaDocument?.branchFactor !== this.branchFactor) {
                throw new TsMongodbOrmError(`branchFactor mismatch with exiting data. Existing branchFactor is ${metaDocument?.branchFactor}, current branchFactor is ${this.branchFactor}`);
            }

            this.hasInit = true;
        }
    }

    private async _getScoreByRankInternal(start: number, end: number, layer: number, rank: number, options: IGetScoreByRankOptions): Promise<number> {
        const rankMeta = this._getRankMeta(start, end, layer);
        const repository = this.getRepository();
        const document = await repository.findOne({_id: rankMeta.documentId});

        if (document) {
            for (const field of rankMeta.fields.reverse()) {
                const total = document.values[field.fieldName] || 0;

                // console.log(`layer: ${layer}, field: ${field.fieldName}, rank: ${rank}, total: ${total}`);
                if (options.useHighest) {
                    if (rank === 1 && total === 0) {
                        // console.log("onlyOne", field.fieldName, {start, end, layer});
                        return field.end;
                        
                    } else if (rank - total === 1 && field.hasChild) {
                        // if we have child and if there is a possible blank space, so we go in and check any possible vacancy
                        // console.log("hasChild", field.fieldName, {start, end, layer});
                        // if the temp score is less than the current one, then it wil be the correct score
                        const tempSore =  await this._getScoreByRankInternal(field.start, field.end, rankMeta.layer + 1, rank, options);
                        if (tempSore < field.end) {
                            return tempSore;
                        }
                    }

                }

                if (total >= rank) {
                    if (field.hasChild) {
                        return this._getScoreByRankInternal(field.start, field.end, rankMeta.layer + 1, rank, options);
                        
                    }  else {
                        return field.start;
                    }
                }

                // reduce the rank
                rank -= total;
            }
        }

        if (options.useHighest) {
            return end;

        }

        return start;
    }

    private _getMetaRepository(): Repository<typeof RankMetaDocument> {
        const repository = new Repository({
            mongoClient: this.mongoClient,
            classObject: RankMetaDocument,
            dbName: this.dbName,
            collectionName: this.collectionName,
        });

        return repository;
    }

    private _getRankMetaListInternal(start: number, end: number, layer: number, rankMetaList: IRankMeta[]) {
        const rankMeta = this._getRankMeta(start, end, layer);
        rankMetaList.push(rankMeta);

        for (const field of rankMeta.fields) {
            if (field.hasChild) {
                this._getRankMetaListInternal(field.start, field.end, rankMeta.layer + 1, rankMetaList);
            }
        }
    }

    private _getRankMeta(start: number, end: number, layer: number) {
        const diff = Math.ceil((end - start + 1) / this.branchFactor);
        const documentItem: IRankMeta = {
            documentId: `rank_${layer}_${start}_${end}`,
            fields: [],
            layer,
            start,
            end,
        };

        for (let i = start; i <= end; i += diff) {
            const rangeStart = i;
            const rangeEnd = Math.min(rangeStart + diff - 1, end);
            const total = rangeEnd - rangeStart + 1;

            const fieldName = `range_${rangeStart}_${rangeEnd}`;
            const hasChild = total > 1;
            documentItem.fields.push({fieldName, start: rangeStart, end: rangeEnd, hasChild});
        }

        return documentItem;
    }

    private async _runWithTransaction<T extends any>(callback: (session?: ClientSession) => Promise<any>) {
        if (this.skipTransaction) {
            await callback();

        } else {
            const transactionManager = new TransactionManager({mongoClient: this.mongoClient, ...this.transaction});
            return await transactionManager.startTransaction(callback);
        }
    }

    // endregion
}
