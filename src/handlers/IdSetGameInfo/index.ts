import { server } from "../..";
import { PacketHandler } from "../../types";

export const IdSetGameInfo: PacketHandler = (data, send, log) => {
	log("Setting game info");
	server.broadcastInfo();
};
