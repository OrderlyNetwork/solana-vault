import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import {
    createMint,
    createAccount,
    mintTo,
    getMint,
    getOrCreateAssociatedTokenAccount,
  } from "@solana/spl-token";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor, getVaultDepositAuthorityPda, createAndSendV0Tx, createAndSendV0TxWithTable } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID, TREASURY_PROGRAM_ID,EXECUTOR_PROGRAM_ID, DVN_PROGRAM_ID, PRICE_FEED_PROGRAM_ID } from "./constants";
import * as utils from "./utils";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
console.log("LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
console.log("Peer PDA:", peerPda.toBase58());

const enforceOptioinsPda = utils.getEndorcedOptionsPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
console.log("Enforced Options PDA:", enforceOptioinsPda.toBase58());

const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda);
console.log("OApp Registry PDA:", oappRegistryPda.toBase58());

const eventAuthorityPda = utils.getEventAuthorityPda();
console.log("Event Authority PDA:", eventAuthorityPda.toBase58());

const ulnEventAuthorityPda = utils.getUlnEventAuthorityPda();
console.log("ULN Event Authority PDA:", ulnEventAuthorityPda.toBase58());

const ulnSettingPda = utils.getUlnSettingPda();
console.log("ULN Setting PDA:", ulnSettingPda.toBase58());

const sendLibPda = utils.getSendLibPda();
console.log("Send Library PDA:", sendLibPda.toBase58());

const sendLibInfoPda = utils.getSendLibInfoPda(sendLibPda);
console.log("Send Library Info PDA:", sendLibInfoPda.toBase58());

const sendLibConfigPda = utils.getSendLibConfigPda(oappConfigPda, DST_EID);
console.log("Send Library Config PDA:", sendLibConfigPda.toBase58());

const sendConfigPda = utils.getSendConfigPda(oappConfigPda, DST_EID);
console.log("Send Config PDA:", sendConfigPda.toBase58());

const defaultSendConfigPda = utils.getDefaultSendConfigPda(DST_EID);
console.log("Default Send Config PDA:", defaultSendConfigPda.toBase58());

const defaultSendLibConfigPda = utils.getDefaultSendLibConfigPda(DST_EID);
console.log("Default Send Library Config PDA:", defaultSendLibConfigPda.toBase58());

const executorConfigPda = utils.getExecutorConfigPda();
console.log("Executor Config PDA: ", executorConfigPda.toString());

const pricefeedConfigPda = utils.getPriceFeedPda();
console.log("Price Feed Config PDA: ", pricefeedConfigPda.toString());

const dvnConfigPda = utils.getDvnConfigPda();
console.log("DVN Config PDA: ", dvnConfigPda.toString());

const endpointSettingPda = utils.getEndpointSettingPda();
console.log("Endpoint Setting PDA: ", endpointSettingPda.toString());

const outboundNoncePda = utils.getOutboundNoncePda(oappConfigPda, DST_EID, PEER_ADDRESS);
console.log("Outbound Nonce PDA: ", outboundNoncePda.toString());

const messageLibPda = utils.getMessageLibPda();
console.log("Message Lib PDA: ", messageLibPda.toString());

const sendTableAddress = [peerPda, enforceOptioinsPda, oappConfigPda, ENDPOINT_PROGRAM_ID, SEND_LIB_PROGRAM_ID, sendLibConfigPda, defaultSendLibConfigPda, sendLibInfoPda, endpointSettingPda, outboundNoncePda, eventAuthorityPda, ulnSettingPda, sendConfigPda, defaultSendConfigPda, TREASURY_PROGRAM_ID, ulnEventAuthorityPda, SEND_LIB_PROGRAM_ID, EXECUTOR_PROGRAM_ID, executorConfigPda, PRICE_FEED_PROGRAM_ID, pricefeedConfigPda, DVN_PROGRAM_ID, dvnConfigPda];


async function setMockUSDC(): Promise<PublicKey> {
    const mintKeypair = Keypair.generate();
    const USDC_DECIMALS = 6;

    const mockUSDC = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        wallet.publicKey,
        USDC_DECIMALS,
        mintKeypair
    );

    console.log("Mock USDC Mint:", mockUSDC.toBase58());

    return mockUSDC;
}

async function createAta(spl: PublicKey, owner: PublicKey): Promise<PublicKey> {
    
    const ata = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        spl,
        owner,
        true
    );
    
    return ata.address;
}

async function mintUSDC(mint: PublicKey, to: PublicKey, amount: number) {
    const mintInfo = await getMint(provider.connection, mint);
    const decimals = mintInfo.decimals;
    const amountDecimals = amount * Math.pow(10, decimals);

    const sigMint = await mintTo(
        provider.connection,
        wallet.payer,
        mint,
        to,
        wallet.publicKey,
        amountDecimals
    );

    
    console.log("Minted USDC:", sigMint);
}

async function setup() {
    console.log("Setting up Vault...");
    const usdc = await setMockUSDC();
    const userAta = await createAta(usdc, wallet.publicKey);
    console.log("User ATA", userAta.toBase58());

    
    const amountToMint = 1000;
    await mintUSDC(usdc, userAta, amountToMint);

    const vaultDepositAuthorityPda = getVaultDepositAuthorityPda(OAPP_PROGRAM_ID, usdc);
    console.log("Vault Deposit Authority PDA:", vaultDepositAuthorityPda.toBase58());

    const vaultAta = await createAta(usdc, vaultDepositAuthorityPda);
    console.log("Vault ATA", vaultAta.toBase58());

    const userInfoPda = PublicKey.findProgramAddressSync(
        [wallet.publicKey.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];

    const tableAddress = [usdc, vaultDepositAuthorityPda, vaultAta, userInfoPda]

    const ixInitVault = await OAppProgram.methods.initVault().accounts({
        depositToken: usdc,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        user: wallet.publicKey,

    }).instruction();

    console.log("Init Vault:");
    await createAndSendV0TxWithTable([ixInitVault], provider, wallet, tableAddress);


    const vaultDepositParams = {
        accountId:  Array.from(Buffer.from("083098c593f395bea1de45dda552d9f14e8fcb0be3faaa7a1903c5477d7ba7fd", 'hex')),
        brokerHash: Array.from(Buffer.from("083098c593f395bea1de45dda552d9f14e8fcb0be3faaa7a1903c5477d7ba7fd", 'hex')),
        tokenHash:  Array.from(Buffer.from("083098c593f395bea1de45dda552d9f14e8fcb0be3faaa7a1903c5477d7ba7fd", 'hex')),
        srcChainId: new anchor.BN(902902902),
        tokenAmount: new anchor.BN(1),
    };

    

    const ixDeposit = await OAppProgram.methods.deposit(vaultDepositParams).accounts({
        userInfo: userInfoPda,
        userDepositWallet: userAta,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        vaultDepositWallet: vaultAta,
        depositToken: usdc
    }).instruction();

    console.log("Deposit Token:");
    // await createAndSendV0TxWithTable([ixDeposit], provider, wallet, tableAddress);

    const sendParam = {
        dstEid: DST_EID,
        to: Array.from(PEER_ADDRESS),
        options: Buffer.from(Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS,0).toBytes()),
        message: Buffer.from("Hello, World!"),
        nativeFee: new anchor.BN(1_000_000),
        lzTokenFee: new anchor.BN(0),
    }

    // console.log(vaultDepositParams);

    const ixDepositEntry = await OAppProgram.methods.depositEntry(vaultDepositParams, sendParam).accounts({
        userInfo: userInfoPda,
        userDepositWallet: userAta,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        vaultDepositWallet: vaultAta,
        depositToken: usdc,
        user: wallet.publicKey,
        peer: peerPda,
        enforcedOptions: enforceOptioinsPda,
        oappConfig: oappConfigPda,
    }).remainingAccounts([
                    // ENDPOINT solana/programs/programs/uln/src/instructions/endpoint/send.rs
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: ENDPOINT_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: oappConfigPda,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SEND_LIB_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: sendLibConfigPda, 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: defaultSendLibConfigPda, 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: sendLibInfoPda, 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: endpointSettingPda, 
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: outboundNoncePda, 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: eventAuthorityPda, 
                    },
                    // ULN solana/programs/programs/uln/src/instructions/endpoint/send.rs
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: ENDPOINT_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: ulnSettingPda,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: sendConfigPda,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: defaultSendConfigPda,
                    },
                    {
                        isSigner: true,
                        isWritable: false,
                        pubkey: wallet.publicKey,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: TREASURY_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SystemProgram.programId,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: ulnEventAuthorityPda, 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SEND_LIB_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: EXECUTOR_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: executorConfigPda
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: PRICE_FEED_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: pricefeedConfigPda
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: DVN_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: dvnConfigPda
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: PRICE_FEED_PROGRAM_ID 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: pricefeedConfigPda
                    }
    ]).instruction();

    const ixAddComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

    console.log("Deposit Entry:");
    await utils.createAndSendV0TxWithTable(
        [ixDepositEntry, ixAddComputeBudget],
        provider,
        wallet,
        sendTableAddress
    );
    
}

setup();