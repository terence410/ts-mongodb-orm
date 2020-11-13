import { assert, expect } from "chai";
import {Connection, Document, Field, ObjectID, Repository} from "../src/";
import {timeout} from "../src/utils";
// @ts-ignore
import {addConnection} from "./share";

@Document()
class WatchTest {
    @Field()
    public _id!: ObjectID;

    @Field()
    public date: Date = new Date();
}

describe("Watcher Test", () => {
    let connection!: Connection;
    let repository!: Repository<typeof WatchTest>;

    before(async () => {
        connection = await addConnection();
        repository = connection.getRepository(WatchTest);
    });

    after(async () => {
        await repository.dropCollection();
        await connection.close();
    });

    it("check all the events", async () => {
        const stream = repository.watch();
        stream.on("error", err => {
            console.log("error", err);
        });

        // wait a while for the stream to initialize
        await timeout(500);

        // insert document
        const promise1a = new Promise(resolve => stream.once("insert", resolve));
        const document = new WatchTest();
        const promise1b = repository.insert(document);
        await Promise.all([promise1a, promise1b]);

        // update document
        const promise2a = new Promise(resolve => stream.once("update", resolve));
        document.date = new Date();
        const promise2b = repository.update(document);
        await Promise.all([promise2a, promise2b]);

        // delete document
        const promise3a = new Promise(resolve => stream.once("delete", resolve));
        const promise3b = repository.delete(document);
        await Promise.all([promise3a, promise3b]);

        // drop the collection and get end and close event
        const promise4a = new Promise(async resolve => {
            const eventNames: string[] = [];

            stream.on("change", next => {
                eventNames.push(next.operationType);
            });
            
            stream.once("end", () => {
                eventNames.push("end");
            });

            // stream close at the end
            stream.once("close", () => {
                if (eventNames.join(",") === "drop,invalidate,end") {
                    resolve();
                }
            });
        });
        const promise4b = repository.dropCollection();
        await Promise.all([promise4a, promise4b]);
        assert.isTrue(stream.isClosed());
    });

    it("transaction with watch", async () => {
        await repository.createCollection();

        const stream = repository.watch();
        let totalChangeEvent = 0;
        stream.once("change", next => totalChangeEvent++);

        // abort transaction
        const transactionManager = connection.getTransactionManager();
        await transactionManager.startTransaction(async session => {
            const document = new WatchTest();
            await repository.insert(document, {session});
            await session.abortTransaction();
        });
        await timeout(500); // wait a while for the event to be emitted
        assert.equal(totalChangeEvent, 0);

        // successful transaction
        await transactionManager.startTransaction(async session => {
            const document = new WatchTest();
            await repository.insert(document);
        });
        await timeout(500); // wait a while for the event to be emitted
        assert.equal(totalChangeEvent, 1);

        // clean up
        await stream.close();
        assert.isTrue(stream.isClosed());
    });
});
