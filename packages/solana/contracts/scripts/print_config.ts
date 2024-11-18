import { bytes32ToEthAddress } from "@layerzerolabs/lz-v2-utilities";
import { PublicKey } from "@solana/web3.js";
import * as utils from "./utils";
import { hexlify } from "ethers";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";

const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

const ENV = utils.getEnv(OAPP_PROGRAM_ID);
const DST_EID = utils.getDstEid(ENV);

async function printConfig() {
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
    const lzReceiveTypesAccountsPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);

    console.log(`====================== Print Delegate on ${ENV} ======================`);
    const delegatePda = await OftTools.getDelegate(provider.connection, oappConfigPda);
    console.log("Delegate Role: ", delegatePda.toBase58());
    console.log(`====================== Print PDA Status on ${ENV} ======================`);

    const oappConfigPdaData = await OAppProgram.account.oAppConfig.fetch(oappConfigPda);
    console.log("OApp Config PDA: ",  oappConfigPda.toBase58());
    console.log("   - endpoint: ", new PublicKey(oappConfigPdaData.endpointProgram).toBase58());
    console.log("   - oapp admin: ", new PublicKey(oappConfigPdaData.admin).toBase58());
    console.log("   - bump: ", oappConfigPdaData.bump);

    const vaultAuthorityPdaData = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);

    console.log("Vault Authority PDA: ", vaultAuthorityPda.toBase58());
    console.log("   - vault owner: ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());
    console.log("   - sol chain id: ", Number(vaultAuthorityPdaData.solChainId));
    console.log("   - dst eid: ", Number(vaultAuthorityPdaData.dstEid));
    console.log("   - deposit nonce: ", Number(vaultAuthorityPdaData.depositNonce));
    console.log("   - order delivery: ", vaultAuthorityPdaData.orderDelivery);
    console.log("   - inbound nonce: ", Number(vaultAuthorityPdaData.inboundNonce));
    console.log("   - bump: ", vaultAuthorityPdaData.bump);
    
    const peerPdaData = await OAppProgram.account.peer.fetch(peerPda);
    console.log("Peer PDA: ", peerPda.toBase58());
    console.log("   - peer address: ", bytes32ToEthAddress(Buffer.from(peerPdaData.address as Uint8Array)));
    console.log("   - bump: ", peerPdaData.bump);

    const lzReceiveTypesAccountsPdaData = await OAppProgram.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesAccountsPda);
    console.log("LZ Receive Types PDA: ", lzReceiveTypesAccountsPda.toBase58());
    console.log("   - oapp config address: ",new PublicKey(lzReceiveTypesAccountsPdaData.oappConfig).toBase58());
    console.log("   - account list address: ", new PublicKey(lzReceiveTypesAccountsPdaData.accountList).toBase58());

    const accountListPda = utils.getAccountListPda(OAPP_PROGRAM_ID, oappConfigPda);

    const accountListPdaData = await OAppProgram.account.accountList.fetch(accountListPda);
    console.log("Account List PDA: ", accountListPda.toBase58());
    console.log("   - usdc pda: ", new PublicKey(accountListPdaData.usdcPda).toBase58());
    console.log("   - usdc mint: ", new PublicKey(accountListPdaData.usdcMint).toBase58());
    console.log("   - woofi_rp pda: ", new PublicKey(accountListPdaData.woofiProPda).toBase58());
    console.log("   - bump: ", accountListPdaData.bump);

    const tokenSymbol = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymbol);
    const allowedTokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    const allowedTokenPdaData = await OAppProgram.account.allowedToken.fetch(allowedTokenPda);
    console.log("Allowed Token PDA: ", allowedTokenPda.toBase58());
    console.log("   - token hash: ", hexlify(Buffer.from(allowedTokenPdaData.tokenHash as Uint8Array)));
    console.log("   - token mint: ", new PublicKey(allowedTokenPdaData.mintAccount).toBase58());
    console.log("   - allowed status: ", allowedTokenPdaData.allowed);

    const brokerId = "woofi_pro";
    const brokerHash = utils.getBrokerHash(brokerId);
    const allowedBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    const allowedBrokerPdaData = await OAppProgram.account.allowedBroker.fetch(allowedBrokerPda);
    console.log("Allowed Broker PDA: ", allowedBrokerPda.toBase58());
    console.log("   - broker hash: ", hexlify(Buffer.from(allowedBrokerPdaData.brokerHash as Uint8Array)));
    console.log("   - allowed status: ", allowedBrokerPdaData.allowed);


}

printConfig();