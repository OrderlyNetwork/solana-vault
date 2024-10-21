import { bytes32ToEthAddress } from "@layerzerolabs/lz-v2-utilities";
import { PublicKey } from "@solana/web3.js";
import * as utils from "./utils";
import { hexlify } from "ethers";

const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

const ENV = utils.getEnv(OAPP_PROGRAM_ID);
const DST_EID = utils.getDstEid(ENV);

async function printConfig() {
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
    console.log(`====================== Print PDA Status on ${ENV} ======================`);

    const oappConfigPdaData = await OAppProgram.account.oAppConfig.fetch(oappConfigPda);
    console.log("OApp Config PDA: ",  vaultAuthorityPda.toBase58());
    console.log("   - oapp admin: ", new PublicKey(oappConfigPdaData.admin).toBase58());
    console.log("   - usdc mint: ", new PublicKey(oappConfigPdaData.usdcMint).toBase58());
    console.log("   - usdc hash: ", hexlify(Buffer.from(oappConfigPdaData.usdcHash as Uint8Array)));

    const vaultAuthorityPdaData = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);

    console.log("Vault Authority PDA: ", vaultAuthorityPda.toBase58());
    console.log("   - vault owner: ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());
    console.log("   - sol chain id: ", Number(vaultAuthorityPdaData.solChainId));
    console.log("   - dst eid: ", Number(vaultAuthorityPdaData.dstEid));
    console.log("   - deposit nonce: ", Number(vaultAuthorityPdaData.depositNonce));
    console.log("   - order delivery: ", vaultAuthorityPdaData.orderDelivery);
    console.log("   - inbound nonce: ", Number(vaultAuthorityPdaData.inboundNonce));
    
    const peerPdaData = await OAppProgram.account.peer.fetch(peerPda);
    console.log("Peer PDA: ", peerPda.toBase58());
    console.log("   - peer address: ", bytes32ToEthAddress(Buffer.from(peerPdaData.address as Uint8Array)));


}

printConfig();