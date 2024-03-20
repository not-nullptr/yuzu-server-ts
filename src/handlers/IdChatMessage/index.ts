import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import { readString, sendStatusMessage, stringToBuffer } from "../../util";

export const IdChatMessage: PacketHandler = (data, send, log, id) => {
	const [message] = readString(data, 0);
	// log("Chat message from", `"${message}"`.green);
	const header = Buffer.alloc(1);
	header.writeUInt8(PacketType.IdChatMessage, 0);
	const client = server.getClientById(id);
	if (!client.member) {
		log("Member not found");
		client.peer.disconnect(PacketType.IdHostKicked);
		return;
	}
	log(`Chat message from ${client.member.nickname.red}: "${message.blue}"`);
	const nickname = stringToBuffer(client.member.nickname);
	const username = stringToBuffer(client.member.username);
	const msg = stringToBuffer(message);
	const payload = Buffer.concat([nickname, username, msg]);
	const packet = Buffer.concat([header, payload]);
	server.broadcast(packet, id);
};
