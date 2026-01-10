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
    // const brokerList = ['ibx', 'trading_strategy']
    for (const brokerId of brokerList) {
        const brokerIndex = constants.WITHDRAW_BROKER_INDEX[brokerId]
        const brokerHash = utils.getBrokerHash(brokerId)
        const depositBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash)

        console.log('===============================================  ')

        console.log('broker id: ', brokerId)
        console.log(' broker hash: ', brokerHash)
        console.log(' broker hash array: ', Array.from(Buffer.from(brokerHash.slice(2), 'hex')))
        try {
            const depositBrokerData = await OAppProgram.account.allowedBroker.fetch(depositBrokerPda)

            console.log('deposit broker status: ', depositBrokerData.allowed)
        } catch (err) {
            console.log('Deposit Broker PDA not exist')
        }

        try {
            const witdhrawBrokerPda = utils.getWithdrawBrokerPda(OAPP_PROGRAM_ID, brokerIndex)

            const withdrawBrokerData = await OAppProgram.account.withdrawBroker.fetch(witdhrawBrokerPda)

            console.log('withdraw broker data: ')
            console.log(' withdraw broker status: ', withdrawBrokerData.allowed)
            console.log('  broker index: ', withdrawBrokerData.brokerIndex)
            console.log('  broker hash: ', '0x' + Buffer.from(withdrawBrokerData.brokerHash as any).toString('hex'))
            console.log('  broker hash array: ', withdrawBrokerData.brokerHash)
        } catch (err) {
            console.log('Withdraw Broker PDA not exist')
        }
    }
}
printBroker()
