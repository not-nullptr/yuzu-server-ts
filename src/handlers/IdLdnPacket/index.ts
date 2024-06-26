import { server } from "../..";
import { PacketHandler } from "../../types";
import { readBool, readIp } from "../../util";
import * as util from "../../util";

export const IdLdnPacket: PacketHandler = (data, send, log, id, rawData) => {
	let offset = 1 + 1 + 4; // LAN packet type and local IP
	const [ipv4, ipv4Offset] = readIp(data, offset);
	offset = ipv4Offset;
	const [broadcast, broadcastOffset] = readBool(data, offset);
	offset = broadcastOffset;
	console.log(data.toString("hex"));
	if (broadcast) {
		server.broadcast(rawData, id);
	} else {
		const client = server.getClientByIP(ipv4);
		if (!client) {
			util.log("ERROR", "Client not found (IdLdnPacket)");
			return;
		}
		client.peer.send(0, rawData);
	}
};
