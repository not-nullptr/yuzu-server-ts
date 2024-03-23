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
