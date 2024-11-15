import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { OftTools, EndpointProgram, extractEventFromTransactionSignature, lzReceive, getLzReceiveAccounts, LzReceiveParams } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options, Packet } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(); 
const ENV = utils.getEnv(OAPP_PROGRAM_ID);


async function callLzReceive() {
    console.log(OAPP_PROGRAM_ID.toString());
    const lzReceiveAlertSig = "3nMazToDmHPpEQiVuHSuKFs6a4psJw4FmepzoB2Gah2w98Uk6eLB3r3qbdf9pZSxnZudtG5Yb4Fjd88HT4g9USy3";

    const [lzReceiveEventAlert] =  await extractEventFromTransactionSignature(provider.connection, EndpointProgram.PROGRAM_ID, lzReceiveAlertSig, EndpointProgram.events.lzReceiveAlertEventBeet, {
      commitment: 'confirmed',
    })

    console.log(lzReceiveEventAlert)

    const receivePacket = {
      version: 1,
      nonce: lzReceiveEventAlert.nonce.toString(),
      srcEid: lzReceiveEventAlert.srcEid,
      dstEid: 40168,
      sender: lzReceiveEventAlert.sender.toString(),
      receiver: lzReceiveEventAlert.receiver.toString(),
      guid: lzReceiveEventAlert.guid.toString(),
      message: lzReceiveEventAlert.message.toString(),
      payload: '',
    }

    console.log(receivePacket)

    // const lzReceiveSig = await lzReceive(provider.connection, wallet.payer.publicKey,receivePacket);

    // console.log("LzReceive transaction confirmed:", lzReceiveSig);

    const lzReceiveParams: LzReceiveParams = {
      sender: lzReceiveEventAlert.sender,
      srcEid: lzReceiveEventAlert.srcEid,
      nonce: lzReceiveEventAlert.nonce,
      guid: lzReceiveEventAlert.guid,
      message: lzReceiveEventAlert.message,
      callerParams: Uint8Array.from(wallet.payer.publicKey.toBuffer()),
    }
    console.log("sender", Buffer.from(lzReceiveEventAlert.sender).toString('hex'))
    const lzReceiveAccounts = await getLzReceiveAccounts(provider.connection, wallet.payer.publicKey, lzReceiveEventAlert.receiver, OAPP_PROGRAM_ID, lzReceiveParams)


    console.log(lzReceiveAccounts)
    console.log(lzReceiveAccounts.length)


    const oappLzReceiveParams = {
      srcEid: lzReceiveEventAlert.srcEid,
      sender: lzReceiveEventAlert.sender,
      nonce: lzReceiveEventAlert.nonce,
      guid: lzReceiveEventAlert.guid,
      message: lzReceiveEventAlert.message,
      extraData: lzReceiveEventAlert.extraData,
    }
    console.log(typeof(lzReceiveEventAlert.message))
    console.log(lzReceiveEventAlert.message)
    console.log(lzReceiveEventAlert.receiver.toBase58())
    console.log(lzReceiveEventAlert.extraData)
    const DST_EID = utils.getDstEid(ENV);
    // const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    // const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
    // const brokerHash = utils.getBrokerHash("woofi_rpo");
    // const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    // console.log(oappConfigPda.toString(), peerPda.toString(), brokerPda.toString());
    // const tokenHash = utils.getTokenHash("USDC");
    // const tokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    // const receiverTokenAccount = utils.getUSDCAccount(constants.DEV_USDC_ACCOUNT, lzReceiveEventAlert.receiver);
    // const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    // const vaultAuthorityTokenAccount = utils.getUSDCAccount(constants.DEV_USDC_ACCOUNT, vaultAuthorityPda);
    console.log("hi")
    console.log(lzReceiveAccounts[0].pubkey.toString())

    console.log(lzReceiveAccounts[5].pubkey, lzReceiveAccounts[6].pubkey, lzReceiveAccounts[7].pubkey)
    const ixLzReceive = await OAppProgram.methods.lzReceive({
      srcEid: lzReceiveEventAlert.srcEid,
      sender: lzReceiveEventAlert.sender,
      nonce: lzReceiveEventAlert.nonce,
      guid: lzReceiveEventAlert.guid,
      message: lzReceiveEventAlert.message,
      extraData: lzReceiveEventAlert.extraData,
    }).accounts({
      payer: wallet.payer.publicKey,
      peer: lzReceiveAccounts[1].pubkey,
      oappConfig: lzReceiveAccounts[2].pubkey,
      brokerPda: lzReceiveAccounts[3].pubkey,
      tokenPda: lzReceiveAccounts[4].pubkey,
      tokenMint: lzReceiveAccounts[5].pubkey,
      receiver: lzReceiveAccounts[6].pubkey,
      receiverTokenAccount: lzReceiveAccounts[7].pubkey,
      vaultAuthority: lzReceiveAccounts[8].pubkey,
      vaultTokenAccount: lzReceiveAccounts[9].pubkey,
      tokenProgram: lzReceiveAccounts[10].pubkey,
    }).remainingAccounts(lzReceiveAccounts.slice(11)).instruction();

    // console.log(ixLzReceive);
   
    const tx = new Transaction().add(ixLzReceive);
    const sig = await provider.sendAndConfirm(tx, [wallet.payer]);
    console.log("LzReceive transaction confirmed:", sig);

    // const transactionDetails = await provider.connection.getParsedTransaction(lzReceiveAlertSig, {
    //   commitment: 'confirmed',
    // });
    // const eventParser = new anchor.EventParser(OAppProgram.programId, new anchor.BorshCoder(OAppProgram.idl));

    // const events = eventParser.parseLogs(transactionDetails.meta.logMessages);
    // for (let event of events) {
    //     console.log(event);
    // }
    // console.log(transactionDetails);

    // console.log(transactionDetails.meta.logMessages);

    // const addressList= utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);
    // const guid = "0x199fef33f9c31286a93b02e659972f64766908d14a9e1a7fcd6ea1f85b00498e";
    // const codedGuid = Array.from(Uint8Array.from(Buffer.from(guid.slice(2), 'hex')));
    // const message = "0x015fd71ce45ab6cccbc4010d975ea1ab3477f7dfc41ab9d558b2e5f6974a4eaa8d0861db5f04e9bc6ff0c14b7e8b72c659b60e4a1a0bfc3029800a1987423df8010861db5f04e9bc6ff0c14b7e8b72c659b60e4a1a0bfc3029800a1987423df8016ca2f644ef7bd6d75953318c7f2580014941e753b3c6d54da56b3bf75dd14dfcd6aca1be9729c13d677335161321649cccae6a591554772516700f986f942eaa00000000004c4b4000000000000f42400000000035c1ee4d000000000000004c";
    // const codedMessage = Uint8Array.from(Buffer.from(message.slice(2), 'hex'));
   
    // const lzReceiveParams = {
    //     srcEid: 40200,
    //     sender: Uint8Array.from(Array.from(constants.PEER_ADDRESS)),
    //     nonce: new anchor.BN(1),
    //     guid: codedGuid,
    //     message: codedMessage,
    //     extraData: Uint8Array.from([0, 0])
    // }

    

    // const ixLzReceive = OAppProgram.methods.lzReceive(lzReceiveParams)
    // .accounts({
    //     payer: wallet.publicKey,
    //     peer: peerPda,
    //     oappConfig: oappConfigPda,
    //     user: wallet.publicKey,
    //     userDepositWallet: userUSDCAccount,
    //     vaultAuthority: vaultAuthorityPda,
    //     vaultDepositWallet: vaultUSDCAccount,
    //     depositToken: usdcAddress,

    // }).remainingAccounts(
    //     [
    //         // {
    //         //   pubkey: new PublicKey("3HSGGUXKRtmAXpktCajhm4c7RAv8NFGpXmgRW53uUAKx"),
    //         //   isSigner: true,
    //         //   isWritable: true
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("F8E8QGhKmHEx2esh5LpVizzcP4cHYhzXdXTwg9w3YYY2"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("GcsisZBEmrP5nmz2mpcW1RDirwjedFyC52FwyX5am3bi"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("EYJq9eU4GMRUriUJBgGoZ8YLQBXcWaciXuSsEXE7ieQS"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("3HSGGUXKRtmAXpktCajhm4c7RAv8NFGpXmgRW53uUAKx"),
    //         //   isSigner: true,
    //         //   isWritable: true
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("pJwTiYrF1JR3criJyjuwradsjodUcB2bC7J5QXwK85c"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("FALLg3ZbcmcWqkkvfbRMVxM2bj9hxgMYmD7dSkgJSgkv"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("Zions51qQNUgWNyp4JegUFoMUpgFx43jBUsYmHtDPdr"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("8g3yNyoXr6N4c8eQapQ1jeX5oDYY2kgzvDx6Lb9qunhA"),
    //         //   isSigner: false,
    //         //   isWritable: true
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("HmsdrYgTX7Nv9ZBTcf375F4C1WG7dVkpF8DZX43BJa6y"),
    //         //   isSigner: false,
    //         //   isWritable: true
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("EEY5evBCYJ52wWrRarKdzjpEoybmW28sTwFeTLn1PXp4"),
    //         //   isSigner: false,
    //         //   isWritable: true
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         // {
    //         //   pubkey: new PublicKey("11111111111111111111111111111111"),
    //         //   isSigner: false,
    //         //   isWritable: false
    //         // },
    //         {
    //           pubkey: new PublicKey("3iySQAxqDbKJyyawa78JTQbAY1BvLcDZb2Hua66Tz32V"),
    //           isSigner: false,
    //           isWritable: false
    //         },
    //         {
    //           pubkey: new PublicKey("EYJq9eU4GMRUriUJBgGoZ8YLQBXcWaciXuSsEXE7ieQS"),
    //           isSigner: false,
    //           isWritable: false
    //         },
    //         {
    //           pubkey: new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"),
    //           isSigner: false,
    //           isWritable: false
    //         },
    //         {
    //           pubkey: new PublicKey("FALLg3ZbcmcWqkkvfbRMVxM2bj9hxgMYmD7dSkgJSgkv"),
    //           isSigner: false,
    //           isWritable: false
    //         },
    //         {
    //           pubkey: new PublicKey("FZQpsz3VbHW5WaN9d82zVJtqW3TozjV19LPCZcHDp9sU"),
    //           isSigner: false,
    //           isWritable: false
    //         },
    //         {
    //           pubkey: new PublicKey("F6upK6xUX6t9LWpoLjyiu3R6hhs76QVZwZDVyT9iG1W7"),
    //           isSigner: false,
    //           isWritable: true
    //         },
    //         {
    //           pubkey: new PublicKey("8rq9uC2xhiEraGTitCCTHpnFxdxW1HuBW5QJgND91A2d"),
    //           isSigner: false,
    //           isWritable: true
    //         },
    //         {
    //          pubkey: new PublicKey("2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3"),
    //           isSigner: false,
    //           isWritable: true
    //         },
    //         {
    //           pubkey: new PublicKey("F8E8QGhKmHEx2esh5LpVizzcP4cHYhzXdXTwg9w3YYY2"),
    //           isSigner: false,
    //           isWritable: false
    //         },
    //         {
    //           pubkey: new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"),
    //           isSigner: false,
    //           isWritable: false
    //         }
    //     ]
    // ).instruction();

}

callLzReceive();

