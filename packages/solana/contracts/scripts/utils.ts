import { ENFORCED_OPTIONS_SEED, EVENT_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED, PEER_SEED, MESSAGE_LIB_SEED, SEND_LIBRARY_CONFIG_SEED, ENDPOINT_SEED, NONCE_SEED, ULN_SEED, SEND_CONFIG_SEED, EXECUTOR_CONFIG_SEED, PRICE_FEED_SEED, DVN_CONFIG_SEED, OFT_SEED, RECEIVE_CONFIG_SEED, PENDING_NONCE_SEED, PAYLOAD_HASH_SEED, RECEIVE_LIBRARY_CONFIG_SEED } from "@layerzerolabs/lz-solana-sdk-v2";
import { PublicKey, TransactionInstruction, VersionedTransaction, TransactionMessage, AddressLookupTableProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddressSync,
    getMint,
    mintTo
  } from "@solana/spl-token";
import * as constants from "./constants";
import { seed } from "@coral-xyz/anchor/dist/cjs/idl";
import { hexToBytes } from 'ethereum-cryptography/utils';
import { keccak256, AbiCoder, solidityPackedKeccak256, decodeBase58 } from "ethers"
import { getKeypairFromEnvironment } from "@solana-developers/helpers";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";



export function getOAppConfigPda(OAPP_PROGRAM_ID: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OAPP_SEED, "utf8")],
        OAPP_PROGRAM_ID
    )[0];
}

export function getVaultOwnerPda(OAPP_PROGRAM_ID: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(constants.OWNER_SEED, "utf8")],
        OAPP_PROGRAM_ID
    )[0];
}

export function getLzReceiveTypesPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(LZ_RECEIVE_TYPES_SEED, "utf8"), oappConfigPda.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];
}

export function getPeerPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);

    return PublicKey.findProgramAddressSync(
        [Buffer.from(PEER_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid],
        OAPP_PROGRAM_ID
    )[0];
}

// pda address: F8E8QGhKmHEx2esh5LpVizzcP4cHYhzXdXTwg9w3YYY2
export function getEventAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED, "utf8")],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getOAppRegistryPda(oappConfigPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OAPP_SEED, "utf8"), oappConfigPda.toBuffer()],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getEnforcedOptionsPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);

    return PublicKey.findProgramAddressSync(
        [Buffer.from(ENFORCED_OPTIONS_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid],
        OAPP_PROGRAM_ID
    )[0];
}

// pda: 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ
export function getSendLibPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8")],
        constants.SEND_LIB_PROGRAM_ID
    )[0];
}

export function getSendLibConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_LIBRARY_CONFIG_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

// pda: 526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv
export function getSendLibInfoPda(sendLibPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8"), sendLibPda.toBuffer()],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getDefaultSendLibConfigPda(dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_LIBRARY_CONFIG_SEED, "utf8"), bufferDstEid],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getReceiveLibConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(RECEIVE_LIBRARY_CONFIG_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getDefaultReceiveLibConfigPda(dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(RECEIVE_LIBRARY_CONFIG_SEED, "utf8"), bufferDstEid],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getSendConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_CONFIG_SEED, "utf8"), bufferDstEid, oappConfigPda.toBuffer()],
        constants.SEND_LIB_PROGRAM_ID
    )[0];
}

export function getDefaultSendConfigPda(dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_CONFIG_SEED, "utf8"), bufferDstEid],
        constants.RECEIVE_LIB_PROGRAM_ID
    )[0];
}

export function getReceiveConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferSrcEid = Buffer.alloc(4);
    bufferSrcEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(RECEIVE_CONFIG_SEED, "utf8"), bufferSrcEid, oappConfigPda.toBuffer()],
        constants.RECEIVE_LIB_PROGRAM_ID
    )[0];
}


export function getDefaultReceiveConfigPda(srcEid: number, receiveLibProgramId?: PublicKey): PublicKey {
    const bufferSrcEid = Buffer.alloc(4);
    bufferSrcEid.writeUInt32BE(srcEid);
    const programId = receiveLibProgramId ? receiveLibProgramId : constants.RECEIVE_LIB_PROGRAM_ID
    return PublicKey.findProgramAddressSync(
        [Buffer.from(RECEIVE_CONFIG_SEED, "utf8"), bufferSrcEid],
        programId
    )[0];
}

// pda: 7n1YeBMVEUCJ4DscKAcpVQd6KXU7VpcEcc15ZuMcL4U3
export function getUlnEventAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED, "utf8")],
        constants.SEND_LIB_PROGRAM_ID
    )[0];
}

// pda: 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ
export function getUlnSettingPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ULN_SEED, "utf8")],
        constants.SEND_LIB_PROGRAM_ID
    )[0];
}

// pda: 2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3
export function getEndpointSettingPda(programId?: PublicKey): PublicKey {
    const endpointProgramId = programId ? programId : constants.ENDPOINT_PROGRAM_ID
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ENDPOINT_SEED, "utf8")],
        endpointProgramId
    )[0];
}

export function getNoncePda(oappConfigPda: PublicKey, dstEid: number, peer_address: Uint8Array): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(NONCE_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid, peer_address],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}


export function getPendingInboundNoncePda(oappConfigPda: PublicKey, dstEid: number, peer_address: Uint8Array): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(PENDING_NONCE_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid, peer_address],
        constants.ENDPOINT_PROGRAM_ID
    )[0];
}


// pda: AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK
export function getExecutorConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EXECUTOR_CONFIG_SEED, "utf8")],
        constants.EXECUTOR_PROGRAM_ID
    )[0];
}

// pda: CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ
export function getPriceFeedPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(PRICE_FEED_SEED, "utf8")],
        constants.PRICE_FEED_PROGRAM_ID
    )[0];
}

// pda: 4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb
export function getDvnConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(DVN_CONFIG_SEED, "utf8")],
        constants.DVN_PROGRAM_ID
    )[0];
}

export function getMessageLibPda(programId?: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8")],
        programId ? programId : constants.SEND_LIB_PROGRAM_ID
    )[0];
}

export function getMessageLibInfoPda(msgLibPda: PublicKey, programId?: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8"), msgLibPda.toBytes()],
        programId ? programId : constants.ENDPOINT_PROGRAM_ID
    )[0];
}

export function getPayloadHashPda(sender: PublicKey, srcEid: number, receiver: PublicKey, nonce: bigint): PublicKey {
    const bufferSrcEid = Buffer.alloc(4)
    bufferSrcEid.writeUInt32BE(srcEid)
    const bufferNonce = Buffer.alloc(8)
    bufferNonce.writeBigUInt64BE(nonce)

    return PublicKey.findProgramAddressSync(
        [Buffer.from("PayloadHash"), sender.toBuffer(), bufferSrcEid, receiver.toBuffer(), bufferNonce],
        constants.ENDPOINT_PROGRAM_ID
    )[0]
}


export function setAnchor(): [anchor.AnchorProvider, anchor.Wallet, string] {
    console.log("Setting Anchor...");
    const provider = anchor.AnchorProvider.env();
    const rpc = provider.connection.rpcEndpoint;
    anchor.setProvider(provider);
    const wallet = provider.wallet as anchor.Wallet;
    return [provider, wallet, rpc];
}

export function getDeployedProgram(): [PublicKey, anchor.Program] {
    const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
    const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;
    return [OAPP_PROGRAM_ID, OAppProgram];
}

export async function createAndSendV0Tx(txInstructions: TransactionInstruction[], provider: anchor.AnchorProvider, wallet: anchor.Wallet) {
    // Step 1 - Fetch Latest Blockhash
    let latestBlockhash = await provider.connection.getLatestBlockhash('finalized');

    // Step 2 - Generate Transaction Message
    const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: txInstructions
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);

    // Step 3 - Sign your transaction with the required `Signers`
    transaction.sign([wallet.payer]);

    // Step 4 - Send our v0 transaction to the cluster
    const txid = await provider.connection.sendTransaction(transaction, { maxRetries: 5 });
    console.log("   ✅ - Transaction sent to network", txid);

    await new Promise((r) => setTimeout
        (r, 2000));
}

export async function createAndSendV0TxWithTable(txInstructions: TransactionInstruction[], provider: anchor.AnchorProvider, wallet: anchor.Wallet, addressList: PublicKey[], OAPP_PROGRAM_ID: PublicKey) {
    const lookupTableAddress = await getLookupTableAddress(provider, wallet, provider.connection.rpcEndpoint, OAPP_PROGRAM_ID);
    // if (provider.connection.rpcEndpoint === constants.LOCAL_RPC) {
    //     await extendLookupTable(provider, wallet, lookupTableAddress, addressList);
    // }
   
    const lookupTableAccount = await getLookupTableAccount(provider, lookupTableAddress);
    const msg = new TransactionMessage({
        payerKey: wallet.payer.publicKey,
        recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
        instructions:txInstructions
    }).compileToV0Message([lookupTableAccount]);

    const tx = new VersionedTransaction(msg);
    tx.sign([wallet.payer]);
    const sigSend = await provider.connection.sendTransaction(tx);
    console.log("Send transaction confirmed:", sigSend);
    await sleep(2);

}

export async function getLookupTableAddress(provider: anchor.AnchorProvider, wallet: anchor.Wallet, rpc: string, OAPP_PROGRAM_ID: PublicKey): Promise<PublicKey> {
     if (OAPP_PROGRAM_ID.toBase58() === constants.DEV_OAPP_PROGRAM_ID.toBase58()) {
        console.log("DEV_LOOKUP_TABLE_ADDRESS: ", constants.DEV_LOOKUP_TABLE_ADDRESS.toBase58());
        return constants.DEV_LOOKUP_TABLE_ADDRESS;
    } else if (OAPP_PROGRAM_ID.toBase58() === constants.QA_OAPP_PROGRAM_ID.toBase58()) {
        return constants.QA_LOOKUP_TABLE_ADDRESS;
    } else if (OAPP_PROGRAM_ID.toBase58() === constants.STAGING_OAPP_PROGRAM_ID.toBase58()) {
        return constants.STAGING_LOOKUP_TABLE_ADDRESS;
    } else {
        throw new Error("Invalid OAPP Program ID or rpc");
    }
}

export async function extendLookupTable(provider: anchor.AnchorProvider, wallet: anchor.Wallet, lookupTableAddress: PublicKey, addressList: PublicKey[]) {
    const ixExtendLookupTable = AddressLookupTableProgram.extendLookupTable({
        payer: wallet.publicKey,
        authority: wallet.publicKey,
        lookupTable: lookupTableAddress,
        addresses: addressList
    });
    await createAndSendV0Tx([ixExtendLookupTable], provider, wallet);
    // sleep for 2 seconds to wait for the lookup table to be updated
    await sleep(2);
}

export async function getLookupTableAccount(provider: anchor.AnchorProvider, lookupTableAddress: PublicKey) {
    const lookupTableAccount = (
        await provider.connection.getAddressLookupTable(lookupTableAddress)
      ).value;

    return lookupTableAccount;
}

export async function getMintAccount(provider: anchor.AnchorProvider, rpc: string) {

}

// get the usdc address, user account, and vault account
export function getRelatedUSDCAcount(wallet: anchor.Wallet, rpc: string): PublicKey[] {
    const [VAULT_PROGRAM_ID, VaultProgram] =  getDeployedProgram();
    const usdcAddress = getUSDCAddress(rpc);
    const userUSDCAccount = getUSDCAccount(usdcAddress, wallet.publicKey);
    const vaultUSDCAccount = getUSDCAccount(usdcAddress, VAULT_PROGRAM_ID);
    return [usdcAddress, userUSDCAccount, vaultUSDCAccount];
}

export async function createRelatedUSDCAcount(provider: anchor.AnchorProvider, wallet: anchor.Wallet, rpc: string): Promise<PublicKey[]> {
    const [VAULT_PROGRAM_ID, VaultProgram] =  getDeployedProgram();
    const usdcAddress = getUSDCAddress(rpc);
    const userUSDCAccount = await createUSDCAccount(provider, wallet, usdcAddress, wallet.publicKey);
    const vaultUSDCAccount = await createUSDCAccount(provider, wallet, usdcAddress, VAULT_PROGRAM_ID);
    return [usdcAddress, userUSDCAccount, vaultUSDCAccount];
}

export function getOftConfigPda(OFT_PROGRAM_ID: PublicKey, mintAccount: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OFT_SEED, "utf8"), mintAccount.toBuffer()],
        OFT_PROGRAM_ID
    )[0];
}


export function getVaultAuthorityPda(VAULT_PROGRAM_ID: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(constants.VAULT_AUTHORITY_SEED, "utf8")],
        VAULT_PROGRAM_ID
    )[0];
}


async function sleep(number: number) {
    await new Promise((r) => setTimeout
    (r, number* 1000));
}

export function getBrokerHash(brokerId: string): string {
    return solidityPackedKeccak256(['string'], [brokerId])
}

export function getTokenHash(tokenSymbol: string): string {
    return solidityPackedKeccak256(['string'], [tokenSymbol])
}

export function getBrokerPda(VAULT_PROGRAM_ID: PublicKey, brokerHash: string): PublicKey {
    const hash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
    return PublicKey.findProgramAddressSync(
        [Buffer.from(constants.BROKER_SEED, "utf8"), Buffer.from(hash)],
        VAULT_PROGRAM_ID
    )[0];
}

export function getBrokerPdaWithBuf(VAULT_PROGRAM_ID: PublicKey, brokerHash: number[]): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(constants.BROKER_SEED, "utf8"), Buffer.from(brokerHash)],
        VAULT_PROGRAM_ID
    )[0];
}

export function getTokenPda(VAULT_PROGRAM_ID: PublicKey, tokenHash: string): PublicKey {
    const hash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    return PublicKey.findProgramAddressSync(
        [Buffer.from(constants.TOKEN_SEED, "utf8"), Buffer.from(hash)],
        VAULT_PROGRAM_ID
    )[0];
}

export function getTokenPdaWithBuf(VAULT_PROGRAM_ID: PublicKey, tokenHash: number[]): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(constants.TOKEN_SEED, "utf8"), Buffer.from(tokenHash)],
        VAULT_PROGRAM_ID
    )[0];
}
     
export function getSolAccountId(userAccount: PublicKey, brokerId: string): string{
        // base58 => bytes
        const decodedUserAccount = Buffer.from(userAccount.toBytes());
        const abicoder = AbiCoder.defaultAbiCoder()
    return keccak256(abicoder.encode(['bytes32', 'bytes32'], [decodedUserAccount, getBrokerHash(brokerId)]))
}
// base58 => bytes => hex => bytes32
// const decodedUserAccount = hexToBytes((Buffer.from(userAccount.toBytes()).toString('hex')));

export function getUSDCAddress(rpc: string): PublicKey {
    
    if (rpc === constants.MAIN_RPC) {
        return constants.MAIN_USDC_ACCOUNT;
    }
    return constants.DEV_USDC_ACCOUNT;
}

export function getUSDCAccount(usdc: PublicKey, owner: PublicKey): PublicKey {
    const usdcTokenAccount = getAssociatedTokenAddressSync(
        usdc,
        owner,
        true,
    );
    console.log(`💶 USDC Account for ${owner}: ${usdcTokenAccount.toBase58()}`);
    return usdcTokenAccount;
}

export async function createUSDCAccount(provider: anchor.Provider, wallet: anchor.Wallet, usdc: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const usdcTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        usdc,
        owner,
        true
    );
    console.log(`💶 USDC Account for ${owner}: ${usdcTokenAccount.address.toBase58()}`);
    return usdcTokenAccount.address;
}


export async function mintUSDC(provider: anchor.Provider, wallet: anchor.Wallet, usdc: PublicKey, receiverATA: PublicKey, amount: number) {
    const usdcInfo = await getMint(provider.connection, usdc);
    const decimals = usdcInfo.decimals;
    const amountInDecimals = amount * Math.pow(10, decimals);
    const sigMint = await mintTo(
        provider.connection,
        wallet.payer,
        usdc,
        receiverATA,
        wallet.publicKey,
        amountInDecimals
    );

    
    console.log(`💶 Minted ${amount} USDC to ${receiverATA.toBase58()}: ${sigMint}`);
}

export function printPda(OAPP_PROGRAM_ID: PublicKey, wallet: anchor.Wallet, rpc: string) {
    const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
    console.log("🔑 OApp Config PDA:", oappConfigPda.toBase58());

    const vaultOwnerPda = getVaultOwnerPda(OAPP_PROGRAM_ID);
    console.log("🔑 Vault Owner PDA:", vaultOwnerPda.toBase58());

    const vaultAuthorityPda = getVaultAuthorityPda(OAPP_PROGRAM_ID);
    console.log("🔑 Vault Authority PDA:", vaultAuthorityPda.toBase58());
    
    const lzReceiveTypesPda = getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    console.log("🔑 LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

    const peerPda = getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("🔑 Peer PDA:", peerPda.toBase58());

    const eventAuthorityPda = getEventAuthorityPda();
    console.log("🔑 Event Authority PDA:", eventAuthorityPda.toBase58());

    const oappRegistryPda = getOAppRegistryPda(oappConfigPda);
    console.log("🔑 OApp Registry PDA:", oappRegistryPda.toBase58());

    const enforceOptioinsPda = getEnforcedOptionsPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("🔑 Enforced Options PDA:", enforceOptioinsPda.toBase58());

    const sendLibPda = getSendLibPda();
    console.log("🔑 Send Library PDA:", sendLibPda.toBase58());

    const sendLibConfigPda = getSendLibConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Send Library Config PDA:", sendLibConfigPda.toBase58());

    const sendLibInfoPda = getSendLibInfoPda(sendLibPda);
    console.log("🔑 Send Library Info PDA:", sendLibInfoPda.toBase58());

    const defaultSendLibConfigPda = getDefaultSendLibConfigPda(constants.DST_EID);
    console.log("🔑 Default Send Library Config PDA:", defaultSendLibConfigPda.toBase58());

    const sendConfigPda = getSendConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Send Config PDA:", sendConfigPda.toBase58());

    const defaultSendConfigPda = getDefaultSendConfigPda(constants.DST_EID);
    console.log("🔑 Default Send Config PDA:", defaultSendConfigPda.toBase58());

    const receiveConfigPda = getReceiveConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Receive Config PDA:", receiveConfigPda.toBase58());

    const defaultReceiveConfigPda = getDefaultReceiveConfigPda(constants.DST_EID);
    console.log("🔑 Default Receive Config PDA:", defaultReceiveConfigPda.toBase58());

    const ulnEventAuthorityPda = getUlnEventAuthorityPda();
    console.log("🔑 ULN Event Authority PDA:", ulnEventAuthorityPda.toBase58());

    const ulnSettingPda = getUlnSettingPda();
    console.log("🔑 ULN Setting PDA:", ulnSettingPda.toBase58());

    const endpointSettingPda = getEndpointSettingPda();
    console.log("🔑 Endpoint Setting PDA: ", endpointSettingPda.toString());

    const noncePda = getNoncePda(oappConfigPda, constants.DST_EID, constants.PEER_ADDRESS);
    console.log("🔑 Nonce PDA: ", noncePda.toString());
   
    const pendingInboundNoncePda = getPendingInboundNoncePda(oappConfigPda, constants.DST_EID, constants.PEER_ADDRESS);
    console.log("🔑 Pending Inbound Nonce PDA: ", pendingInboundNoncePda.toString());

    const executorConfigPda = getExecutorConfigPda();
    console.log("🔑 Executor Config PDA: ", executorConfigPda.toString());

    const pricefeedConfigPda = getPriceFeedPda();
    console.log("🔑 Price Feed Config PDA: ", pricefeedConfigPda.toString());

    const dvnConfigPda = getDvnConfigPda();
    console.log("🔑 DVN Config PDA: ", dvnConfigPda.toString());

    const messageLibPda = getMessageLibPda();
    console.log("🔑 Message Lib PDA: ", messageLibPda.toString());

    const [usdcAddress, userUSDCAccount, vaultUSDCAccount] =  getRelatedUSDCAcount(wallet, rpc);
    console.log("🔑 USDC Address: ", usdcAddress.toString());
    console.log("🔑 User USDC Account: ", userUSDCAccount.toString());
    console.log("🔑 Vault USDC Account: ", vaultUSDCAccount.toString());

    console.log("Execute the following command to set up local solana node:");
    console.log(`solana-test-validator --clone-upgradeable-program ${constants.ENDPOINT_PROGRAM_ID} --clone-upgradeable-program ${constants.SEND_LIB_PROGRAM_ID} --clone-upgradeable-program ${constants.DVN_PROGRAM_ID} --clone-upgradeable-program ${constants.EXECUTOR_PROGRAM_ID} --clone-upgradeable-program ${constants.PRICE_FEED_PROGRAM_ID} -c ${sendLibPda} -c ${sendLibInfoPda} -c ${defaultSendConfigPda} -c ${defaultSendLibConfigPda} -c ${endpointSettingPda} -c ${dvnConfigPda} -c ${pricefeedConfigPda} -c ${executorConfigPda} -c ${defaultSendConfigPda} -c ${defaultReceiveConfigPda} -c ${usdcAddress} -c ${userUSDCAccount} -c ${constants.DEV_LOOKUP_TABLE_ADDRESS} -c ${constants.QA_LOOKUP_TABLE_ADDRESS} -c ${constants.STAGING_LOOKUP_TABLE_ADDRESS} --url devnet --reset`)

    // solana-test-validator --clone-upgradeable-program 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 --clone-upgradeable-program 7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH --clone-upgradeable-program HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW --clone-upgradeable-program 6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn --clone-upgradeable-program 8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP -c 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ -c 526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c 3hfYq9afjFbedp4GZk6n9ZefuCbhvgf4z4Jiyw2QEEPY -c 2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3 -c 4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb -c CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ -c AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK -c gCUbJuyKKEdYNsojKX8QJdNqjXf2AfGmodHL7wXpuCx -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c 8dLsxgaPF7sbR4brxdciF5n41ZEiEYSnKZacK4ZmS3NW -c FFf52Jx9Biw3QUjcZ3nPYyuGy9bE8Dmzv1AJryjzJX6X --url devnet --reset
    // solana-test-validator --clone-upgradeable-program 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 --clone-upgradeable-program 7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH --clone-upgradeable-program HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW --clone-upgradeable-program 6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn --clone-upgradeable-program 8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP -c 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ -c 526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c 3hfYq9afjFbedp4GZk6n9ZefuCbhvgf4z4Jiyw2QEEPY -c 2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3 -c 4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb -c CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ -c AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK -c gCUbJuyKKEdYNsojKX8QJdNqjXf2AfGmodHL7wXpuCx -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c 8dLsxgaPF7sbR4brxdciF5n41ZEiEYSnKZacK4ZmS3NW -c FFf52Jx9Biw3QUjcZ3nPYyuGy9bE8Dmzv1AJryjzJX6X -c 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU -c 8g3yNyoXr6N4c8eQapQ1jeX5oDYY2kgzvDx6Lb9qunhA --url devnet --reset
    //                                 0                 1           2             3                 4                 5                6              7               8                    9                   10                   11                 12               13              14               15              16                  17               18            19             20
    const lookupTableList = [oappConfigPda, lzReceiveTypesPda, peerPda, eventAuthorityPda, oappRegistryPda, enforceOptioinsPda, sendLibPda, sendLibConfigPda, sendLibInfoPda, defaultSendLibConfigPda, sendConfigPda, defaultSendConfigPda, ulnEventAuthorityPda, ulnSettingPda, endpointSettingPda, noncePda, executorConfigPda, pricefeedConfigPda, dvnConfigPda, messageLibPda, vaultAuthorityPda];

    return lookupTableList;
}

