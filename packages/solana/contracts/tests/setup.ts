import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from '../tests/types/endpoint'
import * as utils from '../scripts/utils'
import { EVENT_SEED, MESSAGE_LIB_SEED, OAPP_SEED } from "@layerzerolabs/lz-solana-sdk-v2"
import { ConfirmOptions, PublicKey, SystemProgram } from '@solana/web3.js'

export const confirmOptions: ConfirmOptions = { maxRetries: 6, commitment: "confirmed", preflightCommitment: "confirmed"}

export const initOapp = async (wallet: anchor.Wallet, program: Program<SolanaVault>, endpointProgram: Program<Endpoint>, usdcMint: PublicKey) => {
    
    const [oappConfigPda, oappBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("OApp")],
        program.programId
    )
    const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("LzReceiveTypes"), oappConfigPda.toBuffer()],
        program.programId
    )
    const [oappRegistryPda, oappRegistryBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("OApp"), oappConfigPda.toBuffer()],
        endpointProgram.programId
    )
    const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED)],
        endpointProgram.programId
    )

    const accountListPda = utils.getAccountListPda(program.programId, oappConfigPda)

    const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

    let oappRegistry
    try {
        oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
    } catch {
        await program.methods
            .initOapp({
                admin: wallet.publicKey,
                endpointProgram: endpointProgram.programId,
                accountList: accountListPda,
            })
            .accounts({
                payer: wallet.publicKey,
                oappConfig: oappConfigPda,
                lzReceiveTypes: lzReceiveTypesPda,
                accountList: accountListPda,
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
                    pubkey: oappConfigPda,
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
    
    return {oappRegistry, oappConfigPda}
}

export const setVault = async (wallet: anchor.Wallet, program: Program<SolanaVault>, dstEid: number) => {
    
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("VaultAuthority")],
        program.programId
    )
    const oappConfigPda = PublicKey.findProgramAddressSync(
        [Buffer.from(OAPP_SEED, "utf8")],
        program.programId
    )[0]

    let vaultAuthority
    try {
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
    } catch {
        await program.methods
            .setVault({
                owner: wallet.publicKey,
                depositNonce: new BN(0),
                orderDelivery: true,
                inboundNonce: new BN(0),
                dstEid: dstEid,
                solChainId: new BN(12),
            })
            .accounts({
                admin: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([wallet.payer])
            .rpc(confirmOptions)
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
    }  
   
    return {vaultAuthority, vaultAuthorityPda}
}