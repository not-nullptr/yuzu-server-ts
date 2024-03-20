import enet from "enet";
import { PacketHandler, PacketType, StatusMessageTypes } from "./types";
import { readdirSync } from "fs";
import "colorts/lib/string";
import { encodeIp, log, stringToBuffer } from "./util";
import { v4 } from "uuid";

async function createServer(options: enet.ServerOpts): Promise<enet.Server> {
	return new Promise((resolve, reject) => {
		enet.createServer(options, (err, host) => {
			if (err) {
				reject(err);
			}
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

readdirSync("./src/handlers").forEach((file) => {
	const handler = require(`./handlers/${file}`);
	const type = file.replace(".ts", "") as keyof typeof PacketType;
	handlers[type] = handler[type];
	log("LOG", `Loaded handler for packet type ${type}`);
});

interface RoomOptions {
	name: string;
	description: string;
	maxPlayers: number;
	port: number;
	gameName: string;
	hostName: string;
	members: {
		nickname: string;
		ip: string;
		gameName: string;
		gameId: bigint;
		gameVersion: string;
		username: string;
		displayName: string;
		avatarUrl: string;
	}[];
}

export class Server {
	// @ts-expect-error
	private server: enet.Server;
	private clients: Record<string, enet.Peer> = {};
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
			this.clients[id] = peer;
			peer.on("message", (packet, channel) => {
				const d = parsePacket(packet.data());
				const handler =
					handlers[PacketType[d.type] as keyof typeof PacketType];
				if (!handler) {
					log(
						"WARNING",
						`No handler for packet type ${PacketType[d.type]}`
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
						(...message) =>
							log(PacketType[d.type] as any, ...message)
					);
				} catch (e) {
					log("ERROR", `(in ${PacketType[d.type]}) ${e}`);
				}
			});
			peer.on("disconnect", () => {
				delete this.clients[id];
			});
		});
	}
	broadcast(data: Buffer) {
		for (const id in this.clients) {
			this.clients[id].send(0, data);
		}
	}

	getRoomInfoPacket(): Buffer {
		const typeBuf = Buffer.alloc(1);
		typeBuf.writeUInt8(PacketType.IdRoomInformation, 0);
		// const nameBuf = Buffer.from("Test Room");
		// const descriptionBuf = Buffer.from("This is a test room");
		let nameBuf = stringToBuffer(this.options.name);
		let descriptionBuf = stringToBuffer(this.options.description);
		let maxPlayersBuf = Buffer.alloc(4);
		maxPlayersBuf.writeUInt32BE(this.options.maxPlayers, 0);
		let portBuf = Buffer.alloc(2);
		portBuf.writeUInt16BE(this.options.port, 0);
		const gameNameBuf = stringToBuffer(this.options.gameName);
		const hostNameBuf = stringToBuffer(this.options.hostName);
		const memberCountBuf = Buffer.alloc(4);
		memberCountBuf.writeUInt32BE(this.options.members.length, 0);
		let memberPackets: Buffer[] = [];
		for (const member of this.options.members.map(
			(m) =>
				[
					m.nickname,
					m.ip,
					m.gameName,
					m.gameId,
					m.gameVersion,
					m.username,
					m.displayName,
					m.avatarUrl,
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
		this.broadcast(packet);
	}
}

export let server: Server;

async function main() {
	const lServer = new Server({
		name: "Room Name",
		description: "Room Description",
		maxPlayers: 10,
		port: 5000,
		gameName: "Game Name",
		hostName: "Host Name",
		members: [
			{
				displayName: "",
				nickname: "nullptr-alt",
				avatarUrl: "",
				gameId: 0x0100152000022000n,
				gameName: "",
				gameVersion: "",
				ip: "0.0.0.0",
				username: "",
			},
		],
	});
	await lServer.start();
	server = lServer;
}

main();
