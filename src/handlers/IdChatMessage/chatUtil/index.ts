import { PacketType } from "../../../types";
import { stringToBuffer } from "../../../util";

export function constructMessagePacket(
	nickname: string,
	username: string,
	message: string
): Buffer {
	const header = Buffer.alloc(1);
	header.writeUInt8(PacketType.IdChatMessage, 0);
	const nicknameBuf = stringToBuffer(nickname);
	const usernameBuf = stringToBuffer(username);
	const messageBuf = stringToBuffer(message);
	return Buffer.concat([header, nicknameBuf, usernameBuf, messageBuf]);
}

export function parseCommand(message: string): {
	command: string;
	args: string[];
} | null {
	if (!message.startsWith("/")) return null;
	const parts = message
		.slice(1)
		.match(/\\?.|^$/g)
		?.reduce(
			(p: any, c) => {
				if (c === '"') {
					p.quote ^= 1;
				} else if (!p.quote && c === " ") {
					p.a.push("");
				} else {
					p.a[p.a.length - 1] += c.replace(/\\(.)/, "$1");
				}
				return p;
			},
			{ a: [""] }
		).a;
	if (!parts) return null;
	const command = parts[0];
	const args = parts.slice(1);
	return { command, args };
}
