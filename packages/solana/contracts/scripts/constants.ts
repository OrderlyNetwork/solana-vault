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

export const MOCK_USDC_ACCOUNT = new PublicKey("usdc4pNcoYJ2GNXcJN4iwNXfxbKXPQzqBdALdqaRyUn");
export const DEV_USDC_ACCOUNT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const MAIN_USDC_ACCOUNT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const PEER_ADDRESS = addressToBytes32('0x5Bf771A65d057e778C5f0Ed52A0003316f94322D');
export const DEV_PEER_ADDRESS = addressToBytes32("0x9Dc724b24146BeDD2dA28b8C4B74126169B8f312");
export const QA_PEER_ADDRESS = addressToBytes32("0x45b6C6266A7A2170617d8A27A50C642fd68b91c4");
export const STAGING_PEER_ADDRESS = addressToBytes32("0x5Bf771A65d057e778C5f0Ed52A0003316f94322D");
export const MAIN_PEER_ADDRESS = STAGING_PEER_ADDRESS;

export const DST_EID = 40200;
export const TEST_DST_EID = 40200;  // eid of orderly testnet, defined by layerzero: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
export const MAIN_DST_EID = 30213;  // eid of orderly mainnet, defined by layerzero: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts

export const SOL_CHAIN_ID = 901901901;      
export const DEV_SOL_CHAIN_ID = 901901901;      // the chainid for solana devnet, defined by orderly
export const MAIN_SOL_CHAIN_ID = 900900900;     // the chainid for solana mainnet, defined by orderly
export const LZ_RECEIVE_GAS = 500000;           
export const LZ_RECEIVE_VALUE = 0;
export const LZ_COMPOSE_GAS = 0;               
export const LZ_COMPOSE_VALUE = 0;

export const LOCAL_RPC = "http://localhost:8899";
export const DEV_RPC = "https://api.devnet.solana.com";
export const MAIN_RPC = "https://api.mainnet-beta.solana.com";

export const VAULT_AUTHORITY_SEED = "VaultAuthority";
export const BROKER_SEED = "Broker";
export const TOKEN_SEED = "Token";
export const OWNER_SEED = "Owner";
export const ACCOUNT_LIST_SEED = "AccountList";

export const ENV: "DEV" | "QA" | "STAGING" | "MAIN" = "QA";
export const MOCK_OAPP_PROGRAM_ID = new PublicKey("EFLrsQmcfYTSvVrUiP4qruDhbYBtjbQNAhC6tkLJbBtQ");
export const DEV_OAPP_PROGRAM_ID = new PublicKey("EYJq9eU4GMRUriUJBgGoZ8YLQBXcWaciXuSsEXE7ieQS");
export const QA_OAPP_PROGRAM_ID = new PublicKey("5zBjLor7vEraAt4zp2H82sy9MSqFoDnNa1Lx6EYKTYRZ");
export const STAGING_OAPP_PROGRAM_ID = new PublicKey("9shwxWDUNhtwkHocsUAmrNAQfBH2DHh4njdAEdHZZkF2");
export const MAIN_OAPP_PROGRAM_ID = STAGING_OAPP_PROGRAM_ID;   // placeholder

export const DEV_MULTISIG = new PublicKey("AbQgW1N8JAZxQFdh3VTx3ukGdGCN1vQYADktp3d2HDYw");
export const QA_MULTISIG = new PublicKey("2WG7UG81NsutAzKDpJp6ZepEisMKrXS9XvMVPhsfqtuB");
export const STAGING_MULTISIG = new PublicKey("48usEusxMDBxpjLkyrarHupqodAfxXyoaLDVNDJFvkME");
export const MAIN_MULTISIG = STAGING_MULTISIG;  // placeholder

export const DEV_LOOKUP_TABLE_ADDRESS = new PublicKey("BWp8HaYYhiNHekt3zgQhqoCrRftneGxxfgKmCZ6svHN");
export const QA_LOOKUP_TABLE_ADDRESS = new PublicKey("BswrQQoPKAFojTuJutZcBMtigAgTghEH4M8ofn3EG2X2");
export const STAGING_LOOKUP_TABLE_ADDRESS = new PublicKey("BbGKfxuPwDmu58BjPpd7PMG69TqnZjSpKaLDMgf9E9Dr");
export const MAIN_LOOKUP_TABLE_ADDRESS = STAGING_LOOKUP_TABLE_ADDRESS;  // placeholder

export const DEV_BROKERS = ["woofi_pro", "vooi"];
export const QA_BROKERS = ["woofi_pro", "vooi"];
export const STAGING_BROKERS = [
    "root",
    "orderly",
    "woofi_pro",
    "woofi_dex",
    "busywhale",
    "0xfin",
    "emdx_dex",
    "logx",
    "rkqa_dex",
    "prime_protocol",
    "bitoro_network",
    "coolwallet",
    "quick_perps",
    "empyreal",
    "galar_fin",
    "what_exchange",
    "ibx",
    "unibot",
    "ascendex",
    "sharpe_ai",
    "panda_terminal",
    "vooi",
    "fusionx_pro",
    "elixir",
    "xade_finance",
    "kai",
    "sable",
    "dfyn",
    "ask_jimmy",
    "alphanaut",
    "rage_trade",
    "ox_markets",
    "zk_automate",
    "flash_x",
    "pinde",
    "ape_terminal",
    "funl_ai",
    "crust_finance",
    "btse_dex",
    "orderoo",
    "boodex_com",
    "tcmp",
    "tealstreet",
    "vls",
    "veeno_dex",
    "dvx",
    "book_x",
    "zotto", 
    "atlas",
    "primex",
    "demo",
    "eisen",
    "blazpay",
    "if_exchange",
    "one_bow",
    "filament",
    "raydium",
    "bun_dex",
    "linear_finance"
    ];
export const MAIN_BROKERS = STAGING_BROKERS;  // placeholder


