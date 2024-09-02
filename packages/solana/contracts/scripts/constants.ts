import { PublicKey } from "@solana/web3.js";
import { addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
export const ENDPOINT_PROGRAM_ID = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");
export const PEER_ADDRESS = addressToBytes32('0x42532863dcC16164B515C10eb2e46a3630A47762');
export const DST_EID = 40200;
export const LZ_RECEIVE_GAS = 500000;
export const LZ_RECEIVE_VALUE = 0;
export const LZ_COMPOSE_GAS = 500000;
export const LZ_COMPOSE_VALUE = 0;
