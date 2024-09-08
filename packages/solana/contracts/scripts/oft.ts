import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, Keypair, ComputeBudgetInstruction, ComputeBudgetProgram} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createInitializeMintInstruction, getMintLen, getOrCreateAssociatedTokenAccount } from '@solana/spl-token'
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor, getOftConfigPda } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID } from "./constants";

import OftIdl from "../target/idl/oft.json";
import { Oft } from "../target/types/oft";
import { set } from "@coral-xyz/anchor/dist/cjs/utils/features";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
const OFT_PROGRAM_ID = new PublicKey(OftIdl.metadata.address);
const OFTProgram = anchor.workspace.SolanaVault as anchor.Program<Oft>;

const [provider, wallet] = setAnchor();

const SOLANA_OFT_TOKEN_DECIMALS = 6;

const MINT_ACCOUNT_PRIVATE = new Uint8Array([34,81,178,29,220,118,76,1,237,155,90,252,238,163,70,18,38,70,146,193,233,167,78,118,169,92,64,91,58,208,204,7,242,171,13,70,176,229,137,37,101,183,244,226,5,145,15,33,116,222,52,118,16,31,10,140,18,194,160,103,209,121,84,59])
const MINT_ACCOUNT = Keypair.fromSecretKey(MINT_ACCOUNT_PRIVATE)
console.log("Mint Account:", MINT_ACCOUNT.publicKey.toBase58());

const oftConfigPda = getOftConfigPda(OFT_PROGRAM_ID, MINT_ACCOUNT.publicKey);
console.log("OApp Config PDA:", oftConfigPda.toBase58());

const lzReceiveTypesPda = getLzReceiveTypesPda(OFT_PROGRAM_ID, oftConfigPda);
console.log("LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

const peerPda = getPeerPda(OFT_PROGRAM_ID, oftConfigPda, DST_EID);
console.log("Peer PDA:", peerPda.toBase58());

const eventAuthorityPda = getEventAuthorityPda();
console.log("Event Authority PDA:", eventAuthorityPda.toBase58());

const oftRegistryPda = getOAppRegistryPda(oftConfigPda);
console.log("OApp Registry PDA:", oftRegistryPda.toBase58());

async function setup() {
    console.log("Setting up OFT...");

    const ixCreateMint = [
        SystemProgram.createAccount(
            {
                fromPubkey: wallet.publicKey,
                newAccountPubkey: MINT_ACCOUNT.publicKey,
                lamports: await provider.connection.getMinimumBalanceForRentExemption(getMintLen([])),
                space: getMintLen([]),
                programId: TOKEN_PROGRAM_ID
            }
        ),
        createInitializeMintInstruction(
            MINT_ACCOUNT.publicKey,
            SOLANA_OFT_TOKEN_DECIMALS,
            oftConfigPda,
            oftConfigPda
        )
    ];

    const txCreateMint = new Transaction().add(...ixCreateMint);
    const sigCreateMint = await provider.sendAndConfirm(txCreateMint, [wallet.payer, MINT_ACCOUNT]);
    console.log("Create Mint transaction confirmed:", sigCreateMint);

    const ixInitOft = await OftTools.createInitNativeOftIx(
        wallet.publicKey,
        wallet.publicKey,
        MINT_ACCOUNT.publicKey,
        wallet.publicKey,
        SOLANA_OFT_TOKEN_DECIMALS,
        TOKEN_PROGRAM_ID,
        OFT_PROGRAM_ID,
        ENDPOINT_PROGRAM_ID
    );

    const txInitOft = new Transaction().add(ixInitOft);
    const sigInitOft = await provider.sendAndConfirm(txInitOft, [wallet.payer]);
    console.log("Init OFT transaction confirmed:", sigInitOft);

    const ixSetPeer = await OftTools.createSetPeerIx(
        wallet.publicKey,
        oftConfigPda,
        DST_EID,
        Uint8Array.from(PEER_ADDRESS),
        OFT_PROGRAM_ID
    );

    const txSetPeer = new Transaction().add(ixSetPeer);
    const sigSetPeer = await provider.sendAndConfirm(txSetPeer, [wallet.payer]);
    console.log("Set Peer transaction confirmed:", sigSetPeer);
}

async function setconfig() {
    const txOptions = new Transaction().add(
        await OftTools.createSetEnforcedOptionsIx(
            wallet.publicKey,
            oftConfigPda,
            DST_EID,
            Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS, LZ_RECEIVE_GAS).toBytes(),
            Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS, LZ_RECEIVE_GAS).addExecutorComposeOption(0, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE).toBytes(),
            OFT_PROGRAM_ID
        ),
        await OftTools.createInitNonceIx(
            wallet.publicKey,
            DST_EID,
            oftConfigPda,
            PEER_ADDRESS,
            ENDPOINT_PROGRAM_ID
        ),
        await OftTools.createInitConfigIx(
            wallet.publicKey,
            oftConfigPda,
            DST_EID,
            SEND_LIB_PROGRAM_ID,
            ENDPOINT_PROGRAM_ID
        )
    );

    const sigOptions = await provider.sendAndConfirm(txOptions, [wallet.payer]);
    console.log("Options transaction confirmed:", sigOptions);
}

async function setlib() {
    const txInitSendLib = new Transaction().add(
        await OftTools.createInitSendLibraryIx(
            wallet.publicKey,
            oftConfigPda,
            DST_EID
        )
    );

    const sigInitSendLib = await provider.sendAndConfirm(txInitSendLib, [wallet.payer]);
    console.log("Init Send Library transaction confirmed:", sigInitSendLib);

    const txSetSendLib = new Transaction().add(
        await OftTools.createSetSendLibraryIx(
            wallet.publicKey,
            oftConfigPda,
            SEND_LIB_PROGRAM_ID,
            DST_EID
        )
    );
    const sigSetSendLib = await provider.sendAndConfirm(txSetSendLib, [wallet.payer]);
    console.log("Set Send Library transaction confirmed:", sigSetSendLib);

    const txInitReceiveLib = new Transaction().add(
        await OftTools.createInitReceiveLibraryIx(
            wallet.publicKey,
            oftConfigPda,
            DST_EID
        )
    );
    const sigInitReceiveLib = await provider.sendAndConfirm(txInitReceiveLib, [wallet.payer]);
    console.log("Init Receive Library transaction confirmed:", sigInitReceiveLib);

    const txSetReceiveLib = new Transaction().add(
        await OftTools.createSetReceiveLibraryIx(
            wallet.publicKey,
            oftConfigPda,
            SEND_LIB_PROGRAM_ID,
            DST_EID,
            BigInt(0)
        )
    );
    const sigSetReceiveLib = await provider.sendAndConfirm(txSetReceiveLib, [wallet.payer]);
    console.log("Set Receive Library transaction confirmed:", sigSetReceiveLib);
}

async function send() {
    const ATA = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        MINT_ACCOUNT.publicKey,
        wallet.publicKey,
        false,
        "confirmed",
        {},
        TOKEN_PROGRAM_ID
    );
    console.log("ATA:", ATA.address.toBase58());

    const AMOUNT = BigInt(0);

    
    const fee = await OftTools.quoteWithUln(
        provider.connection,
        wallet.publicKey,
        MINT_ACCOUNT.publicKey,
        DST_EID,
        AMOUNT,
        AMOUNT,
        Options.newOptions().addExecutorLzReceiveOption(50000,0).toBytes(),
        Array.from(PEER_ADDRESS),
        false,
        undefined,
        undefined,
        Array.from(PEER_ADDRESS),
        undefined,
        TOKEN_PROGRAM_ID,
        OFT_PROGRAM_ID,
        SEND_LIB_PROGRAM_ID,
        ENDPOINT_PROGRAM_ID,
    );
    console.log("Fee:", fee);

    const txSend = new Transaction().add(
        await OftTools.sendWithUln(
            provider.connection,
            wallet.publicKey,
            MINT_ACCOUNT.publicKey,
            ATA.address,
            DST_EID,
            AMOUNT,
            AMOUNT,
            Options.newOptions().addExecutorLzReceiveOption(50000,0).toBytes(),
            Array.from(PEER_ADDRESS),
            BigInt(100_000_000),
            BigInt(0),
            undefined,
            Buffer.from(""),
            Array.from(PEER_ADDRESS),
            undefined,
            TOKEN_PROGRAM_ID,
            OFT_PROGRAM_ID,
            ENDPOINT_PROGRAM_ID
        )
    ).add(ComputeBudgetProgram.setComputeUnitLimit({units: 400_000}));

    const sig = await provider.sendAndConfirm(txSend, [wallet.payer]);
    console.log("Send transaction confirmed:", sig);
}

async function main() {

    // await setup();
    // await setconfig();
    // await setlib();
    await send();
}

main();
