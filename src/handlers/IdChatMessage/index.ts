import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import {
	COLORS,
	generateColorText,
	readString,
	sendStatusMessage,
	stringToBuffer,
} from "../../util";
import * as util from "../../util";
import { constructMessagePacket } from "./chatUtil";

export const IdChatMessage: PacketHandler = (data, send, log, id) => {
	const [message] = readString(data, 0);
	// log("Chat message from", `"${message}"`);
	const header = Buffer.alloc(1);
	header.writeUInt8(PacketType.IdChatMessage, 0);
	const client = server.getClientById(id);
	if (!client.member) {
		log("Member not found");
		client.peer.disconnect(PacketType.IdHostKicked);
		return;
	}
	// hh:mm
	const time = new Date().toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});

	let index = -1;
	const clients = server.getClients();
	Object.entries(clients).forEach(([key, value], i) => {
		if (key === id) {
			index = i;
		}
	});
	if (index === -1) {
		log("Client not found");
		return;
	}

	// log(
	// 	`New Chat:\n[${time}] ${generateColorText(
	// 		`<${client.member.nickname || "Unknown"}>`,
	// 		COLORS[index % COLORS.length]
	// 	)} ${message}`
	// );

	util.log(
		"no-info",
		`[${time}] ${generateColorText(
			`<${client.member.nickname || "Unknown"}>`,
			COLORS[index % COLORS.length]
		)} ${message}`
	);

	const packet = constructMessagePacket(
		client.member.nickname,
		client.member.username,
		message
	);
	server.broadcast(packet, id);
};
