import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import {
	createIp,
	generateIp,
	readIp,
	readString,
	sendStatusMessage,
} from "../../util";
import * as util from "../../util";
import { constructMessagePacket } from "../IdChatMessage/chatUtil";

export const IdJoinRequest: PacketHandler = (data, send, log, id) => {
	let offset = 0;
	const nicknameInfo = readString(data, offset);
	offset = nicknameInfo[1];
	const ipInfo = readIp(data, offset);
	offset = ipInfo[1];
	const version = data.readUInt32BE(offset);
	offset += 4;
	const nickname = nicknameInfo[0];
	const ip = ipInfo[0] === "255.255.255.255" ? generateIp() : ipInfo[0];
	log(`Join request from ${nickname} (${ip}), v${version}`);
	if (server.getMemberByNickname(nickname)) {
		log(`Name collision for ${nickname}!`);
		send(PacketType.IdNameCollision);
		return;
	}
	server.addMember({
		nickname,
		ip,
		avatarUrl: "",
		displayName: "",
		gameId: BigInt(0),
		gameName: "",
		gameVersion: "",
		username: "",
		clientId: id,
	});
	const header = Buffer.alloc(1);
	header.writeUInt8(PacketType.IdJoinSuccess, 0);
	// write the IP
	const ipBuf = createIp(ip);
	const packet = Buffer.concat([header, ipBuf]);
	send(packet);
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
