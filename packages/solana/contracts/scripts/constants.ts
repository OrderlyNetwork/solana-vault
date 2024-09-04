import { PublicKey } from "@solana/web3.js";
import { addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
export const ENDPOINT_PROGRAM_ID = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");
export const SEND_LIB_PROGRAM_ID = new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH");
export const RECEIVE_LIB_PROGRAM_ID = SEND_LIB_PROGRAM_ID;
export const TREASURY_PROGRAM_ID = SEND_LIB_PROGRAM_ID;
export const EXECUTOR_PROGRAM_ID = new PublicKey("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn");
export const DVN_PROGRAM_ID = new PublicKey("HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW");
export const PRICE_FEED_PROGRAM_ID = new PublicKey("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP");
export const DEV_LOOKUP_TABLE_PROGRAM_ID = new PublicKey("AKvdEhj2bvArHvKrqveFmeCbFCv3Yo9rDSYasEpP9F61");
export const MAIN_LOOKUP_TABLE_PROGRAM_ID = DEV_LOOKUP_TABLE_PROGRAM_ID;

export const PEER_ADDRESS = addressToBytes32('0x42532863dcC16164B515C10eb2e46a3630A47762');
export const DST_EID = 40200;
export const LZ_RECEIVE_GAS = 500000;
export const LZ_RECEIVE_VALUE = 0;
export const LZ_COMPOSE_GAS = 10;
export const LZ_COMPOSE_VALUE = 0;

export const LOCAL_RPC = "http://localhost:8899";
export const DEV_RPC = "https://api.devnet.solana.com";
export const MAIN_RPC = "https://api.mainnet-beta.solana.com";

export const VAULT_DEPOSIT_AUTHORITY_SEED = "vault_deposit_authority";
