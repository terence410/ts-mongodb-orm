import { assert, expect } from "chai";
import {Connection, Document, Field} from "../src/";
import {IGetRankManagerOptions} from "../src/types";
// @ts-ignore
import {addConnection, assertAsyncError, assertTsMongodbOrmError} from "./share";

@Document()
class RankManagerTest {
    @Field()
    public _id: string = "";

    @Field()
    public score: number = 0;
}

const dbName = "rank";
describe("Lock Manager Test", () => {
    let connection!: Connection;

    before(async () => {
        connection = await addConnection();
    });

    after(async () => {
        await connection.mongoClient.db(dbName).dropDatabase();
    });

    describe("basic", () => {
        it("list testing", async () => {
            const manager = connection.getRankManager({minScore: 1, maxScore: 100 * 100 * 100, branchFactor: 100});
            const list = manager.getFullRankMetaList();
            assert.equal(list.length, 10101);
        });

        it("document items simple", async () => {
            const manager = connection.getRankManager({minScore: 1, maxScore: 11, branchFactor: 10});
            const documentItems = manager.getFullRankMetaList();

            const documentIds = documentItems.filter(x => x.layer === 1).map(x => x.documentId);
            assert.deepEqual(documentIds, ["rank_1_1_2", "rank_1_3_4", "rank_1_5_6", "rank_1_7_8", "rank_1_9_10"]);
        });

        it("document items complicated", async () => {
            const manager = connection.getRankManager({minScore: 1, maxScore: 625, branchFactor: 5});
            const documentItems = manager.getFullRankMetaList();

            assert.equal(documentItems.length, 1 + 5 + 25 + 125);
            const documentIds = documentItems.filter(x => x.layer === 1).map(x => x.documentId);
            assert.deepEqual(documentIds, ["rank_1_1_125", "rank_1_126_250", "rank_1_251_375", "rank_1_376_500", "rank_1_501_625"]);
        });

        it("basic rank testing, jumping", async () => {
            const options: IGetRankManagerOptions = {dbName, collectionName: "basic_8_1_100", minScore: 1, maxScore: 100, branchFactor: 8};
            const rankManager = connection.getRankManager(options);

            await rankManager.addScore(100);
            await rankManager.addScore(100);
            await rankManager.addScore(97);
            await rankManager.addScore(50);
            await rankManager.addScore(8);

            // check the count first
            assert.equal(await rankManager.count(), 5);

            const rank1 = await rankManager.getRankByScore(100);
            const rank2 = await rankManager.getRankByScore(98);
            const rank3 = await rankManager.getRankByScore(97);
            const rank4 = await rankManager.getRankByScore(50);
            const rank5 = await rankManager.getRankByScore(49);
            const rank6 = await rankManager.getRankByScore(3);
            assert.equal(rank1, 1);
            assert.equal(rank2, 3);
            assert.equal(rank3, 3);
            assert.equal(rank4, 4);
            assert.equal(rank5, 5);
            assert.equal(rank6, 6);

            const score1 = await rankManager.getScoreByRank(1);
            const score2 = await rankManager.getScoreByRank(2);
            const score3 = await rankManager.getScoreByRank(3);
            const score4 = await rankManager.getScoreByRank(4);
            const score5 = await rankManager.getScoreByRank(5);
            const score6 = await rankManager.getScoreByRank(6);
            assert.equal(score1, 100);
            assert.equal(score2, 100);
            assert.equal(score3, 97);
            assert.equal(score4, 50);
            assert.equal(score5, 8);
            assert.equal(score6, 1);
        });

        it("getScoreByRank, useHighest", async () => {
            const options: IGetRankManagerOptions = {dbName, collectionName: "basic_5_1_25", minScore: 1, maxScore: 25, branchFactor: 5};
            const rankManager = connection.getRankManager(options);

            const scoreA = await rankManager.getScoreByRank(1, {useHighest: true});
            const scoreB = await rankManager.getScoreByRank(2, {useHighest: true});
            assert.equal(scoreA, options.maxScore);
            assert.equal(scoreB, options.maxScore);

            await rankManager.addScore(25);
            await rankManager.addScore(23);
            await rankManager.addScore(22);
            await rankManager.addScore(22);
            await rankManager.addScore(14);
            await rankManager.addScore(13);
            await rankManager.addScore(11);
            await rankManager.addScore(4);
            await rankManager.addScore(2);

            const score1 = await rankManager.getScoreByRank(5, {useHighest: true});
            const score2 = await rankManager.getScoreByRank(7, {useHighest: true});
            const score3 = await rankManager.getScoreByRank(8, {useHighest: true});
            const score4 = await rankManager.getScoreByRank(9, {useHighest: true});
            assert.equal(score1, 21);
            assert.equal(score2, 12);
            assert.equal(score3, 10);
            assert.equal(score4, 3);
        });
    });

    describe("performance (have transaction)", () => {
        it("add / remove", async () => {
            const options: IGetRankManagerOptions = {
                dbName,
                collectionName: "basic_5_1_150",
                minScore: 1,
                maxScore: 150,
                branchFactor: 5,
            };
            const rankManager = connection.getRankManager(options);

            // show error
            await assertAsyncError(() => rankManager.removeScore(1), {message: /No such score: 1/});

            // assert
            const total = 5;
            const scores: number[] = [];
            for (let i = 0; i < total; i++) {
                const score = options.minScore + Math.round((options.maxScore - options.minScore) * Math.random());
                await rankManager.addScore(score);
                scores.push(score);
            }

            for (const score of scores) {
                await rankManager.removeScore(score);
            }
            assert.equal(await rankManager.count(), 0);

            // show error
            await assertAsyncError(() => rankManager.removeScore(13), {message: /No such score: 13/});
        });
    });

    describe("error", () => {
        it("argument errors", async () => {
            const options: IGetRankManagerOptions = {
                dbName,
                collectionName: "basic_10_1_10000",
                minScore: 1,
                maxScore: 10000,
                branchFactor: 10,
            };
            const rankManager = connection.getRankManager(options);
            await rankManager.init();
            await assertTsMongodbOrmError(() => rankManager.getScoreByRank(0), /Rank must be >= 1/);

            await assertTsMongodbOrmError(() => rankManager.addScore(options.minScore - 1), /Score must be/);

            await assertTsMongodbOrmError(() => rankManager.addScore(options.maxScore + 1), /Score must be/);

            // mist match
            const rankManager1 = connection.getRankManager({...options, maxScore: 20000});
            await assertTsMongodbOrmError(() => rankManager1.addScore(1), /maxScore mismatch/);

            const rankManager2 = connection.getRankManager({...options, minScore: -1});
            await assertTsMongodbOrmError(() => rankManager2.addScore(1), /minScore mismatch/);

            const rankManager3 = connection.getRankManager({...options, branchFactor: 9});
            await assertTsMongodbOrmError(() => rankManager3.addScore(1), /branchFactor mismatch/);
        });
    });

    describe("performance (skip transaction)", () => {
        it("basic rank testing", async () => {
            const options: IGetRankManagerOptions = {
                dbName,
                collectionName: "basic_3_1_27",
                minScore: 1,
                maxScore: 27,
                branchFactor: 3,
                skipTransaction: true,
            };
            const rankManager = connection.getRankManager(options);
            await rankManager.init();

            for (let multiplier = 1; multiplier <= 2; multiplier++) {
                const promises: any = [];
                for (let i = options.minScore; i <= options.maxScore; i++) {
                    promises.push(rankManager.addScore(i));
                }
                await Promise.all(promises);

                // check the number
                // console.log("multiplier", multiplier);
                assert.equal(await rankManager.count(), options.maxScore * multiplier);

                // get result and save it
                const rankPromises: any[] = [];
                const scorePromises: any[] = [];
                const rankValues: any[] = [];
                const scoreValues: any[] = [];
                for (let i = options.maxScore; i >= options.minScore; i--) {
                    const rank = (options.maxScore - i) * multiplier + 1;
                    rankPromises.push(rankManager.getRankByScore(i));
                    scorePromises.push(rankManager.getScoreByRank(rank));
                    rankValues.push(rank);
                    scoreValues.push(i);
                }

                // wait for the values and validate
                const ranks = await Promise.all(rankPromises);
                const scores = await Promise.all(scorePromises);
                for (let i = 0; i < ranks.length; i++) {
                    assert.equal(ranks[i], rankValues[i]);
                    assert.equal(scores[i], scoreValues[i]);
                }
            }
        });

        it("basic rank testing, approximate", async () => {
            const size = 1000 * 1000;
            const minScore = Math.random() * size | 0 - size / 2;
            const maxScore = minScore + size / 2 + Math.random() * size | 0;
            const branchFactor = 2 + Math.random() * 50 | 0;
            const collectionName = `basic_${branchFactor}_${minScore}_${maxScore}`;
            const options: IGetRankManagerOptions = {dbName, collectionName, minScore, maxScore, branchFactor, skipTransaction: true};
            const rankManager = connection.getRankManager(options);
            await rankManager.init();

            const totalScores = 50;
            const scores = Array(totalScores).fill(0)
                .map(x => minScore + (maxScore - minScore) * Math.random() | 0)
                .sort((a, b) => b - a);

            await Promise.all(scores.map(score => rankManager.addScore(score)));
            // console.log("added scores");

            const count = await rankManager.count();
            assert.equal(count, totalScores);

            for (let i = 0; i < scores.length; i++) {
                const previousScore = scores[i - 1];
                const rankScore = await rankManager.getScoreByRank(i + 1, {useHighest: true});

                if (i === 0) {
                    assert.equal(rankScore, maxScore);

                } else {
                    assert.equal(rankScore, previousScore - 1);

                }
            }
        });

        it("Add all scores at once (skip transaction)", async () => {
            const options: IGetRankManagerOptions = {
                dbName,
                collectionName: "basic_4_1_16",
                minScore: 1,
                maxScore: 16,
                branchFactor: 4,
                skipTransaction: true,
            };
            const rankManager = connection.getRankManager(options);
            await rankManager.init();

            const total = options.maxScore - options.minScore;
            for (let i = options.minScore; i <= options.maxScore; i++) {
                const promises = Array(i).fill(0).map(x => rankManager.addScore(i));
                await Promise.all(promises);
                // console.log("added", i);
            }

            const count = (total + 1) * (total + 2) / 2;
            assert.equal(await rankManager.count(), count);
            // console.log("count", count);

            for (let i = options.minScore; i <= options.maxScore; i++) {
                const count1 = await rankManager.countByScore(i);
                assert.equal(count1, i);
            }
        });
    });
});
