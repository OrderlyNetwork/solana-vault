import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from '../tests/types/endpoint'
import { EVENT_SEED, MESSAGE_LIB_SEED } from "@layerzerolabs/lz-solana-sdk-v2"
import { ConfirmOptions, PublicKey, SystemProgram } from '@solana/web3.js'

export const confirmOptions: ConfirmOptions = { maxRetries: 6, commitment: "confirmed", preflightCommitment: "confirmed"}

export const registerOapp = async (wallet: anchor.Wallet, program: Program<SolanaVault>, endpointProgram: Program<Endpoint>, usdcMint: PublicKey) => {
    const [oappPda, oappBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("OApp")],
        program.programId
    )
    const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("LzReceiveTypes"), oappPda.toBuffer()],
        program.programId
    )
    const [oappRegistryPda, oappRegistryBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("OApp"), oappPda.toBuffer()],
        endpointProgram.programId
    )
    const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED)],
        endpointProgram.programId
    )

    const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

    let oappRegistry
    try {
        oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
    } catch {
        await program.methods
            .initOapp({
                admin: wallet.publicKey,
                endpointProgram: endpointProgram.programId,
                usdcHash: usdcHash,
                usdcMint: usdcMint
            })
            .accounts({
                payer: wallet.publicKey,
                oappConfig: oappPda,
                lzReceiveTypes: lzReceiveTypesPda,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts([
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: wallet.publicKey,
                    isWritable: true,
                    isSigner: true,
                },
                {
                    pubkey: oappPda,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: oappRegistryPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: SystemProgram.programId,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: eventAuthorityPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
            ])
            .rpc(confirmOptions)
            oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
    }

    return {oappRegistry, oappPda}
}

export const initializeVault = async (wallet: anchor.Wallet, program: Program<SolanaVault>) => {
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("VaultAuthority")],
        program.programId
    )

    let vaultAuthority
    try {
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
    } catch {
        await program.methods
            .initVault({
                owner: wallet.publicKey,
                orderDelivery: true,
                dstEid: 42,
                solChainId: new BN(12),
            })
            .accounts({
                signer: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([wallet.payer])
            .rpc(confirmOptions)
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
    }    
    return {vaultAuthority, vaultAuthorityPda}
}