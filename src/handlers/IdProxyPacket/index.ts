import { server } from "../..";
import { PacketHandler } from "../../types";
import { readString } from "../../util";
import * as util from "../../util";

export const IdProxyPacket: PacketHandler = (
	data,
	send,
	log,
	clientId,
	rawData
) => {
	let offset = 0;
	offset += 1; // domain?
	offset += 4; // ip
	offset += 2; // port

	offset += 1;
	const [remoteIp, remoteIpOffset] = util.readIp(data, offset);
	offset += remoteIpOffset;
	offset += 2; // port. again.

	offset += 1; // protocol, which we know

	const [broadcast, broadcastOffset] = util.readBool(data, offset);
	offset = broadcastOffset;
	if (broadcast) {
		server.broadcast(rawData);
	} else {
		const client = server.getClientByIP(remoteIp);
		if (!client) {
			util.log("ERROR", "Client not found (IdProxyPacket)");
			return;
		}
		client.peer.send(0, rawData);
	}
};
