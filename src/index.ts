import enet from "enet";
import {
	BanList,
	JsonConfig,
	Member,
	PacketHandler,
	PacketType,
	RoomOptions,
	StatusMessageTypes,
} from "./types";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import "colorts/lib/string";
import {
	COLORS,
	createIp,
	encodeIp,
	generateColorText,
	log,
	sendAsServer,
	sendStatusMessage,
	stringToBuffer,
} from "./util";
import { v4 } from "uuid";
import dotenv from "dotenv";
import { parse } from "ts-command-line-args";
import readline from "readline";
import { constructMessagePacket } from "./handlers/IdChatMessage/chatUtil";
import consolePng from "console-png";

consolePng.attachTo(console);

dotenv.config();

console.clear();

export const START_DATE = performance.now();

let config: RoomOptions = {
	name: "Suyu Dedicated Server",
	description: "A TypeScript, custom-written dedicated UDP server for Suyu.",
	maxPlayers: 10,
	port: 24872,
	preferredGameName: "",
	preferredGameId: 0,
	hostName: "https://github.com/not-nullptr/yuzu-server-ts",
	fakeMembers: [],
};

export let rl: readline.Interface;
export let banlist: BanList;
export let publicJwtKey: string = "FAKE_JWT_KEY";

try {
	JSON.parse(readFileSync("./banlist.json", "utf-8"));
} catch {
	writeFileSync("./banlist.json", `{ "bans": [], "reports": [] }`);
}

const args = parse<
	RoomOptions & {
		generateConfig: boolean;
		help: boolean;
	}
>({
	name: {
		type: String,
		defaultValue: config.name,
		description: "The name of the server",
	},
	description: {
		type: String,
		defaultValue: config.description,
		description: "The description of the server",
	},
	maxPlayers: {
		type: Number,
		defaultValue: config.maxPlayers,
		description: "The maximum number of players",
	},
	port: {
		type: Number,
		defaultValue: config.port,
		description: "The port to run the server on",
	},
	gameName: {
		type: String,
		defaultValue: config.preferredGameName,
		description: "The name of the game",
	},
	hostName: {
		type: String,
		defaultValue: config.hostName,
		description: "The name of the person/user hosting the server",
	},
	generateConfig: {
		type: Boolean,
		description: "Generate a config file",
	},
	help: {
		type: Boolean,
		alias: "h",
		description: "Show this help message",
	},
} as any);

if (args.help) {
	Object.entries(args).forEach(([key, value]) => {
		if (key === "help") {
			return;
		}
		log(
			"INFO",
			`--${key}: ${typeof value} (default: ${value.toString() || "none"})`
		);
	});
	process.exit(0);
}

// read if it exists
export let jsonConfig: JsonConfig = {};
try {
	jsonConfig = JSON.parse(readFileSync("./config.json", "utf-8"));
} catch {
	log("WARNING", "No config file found, using defaults");
}

config = {
	...config,
	...args,
	...jsonConfig.opts,
};

// @ts-expect-error
delete config.help;
// @ts-expect-error
delete config.generateConfig;

function updateRlPrompt() {
	// hh:mm
	const time = new Date().toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
	const prompt = `[${time}] ${generateColorText(
		"<Server> ",
		COLORS[
			(Object.values(server?.getClients() || {})?.length || 0) %
				COLORS.length
		]
	)}`;
	rl?.setPrompt(prompt);
	// send cursor to end
	rl?.write(null, { ctrl: true, name: "e" });
	return prompt;
}

async function createServer(options: enet.ServerOpts): Promise<enet.Server> {
	return new Promise((resolve, reject) => {
		enet.createServer(options, (err, host) => {
			if (err) {
				reject(err);
			}
			if (!host)
				throw new Error("Host is undefined! (port is already in use?)");
			host.start(50);
			resolve(host);
		});
	});
}

function parsePacket(data: Buffer): { type: PacketType; payload: Buffer } {
	const type = data.readUInt8(0);
	const payload = data.subarray(1);
	return { type, payload };
}

// @ts-expect-error
const handlers: Record<keyof typeof PacketType, PacketHandler> = {};

function camelToSpaced(str: string) {
	// camelCase => Camel Case, with capitalization
	return str
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (s) => s.toUpperCase())
		.replaceAll("  ", " ")
		.trim();
}

export class Server {
	// @ts-expect-error
	private server: enet.Server;
	private clients: Record<
		string,
		{
			peer: enet.Peer;
			member?: Member;
		}
	> = {};
	public id: string = "";
	constructor(public options: RoomOptions) {}
	async start() {
		this.server = await createServer({
			address: {
				address: "0.0.0.0",
				port: this.options.port,
			},
			peers: 32,
			channels: 2,
			down: 0,
			up: 0,
		});
		this.server.on("connect", (peer, data) => {
			const id = v4();
			this.clients[id] = {
				...this.clients[id],
				peer,
			};
			peer.on("message", (packet) => {
				const d = parsePacket(packet.data());
				const handler =
					handlers[PacketType[d.type] as keyof typeof PacketType];
				if (!handler) {
					log(
						"WARNING",
						`No handler for packet type ${
							PacketType[d.type].bgGreen
						}`
					);
					return;
				}
				try {
					handler(
						d.payload,
						(data) => {
							peer.send(
								0,
								typeof data === "number"
									? Buffer.from([data])
									: data
							);
						},
						(...message) => log(PacketType[d.type], ...message),
						id,
						packet.data()
					);
				} catch (e) {
					log("ERROR", `(in ${PacketType[d.type]}) ${e}`);
				}
			});
			peer.on("disconnect", () => {
				const member = this.clients[id].member;
				if (member) {
					if (jsonConfig.byeMessage) {
						sendAsServer(
							typeof jsonConfig.byeMessage === "string"
								? jsonConfig.byeMessage.replaceAll(
										"{{name}}",
										member.nickname
								  )
								: jsonConfig.byeMessage.map((m) =>
										m.replaceAll(
											"{{name}}",
											member.nickname
										)
								  )
						);
					}
					log(
						"no-info",
						generateColorText(
							`* ${member.nickname} has left`,
							"#ff8c00"
						)
					);
				}
				delete this.clients[id];
				this.broadcastInfo();
			});
		});
		try {
			const res = await fetch(`${process.env.API_URL}/lobby`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: process.env.API_TOKEN,
				},
				body: JSON.stringify({
					...this.options,
					members: Object.values(this.clients).map((c) => ({
						...c.member,
						gameId: c.member?.gameId.toString(),
					})),
				}),
			});
			if (!res.ok) {
				throw new Error("Failed to create room");
			}
			const body = await res.json();
			this.id = body.id;
		} catch {
			log(
				"SERVER",
				"Failed to create room publicly, listing as private!"
			);
		}
		Object.entries(this.options).forEach(([key, value]) => {
			if (key === "fakeMembers") return;
			log(
				"SERVER",
				`${camelToSpaced(key || "")}: ${(value || "(none)").toString()}`
			);
		});

		log(
			"SERVER",
			`Server started on port ${this.options.port.toString()}!`
		);
		if (process.env.COOL_LOGGING_ONLY === "true") {
			// let timeout: NodeJS.Timeout;
			// let joined = false;
			// perpetually, asynchronously read line
			rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
				prompt: updateRlPrompt(),
			});
			rl.prompt();
			rl?.write(null, { ctrl: true, name: "e" });
			rl.on("line", async (line) => {
				updateRlPrompt();
				rl.prompt();
				rl?.write(null, { ctrl: true, name: "e" });
				// if (!joined) {
				await sendAsServer(line, true);
				// joined = true;

				// clearTimeout(timeout);
				// timeout = setTimeout(() => {
				// 	joined = false;
				// 	server.setFakeMembers([]);
				// }, 5000);
			});
		}
	}
	broadcast(data: Buffer, ...exclusions: string[]) {
		for (const id in this.clients) {
			if (exclusions.includes(id)) {
				continue;
			}
			this.clients[id].peer.send(0, data);
		}
	}

	getClientById(id: string) {
		return this.clients[id];
	}

	getRoomInfoPacket(): Buffer {
		const typeBuf = Buffer.alloc(1);
		typeBuf.writeUInt8(PacketType.IdRoomInformation, 0);
		let nameBuf = stringToBuffer(this.options.name);
		let descriptionBuf = stringToBuffer(this.options.description);
		let maxPlayersBuf = Buffer.alloc(4);
		maxPlayersBuf.writeUInt32BE(this.options.maxPlayers, 0);
		let portBuf = Buffer.alloc(2);
		portBuf.writeUInt16BE(this.options.port, 0);
		const gameNameBuf = stringToBuffer(this.options.preferredGameName);
		const hostNameBuf = stringToBuffer(this.options.hostName);
		const memberCountBuf = Buffer.alloc(4);
		memberCountBuf.writeUInt32BE(
			Object.keys(this.clients).length +
				(this.options.fakeMembers?.length || 0),
			0
		);
		let memberPackets: Buffer[] = [];
		for (const member of Object.values(this.clients)
			.map((c) => c.member)
			.filter((m) => typeof m !== "undefined")
			.concat(
				this.options.fakeMembers?.map((m) => ({
					nickname: m,
					ip: "0.0.0.0",
					gameId: BigInt(0),
					gameName: "Playing with the server",
					gameVersion:
						"https://github.com/not-nullptr/yuzu-server-ts",
					username: m,
					displayName: m,
					avatarUrl: "",
					clientId: v4(),
				}))
			)
			.map(
				(m) =>
					[
						m!.nickname,
						m!.ip,
						m!.gameName,
						m!.gameId,
						m!.gameVersion,
						m!.username,
						m!.displayName,
						m!.avatarUrl,
					] as [
						string,
						string,
						string,
						bigint,
						string,
						string,
						string,
						string
					]
			)) {
			const [
				nickname,
				ip,
				gameName,
				gameId,
				gameVersion,
				username,
				displayName,
				avatarUrl,
			] = member;
			const nicknameBuf = stringToBuffer(nickname);
			const ipBuf = encodeIp(ip);
			const gameNameBuf = stringToBuffer(gameName);
			let gameIdBuf = Buffer.alloc(8);
			gameIdBuf.writeBigUInt64BE(gameId, 0);
			const gameVersionBuf = stringToBuffer(gameVersion);
			const usernameBuf = stringToBuffer(username);
			const displayNameBuf = stringToBuffer(displayName);
			const avatarBuf = stringToBuffer(avatarUrl);
			const payload = Buffer.concat([
				nicknameBuf,
				ipBuf,
				gameNameBuf,
				gameIdBuf,
				gameVersionBuf,
				usernameBuf,
				displayNameBuf,
				avatarBuf,
			]);
			memberPackets.push(payload);
		}
		const payload = Buffer.concat([
			typeBuf,
			nameBuf,
			descriptionBuf,
			maxPlayersBuf,
			portBuf,
			gameNameBuf,
			hostNameBuf,
			memberCountBuf,
			...memberPackets,
		]);
		// return Buffer.concat([typeBuf, payload]);
		return Buffer.from(payload);
	}

	broadcastInfo() {
		const packet = this.getRoomInfoPacket();
		updateRlPrompt();
		rl?.prompt();
		rl?.write(null, { ctrl: true, name: "e" });

		this.broadcast(packet);
	}

	setFakeMembers(members: string[]) {
		this.options.fakeMembers = members;
		// members.forEach((m) => {
		// 	sendStatusMessage(
		// 		StatusMessageTypes.IdMemberJoin,
		// 		m,
		// 		m,
		// 		createIp("0.0.0.0")
		// 	);
		// });
		this.broadcastInfo();
	}

	addMember(member: Member) {
		this.clients[member.clientId].member = member;
		this.broadcastInfo();
	}

	getMemberByNickname(nickname: string) {
		return Object.values(this.clients)
			.map((c) => c.member)
			.find((m) => m?.nickname === nickname);
	}

	getMemberByIP(ip: string) {
		return Object.values(this.clients)
			.map((c) => c.member)
			.find((m) => m?.ip === ip);
	}

	getClients() {
		return this.clients;
	}

	getClientByIP(ip: string) {
		return Object.values(this.clients).find((c) => c.member?.ip === ip);
	}
}

export let server: Server;

async function main() {
	const res = await fetch(`${process.env.API_URL}/jwt/external/key.pem`);
	if (res.ok) {
		publicJwtKey = await res.text();
	}
	log(
		"INFO",

		"yuzu-server-ts - An open-source, easier-to-understand yuzu-room implementation"
	);
	const lServer = new Server(config);
	readdirSync("./src/handlers").forEach((file) => {
		const handler = require(`./handlers/${file}`);
		const type = file.replace(".ts", "") as keyof typeof PacketType;
		handlers[type] = handler[type];
		log("LOG", `Loaded handler for packet type ${type}`);
	});
	await lServer.start();
	server = lServer;
}

main();

(process.emit as any) = function () {
	return false;
};
