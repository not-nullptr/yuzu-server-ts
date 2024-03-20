import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import { generateIp, readIp, readString, sendStatusMessage } from "../../util";

export const IdJoinRequest: PacketHandler = (data, send, log, id) => {
	let offset = 0;
	const nicknameInfo = readString(data, offset);
	offset = nicknameInfo[1];
	const ipInfo = readIp(data, offset);
	offset = ipInfo[1];
	const version = data.readUInt32BE(offset);
	offset += 4;
	const nickname = nicknameInfo[0];
	const ip = ipInfo[0];
	log(`Join request from ${nickname} (${ip}), v${version}`);
	if (server.getMemberByNickname(nickname)) {
		log(`Name collision for ${nickname.yellow}!`);
		send(PacketType.IdNameCollision);
		return;
	}
	server.addMember({
		nickname,
		ip: generateIp(),
		avatarUrl: "",
		displayName: "",
		gameId: BigInt(0),
		gameName: "",
		gameVersion: "",
		username: "",
		clientId: id,
	});
	send(PacketType.IdJoinSuccess);
	sendStatusMessage(StatusMessageTypes.IdMemberJoin, nickname, nickname, id);
	log(`Join succeeded for ${nickname.yellow}!`);
};
