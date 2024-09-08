import * as utils from "./utils";
import * as constants from "./constants";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey} from "@solana/web3.js";

const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

printPda();

function printPda() {
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    console.log("🔑 OApp Config PDA:", oappConfigPda.toBase58());

    const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    console.log("🔑 LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

    const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("🔑 Peer PDA:", peerPda.toBase58());

    const eventAuthorityPda = utils.getEventAuthorityPda();
    console.log("🔑 Event Authority PDA:", eventAuthorityPda.toBase58());

    const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda);
    console.log("🔑 OApp Registry PDA:", oappRegistryPda.toBase58());

    const enforceOptioinsPda = utils.getEndorcedOptionsPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("🔑 Enforced Options PDA:", enforceOptioinsPda.toBase58());

    const sendLibPda = utils.getSendLibPda();
    console.log("🔑 Send Library PDA:", sendLibPda.toBase58());

    const sendLibConfigPda = utils.getSendLibConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Send Library Config PDA:", sendLibConfigPda.toBase58());

    const sendLibInfoPda = utils.getSendLibInfoPda(sendLibPda);
    console.log("🔑 Send Library Info PDA:", sendLibInfoPda.toBase58());

    const defaultSendLibConfigPda = utils.getDefaultSendLibConfigPda(constants.DST_EID);
    console.log("🔑 Default Send Library Config PDA:", defaultSendLibConfigPda.toBase58());

    const sendConfigPda = utils.getSendConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Send Config PDA:", sendConfigPda.toBase58());

    const defaultSendConfigPda = utils.getDefaultSendConfigPda(constants.DST_EID);
    console.log("🔑 Default Send Config PDA:", defaultSendConfigPda.toBase58());

    const receiveConfigPda = utils.getReceiveConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Receive Config PDA:", receiveConfigPda.toBase58());

    const defaultReceiveConfigPda = utils.getDefaultReceiveConfigPda(constants.DST_EID);
    console.log("🔑 Default Receive Config PDA:", defaultReceiveConfigPda.toBase58());

    const ulnEventAuthorityPda = utils.getUlnEventAuthorityPda();
    console.log("🔑 ULN Event Authority PDA:", ulnEventAuthorityPda.toBase58());

    const ulnSettingPda = utils.getUlnSettingPda();
    console.log("🔑 ULN Setting PDA:", ulnSettingPda.toBase58());

    const endpointSettingPda = utils.getEndpointSettingPda();
    console.log("🔑 Endpoint Setting PDA: ", endpointSettingPda.toString());

    const outboundNoncePda = utils.getOutboundNoncePda(oappConfigPda, constants.DST_EID, constants.PEER_ADDRESS);
    console.log("🔑 Outbound Nonce PDA: ", outboundNoncePda.toString());

    const executorConfigPda = utils.getExecutorConfigPda();
    console.log("🔑 Executor Config PDA: ", executorConfigPda.toString());

    const pricefeedConfigPda = utils.getPriceFeedPda();
    console.log("🔑 Price Feed Config PDA: ", pricefeedConfigPda.toString());

    const dvnConfigPda = utils.getDvnConfigPda();
    console.log("🔑 DVN Config PDA: ", dvnConfigPda.toString());

    const messageLibPda = utils.getMessageLibPda();
    console.log("🔑 Message Lib PDA: ", messageLibPda.toString());

    console.log("Execute the following command to set up local solana node:");
    console.log(`solana-test-validator --clone-upgradeable-program ${constants.ENDPOINT_PROGRAM_ID} --clone-upgradeable-program ${constants.SEND_LIB_PROGRAM_ID} --clone-upgradeable-program ${constants.DVN_PROGRAM_ID} --clone-upgradeable-program ${constants.EXECUTOR_PROGRAM_ID} --clone-upgradeable-program ${constants.PRICE_FEED_PROGRAM_ID} -c ${sendLibPda} -c ${sendLibInfoPda} -c ${defaultSendConfigPda} -c ${defaultSendLibConfigPda} -c ${endpointSettingPda} -c ${dvnConfigPda} -c ${pricefeedConfigPda} -c ${executorConfigPda} -c ${sendConfigPda} -c ${defaultSendConfigPda} -c ${receiveConfigPda} -c ${defaultReceiveConfigPda} --url devnet --reset`)

    // const [usdcAddress, userUSDCAccount, vaultUSDCAccount] = await utils.getRelatedUSDCAcount(provider, wallet, rpc);
    // console.log("💶 USDC Address: ", usdcAddress.toString());
    // console.log("💶 User USDC Account: ", userUSDCAccount.toString());
    // console.log("💶 Vault USDC Account: ", vaultUSDCAccount.toString());

    const lookupTableAddress = [oappConfigPda, lzReceiveTypesPda, peerPda, eventAuthorityPda, oappRegistryPda, enforceOptioinsPda, sendLibPda, sendLibConfigPda, sendLibInfoPda, defaultSendLibConfigPda, sendConfigPda, defaultSendConfigPda, ulnEventAuthorityPda, ulnSettingPda, endpointSettingPda, outboundNoncePda, executorConfigPda, pricefeedConfigPda, dvnConfigPda, messageLibPda];
    return lookupTableAddress;
}






