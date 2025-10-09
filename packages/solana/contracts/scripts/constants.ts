import { PublicKey } from '@solana/web3.js'
import { addressToBytes32 } from '@layerzerolabs/lz-v2-utilities'
export const ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
export const SEND_LIB_PROGRAM_ID = new PublicKey('7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH')
export const RECEIVE_LIB_PROGRAM_ID = SEND_LIB_PROGRAM_ID
export const TREASURY_PROGRAM_ID = SEND_LIB_PROGRAM_ID
export const EXECUTOR_PROGRAM_ID = new PublicKey('6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn')
export const EXECUTOR_PDA = new PublicKey('AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK')
export const DVN_PROGRAM_ID = new PublicKey('HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW')
export const PRICE_FEED_PROGRAM_ID = new PublicKey('8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP')

export const MOCK_USDC_ACCOUNT = new PublicKey('usdc4pNcoYJ2GNXcJN4iwNXfxbKXPQzqBdALdqaRyUn')
export const DEV_USDC_ACCOUNT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
export const MAIN_USDC_ACCOUNT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

export const DEV_USDT_ACCOUNT = new PublicKey('USDTWREFQR4hQoKiDD8w9hHBiJ5qx5EKfouU5hLLhc1')
export const MAIN_USDT_ACCOUNT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')

export const DEV_WSOL_ACCOUNT = new PublicKey('So11111111111111111111111111111111111111112')
export const MAIN_WSOL_ACCOUNT = new PublicKey('So11111111111111111111111111111111111111112')

export const PEER_ADDRESS = addressToBytes32('0x5Bf771A65d057e778C5f0Ed52A0003316f94322D')
export const DEV_PEER_ADDRESS = addressToBytes32('0x9Dc724b24146BeDD2dA28b8C4B74126169B8f312')
export const QA_PEER_ADDRESS = addressToBytes32('0x45b6C6266A7A2170617d8A27A50C642fd68b91c4')
export const STAGING_PEER_ADDRESS = addressToBytes32('0x5Bf771A65d057e778C5f0Ed52A0003316f94322D')
export const MAIN_PEER_ADDRESS = addressToBytes32('0xCecAe061aa078e13b5e70D5F9eCee90a3F2B6AeA')

export const DST_EID = 40200
export const TEST_DST_EID = 40200 // eid of orderly testnet, defined by layerzero: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
export const MAIN_DST_EID = 30213 // eid of orderly mainnet, defined by layerzero: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts

export const SOL_CHAIN_ID = 901901901
export const DEV_SOL_CHAIN_ID = 901901901 // the chainid for solana devnet, defined by orderly
export const MAIN_SOL_CHAIN_ID = 900900900 // the chainid for solana mainnet, defined by orderly
export const LZ_RECEIVE_GAS = 500000
export const LZ_RECEIVE_VALUE = 0
export const LZ_COMPOSE_GAS = 0
export const LZ_COMPOSE_VALUE = 0

export const LOCAL_RPC = 'http://localhost:8899'
export const DEV_RPC = 'https://api.devnet.solana.com'
export const MAIN_RPC = 'https://api.mainnet-beta.solana.com'

export const VAULT_AUTHORITY_SEED = 'VaultAuthority'
export const SOL_VAULT_SEED = 'SolVault'
export const BROKER_SEED = 'Broker'
export const TOKEN_SEED = 'Token'
export const OWNER_SEED = 'Owner'
export const ACCOUNT_LIST_SEED = 'AccountListMultiCollateral'
export const ACCESS_CONTROL_SEED = 'AccessControl'
export const BROKER_MANAGER_ROLE = 'BrokerManagerRole'
export const TOKEN_MANAGER_ROLE = 'TokenManagerRole'

export const ENV: 'DEV' | 'QA' | 'STAGING' | 'MAIN' = 'STAGING'
export const MOCK_OAPP_PROGRAM_ID = new PublicKey('EFLrsQmcfYTSvVrUiP4qruDhbYBtjbQNAhC6tkLJbBtQ')
export const DEV_OAPP_PROGRAM_ID = new PublicKey('EYJq9eU4GMRUriUJBgGoZ8YLQBXcWaciXuSsEXE7ieQS')
export const QA_OAPP_PROGRAM_ID = new PublicKey('5zBjLor7vEraAt4zp2H82sy9MSqFoDnNa1Lx6EYKTYRZ')
export const STAGING_OAPP_PROGRAM_ID = new PublicKey('9shwxWDUNhtwkHocsUAmrNAQfBH2DHh4njdAEdHZZkF2')
export const MAIN_OAPP_PROGRAM_ID = new PublicKey('ErBmAD61mGFKvrFNaTJuxoPwqrS8GgtwtqJTJVjFWx9Q')

export const DEV_MULTISIG = new PublicKey('AbQgW1N8JAZxQFdh3VTx3ukGdGCN1vQYADktp3d2HDYw')
export const QA_MULTISIG = new PublicKey('2WG7UG81NsutAzKDpJp6ZepEisMKrXS9XvMVPhsfqtuB')
export const STAGING_MULTISIG = new PublicKey('48usEusxMDBxpjLkyrarHupqodAfxXyoaLDVNDJFvkME')
export const MAIN_MULTISIG = new PublicKey('6aQHPsgaSxCGwf1uAVetEmzuz9bpv9Rn4bq9jTg91RH8')

export const DEV_LOOKUP_TABLE_ADDRESS = new PublicKey('BWp8HaYYhiNHekt3zgQhqoCrRftneGxxfgKmCZ6svHN')
export const QA_LOOKUP_TABLE_ADDRESS = new PublicKey('BswrQQoPKAFojTuJutZcBMtigAgTghEH4M8ofn3EG2X2')
export const STAGING_LOOKUP_TABLE_ADDRESS = new PublicKey('BbGKfxuPwDmu58BjPpd7PMG69TqnZjSpKaLDMgf9E9Dr')
export const MAIN_LOOKUP_TABLE_ADDRESS = new PublicKey('8iq7xCQt3bLdRRn4A46d5GuaXYinBoiAhbe2sUmZVzwg')

export const DEV_BROKERS = ['baby_doge', 'app988'] // , 'woofi_dex', 'root', 'orderly', 'woofi_pro', 'busywhale', '0xfin'
export const QA_BROKERS = ['pnut', 'perpx'] // 'woofi_dex', 'root', 'orderly', 'woofi_pro', 'busywhale', '0xfin',
export const STAGING_BROKERS = [
    // 'woofi_dex',
    // 'root',
    // 'orderly',
    // 'woofi_pro',
    // 'busywhale',
    // '0xfin',
    // 'emdx_dex',
    // 'logx',
    // 'rkqa_dex',
    // 'prime_protocol',
    // 'bitoro_network',
    // 'coolwallet',
    // 'quick_perps',
    // 'empyreal',
    // 'galar_fin',
    // 'what_exchange',
    // 'ibx',
    // 'unibot',
    // 'ascendex',
    // 'sharpe_ai',
    // 'panda_terminal',
    // 'vooi',
    // 'fusionx_pro',
    // 'elixir',
    // 'xade_finance',
    // 'kai',
    // 'sable',
    // 'dfyn',
    // 'ask_jimmy',
    // 'alphanaut',
    // 'rage_trade',
    // 'zk_automate',
    // 'flash_x',
    // 'pinde',
    // 'ox_markets',
    // 'funl_ai',
    // 'crust_finance',
    // 'btse_dex',
    // 'orderoo',
    // 'boodex_com',
    // 'tcmp',
    // 'tealstreet',
    // 'ape_terminal',
    // 'vls',
    // 'veeno_dex',
    // 'dvx',
    // 'zotto',
    // 'book_x',
    // 'atlas',
    // 'primex',
    // 'demo',
    // 'eisen',
    // 'blazpay',
    // 'if_exchange',
    // 'one_bow',
    // 'filament',
    // 'bun_dex',
    // 'raydium',
    // 'linear_finance',
    // 'habit',
    // 'funnymoney',
    // 'boom',
    // 'saros',
    // // 'staging_qa',
    // 'cryptotraders', // deposit broker pda not initialized
    // 'cru',
    // 'orbidex',
    // 'pump_space',
    // 'coin98',
    // 'jojo',
    // 'navigator',
    // 'pegasus',
    // 'aark',
    // 'denx',
    // 'kyrrio',
    // 'mode',
    // 'yummy',
    // 'noot',
    // 'angryberas',
    // 'bbx',
    // 'aiw3',
    // 'purps',
    // 'interlink',
    // 'involio',
    // 'hyperx',
    // 'ranger',
    // 'luma',
    // 'hyperai',
    // 'trading_strategy',
    // 'lolol',
    // 'bgsc', // deposit broker pda not initialized
    // 'apolo_pay',
    // 'ninco_fi',
    // 'shitzu',
    // 'degentics',
    // 'aden',
    // 'eolas', // deposit broker pda not initialized
    // 'million', // deposit broker pda not initialized
    // 'veterans_crew', // deposit broker pda not initialized
    // 'otter_lee',
    // 'foxify',
    // 'zenthryx',
    // 'perpsdao',
    // 'amped',
    // 'tokerate',
    // 'odyssey',
    // 'blofin',
    // 'alphanet',
    // 'figment',
    // 'levr',
    // 'satuca',
    // 'pineauto',
    // 'ttc',
    // 'citrex-markets',
    // 'kek_ai',
    // 'clypto',
    // 'whalex',
    // 'pnut',
    // 'perpx',
    'tako',
    'app98',
    'baby_doge',
]
export const MAIN_BROKERS = [
    // // 'woofi_dex', //index 1:  not support on mainnet
    // 'root',
    // 'orderly',
    // 'woofi_pro',
    // 'busywhale',
    // '0xfin',
    // 'emdx_dex',
    // 'logx',
    // // 'rkqa_dex', // index 9: not support on mainnet
    // 'prime_protocol',
    // 'bitoro_network',
    // 'coolwallet',

    // 'quick_perps',
    // 'empyreal',
    // 'galar_fin',
    // 'what_exchange',
    // 'ibx', // index 17: deposit broker pda not initialized
    // 'unibot',
    // 'ascendex',
    // 'sharpe_ai',
    // 'panda_terminal',
    // 'vooi',

    // 'fusionx_pro',
    // 'elixir',
    // 'xade_finance',
    // 'kai',
    // 'sable',
    // 'dfyn',
    // 'ask_jimmy',
    // 'alphanaut',
    // 'rage_trade',
    // // 'zk_automate', // index 32: not support on mainnet
    // 'flash_x',

    // 'pinde',
    // 'ox_markets',
    // 'funl_ai',
    // 'crust_finance',
    // 'btse_dex',
    // 'orderoo',
    // 'boodex_com',
    // 'tcmp',
    // 'tealstreet',
    // 'ape_terminal',

    // 'vls',
    // 'veeno_dex',
    // 'dvx',
    // 'zotto',
    // 'book_x',
    // 'atlas',
    // 'primex',
    // 'demo',
    // 'eisen',
    // 'blazpay',

    // 'if_exchange',
    // 'one_bow',
    // 'filament',
    // 'bun_dex',
    // 'raydium',
    // 'linear_finance',
    // 'habit',
    // 'funnymoney',
    // 'boom',
    // 'saros',

    // 'cryptotraders',
    // 'cru',
    // 'orbidex',
    // 'pump_space',
    // 'coin98',
    // 'jojo',
    // 'navigator',
    // 'pegasus',
    // 'aark',
    // 'denx',

    // 'kyrrio',
    // 'mode',
    // 'yummy',
    // 'noot',
    // 'angryberas',
    // 'bbx',
    // 'aiw3',
    // 'purps',
    // 'interlink',
    // 'involio',

    // 'hyperx',
    // 'desk',
    // 'ranger',
    // 'luma',
    // 'hyperai',
    // // 'trading_strategy', // index 89: deposit broker pda not initialized
    // 'lolol',
    // 'bgsc',
    // 'apolo_pay',
    // 'ninco_fi',

    // 'shitzu',
    // 'degentics',
    // 'aden',
    // 'eolas',
    // 'million',
    // 'veterans_crew',
    // // 'otter_lee', // index 100: not support on mainnet
    // 'foxify',
    // 'zenthryx',
    // 'perpsdao',
    // 'amped',

    // 'tokerate',
    // 'odyssey',
    // 'blofin',
    // 'alphanet',
    // 'figment',
    // 'levr',
    // 'satuca',
    // 'pineauto',
    // 'ttc',
    // 'citrex-markets',

    // 'kek_ai',
    // 'clypto',
    // 'whalex',
    // 'pnut',
    // 'perpx',
    'tako',
]

export const WITHDRAW_BROKER_INDEX = {
    woofi_dex: 1,
    root: 2,
    orderly: 3,
    woofi_pro: 4,
    busywhale: 5,
    '0xfin': 6,
    emdx_dex: 7,
    logx: 8,
    rkqa_dex: 9,
    prime_protocol: 10,
    bitoro_network: 11,
    coolwallet: 12,
    quick_perps: 13,
    empyreal: 14,
    galar_fin: 15,
    what_exchange: 16,
    ibx: 17,
    unibot: 18,
    ascendex: 19,
    sharpe_ai: 20,
    panda_terminal: 21,
    vooi: 22,
    fusionx_pro: 23,
    elixir: 24,
    xade_finance: 25,
    kai: 26,
    sable: 27,
    dfyn: 28,
    ask_jimmy: 29,
    alphanaut: 30,
    rage_trade: 31,
    zk_automate: 32,
    flash_x: 33,
    pinde: 34,
    ox_markets: 35,
    funl_ai: 36,
    crust_finance: 37,
    btse_dex: 38,
    orderoo: 39,
    boodex_com: 40,
    tcmp: 41,
    tealstreet: 42,
    ape_terminal: 43,
    vls: 44,
    veeno_dex: 45,
    dvx: 46,
    zotto: 47,
    book_x: 48,
    atlas: 49,
    primex: 50,
    demo: 51,
    eisen: 52,
    blazpay: 53,
    if_exchange: 54,
    one_bow: 55,
    filament: 56,
    bun_dex: 57,
    raydium: 58,
    linear_finance: 59,
    habit: 60,
    funnymoney: 61,
    boom: 62,
    saros: 63,
    cryptotraders: 64,
    cru: 65,
    orbidex: 66,
    pump_space: 67,
    coin98: 68,
    jojo: 69,
    navigator: 70,
    pegasus: 71,
    aark: 72,
    denx: 73,
    kyrrio: 74,
    mode: 75,
    yummy: 76,
    noot: 77,
    angryberas: 78,
    bbx: 79,
    aiw3: 80,
    purps: 81,
    interlink: 82,
    involio: 83,
    hyperx: 84,
    desk: 85,
    ranger: 86,
    luma: 87,
    hyperai: 88,
    trading_strategy: 89,
    lolol: 90,
    bgsc: 91,
    apolo_pay: 92,
    ninco_fi: 93,
    shitzu: 94,
    degentics: 95,
    aden: 96,
    eolas: 97,
    million: 98,
    veterans_crew: 99,
    otter_lee: 100,
    foxify: 101,
    zenthryx: 102,
    perpsdao: 103,
    amped: 104,
    tokerate: 105,
    odyssey: 106,
    blofin: 107,
    alphanet: 108,
    figment: 109,
    levr: 110,
    satuca: 111,
    pineauto: 112,
    ttc: 113,
    'citrex-markets': 114,
    kek_ai: 115,
    clypto: 116,
    whalex: 117,
    pnut: 118,
    perpx: 119,
    tako: 120,
    app98: 121,
    app988: 121,
    baby_doge: 122,
}

export const TOKEN_DECIMALS = {
    USDC: 6,
    USDT: 6,
    WSOL: 9,
    SOL: 9,
}

export const TOKEN_SYMBOLS = ['USDC', 'USDT', 'SOL', 'WSOL'] // 'WSOL'

// The token index is used to identify the token
// Native tokens are indexed counter-down from 255
// ERC20/SPL tokens are indexed counter-up from 1
export const TOKEN_INDEX = {
    PLACEHOLDER: 0,
    USDC: 1,
    USDT: 2,
    WSOL: 3,
    SOL: 255,
}

export const DEV_TOKEN_MINT = {
    USDC: DEV_USDC_ACCOUNT,
    USDT: DEV_USDT_ACCOUNT,
    WSOL: DEV_WSOL_ACCOUNT,
    SOL: DEV_WSOL_ACCOUNT,
}

export const MAIN_TOKEN_MINT = {
    USDC: MAIN_USDC_ACCOUNT,
    USDT: MAIN_USDT_ACCOUNT,
    WSOL: MAIN_WSOL_ACCOUNT,
    SOL: MAIN_WSOL_ACCOUNT,
}
