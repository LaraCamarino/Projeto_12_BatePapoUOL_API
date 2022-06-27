import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv"
import joi from "joi";
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;
mongoClient.connect().then(() => {
	db = mongoClient.db("banco_UOL");
});

app.listen(5000, () => console.log("Servidor foi iniciado."));