pub const TOKEN_INDEX_PLACEHOLDER: u8 = 0;
pub const TOKEN_INDEX_USDC: u8 = 1;
pub const TOKEN_INDEX_USDT: u8 = 2;
pub const TOKEN_INDEX_WSOL: u8 = 3;
pub const TOKEN_INDEX_SOL: u8 = 255;
pub const SOL_TOKEN_HASH: [u8; 32] = [
    10, 62, 196, 252, 112, 234, 246, 79, 175, 110, 237, 164, 233, 178, 189, 71, 66, 167, 133, 70,
    64, 83, 170, 35, 175, 173, 139, 210, 70, 80, 232, 111,
]; // == keccak256("SOL")
pub const BROKER_MANAGER_ROLE_HASH: [u8; 32] = [
    192, 119, 71, 180, 183, 247, 158, 192, 21, 132, 190, 149, 41, 82, 63, 161, 224, 228, 99, 139,
    144, 220, 168, 76, 215, 116, 92, 173, 31, 171, 229, 149,
]; // == keccak256("BrokerManagerRole")
pub const TOKEN_MANAGER_ROLE_HASH: [u8; 32] = [
    58, 36, 207, 160, 242, 40, 117, 51, 154, 131, 86, 246, 117, 125, 216, 6, 21, 202, 123, 135,
    188, 26, 226, 95, 115, 32, 226, 140, 226, 227, 247, 49,
]; // == keccak256("TokenManagerRole")
