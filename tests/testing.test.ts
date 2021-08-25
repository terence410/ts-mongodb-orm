import {MongoClient} from "mongodb";

async function testing() {
    const mongoClient = await MongoClient.connect("");
    const collection = mongoClient.db("").collection("coll");
    const mongodbResponse = await collection.updateOne({_id: 1}, {});
    const a = mongodbResponse.modifiedCount;
}
