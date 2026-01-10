import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import * as utils from './utils'
import * as constants from './constants'

const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function setTokenManagerRole() {
    console.log('Setting up Token Manager Role...')
    const multisig = utils.getMultisig(ENV)
    const useMultisig = true
    const tokenManager = multisig
    const tokenManagerRole = utils.getManagerRoleHash(constants.TOKEN_MANAGER_ROLE)
    const codedTokenManagerRole = Array.from(Buffer.from(tokenManagerRole.slice(2), 'hex'))
    const tokenManagerRolePda = utils.getManagerRolePdaWithBuf(OAPP_PROGRAM_ID, codedTokenManagerRole, tokenManager)
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID)
    const setManagerRoleParams = {
        roleHash: codedTokenManagerRole,
        managerAddress: tokenManager,
        allowed: true,
    }
    console.log('setManagerRoleParams', setManagerRoleParams)
    const setManagerRoleAccounts = {
        owner: useMultisig ? multisig : wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
        managerRole: tokenManagerRolePda,
        systemProgram: SystemProgram.programId,
    }
    console.log('setManagerRoleAccounts', setManagerRoleAccounts)
    const ixSetManagerRole = await OAppProgram.methods
        .setManagerRole(setManagerRoleParams)
        .accounts(setManagerRoleAccounts)
        .instruction()
    const txSetManagerRole = new Transaction().add(ixSetManagerRole)
    console.log('txSetManagerRole', txSetManagerRole)
    if (useMultisig) {
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetManagerRole)
        console.log('txBase58 for set manager role:\n', txBase58)
    } else {
        console.log('Setting up Manager Role...')
        const sigSetManagerRole = await sendAndConfirmTransaction(
            provider.connection,
            txSetManagerRole,
            [wallet.payer],
            {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
            }
        )
    }
}
setTokenManagerRole()
