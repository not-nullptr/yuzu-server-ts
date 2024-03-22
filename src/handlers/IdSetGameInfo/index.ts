import { server } from "../..";
import { PacketHandler } from "../../types";
import { readString } from "../../util";
import * as util from "../../util";

export const IdSetGameInfo: PacketHandler = (data, send, log, clientId) => {
	const client = server.getClientById(clientId);
	if (!client || !client.member) {
		util.log("ERROR", "Client not found (IdSetGameInfo)");
		return;
	}
	log("Setting game info");
	let offset = 0;
	const [name, nameOffset] = readString(data, offset);
	offset = nameOffset;
	const id = data.readBigUInt64BE(offset);
	offset += 8;
	const [version, versionOffset] = readString(data, offset);
	offset = versionOffset;
	log(
		`User: ${client.member.nickname.magenta}, Name: ${
			(name || "(empty string)").magenta
		}, ID: ${id.toString().magenta}, Version: ${
			(version || "(empty string)").magenta
		}`
	);
	client.member.gameName = name;
	client.member.gameId = id;
	client.member.gameVersion = version;
	server.broadcastInfo();
};
