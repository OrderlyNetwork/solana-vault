import { bytes32ToEthAddress } from "@layerzerolabs/lz-v2-utilities";
import { PublicKey } from "@solana/web3.js";
import * as utils from "./utils";
import { hexlify } from "ethers";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import * as constants from "./constants";
import { Options } from "@layerzerolabs/lz-v2-utilities";


const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 

const DST_EID = utils.getDstEid(ENV);

async function printConfig() {
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
    const lzReceiveTypesAccountsPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    const delegatePda = await OftTools.getDelegate(provider.connection, oappConfigPda);
    const oappConfigPdaData = await OAppProgram.account.oAppConfig.fetch(oappConfigPda);

    const programDataAddress = PublicKey.findProgramAddressSync(
        [OAPP_PROGRAM_ID.toBuffer()],
        new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111") // Address of BPF Loader for upgradeable programs
    )[0];

    // console.log("ProgramData Address:", programDataAddress.toBase58());

    // Step 3: Fetch the ProgramData account info
    const programDataAccountInfo = await provider.connection.getAccountInfo(programDataAddress);
    if (!programDataAccountInfo) {
        console.error("ProgramData account not found!");
        return;
    }

    // Step 4: Parse the Authority from the ProgramData account
    const authorityPubkey = new PublicKey(programDataAccountInfo.data.slice(13, 45)); // Authority starts at offset 4
    
    const vaultAuthorityPdaData = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);


    console.log(`====================== Print Delegate on ${ENV} ======================`);
    console.log("Delegate Role:    ", delegatePda.toBase58());
    console.log("OAPP Admin:       ", new PublicKey(oappConfigPdaData.admin).toBase58());
    console.log("Upgrade Authority:", authorityPubkey.toBase58());
    console.log("Vault Owner:      ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());

    console.log(`====================== Print PDA Content on ${ENV} ======================`);
    console.log("OApp Config PDA: ",  oappConfigPda.toBase58());
    console.log("   - endpoint:   ", new PublicKey(oappConfigPdaData.endpointProgram).toBase58());
    console.log("   - oapp admin: ", new PublicKey(oappConfigPdaData.admin).toBase58());
    // console.log("   - bump: ", oappConfigPdaData.bump);


    console.log("Vault Authority PDA: ", vaultAuthorityPda.toBase58());
    console.log("   - vault owner:    ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());
    console.log("   - sol chain id:   ", Number(vaultAuthorityPdaData.solChainId));
    console.log("   - dst eid:        ", Number(vaultAuthorityPdaData.dstEid));
    console.log("   - deposit nonce:  ", Number(vaultAuthorityPdaData.depositNonce));
    console.log("   - order delivery: ", vaultAuthorityPdaData.orderDelivery);
    console.log("   - inbound nonce:  ", Number(vaultAuthorityPdaData.inboundNonce));
    // console.log("   - bump: ", vaultAuthorityPdaData.bump);
    
    const peerPdaData = await OAppProgram.account.peer.fetch(peerPda);
    console.log("Peer PDA: ", peerPda.toBase58());
    console.log("   - peer address: ", bytes32ToEthAddress(Buffer.from(peerPdaData.address as Uint8Array)));
    // console.log("   - bump: ", peerPdaData.bump);

    const lzReceiveTypesAccountsPdaData = await OAppProgram.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesAccountsPda);
    console.log("LZ Receive Types PDA:      ", lzReceiveTypesAccountsPda.toBase58());
    console.log("   - oapp config address:  ",new PublicKey(lzReceiveTypesAccountsPdaData.oappConfig).toBase58());
    console.log("   - account list address: ", new PublicKey(lzReceiveTypesAccountsPdaData.accountList).toBase58());

    const accountListPda = utils.getAccountListPda(OAPP_PROGRAM_ID, oappConfigPda);

    const accountListPdaData = await OAppProgram.account.accountList.fetch(accountListPda);
    console.log("Account List PDA:   ", accountListPda.toBase58());
    console.log("   - usdc pda:      ", new PublicKey(accountListPdaData.usdcPda).toBase58());
    console.log("   - usdc mint:     ", new PublicKey(accountListPdaData.usdcMint).toBase58());
    console.log("   - woofi_pro pda: ", new PublicKey(accountListPdaData.woofiProPda).toBase58());
    // console.log("   - bump: ", accountListPdaData.bump);


    const tokenSymbol = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymbol);
    const allowedTokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    const allowedTokenPdaData = await OAppProgram.account.allowedToken.fetch(allowedTokenPda);
    // sleep 5 senconds
    await utils.delay(ENV)
    console.log("Allowed Token PDA:   ", allowedTokenPda.toBase58());
    console.log("   - token hash:     ", hexlify(Buffer.from(allowedTokenPdaData.tokenHash as Uint8Array)));
    console.log("   - token mint:     ", new PublicKey(allowedTokenPdaData.mintAccount).toBase58());
    console.log("   - allowed status: ", allowedTokenPdaData.allowed);

    const brokerId = "woofi_pro";
    const brokerHash = utils.getBrokerHash(brokerId);
    const allowedBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    const allowedBrokerPdaData = await OAppProgram.account.allowedBroker.fetch(allowedBrokerPda);
    // sleep 5 senconds
    await utils.delay(ENV)
    console.log("Allowed Broker PDA:  ", allowedBrokerPda.toBase58());
    console.log("   - broker hash:    ", hexlify(Buffer.from(allowedBrokerPdaData.brokerHash as Uint8Array)));
    console.log("   - allowed status: ", allowedBrokerPdaData.allowed);
    
    console.log(`====================== Print OAPP Config on ${ENV} ======================`);

    const peer = await OftTools.getPeerAddress(provider.connection, oappConfigPda, DST_EID, OAPP_PROGRAM_ID);
    console.log("Peer Address: ", peer);
    // sleep 5 senconds
    await utils.delay(ENV)
    const peerOptions = await OftTools.getEnforcedOptions(provider.connection, oappConfigPda, DST_EID, OAPP_PROGRAM_ID);
    // sleep 5 senconds
    await utils.delay(ENV)
    // console.log("Peer Options: ", peerOptions);
    console.log(`Option for LzReceive: gas = ${constants.LZ_RECEIVE_GAS}, value = ${constants.LZ_RECEIVE_VALUE}`);
    console.log(`Encode optoin for LzReceive:   `, Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorOrderedExecutionOption().toHex())
    console.log(`Options onchain for LzReceive: `, '0x' + Buffer.from(peerOptions.send).toString('hex'))
    console.log(`Encode optoin for LzCompose:   `, Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorComposeOption(0, constants.LZ_COMPOSE_GAS, constants.LZ_COMPOSE_VALUE).toHex())
    console.log(`Options onchain for LzCompose: `, '0x' + Buffer.from(peerOptions.sendAndCall).toString('hex'))

    const endpointConfig = await OftTools.getEndpointConfig(provider.connection, oappConfigPda, DST_EID);
    // sleep 5 senconds
    await utils.delay(ENV)
    console.log(`Endpoint config - send lib config: `) // , endpointConfig.sendLibraryConfig
    console.log(`    - messageLib: `, endpointConfig.sendLibraryConfig.messageLib.toString())
    console.log(`    - uln sendConfig: `);
    console.log(`        - uln: `)
    console.log(`           - confirmation: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.uln.confirmations.toString());
    console.log(`           - requiredDvns:: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.uln.requiredDvns.toString());
    console.log(`           - requiredDvnCount: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.uln.requiredDvnCount);
    console.log(`           - optionalDvns: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.uln.optionalDvns.toLocaleString());
    console.log(`           - optionalDvnCount: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.uln.optionalDvnCount);
    console.log(`           - optionalDvnThreshold: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.uln.optionalDvnThreshold);
    console.log(`        - executor: `)
    console.log(`           - maxMessageSize: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.executor.maxMessageSize)
    console.log(`           - executor: `, endpointConfig.sendLibraryConfig.ulnSendConfig?.executor.executor.toString())

    console.log(`Endpoint config - receive lib config: `) // , endpointConfig.receiveLibraryConfig
    console.log(`    - messageLib: `, endpointConfig.receiveLibraryConfig.messageLib.toString())
    console.log(`    - timeout: `, endpointConfig.receiveLibraryConfig.timeout)
    console.log(`    - uln receiveConfig: `);
    console.log(`        - uln: `)
    console.log(`           - confirmation: `, endpointConfig.receiveLibraryConfig.ulnReceiveConfig?.uln.confirmations.toString());
    console.log(`           - requiredDvns:: `, endpointConfig.receiveLibraryConfig.ulnReceiveConfig?.uln.requiredDvns.toString());
    console.log(`           - requiredDvnCount: `, endpointConfig.receiveLibraryConfig.ulnReceiveConfig?.uln.requiredDvnCount);
    console.log(`           - optionalDvns: `, endpointConfig.receiveLibraryConfig.ulnReceiveConfig?.uln.optionalDvns.toLocaleString());
    console.log(`           - optionalDvnCount: `, endpointConfig.receiveLibraryConfig.ulnReceiveConfig?.uln.optionalDvnCount);
    console.log(`           - optionalDvnThreshold: `, endpointConfig.receiveLibraryConfig.ulnReceiveConfig?.uln.optionalDvnThreshold);
}

printConfig();