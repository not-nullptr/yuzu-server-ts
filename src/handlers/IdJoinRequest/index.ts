import { jsonConfig, publicJwtKey, server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import {
	createIp,
	generateIp,
	readIp,
	readString,
	sendStatusMessage,
} from "../../util";
import * as util from "../../util";
import jwt from "jsonwebtoken";

async function decodeToken(token: string) {
	return new Promise((resolve, reject) => {
		jwt.verify(token, publicJwtKey, (err, decoded) => {
			if (err) reject(err);
			resolve(decoded);
		});
	});
}

export const IdJoinRequest: PacketHandler = async (data, send, log, id) => {
	let offset = 0;
	const nicknameInfo = readString(data, offset);
	offset = nicknameInfo[1];
	const ipInfo = readIp(data, offset);
	offset = ipInfo[1];
	const version = data.readUInt32BE(offset);
	offset += 4;
	const nickname = nicknameInfo[0];
	const ip = ipInfo[0] === "255.255.255.255" ? generateIp() : ipInfo[0];
	offset += 8;
	const token = data.subarray(offset).toString("utf-8");
	let username = "";
	let avatarUrl = "";
	try {
		console.log(token);
		const jwt = (await decodeToken(token)) as {
			username: string;
			avatarUrl: string;
		};
		username = jwt.username;
		avatarUrl = jwt.avatarUrl;
		// fetch avatar url as buffer
		const avatarRes = await fetch(avatarUrl);
		const avatarBuf = await avatarRes.arrayBuffer();
		const buffer = Buffer.from(avatarBuf);
		const { default: terminalImage } = (await import(
			// @ts-expect-error
			"terminal-image"
		)) as typeof import("terminal-image");
		const img = await terminalImage.buffer(buffer, { width: 10 });
		const lines = [
			"!! USER JOINED !!",
			"Username: " + username === nickname || !username
				? nickname
				: `${nickname} (${username})`,
			"Authenticated: " + (username ? "Yes" : "No"),
		];
		// append lines to img, center vertically and justify after the image
		const imgLines = img.split("\n");
		console.log();
		imgLines.forEach((line, i) => {
			if (line.trim() === "" || i === 0 || i === 4)
				return console.log(line);
			console.log(`${line}   ${lines[i - 1]}`);
		});
	} catch (e) {
		console.log("Error decoding token");
		console.error(e);
	}
	console.log(username, avatarUrl);
	log(`Join request from ${nickname} (${ip}), v${version}`);
	if (server.getMemberByNickname(nickname)) {
		log(`Name collision for ${nickname}!`);
		send(PacketType.IdNameCollision);
		return;
	}
	server.addMember({
		nickname,
		ip,
		avatarUrl,
		displayName: "",
		gameId: BigInt(0),
		gameName: "",
		gameVersion: "",
		username,
		clientId: id,
	});
	const header = Buffer.alloc(1);
	header.writeUInt8(PacketType.IdJoinSuccess, 0);
	// write the IP
	const ipBuf = createIp(ip);
	const packet = Buffer.concat([header, ipBuf]);
	send(packet);
	if (jsonConfig.greetMessage)
		util.sendAsServer(
			typeof jsonConfig.greetMessage === "string"
				? jsonConfig.greetMessage.replaceAll("{{name}}", nickname)
				: jsonConfig.greetMessage.map((msg) =>
						msg.replaceAll("{{name}}", nickname)
				  )
		);
	else
		sendStatusMessage(
			StatusMessageTypes.IdMemberJoin,
			nickname,
			nickname,
			ipBuf,
			id
		);
	log(`Join succeeded for ${nickname}!`);
	util.log(
		"no-info",
		util.generateColorText(`* ${nickname} has joined`, "#ff8c00")
	);
};
