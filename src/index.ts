import enet from "enet";
import { Member, PacketHandler, PacketType, StatusMessageTypes } from "./types";
import { readdirSync } from "fs";
import "colorts/lib/string";
import { encodeIp, log, sendStatusMessage, stringToBuffer } from "./util";
import { v4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

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
							log(PacketType[d.type] as any, ...message),
						id
					);
				} catch (e) {
					log("ERROR", `(in ${PacketType[d.type]}) ${e}`);
				}
			});
			peer.on("disconnect", () => {
				const member = this.clients[id].member;
				if (member) {
					sendStatusMessage(
						StatusMessageTypes.IdMemberLeave,
						member.nickname,
						member.username,
						id
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
			log("ERROR", "Failed to create room publicly, listing as private!");
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
		memberCountBuf.writeUInt32BE(Object.keys(this.clients).length, 0);
		let memberPackets: Buffer[] = [];
		for (const member of Object.values(this.clients)
			.map((c) => c.member)
			.filter((m) => typeof m !== "undefined")
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
		this.broadcast(packet);
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

	getClientByIP(ip: string) {
		return Object.values(this.clients).find((c) => c.member?.ip === ip);
	}
}

export let server: Server;

async function main() {
	const lServer = new Server({
		name: "Room Name",
		description: "Room Description",
		maxPlayers: 10,
		port: 5000,
		gameName: "Mario Kart 8 Deluxe",
		hostName: "",
	});
	await lServer.start();
	server = lServer;
}

main();
