export type PacketHandler = (
	data: Buffer,
	send: (data: Buffer | number) => void,
	log: (...message: any[]) => void,
	clientId: string
) => void;

export enum PacketType {
	IdJoinRequest = 1,
	IdJoinSuccess,
	IdRoomInformation,
	IdSetGameInfo,
	IdProxyPacket,
	IdLdnPacket,
	IdChatMessage,
	IdNameCollision,
	IdIpCollision,
	IdVersionMismatch,
	IdWrongPassword,
	IdCloseRoom,
	IdRoomIsFull,
	IdStatusMessage,
	IdHostKicked,
	IdHostBanned,
	/// Moderation requests
	IdModKick,
	IdModBan,
	IdModUnban,
	IdModGetBanList,
	// Moderation responses
	IdModBanListResponse,
	IdModPermissionDenied,
	IdModNoSuchUser,
	IdJoinSuccessAsMod,
}

// enum StatusMessageTypes {
//     IdMemberJoin = 1,  ///< Member joining
//     IdMemberLeave,     ///< Member leaving
//     IdMemberKicked,    ///< A member is kicked from the room
//     IdMemberBanned,    ///< A member is banned from the room
//     IdAddressUnbanned, ///< A username / ip address is unbanned from the room
// };

export enum StatusMessageTypes {
	/** A member has joined the room */
	IdMemberJoin = 1,
	/** A member has left the room */
	IdMemberLeave,
	/** A member has been kicked from the room */
	IdMemberKicked,
	/** A member has been banned from the room */
	IdMemberBanned,
	/** A username / ip address has been unbanned from the room */
	IdAddressUnbanned,
}

export interface SwitchGame {
	bannerUrl: string;
	category: string[];
	description: string;
	// developer: null;
	// frontBoxArt: null;
	iconUrl: string;
	id: string;
	intro: null | string;
	isDemo: boolean;
	// key: null;
	languages: string[];
	name: string;
	nsuId: number;
	numberOfPlayers: number;
	publisher: string;
	rating: number;
	ratingContent: string[];
	// region: null;
	releaseDate: number;
	rightsId: string;
	screenshots: string[];
	size: number;
	// version: null;
}

export interface RoomPlayer {
	gameId: number;
	gameName: string;
	nickname: string;
}
export interface IRoom {
	address: string;
	description: string;
	externalGuid: string;
	hasPassword: boolean;
	id: string;
	maxPlayers: number;
	name: string;
	netVersion: number;
	owner: string;
	players: RoomPlayer[];
	port: number;
	preferredGameId: number;
	preferredGameName: string;
	game?: SwitchGame;
}

export interface Member {
	nickname: string;
	ip: string;
	gameName: string;
	gameId: bigint;
	gameVersion: string;
	username: string;
	displayName: string;
	avatarUrl: string;
	clientId: string;
}
