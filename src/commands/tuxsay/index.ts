import { cmdHandlers } from "../../handlers/IdChatMessage";
import { CommandHandler } from "../../types";
import { sendAsServer } from "../../util";

export const tuxsay: CommandHandler = {
	fn: (args: string[]) => {
		const message = args.join(" ").trim();
		if (!message) return;
		const tux = ` 
 
 
${message}
______
. ..\\
. . .\\
. . . ..----.
. . . |o_o|
. . . |:_/.|
. . .//....\\ \\
. . .(| ....|..)
. ./'\\_..._/\`\\
. .\\__)=(__/
`;
		sendAsServer(tux.split("\n"));
	},
	signature: "/tuxsay (...msg: string[])",
};
