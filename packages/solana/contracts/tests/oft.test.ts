import * as anchor from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, getMintLen } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { assert } from 'chai'

import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'

import solanaVaultIdl from '../target/idl/solana_vault.json'
import endpointIdl from '../target/idl/endpoint.json'
import { setup } from '../scripts/01setup_oapp'
import * as utils from '../scripts/utils'
import * as constants from '../scripts/constants'
import { SolanaVault } from '../target/types/solana_vault'
import { Options } from '@layerzerolabs/lz-v2-utilities'

const SOLANA_VAULT_SEED = 'OApp'
const SOLANA_SOLANA_VAULT_TOKEN_DECIMALS = 8
const SOLANA_VAULT_SHARE_DECIMALS = 6

describe('OApp', () => {
    console.log('starting test')
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.local(undefined, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
    })
    const rpc = "http://127.0.0.1:8899";
    const wallet = provider.wallet as anchor.Wallet

    const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;
    const OAPP_PROGRAM_ID = new PublicKey(solanaVaultIdl.metadata.address)
    console.log("OAPP_PROGRAM_ID", OAPP_PROGRAM_ID.toBase58());

    // const ENDPOINT_PROGRAM_ID = new PublicKey(endpointIdl.metadata.address)
    // console.log("ENDPOINT_PROGRAM_ID", ENDPOINT_PROGRAM_ID.toBase58());

    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    console.log("OApp Config PDA:", oappConfigPda.toBase58());

    const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    console.log("LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

    const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("Peer PDA:", peerPda.toBase58());

    const eventAuthorityPda = utils.getEventAuthorityPda();
    console.log("Event Authority PDA:", eventAuthorityPda.toBase58());

    const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda);
    console.log("OApp Registry PDA:", oappRegistryPda.toBase58());

    const vaultOwnerPda = utils.getVaultOwnerPda(OAPP_PROGRAM_ID);
    console.log("Owner PDA:", vaultOwnerPda.toBase58());

    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    console.log("vault authority pda", vaultAuthorityPda.toBase58());

    it('Setup OApp', async () => {
        console.log("Setting up OApp...");
        const tokenSymble = "USDC";
        const tokenHash = utils.getTokenHash(tokenSymble);
        const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
        const mintAccount = await utils.getUSDCAddress(rpc);

        console.log("constructing initOapp instruction");
        // print wallet info
        console.log(wallet.publicKey.toBase58())

        const ixInitOapp = await OAppProgram.methods.initOapp({
            admin: wallet.publicKey,
            endpointProgram: constants.ENDPOINT_PROGRAM_ID,
            usdcHash: codedTokenHash,
            usdcMint: mintAccount,
        }).accounts({
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            lzReceiveTypes: lzReceiveTypesPda,
            systemProgram: SystemProgram.programId
        }).remainingAccounts(
            [
                {
                    isSigner: false,
                    isWritable: false,
                    pubkey: constants.ENDPOINT_PROGRAM_ID,
                },
                {
                    isSigner: true,
                    isWritable: true,
                    pubkey: wallet.publicKey,
                },
                {
                    isSigner: false,
                    isWritable: false,
                    pubkey: oappConfigPda,
                },
                {
                    isSigner: false,
                    isWritable: true,
                    pubkey: oappRegistryPda
                },
                {
                    isSigner: false,
                    isWritable: false,
                    pubkey: SystemProgram.programId
                },
                {
                    isSigner: false,
                    isWritable: true,
                    pubkey: eventAuthorityPda
                },
                {
                    isSigner: false,
                    isWritable: false,
                    pubkey: constants.ENDPOINT_PROGRAM_ID
                },
            ]
        ).instruction();
        
        // console.log("ixInitOapp", ixInitOapp);

        const txInitOapp = new Transaction().add(ixInitOapp);
        const sigInitOapp = await provider.sendAndConfirm(txInitOapp, [wallet.payer]);
        console.log("Init OApp transaction confirmed:", sigInitOapp);

        const ixSetPeer = await OAppProgram.methods.setPeer({
            dstEid: constants.DST_EID,
            peer: Array.from(constants.PEER_ADDRESS)
        }).accounts({
            admin: wallet.publicKey,
            peer: peerPda,
            oappConfig: oappConfigPda,
            systemProgram: SystemProgram.programId
        }).signers([wallet.payer])
            .instruction();

        const txSetPeer = new Transaction().add(ixSetPeer);
        const sigSetPeer = await provider.sendAndConfirm(txSetPeer, [wallet.payer]);
        console.log("Set Peer transaction confirmed:", sigSetPeer);

        const ixSetOption = await OftTools.createSetEnforcedOptionsIx(
            wallet.publicKey,
            oappConfigPda,
            constants.DST_EID,
            Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorOrderedExecutionOption().toBytes(),
            Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorComposeOption(0, constants.LZ_COMPOSE_GAS, constants.LZ_COMPOSE_VALUE).toBytes(),
            OAPP_PROGRAM_ID
        )

        console.log("send and confirm transaction");

        const txSetOption = await provider.sendAndConfirm(new anchor.web3.Transaction().add(ixSetOption), [wallet.payer]);
        console.log("Transaction to set options:", txSetOption);

        // Get the vault authority account
        const vaultAuthorityAccount = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);

        // Log and check the values
        console.log("Vault Authority values:");
        console.log("Bump:", vaultAuthorityAccount.bump);
        console.log("Owner:", vaultAuthorityAccount.owner.toBase58());
        console.log("Deposit Nonce:", vaultAuthorityAccount.depositNonce.toString());
        console.log("Order Delivery:", vaultAuthorityAccount.orderDelivery);
        console.log("Inbound Nonce:", vaultAuthorityAccount.inboundNonce.toString());
        console.log("Dst EID:", vaultAuthorityAccount.dstEid);
        console.log("Sol Chain ID:", vaultAuthorityAccount.solChainId.toString());

        // Add assertions to check the correctness of the values
        assert(vaultAuthorityAccount.owner.equals(wallet.publicKey), "Owner should be the wallet public key");
        assert(vaultAuthorityAccount.depositNonce.eq(new anchor.BN(0)), "Initial deposit nonce should be 0");
        assert(vaultAuthorityAccount.orderDelivery === true, "Order delivery should be true");
        assert(vaultAuthorityAccount.inboundNonce.eq(new anchor.BN(0)), "Initial inbound nonce should be 0");
        assert(vaultAuthorityAccount.dstEid === constants.DST_EID, "Dst EID should match the constant");
        assert(vaultAuthorityAccount.solChainId.eq(new anchor.BN(constants.SOL_CHAIN_ID)), "Sol Chain ID should match the constant");

        console.log("All vault authority values are correct!");
    })
})
