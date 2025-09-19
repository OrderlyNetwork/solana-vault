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

async function printToken() {
    const tokenList = utils.getTokenList()
    for (const tokenSymble of tokenList) {
        const tokenIndex = constants.TOKEN_INDEX[tokenSymble]
        console.log('token symbol: ', tokenSymble)
        // console.log('token index: ', tokenIndex)
        const tokenHash = utils.getTokenHash(tokenSymble)
        console.log('token hash: ', tokenHash.toString())
        const depositTokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash)
        const withdrawTokenPda = utils.getWithdrawTokenPda(OAPP_PROGRAM_ID, tokenIndex)

        console.log('depositTokenPda: ', depositTokenPda.toString())

        try {
            const depositTokenData = await OAppProgram.account.allowedToken.fetch(depositTokenPda)
            console.log('depositTokenData: ')
            console.log('  mint account: ', depositTokenData.mintAccount.toString())
            console.log('  allowed status: ', depositTokenData.allowed)
            console.log('  token decimals: ', depositTokenData.tokenDecimals)
            console.log('withdrawTokenPda: ', withdrawTokenPda.toString())
        } catch (err) {
            console.log('Deposit Token PDA not exist')
        }

        try {
            const withdrawTokenData = await OAppProgram.account.withdrawToken.fetch(withdrawTokenPda)
            console.log('withdrawTokenData: ')
            console.log('  token index: ', withdrawTokenData.tokenIndex)
            console.log('  mint account: ', withdrawTokenData.mintAccount.toString())
        } catch (err) {
            console.log('Withdraw Token PDA not exist')
        }
    }
}
printToken()
