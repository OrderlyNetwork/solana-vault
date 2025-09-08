import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import * as utils from './utils'
import * as constants from './constants'

import * as bs from 'bs58'
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils'
import { use } from 'chai'
const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function setWithdrawToken() {
    const multisig = utils.getMultisig(ENV)
    const useMultisig = true
    const tokenList = utils.getTokenList()
    let txSetToken = new Transaction()
    for (const tokenSymble of tokenList) {
        console.log('tokenSymble', tokenSymble)
        const tokenIndex = constants.TOKEN_INDEX[tokenSymble]
        console.log('tokenIndex', tokenIndex)
        const tokenHash = utils.getTokenHash(tokenSymble)
        console.log('Token Hash:', tokenHash)
        const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'))
        const mintAccount = utils.getTokenAddress(ENV, tokenSymble)
        console.log('mintAccount', mintAccount.toBase58())
        const tokenPda = utils.getWithdrawTokenPda(OAPP_PROGRAM_ID, tokenIndex)
        console.log('tokenPda', tokenPda.toBase58())
        const tokenManagerRole = utils.getManagerRoleHash(constants.TOKEN_MANAGER_ROLE)
        const codedTokenManagerRole = Array.from(Buffer.from(tokenManagerRole.slice(2), 'hex'))
        const tokenManagerKey = useMultisig ? multisig : wallet.publicKey
        const tokenManagerRolePda = utils.getManagerRolePdaWithBuf(
            OAPP_PROGRAM_ID,
            codedTokenManagerRole,
            tokenManagerKey
        )
        const withdrawTokenPda = utils.getWithdrawTokenPda(OAPP_PROGRAM_ID, tokenIndex)

        const allowed = true
        let setWithdrawTokenParams = {
            tokenManagerRole: codedTokenManagerRole,
            tokenHash: codedTokenHash,
            tokenIndex: tokenIndex,
            allowed: allowed,
        }
        // console.log("Set Token Params:", setTokenParams);
        const setWithdrawTokenAccounts = {
            tokenManager: useMultisig ? multisig : wallet.publicKey,
            withdrawToken: withdrawTokenPda,
            managerRole: tokenManagerRolePda,
            mintAccount: mintAccount,
        }
        // console.log("Set Token Accounts:", setTokenAccounts);
        const ixSetToken = await OAppProgram.methods
            .setWithdrawToken(setWithdrawTokenParams)
            .accounts(setWithdrawTokenAccounts)
            .instruction()

        await utils.delay(ENV)

        txSetToken.add(ixSetToken)
    }
    if (useMultisig) {
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetToken)
        console.log('txBase58 for set token:\n', txBase58)
    } else {
        console.log(`Setting up Token ...`)
        const sigSetToken = await sendAndConfirmTransaction(provider.connection, txSetToken, [wallet.payer], {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
        })
        console.log('sigSetToken', sigSetToken)
    }

    // txSetToken.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    // txSetToken.feePayer = wallet.publicKey;
    // console.log(txSetToken)
    // // console.log(txSetOrderDelivery.serializeMessage().toString('hex'))

    // console.log("txSetToken", txSetToken.serializeMessage().toString('hex'));
    // console.log("base58 encoded tx: ", bs.encode(txSetToken.serializeMessage()));
}
setWithdrawToken()

// {"mintAccount":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","tokenHash":[214,172,161,190,151,41,193,61,103,115,53,22,19,33,100,156,204,174,106,89,21,84,119,37,22,112,15,152,111,148,46,170],"allowed":false}
