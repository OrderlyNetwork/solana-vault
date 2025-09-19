import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import * as utils from './utils'
import * as constants from './constants'

const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function setBroker() {
    const multisig = utils.getMultisig(ENV)
    const useMultisig = true
    const allowedBrokerList = utils.getBrokerList(ENV)

    const brokerManager = useMultisig ? multisig : wallet.publicKey

    const brokerManagerRoleHash = utils.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)
    const codedBrokerManagerRoleHash = Array.from(Buffer.from(brokerManagerRoleHash.slice(2), 'hex'))
    const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(
        OAPP_PROGRAM_ID,
        codedBrokerManagerRoleHash,
        brokerManager
    )

    let setBrokerParams = {
        brokerManagerRole: codedBrokerManagerRoleHash,
        brokerHash: undefined,
        allowed: undefined,
    }
    let setBrokerAccounts = {
        brokerManager: useMultisig ? multisig : wallet.publicKey,
        allowedBroker: undefined,
        managerRole: brokerManagerRolePda,
        systemProgram: SystemProgram.programId,
    }

    let setWithdrawBrokerParams = {
        brokerManagerRole: codedBrokerManagerRoleHash,
        brokerHash: undefined,
        brokerIndex: undefined,
        allowed: undefined,
    }
    let setWithdrawBrokerAccounts = {
        brokerManager: brokerManager,
        withdrawBroker: undefined,
        managerRole: brokerManagerRolePda,
        systemProgram: SystemProgram.programId,
    }

    console.log('Setting up Brokers...')
    let txSetBroker = new Transaction()
    for (const brokerId of allowedBrokerList) {
        console.log('Broker Id:', brokerId)
        const brokerHash = utils.getBrokerHash(brokerId)
        console.log('Broker Hash:', brokerHash)
        const brokerIndex = constants.WITHDRAW_BROKER_INDEX[brokerId]
        if (brokerIndex === undefined) {
            throw new Error(`Broker Index not found for brokerId: ${brokerId}`)
        }
        console.log('Broker Index:', brokerIndex)
        const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'))
        const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash)
        // console.log('BrokerPda', brokerPda.toBase58())
        const allowed = true

        let brokerStatue = 0 // 0: deposit PDA allowed, 1: deposit PDA not exist,
        let withdrawBrokerStatue = 0 // 0: withdraw PDA allowed, 1: withdraw PDA not exist
        try {
            const brokerStatus = await OAppProgram.account.allowedBroker.fetch(brokerPda)
            if (brokerStatus.allowed) {
                console.log('Broker already allowed')
            }
        } catch (err) {
            console.log('Broker PDA not exist, setting deposit Broker PDA')
            brokerStatue = 1

            setBrokerParams.allowed = allowed
            setBrokerParams.brokerHash = codedBrokerHash
            setBrokerAccounts.allowedBroker = brokerPda
            const ixSetBroker = await OAppProgram.methods
                .setBroker(setBrokerParams)
                .accounts(setBrokerAccounts)
                .instruction()
            // console.log('setBrokerParams', setBrokerParams)
            // console.log('setBrokerAccounts', setBrokerAccounts)
            txSetBroker.add(ixSetBroker)
        }

        const withdrawBrokerPda = utils.getWithdrawBrokerPda(OAPP_PROGRAM_ID, brokerIndex)
        console.log('Withdraw BrokerPda', withdrawBrokerPda.toBase58())

        try {
            const brokerStatus = await OAppProgram.account.withdrawBroker.fetch(withdrawBrokerPda)
            if (brokerStatus.allowed) {
                console.log('Wtihdraw Broker already allowed')
            }
        } catch (err) {
            // console.error(err)
            console.log('Broker PDA not exist, setting withdraw Broker PDA')
            setWithdrawBrokerParams.allowed = allowed
            setWithdrawBrokerParams.brokerHash = codedBrokerHash
            setWithdrawBrokerParams.brokerIndex = brokerIndex
            setWithdrawBrokerAccounts.withdrawBroker = withdrawBrokerPda
            const ixSetWithdrawBroker = await OAppProgram.methods
                .setWithdrawBroker(setWithdrawBrokerParams)
                .accounts(setWithdrawBrokerAccounts)
                .instruction()
            txSetBroker.add(ixSetWithdrawBroker)
        }
    }

    if (useMultisig) {
        // console.log(txSetBroker);
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetBroker)
        console.log('txBase58 for set broker:\n', txBase58)
    } else {
        // console.log(`Setting up Broker ...`) // ${brokerId}
        // const sigSetBroker = await sendAndConfirmTransaction(provider.connection, txSetBroker, [wallet.payer], {
        //     commitment: 'confirmed',
        //     preflightCommitment: 'confirmed',
        // })
        // console.log('sigSetBroker', sigSetBroker)
    }
}
setBroker()
