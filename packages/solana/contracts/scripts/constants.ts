import { PublicKey } from "@solana/web3.js";
import { addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
export const ENDPOINT_PROGRAM_ID = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");
export const SEND_LIB_PROGRAM_ID = new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH");
export const RECEIVE_LIB_PROGRAM_ID = SEND_LIB_PROGRAM_ID;
export const TREASURY_PROGRAM_ID = SEND_LIB_PROGRAM_ID;
export const EXECUTOR_PROGRAM_ID = new PublicKey("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn");
export const EXECUTOR_PDA = new PublicKey("AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK");
export const DVN_PROGRAM_ID = new PublicKey("HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW");
export const PRICE_FEED_PROGRAM_ID = new PublicKey("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP");
export const DEV_LOOKUP_TABLE_ADDRESS = new PublicKey("AAudqEoxrKPYMfeYE4wAQuBNukeqxGtskQYmrNF947Z");
export const MAIN_LOOKUP_TABLE_ADDRESS = DEV_LOOKUP_TABLE_ADDRESS;
export const MOCK_USDC_ACCOUNT = new PublicKey("usdc4pNcoYJ2GNXcJN4iwNXfxbKXPQzqBdALdqaRyUn");
export const DEV_USDC_ACCOUNT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const MAIN_USDC_ACCOUNT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const PEER_ADDRESS = addressToBytes32('0x42532863dcC16164B515C10eb2e46a3630A47762');
export const DST_EID = 40200;
export const SOL_CHAIN_ID = 902902902;
export const LZ_RECEIVE_GAS = 500000;
export const LZ_RECEIVE_VALUE = 0;
export const LZ_COMPOSE_GAS = 10;
export const LZ_COMPOSE_VALUE = 0;

export const LOCAL_RPC = "http://localhost:8899";
export const DEV_RPC = "https://api.devnet.solana.com";
export const MAIN_RPC = "https://api.mainnet-beta.solana.com";

export const VAULT_AUTHORITY_SEED = "VaultAuthority";
export const BROKER_SEED = "Broker";
export const TOKEN_SEED = "Token";
export const OWNER_SEED = "Owner";

export const MOCK_USDC_PRIVATE_KEY = [225,216,136,177,14,114,134,37,6,11,223,44,152,142,184,158,139,30,47,126,122,71,205,171,3,242,4,98,142,13,246,170,13,139,115,107,50,109,97,239,233,48,175,33,60,17,30,115,75,120,53,150,157,243,187,249,130,59,76,84,26,123,232,123];
export const DEV_LOOKUP_TABLE_PRIVATE_KEY = [34,81,178,29,220,118,76,1,237,155,90,252,238,163,70,18,38,70,146,193,233,167,78,118,169,92,64,91,58,208,204,7,242,171,13,70,176,229,137,37,101,183,244,226,5,145,15,33,116,222,52,118,16,31,10,140,18,194,160,103,209,121,84,59]


