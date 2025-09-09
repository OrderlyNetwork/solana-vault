import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import * as utils from './utils'
import * as constants from './constants'

import * as bs from 'bs58'
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils'
const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function printBroker() {
    const brokerList = utils.getBrokerList(ENV)
    for (const brokerId of brokerList) {
        const brokerIndex = constants.WITHDRAW_BROKER_INDEX[brokerId]
        console.log('broker id: ', brokerId)
        const brokerHash = utils.getBrokerHash(brokerId)
        console.log('broker hash: ', brokerHash)
        const depositBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash)

        // const depositBrokerData = await OAppProgram.account.allowedBroker.fetch(depositBrokerPda)

        // console.log('deposit broker pda: ', depositBrokerPda.toString())

        // console.log('deposit broker data: ')
        // console.log(' allowed status: ', depositBrokerData.allowed)

        const witdhrawBrokerPda = utils.getWithdrawBrokerPda(OAPP_PROGRAM_ID, brokerIndex)

        const withdrawBrokerData = await OAppProgram.account.withdrawBroker.fetch(witdhrawBrokerPda)

        console.log('withdraw broker pda: ', witdhrawBrokerPda.toString())

        console.log('withdraw broker data: ')
        console.log('  allowed status: ', withdrawBrokerData.allowed)
        console.log('  broker index: ', withdrawBrokerData.brokerIndex)
    }
}
printBroker()
