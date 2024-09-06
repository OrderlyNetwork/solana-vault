pub fn to_bytes32(bytes: &[u8]) -> [u8; 32] {
    let mut bytes32 = [0u8; 32];
    // add ledding zeros to the bytes
    bytes32[32 - bytes.len()..].copy_from_slice(bytes);
    bytes32
}
