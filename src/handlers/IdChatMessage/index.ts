import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import { readString, sendStatusMessage, stringToBuffer } from "../../util";

export const IdChatMessage: PacketHandler = (data, send, log) => {
	const [message] = readString(data, 0);
	log("Chat message", `"${message}"`.green);
	const header = Buffer.alloc(1);
	header.writeUInt8(PacketType.IdChatMessage, 0);
	const nickname = stringToBuffer("nullptr", undefined, true);
	const username = stringToBuffer("");
	const msg = stringToBuffer(message);
	const payload = Buffer.concat([nickname, username, msg]);
	const packet = Buffer.concat([header, payload]);
	server.broadcast(packet);
};
