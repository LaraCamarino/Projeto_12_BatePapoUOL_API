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
const messageSchema = joi.object({
	to: joi.string().required(),
	text: joi.string().required(),
	type: joi.string().valid("message").valid("private_message"),
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

app.get("/participants", async (request, response) => {
	try {
		const allParticipants = await db.collection("participants").find().toArray();
		response.status(200).send(allParticipants);
	}
	catch (error) {
		response.status(500).send(error);
	}
});

app.post("/messages", async (request, response) => {
	const from = request.headers.user;
	const { to, text, type } = request.body;
	const message = {
		to,
		text,
		type,
	};
	const validation = messageSchema.validate(message, { abortEarly: false });
	if (validation.error) {
		console.log(validation.error.details);
		response.status(422).send(validation.error.details);
		return;
	}

	const verifyFromExistingParticipant = await db.collection("participants").findOne({ name: from });
	if(!verifyFromExistingParticipant) {
		response.status(422).send("O usuáio não está ativo.");
		return;
	}

	try {
		await db.collection("messages").insertOne({
			from: from,
			to: to,
			text: text,
			type: type,
			time: dayjs().format("HH:mm:ss")
		});
		response.status(201).send(console.log("Mensagem enviada com sucesso."));
		return;
	}
	catch (error) {
		response.status(500).send(error);
	}
});

app.get("/messages", async (request, response) => {
	const limit = parseInt(request.query.limit);
	const user = request.headers.user;
	try {
		const allMessages = await db.collection("messages").find().toArray();
		const filteredMessages = allMessages.filter(message => {
			if (message.from === user || message.to === user || message.to === "Todos") {
				return message;
			}
		});
		const limitMessages = filteredMessages.slice(-limit);

		if (!limit) {
			response.status(200).send(filteredMessages);
			return;
		}
		response.status(200).send(limitMessages);
	}
	catch (error) {
		response.status(500).send(error);
	}
});

app.post("/status", async (request, response) => {
	const user = request.headers.user;

	try {
		const verifyActiveParticipant = await db.collection("participants").findOne({ name: user });
		if (!verifyActiveParticipant) {
			response.status(404).send("Participante inativo.");
			return;
		}

		const updateStatus = await db.collection("participants").updateOne({
			name: user
		},
			{
				$set: { lastStatus: Date.now() }
			});
		response.status(200).send("Status do participante atualizado.");
	}
	catch (error) {
		response.status(500).send(error);
		console.log("Não foi possível atualizar o status.");
	}
});

async function removeInactiveParticipants() {
	const currentTime = Date.now();
	const participantsList = await db.collection("participants").find().toArray();

	participantsList.forEach(async item => {
		if (item.lastStatus + 10000 < currentTime) {
			await db.collection("participants").deleteOne({ name: item.name })
			await db.collection("messages").insertOne({
				from: item.name,
				to: "Todos",
				text: "sai da sala...",
				type: "status",
				time: dayjs().format("HH:mm:ss")
			});
		}
	})
}

setInterval(removeInactiveParticipants, 15000);

app.listen(5000, () => console.log("Servidor foi iniciado."));