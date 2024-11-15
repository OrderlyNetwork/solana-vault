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
    const lzReceiveAlertSig = "5DyGY5kVDwJuWvkeW5mbRjN5DKZucP5LCD94dxbT2jtMAAA7cRxBtmBkSfX6fiTyS5rPXV34Z1PgK7PiWJStVRyA";

    const [lzReceiveEventAlert] =  await extractEventFromTransactionSignature(provider.connection, EndpointProgram.PROGRAM_ID, lzReceiveAlertSig, EndpointProgram.events.lzReceiveAlertEventBeet, {
      commitment: 'confirmed',
    })

    console.log(lzReceiveEventAlert.receiver)

    const receivePacket = {
      version: 1,
      nonce: lzReceiveEventAlert.nonce.toString(),
      srcEid: lzReceiveEventAlert.srcEid,
      dstEid: 40168,
      sender: '0x' + Buffer.from(lzReceiveEventAlert.sender).toString('hex'),
      receiver: lzReceiveEventAlert.receiver.toBase58(), 
      guid: '0x'+ Buffer.from(lzReceiveEventAlert.guid).toString('hex'),
      message: '0x' + Buffer.from(lzReceiveEventAlert.message).toString('hex'),
      payload: '',
    }

    console.log(receivePacket)

    const ixLzReceive = await lzReceive(provider.connection, wallet.payer.publicKey,receivePacket);
    const txLzReceive = new Transaction().add(ixLzReceive);
    const sigLzReceive = await provider.sendAndConfirm(txLzReceive, [wallet.payer]);

    console.log("LzReceive transaction confirmed:", sigLzReceive);
}

callLzReceive();

