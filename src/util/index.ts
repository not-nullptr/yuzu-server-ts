import { Server, server } from "..";
import { PacketType, StatusMessageTypes } from "../types";

const colorMap = {
	LOG: "blue",
	WARNING: "yellow",
	ERROR: "red",
	IdJoinRequest: "green",
};

export function log(prefix: keyof typeof colorMap, ...message: any[]) {
	console.log(
		`${"[".gray}${prefix[(colorMap[prefix] || "green") as any]}${"]".gray}`,
		...message
	);
}

export function sendStatusMessage(
	type: StatusMessageTypes,
	nickname: string,
	username: string,
	...exclusions: string[]
) {
	log(
		"LOG",
		`Sending status message of type ${
			StatusMessageTypes[type]
		} to all clients ${
			exclusions.length ? `except ${exclusions.join(", ")}` : ""
		}`
	);
	const data = Buffer.alloc(2);
	data.writeUInt8(PacketType.IdStatusMessage, 0);
	data.writeUInt8(type, 1);
	// write the nickname, username, and ip address
	const nicknameBuffer = stringToBuffer(nickname);
	const usernameBuffer = stringToBuffer(username);
	const payload = Buffer.concat([nicknameBuffer, usernameBuffer]);
	const packet = Buffer.concat([data, payload]);
	// send the packet to all clients
	server.broadcast(packet, ...exclusions);
}

export function readString(buffer: Buffer, offset: number): [string, number] {
	// 4 bytes for the length of the string. not encoded; just convert to decimal
	const length = parseInt(
		buffer.subarray(offset, offset + 4).toString("hex"),
		16
	);
	const string = buffer.subarray(offset + 4, offset + 4 + length).toString();
	return [string, offset + 4 + length];
}

export function stringToBuffer(
	str: string,
	pad?: "start" | "end",
	ignoreLength?: boolean
): Buffer {
	// throw if string is greater than 4 bytes
	if (str.length > 0xffffffff) {
		throw new Error("String is too long");
	}
	const length = Buffer.alloc(4);
	const hexStr = str.length.toString(16).padStart(8, "0");
	length.write(hexStr, 0, 4, "hex");
	const string = Buffer.from(str);
	const terminatorStart = Buffer.from(
		pad === "start" ? [0x00, 0x00, 0x00] : []
	);
	const terminatorEnd = Buffer.from(pad === "end" ? [0x00, 0x00, 0x00] : []);
	const payload = Buffer.concat([
		terminatorStart,
		Buffer.from(!ignoreLength ? length : []),
		string,
		terminatorEnd,
	]);
	return payload;
}

export function encodeIp(ip: string): Buffer {
	const parts = ip.split(".").map((part) => parseInt(part));
	return Buffer.from(parts);
}

export function readIp(buffer: Buffer, offset: number): [string, number] {
	const ip = buffer.subarray(offset, offset + 4).join(".");
	return [ip, offset + 4];
}

export function generateIp(): string {
	// 192.168.[0-255].[0-255]
	return `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(
		Math.random() * 256
	)}`;
}

export function readBool(buffer: Buffer, offset: number): [boolean, number] {
	const bool = buffer.at(offset) !== 0x00;
	return [bool, offset + 1];
}
