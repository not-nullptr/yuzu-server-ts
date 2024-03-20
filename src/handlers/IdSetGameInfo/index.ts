import { server } from "../..";
import { PacketHandler, PacketType, StatusMessageTypes } from "../../types";
import { sendStatusMessage } from "../../util";

export const IdSetGameInfo: PacketHandler = (data, send, log) => {
	log("Setting game info");
	server.broadcastInfo();
};
