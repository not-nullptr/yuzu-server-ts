import { server } from "../..";
import { cmdHandlers } from "../../handlers/IdChatMessage";
import { CommandHandler } from "../../types";
import { createReport, log, sendAsServer } from "../../util";

export const report: CommandHandler = {
	fn: async (args, _, id) => {
		const reporterPeer = server.getClientById(id)?.peer;
		if (!reporterPeer) return;
		// get the user and reason from the arguments
		const [user, reason] = [args[0].trim(), args.slice(1).join(" ").trim()];
		// if the user or reason is missing, send an error message
		if (!user || !reason) {
			sendAsServer([
				"/report [user: string, use quotes!] [reason: string]",
			]);
			return;
		}
		const users = Object.values(server.getClients());
		// find the user in the users list
		const target = users.find((u) => u.member?.nickname === user);
		// if the user is not found, send an error message
		if (!target) {
			sendAsServer(
				`User "${user}" not found (did you forget to put it in quotes if it has spaces?)`
			);
			return;
		}
		const addr = target.peer.address();
		const res = await createReport({
			reason,
			reportedIp: addr.address,
			reporterIp: reporterPeer.address().address,
		});
		if (!res) sendAsServer(`User "${user}" reported for: ${reason}`);
		else
			sendAsServer(
				`You already reported user "${user}" for: ${res.reason}`
			);
	},
	signature: "/report (user: string - use quotes!) (...reason: string[])",
};
