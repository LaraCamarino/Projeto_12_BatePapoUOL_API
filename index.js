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

const participantSchema = joi.object({
	name: joi.string().required()
});

app.post("/participants", async (request, response) => {
	const { name } = request.body;

	const validation = participantSchema.validate(request.body);
	if (validation.error) {
		console.log(validation.error.details);
		response.status(422).send("O nome escolhido não é válido.");
		return;
	}

	try {
		const verifySameName = await db.collection("participants").findOne({ name: name });
		if (verifySameName) {
			response.status(409).send(console.log("O nome escolhido já está em utilização."));
			return;
		}
		await db.collection("participants").insertOne({
			name: name,
			lastStatus: Date.now()
		});
		await db.collection("messages").insertOne({
			from: name,
			to: "Todos",
			text: "entra na sala...",
			type: "status",
			time: dayjs().format("HH:mm:ss")
		});
		response.status(201).send(console.log("Participante criado com sucesso."));
		return;
	}
	catch (error) {
		response.status(500).send(console.log(error));
	}
});

app.listen(5000, () => console.log("Servidor foi iniciado."));