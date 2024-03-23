declare module "enet" {
	class Addr {
		constructor(ip: string, port?: number);
	}

	type Callback<T> = (packet: T, channel: number) => void;

	interface GenericEvent {
		data: () => Buffer;
	}

	interface ServerOpts {
		address: {
			address: string;
			port: number;
		};
		peers: number;
		channels: number;
		up: number;
		down: number;
	}

	class Peer {
		on(event: "message", cb: Callback<GenericEvent>): void;
		on(event: "disconnect", cb: Callback<GenericEvent>): void;
		disconnect(data?: any): void;
		send(channel: number, packet: Buffer): void;
	}

	class Server {
		on(event: "connect", cb: (peer: Peer, data: number) => void): void;
		start(timeout: number): void;
	}

	function createServer(
		opts: ServerOpts,
		cb: (err: any, host: Server) => void
	): void;
}

declare namespace NodeJS {
	// process.env
	interface ProcessEnv {
		API_URL: string;
		API_TOKEN: string;
		COOL_LOGGING_ONLY: string;
	}
}
