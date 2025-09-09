import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import * as utils from './utils'
import * as constants from './constants'

const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function setBrokerManagerRole() {
    console.log('Setting up Broker Manager Role...')
    const multisig = utils.getMultisig(ENV)
    const useMultisig = true
    const brokerManager = wallet.publicKey
    const brokerManagerRole = utils.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)
    const codedBrokerManagerRole = Array.from(Buffer.from(brokerManagerRole.slice(2), 'hex'))
    const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(OAPP_PROGRAM_ID, codedBrokerManagerRole, brokerManager)
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID)
    const setManagerRoleParams = {
        roleHash: codedBrokerManagerRole,
        managerAddress: brokerManager,
        allowed: true,
    }
    console.log('setManagerRoleParams', setManagerRoleParams)
    const setManagerRoleAccounts = {
        owner: useMultisig ? multisig : wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
        managerRole: brokerManagerRolePda,
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
setBrokerManagerRole()
