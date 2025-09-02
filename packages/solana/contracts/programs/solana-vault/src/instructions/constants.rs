pub const TOKEN_INDEX_PLACEHOLDER: u8 = 0;
pub const TOKEN_INDEX_USDC: u8 = 1;
pub const TOKEN_INDEX_USDT: u8 = 2;
pub const TOKEN_INDEX_WSOL: u8 = 3;
pub const TOKEN_INDEX_SOL: u8 = 255;
pub const SOL_TOKEN_HASH: [u8; 32] = [
    10, 62, 196, 252, 112, 234, 246, 79, 175, 110, 237, 164, 233, 178, 189, 71, 66, 167, 133, 70,
    64, 83, 170, 35, 175, 173, 139, 210, 70, 80, 232, 111,
]; // == keccak256("SOL")
