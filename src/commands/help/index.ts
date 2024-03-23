import { cmdHandlers } from "../../handlers/IdChatMessage";
import { CommandHandler } from "../../types";
import { sendAsServer } from "../../util";

export const help: CommandHandler = {
	fn: () => {
		let messages = [`Available commands:`];
		Object.values(cmdHandlers).forEach((v) => {
			messages.push(v.signature);
		});
		sendAsServer([
			...messages,
			'Remember to use "quotes" if you need spaces in an argument.',
		]);
	},
	signature: "/help",
};
