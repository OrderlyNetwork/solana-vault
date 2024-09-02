import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { setAnchor, getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, getSendLibConfigPda, getExecutorConfigPda, getPriceFeedPda, getDvnConfigPda } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet] = setAnchor();

const executorConfigPda = getExecutorConfigPda();
console.log("Executor Config PDA: ", executorConfigPda.toString());

const pricefeedConfigPda = getPriceFeedPda();
console.log("Price Feed Config PDA: ", pricefeedConfigPda.toString());

const dvnConfigPda = getDvnConfigPda();
console.log("DVN Config PDA: ", dvnConfigPda.toString());