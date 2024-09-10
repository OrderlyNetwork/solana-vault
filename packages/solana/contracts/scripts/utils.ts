import { ENFORCED_OPTIONS_SEED, EVENT_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED, PEER_SEED, MESSAGE_LIB_SEED, SEND_LIBRARY_CONFIG_SEED, ENDPOINT_SEED, NONCE_SEED, ULN_SEED, SEND_CONFIG_SEED, EXECUTOR_CONFIG_SEED, PRICE_FEED_SEED, DVN_CONFIG_SEED, OFT_SEED, RECEIVE_CONFIG_SEED } from "@layerzerolabs/lz-solana-sdk-v2";
import { PublicKey, TransactionInstruction, VersionedTransaction, TransactionMessage, AddressLookupTableProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    getMint,
    mintTo
  } from "@solana/spl-token";
import { DVN_PROGRAM_ID, ENDPOINT_PROGRAM_ID, EXECUTOR_PROGRAM_ID, PEER_ADDRESS, PRICE_FEED_PROGRAM_ID, SEND_LIB_PROGRAM_ID, DEV_LOOKUP_TABLE_ADDRESS, MAIN_LOOKUP_TABLE_ADDRESS, LOCAL_RPC, DEV_RPC, MAIN_RPC, VAULT_DEPOSIT_AUTHORITY_SEED, MOCK_USDC_PRIVATE_KEY, MOCK_USDC_ACCOUNT, DEV_USDC_ACCOUNT, MAIN_USDC_ACCOUNT, RECEIVE_LIB_PROGRAM_ID, BROKER_SEED, TOKEN_SEED } from "./constants";
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
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getOAppRegistryPda(oappConfigPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OAPP_SEED, "utf8"), oappConfigPda.toBuffer()],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getEndorcedOptionsPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey, dstEid: number): PublicKey {
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
        SEND_LIB_PROGRAM_ID
    )[0];
}

export function getSendLibConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_LIBRARY_CONFIG_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid],
        ENDPOINT_PROGRAM_ID
    )[0];
}

// pda: 526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv
export function getSendLibInfoPda(sendLibPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8"), sendLibPda.toBuffer()],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getDefaultSendLibConfigPda(dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_LIBRARY_CONFIG_SEED, "utf8"), bufferDstEid],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getSendConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_CONFIG_SEED, "utf8"), bufferDstEid, oappConfigPda.toBuffer()],
        SEND_LIB_PROGRAM_ID
    )[0];
}

export function getDefaultSendConfigPda(dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_CONFIG_SEED, "utf8"), bufferDstEid],
        RECEIVE_LIB_PROGRAM_ID
    )[0];
}

export function getReceiveConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferSrcEid = Buffer.alloc(4);
    bufferSrcEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(RECEIVE_CONFIG_SEED, "utf8"), bufferSrcEid, oappConfigPda.toBuffer()],
        RECEIVE_LIB_PROGRAM_ID
    )[0];
}


export function getDefaultReceiveConfigPda(srcEid: number): PublicKey {
    const bufferSrcEid = Buffer.alloc(4);
    bufferSrcEid.writeUInt32BE(srcEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(RECEIVE_CONFIG_SEED, "utf8"), bufferSrcEid],
        RECEIVE_LIB_PROGRAM_ID
    )[0];
}

// pda: 7n1YeBMVEUCJ4DscKAcpVQd6KXU7VpcEcc15ZuMcL4U3
export function getUlnEventAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED, "utf8")],
        SEND_LIB_PROGRAM_ID
    )[0];
}

// pda: 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ
export function getUlnSettingPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ULN_SEED, "utf8")],
        SEND_LIB_PROGRAM_ID
    )[0];
}

// pda: 2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3
export function getEndpointSettingPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ENDPOINT_SEED, "utf8")],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getOutboundNoncePda(oappConfigPda: PublicKey, dstEid: number, peer_address: Uint8Array): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(NONCE_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid, peer_address],
        ENDPOINT_PROGRAM_ID
    )[0];
}

// pda: AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK
export function getExecutorConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EXECUTOR_CONFIG_SEED, "utf8")],
        EXECUTOR_PROGRAM_ID
    )[0];
}

// pda: CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ
export function getPriceFeedPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(PRICE_FEED_SEED, "utf8")],
        PRICE_FEED_PROGRAM_ID
    )[0];
}

// pda: 4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb
export function getDvnConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(DVN_CONFIG_SEED, "utf8")],
        DVN_PROGRAM_ID
    )[0];
}

export function getMessageLibPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8")],
        SEND_LIB_PROGRAM_ID
    )[0];
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

export async function createAndSendV0TxWithTable(txInstructions: TransactionInstruction[], provider: anchor.AnchorProvider, wallet: anchor.Wallet, address: PublicKey[]) {
    const lookupTableAddress = await getLookupTableAddress(provider, wallet, provider.connection.rpcEndpoint);
    if (provider.connection.rpcEndpoint === LOCAL_RPC) {
        await extendLookupTable(provider, wallet, lookupTableAddress, address);
    }
   
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

export async function getLookupTableAddress(provider: anchor.AnchorProvider, wallet: anchor.Wallet, rpc: string): Promise<PublicKey> {
    if (rpc === LOCAL_RPC) {
        const recentSlot = await provider.connection.getSlot();
        const [ixLookupTable, lookupTableAddress] = AddressLookupTableProgram.createLookupTable(
            {
                authority: wallet.publicKey,
                payer: wallet.publicKey,
                recentSlot:recentSlot - 200
            }
        );
        console.log("📋 Create Lookup Table Address: ", lookupTableAddress.toString());

        await createAndSendV0Tx([ixLookupTable], provider, wallet);
        // sleep for 1 seconds to wait for the lookup table to be created
        await sleep(2);
        return lookupTableAddress;
    } else if (rpc === DEV_RPC) {
        return DEV_LOOKUP_TABLE_ADDRESS;
    } else if (rpc === MAIN_RPC) {
        return MAIN_LOOKUP_TABLE_ADDRESS;
    } else {
        throw new Error("Invalid RPC");
    }
}

export async function extendLookupTable(provider: anchor.AnchorProvider, wallet: anchor.Wallet, lookupTableAddress: PublicKey, addresses: PublicKey[]) {
    const ixExtendLookupTable = AddressLookupTableProgram.extendLookupTable({
        payer: wallet.publicKey,
        authority: wallet.publicKey,
        lookupTable: lookupTableAddress,
        addresses: addresses
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
export async function getRelatedUSDCAcount(provider: anchor.AnchorProvider, wallet: anchor.Wallet, rpc: string): Promise<PublicKey[]> {
    const [VAULT_PROGRAM_ID, VaultProgram] =  getDeployedProgram();
    const usdcAddress = await getUSDCAddress(provider, wallet, rpc);
    const userUSDCAccount = await getUSDCAccount(provider, wallet, usdcAddress, wallet.publicKey);
    const vaultUSDCAccount = await getUSDCAccount(provider, wallet, usdcAddress, VAULT_PROGRAM_ID);
    return [usdcAddress, userUSDCAccount, vaultUSDCAccount];
}

export function getOftConfigPda(OFT_PROGRAM_ID: PublicKey, mintAccount: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OFT_SEED, "utf8"), mintAccount.toBuffer()],
        OFT_PROGRAM_ID
    )[0];
}


export function getVaultDepositAuthorityPda(VAULT_PROGRAM_ID: PublicKey, mintAccount: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(VAULT_DEPOSIT_AUTHORITY_SEED, "utf8"), mintAccount.toBuffer()],
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
        [Buffer.from(BROKER_SEED, "utf8"), Buffer.from(hash)],
        VAULT_PROGRAM_ID
    )[0];
}

export function getTokenPda(VAULT_PROGRAM_ID: PublicKey, mintAccount: PublicKey, tokenHash: string): PublicKey {
    const hash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    return PublicKey.findProgramAddressSync(
        [Buffer.from(TOKEN_SEED, "utf8"), mintAccount.toBuffer(), Buffer.from(hash)],
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

export async function getUSDCAddress(provider: anchor.Provider, wallet: anchor.Wallet, rpc: string): Promise<PublicKey> {
    const usdcKeyPair = Keypair.fromSecretKey(Uint8Array.from(MOCK_USDC_PRIVATE_KEY));
    
    if (rpc === LOCAL_RPC) {
        try {
            const USDC_DECIMALS = 6;
            const mockUSDC = await createMint(
                provider.connection,
                wallet.payer,
                wallet.publicKey,
                wallet.publicKey,
                USDC_DECIMALS,
                usdcKeyPair
            );
            console.log("💶 Mock USDC Address:", mockUSDC.toBase58())
        ;
        } catch (err) {
            console.error("💶 USDC already created");
        }
        
    } else if (rpc === DEV_RPC) {
        console.log("💶 Dev USDC Address:", MOCK_USDC_ACCOUNT.toBase58())
        return MOCK_USDC_ACCOUNT;
        // should be DEV_USDC_ACCOUNT after dev env is set up
        // return DEV_USDC_ACCOUNT;
    } else if (rpc === MAIN_RPC) {
        return MAIN_USDC_ACCOUNT;
    }
    return usdcKeyPair.publicKey;
}

export async function getUSDCAccount(provider: anchor.Provider, wallet: anchor.Wallet, usdc: PublicKey, owner: PublicKey): Promise<PublicKey> {
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

