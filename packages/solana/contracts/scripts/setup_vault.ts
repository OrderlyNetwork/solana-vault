import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
    createMint,
    createAccount,
    mintTo,
    getMint,
    getOrCreateAssociatedTokenAccount,
  } from "@solana/spl-token";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor, getVaultDepositAuthorityPda, createAndSendV0Tx } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE } from "./constants";
import { BN } from "bn.js";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

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

    const vaultAta = await createAta(usdc, OAPP_PROGRAM_ID);
    console.log("Vault ATA", vaultAta.toBase58());


    const ixInitVault = await OAppProgram.methods.initVault().accounts({
        depositToken: usdc,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        user: wallet.publicKey,

    }).instruction();

    await createAndSendV0Tx([ixInitVault], provider, wallet);

    // sleep 5 seconds
    
    
    const userInfoPda = PublicKey.findProgramAddressSync(
        [wallet.publicKey.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];

    const vaultDepositParams = {
        accountId:  Array.from(Buffer.from("0x083098c593f395bea1de45dda552d9f14e8fcb0be3faaa7a1903c5477d7ba7fd")),
        brokerHash: Array.from(Buffer.from("0x083098c593f395bea1de45dda552d9f14e8fcb0be3faaa7a1903c5477d7ba7fd")),
        tokenHash:  Array.from(Buffer.from("0x083098c593f395bea1de45dda552d9f14e8fcb0be3faaa7a1903c5477d7ba7fd")),
        srcChainId: new anchor.BN(902902902),
        tokenAmount: new anchor.BN(100),
    };

    

    const ixDeposit = await OAppProgram.methods.deposit(vaultDepositParams).accounts({
        userInfo: userInfoPda,
        userDepositWallet: userAta,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        vaultDepositWallet: vaultAta,
        depositToken: usdc
    }).instruction();

    await createAndSendV0Tx([ixDeposit], provider, wallet);

}

setup();