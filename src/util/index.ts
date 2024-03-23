import path from "path";
import { START_DATE, Server, rl, server } from "..";
import { PacketType, StatusMessageTypes } from "../types";
import process from "process";

const srcDir = path.resolve(__dirname, "..", "..");

function uppercaseToFirst(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// TODO: identical logging to suyu/yuzu
export function log(prefix: string, ...message: any[]) {
	if (process.env.COOL_LOGGING_ONLY === "true") {
		if (prefix === "no-info") {
			process.stdout.write(`\n${message.join(" ")}`);
			console.log();
			rl?.prompt();
		}
		return;
	}
	if (prefix === "no-info") prefix = "Info";
	console.log(
		`[ ${((performance.now() - START_DATE) / 1000).toFixed(6)}]`,
		// "Network",
		`<${
			Object.keys(PacketType).includes(prefix)
				? prefix
				: uppercaseToFirst(prefix)
		}>`,
		...message
	);
}

export function sendStatusMessage(
	type: StatusMessageTypes,
	nickname: string,
	username: string,
	ip: Buffer,
	...exclusions: string[]
) {
	log(
		"LOG",
		`Sending status message of type ${
			StatusMessageTypes[type]
		} to all clients ${
			exclusions.length
				? `except ${exclusions
						.map((e) => server.getClientById(e).member?.nickname)
						.join(", ")}`
				: ""
		}`
	);
	const data = Buffer.alloc(2);
	data.writeUInt8(PacketType.IdStatusMessage, 0);
	data.writeUInt8(type, 1);
	// write the nickname, username, and ip address
	const nicknameBuffer = stringToBuffer(nickname);
	const usernameBuffer = stringToBuffer(username);
	const payload = Buffer.concat([nicknameBuffer, usernameBuffer, ip]);
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

export function stringToBuffer(str: string): Buffer {
	// throw if string is greater than 4 bytes
	if (str.length > 0xffffffff) {
		throw new Error("String is too long");
	}
	const length = Buffer.alloc(4);
	const hexStr = str.length.toString(16).padStart(8, "0");
	length.write(hexStr, 0, 4, "hex");
	const string = Buffer.from(str);
	const payload = Buffer.concat([length, string]);
	return payload;
}

export function encodeIp(ip: string): Buffer {
	const parts = ip.split(".").map((part) => parseInt(part));
	return Buffer.from(parts);
}

export function readIp(buffer: Buffer, offset: number): [string, number] {
	const ipRange = buffer.subarray(offset, offset + 4);
	const nums = ipRange.map((hex) => parseInt(hex.toString(16), 16));
	return [nums.join("."), offset + 4];
}

export function createIp(ip: string): Buffer {
	const parts = ip.split(".").map((part) => parseInt(part));
	return Buffer.from(parts);
}

export function generateIp(): string {
	// 192.168.[0-255].[0-255]
	return `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(
		Math.random() * 256
	)}`;
}

interface Color {
	r: number;
	g: number;
	b: number;
}

export function readBool(buffer: Buffer, offset: number): [boolean, number] {
	const bool = buffer.at(offset) !== 0x00;
	return [bool, offset + 1];
}

function rgbToAnsi256(r: number, g: number, b: number) {
	const ansi =
		16 +
		Math.round((r / 255) * 5) * 36 +
		Math.round((g / 255) * 5) * 6 +
		Math.round((b / 255) * 5);
	return ansi.toString();
}

export function generateColorText(text: string, color: string | Color) {
	if (typeof color === "string") {
		color = {
			r: parseInt(color.slice(1, 3), 16),
			g: parseInt(color.slice(3, 5), 16),
			b: parseInt(color.slice(5, 7), 16),
		};
	}
	const ansiColor = rgbToAnsi256(color.r, color.g, color.b);
	return `\x1b[38;5;${ansiColor}m${text}\x1b[0m`;
}

export const COLORS = [
	"#559AD1",
	"#4EC9A8",
	"#D69D85",
	"#C6C923",
	"#B975B5",
	"#D81F1F",
	"#7EAE39",
	"#4F8733",
	"#F7CD8A",
	"#6FCACF",
	"#CE4897",
	"#8A2BE2",
	"#D2691E",
	"#9ACD32",
	"#FF7F50",
	"#152ccd",
];
