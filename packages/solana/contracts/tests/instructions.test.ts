import * as anchor from '@coral-xyz/anchor'
import { BN, Program } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
// import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, getMintLen } from '@solana/spl-token'
import { getLogs } from "@solana-developers/helpers";
import { ConfirmOptions, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { assert } from 'chai'

const confirmOptions: ConfirmOptions = { maxRetries: 3, commitment: "confirmed" }

describe('solana-vault', () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const program = anchor.workspace.SolanaVault as Program<SolanaVault>

    it('initializes vault', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )
        const tx = await program.methods
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
        
        const logs = await getLogs(provider.connection, tx)
        console.log(logs)
        
        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, 42)
        assert.ok(vaultAuthority.solChainId.eq(new BN(12)))
    })
})
