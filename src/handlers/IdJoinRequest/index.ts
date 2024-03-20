import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import { readIp, readString, sendStatusMessage } from "../../util";

export const IdJoinRequest: PacketHandler = (data, send, log) => {
	let offset = 0;
	const nicknameInfo = readString(data, offset);
	offset = nicknameInfo[1];
	const ipInfo = readIp(data, offset);
	offset = ipInfo[1];
	const version = data.readUInt32BE(offset);
	offset += 4;
	const nickname = nicknameInfo[0];
	const ip = ipInfo[0];
	console.log(data);
	log(`Join request from ${nickname} (${ip}), v${version}`);
	server.broadcastInfo();
	send(PacketType.IdJoinSuccess);
	sendStatusMessage(StatusMessageTypes.IdMemberJoin, nickname, nickname);
};
