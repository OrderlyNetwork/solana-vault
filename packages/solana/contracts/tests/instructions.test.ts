import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from '../tests/types/endpoint'
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getMintLen,
  createMint,
  mintTo,
  getAccount
} from '@solana/spl-token'
import * as constants from "../scripts/constants"
import { EVENT_SEED, MESSAGE_LIB_SEED } from "@layerzerolabs/lz-solana-sdk-v2";
import { getLogs } from "@solana-developers/helpers";
import { Connection, ConfirmOptions, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { assert } from 'chai'
import endpointIdl from '../tests/idl/endpoint.json'
import { getDefaultReceiveConfigPda, getSendLibPda } from '../scripts/utils'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'

const confirmOptions: ConfirmOptions = { maxRetries: 6, commitment: "confirmed", preflightCommitment: "confirmed"}
let USDC_MINT: PublicKey
const LAYERZERO_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const ETHEREUM_EID = MainnetV2EndpointId.ETHEREUM_V2_MAINNET
const SOLANA_EID = MainnetV2EndpointId.SOLANA_V2_MAINNET

function encodeMessage(msgType: number, payload: Buffer): Buffer {
    const encoded = Buffer.alloc(1 + payload.length)
    encoded.writeUIntBE(msgType, 0, 1)
    payload.copy(encoded, 1)
    return encoded
}

async function mintUsdcTo(
  connection: Connection,
  payer: Keypair,
  mintAuthority: Keypair,
  usdcMint: PublicKey,
  destinationWallet: PublicKey,
  amount: number
) {
  try {
    await mintTo(
      connection,
      payer,
      usdcMint,
      destinationWallet,
      mintAuthority,
      amount,
      [],
      confirmOptions
    );

    console.log(`Minted ${amount} USDC to ${destinationWallet.toBase58()}`);
  } catch (error) {
    console.error("Error minting USDC:", error);
    throw error;
  }
}

async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<number> {
  const account = await getAccount(connection, tokenAccount)
  return Number(account.amount)
}

describe('solana-vault', function() {
    this.timeout(120000); // Set timeout for all tests in this describe block
    
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const program = anchor.workspace.SolanaVault as Program<SolanaVault>
    const endpointProgram = new Program(endpointIdl as Idl, LAYERZERO_ENDPOINT_PROGRAM_ID, provider) as Program<Endpoint>
    const ulnProgram = anchor.workspace.Uln as Program<Uln>
    // Create a mint authority for USDC
    const usdcMintAuthority = Keypair.generate()

    before(async () => {
        USDC_MINT = await createMint(
            provider.connection,
            wallet.payer,
            usdcMintAuthority.publicKey,
            null,
            6 // USDC has 6 decimals
        )
    }) 

    const registerOapp = async () => {
        const [oappPda, oappBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("LzReceiveTypes"), oappPda.toBuffer()],
            program.programId
        )
        const [oappRegistryPda, oappRegistryBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp"), oappPda.toBuffer()],
            endpointProgram.programId
        )
        const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(EVENT_SEED)],
            endpointProgram.programId
        )

        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        let oappRegistry
        try {
            oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        } catch {
            await program.methods
                .initOapp({
                    admin: wallet.publicKey,
                    endpointProgram: endpointProgram.programId,
                    usdcHash: usdcHash,
                    usdcMint: USDC_MINT
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappPda,
                    lzReceiveTypes: lzReceiveTypesPda,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: wallet.publicKey,
                        isWritable: true,
                        isSigner: true,
                    },
                    {
                        pubkey: oappPda,
                        isWritable: false,
                        isSigner: false,
                    },
                    {
                        pubkey: oappRegistryPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: SystemProgram.programId,
                        isWritable: false,
                        isSigner: false,
                    },
                    {
                        pubkey: eventAuthorityPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                ])
                .rpc()
                oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        }

        return oappRegistry
    }

    const initializeVault = async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )

        let vaultAuthority
        try {
            vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        } catch {
            await program.methods
                .initVault({
                    owner: wallet.publicKey,
                    orderDelivery: true,
                    dstEid: 42,
                    solChainId: new BN(12),
                })
                .accounts({
                    signer: wallet.publicKey,
                    vaultAuthority: vaultAuthorityPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([wallet.payer])
                .rpc(confirmOptions)
            vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        }    
        return {vaultAuthority, vaultAuthorityPda}
    }

    const initializeOapp = async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )
        const [oappPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        let oapp
        try {
            oapp = await program.account.oAppConfig.fetch(oappPda)
        } catch(e) {
            const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

            await program.methods
                .reinitOapp({
                    admin: wallet.publicKey,
                    endpointProgram: endpointProgram.programId,
                    usdcHash: usdcHash,
                    usdcMint: USDC_MINT
                })
                .accounts({
                    owner: wallet.publicKey,
                    oappConfig: oappPda,
                    vaultAuthority: vaultAuthorityPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([wallet.payer])
                .rpc()
            oapp = await program.account.oAppConfig.fetch(oappPda)
        }
        return {oappPda, oapp}
    }

    const initializePeer = async () => {
        const [oappPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const buf = Buffer.alloc(4)
        buf.writeUInt32BE(12)
        const [peerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("Peer"), oappPda.toBuffer(), buf],
            program.programId
        )
        const peerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        let peer
        try {
            peer = await program.account.peer.fetch(peerPda)
        } catch(e) {
            await program.methods
            .setPeer({
                dstEid: 12,
                peer: peerHash
            })
            .accounts({
                admin: wallet.publicKey,
                peer: peerPda,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc()
            peer = await program.account.peer.fetch(peerPda)
        }
        return {peer, peerPda}
    }

    it('initializes vault', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )
        await program.methods
            .initVault({
                owner: wallet.publicKey,
                orderDelivery: true,
                dstEid: 42,
                solChainId: new BN(12),
            })
            .accounts({
                signer: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([wallet.payer])
            .rpc(confirmOptions)
        
        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, 42)
        assert.ok(vaultAuthority.solChainId.eq(new BN(12)))
    })

    it('resets vault', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )

        let {vaultAuthority} = await initializeVault()
        assert.equal(vaultAuthority.orderDelivery, true)

        await program.methods 
            .resetVault()
            .accounts({
                owner: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda
            })
            .rpc();

        // Reinitialize the vault with new data
        await program.methods
            .initVault({
                owner: wallet.publicKey,
                orderDelivery: false, 
                dstEid: 43,           
                solChainId: new BN(13),
            })
            .accounts({
                signer: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda);
        assert.equal(vaultAuthority.orderDelivery, false);
        assert.equal(vaultAuthority.dstEid, 43);
        assert.ok(vaultAuthority.solChainId.eq(new BN(13)));
    })

    it('initializes oapp', async () => {
        const [oappPda, oappBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("LzReceiveTypes"), oappPda.toBuffer()],
            program.programId
        )
        const [oappRegistryPda, oappRegistryBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp"), oappPda.toBuffer()],
            endpointProgram.programId
        )
        const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(EVENT_SEED)],
            endpointProgram.programId
        )
        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        await program.methods
                .initOapp({
                admin: wallet.publicKey,
                endpointProgram: endpointProgram.programId,
                usdcHash: usdcHash,
                usdcMint: USDC_MINT
            })
            .accounts({
                payer: wallet.publicKey,
                oappConfig: oappPda,
                lzReceiveTypes: lzReceiveTypesPda,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts([
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: wallet.publicKey,
                    isWritable: true,
                    isSigner: true,
                },
                {
                    pubkey: oappPda,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: oappRegistryPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: SystemProgram.programId,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: eventAuthorityPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
            ])
            .rpc()

        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        const lzReceiveTypes = await program.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesPda)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)

        assert.equal(lzReceiveTypes.oappConfig.toString(), oappPda.toString())
        assert.equal(oappConfig.bump, oappBump)
        assert.deepEqual(oappConfig.usdcHash, usdcHash)
        assert.equal(oappConfig.usdcMint.toString(), USDC_MINT.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.bump, oappRegistryBump)
    })

    it('reinitializes oapp', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )
        await initializeVault()

        const [oappPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        await program.methods
            .resetOapp()
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda
            })
            .rpc()

        await program.methods
            .reinitOapp({
                admin: wallet.publicKey,
                endpointProgram: endpointProgram.programId,
                usdcHash: usdcHash,
                usdcMint: usdcMint
            })
            .accounts({
                owner: wallet.publicKey,
                oappConfig: oappPda,
                vaultAuthority: vaultAuthorityPda,
                systemProgram: SystemProgram.programId
            })
            .signers([wallet.payer])
            .rpc()
        
        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.usdcMint.toString(), usdcMint.toString())
        assert.deepEqual(oappConfig.usdcHash, usdcHash)
    })

    it('resets oapp', async () => {
        await initializeVault()
        const {oappPda} = await initializeOapp()

        await program.methods
            .resetOapp()
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda
            })
            .rpc()
        
        let oappPdaDoesNotExist: boolean
        try {
            await program.account.oAppConfig.fetch(oappPda)
        } catch {
            oappPdaDoesNotExist = true
        }
        assert.isTrue(oappPdaDoesNotExist)
    })

    it('reinitializes vault',  async () => {
        const {vaultAuthorityPda} = await initializeVault()
        const {oappPda} = await initializeOapp()

        await program.methods 
            .resetVault()
            .accounts({
                owner: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda
            })
            .rpc();

        await program.methods
            .reinitVault({
                owner: wallet.publicKey,
                dstEid: 12,
                depositNonce: new BN('42'),
                orderDelivery: true,
                inboundNonce: new BN('42'),
                solChainId: new BN('1')
            })
            .accounts({
                vaultAuthority: vaultAuthorityPda,
                admin: wallet.publicKey,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc()
        
        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, 12)
        assert.isTrue(vaultAuthority.depositNonce.eq(new BN('42')))
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('42')))
        assert.isTrue(vaultAuthority.solChainId.eq(new BN('1')))
    }) 

    it('sets broker', async () => {
        const brokerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const [allowedBrokerPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from("Broker"), Buffer.from(brokerHash)],
            program.programId
        )
        await initializeVault()
        const {oappPda} = await initializeOapp()

        await program.methods
            .setBroker({
                brokerHash: brokerHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedBroker: allowedBrokerPda,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc()

        const allowedBroker = await program.account.allowedBroker.fetch(allowedBrokerPda)
        assert.equal(allowedBroker.allowed, true)
        assert.deepEqual(allowedBroker.brokerHash, brokerHash)
        assert.equal(allowedBroker.bump, bump)
    })

    it('sets token', async () => {
        const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const [allowedTokenPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from("Token"), Buffer.from(tokenHash)],
            program.programId
        )
        await initializeVault()
        const {oappPda} = await initializeOapp()

        await program.methods
            .setToken({
                mintAccount: USDC_MINT,
                tokenHash: tokenHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedToken: allowedTokenPda,
                mintAccount: USDC_MINT,
                oappConfig: oappPda
            })
            .rpc()
        const allowedToken = await program.account.allowedToken.fetch(allowedTokenPda)
        assert.equal(allowedToken.mintAccount.toString(), USDC_MINT.toString())
        assert.deepEqual(allowedToken.tokenHash, tokenHash)
        assert.equal(allowedToken.tokenDecimals, 6)
        assert.equal(allowedToken.allowed, true)
        assert.equal(allowedToken.bump, bump)
    })

    it('sets order delivery', async () => {
        let {vaultAuthorityPda, vaultAuthority} = await initializeVault()
        assert.isTrue(vaultAuthority.orderDelivery)

        await program.methods
            .setOrderDelivery({
                orderDelivery: false,
                nonce: new BN('23')
            })
            .accounts({
                owner: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda
            })
            .rpc()

        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.isFalse(vaultAuthority.orderDelivery)
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('23')))
    })

    it('sets peer', async () => {
        await initializeVault()
        const {oappPda} = await initializeOapp()
        const buf = Buffer.alloc(4)
        buf.writeUInt32BE(12)
        const [peerPda, peerBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("Peer"), oappPda.toBuffer(), buf],
            program.programId
        )
        const peerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        await program.methods
            .setPeer({
                dstEid: 12,
                peer: peerHash
            })
            .accounts({
                admin: wallet.publicKey,
                peer: peerPda,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc()
        
        const peer = await program.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, peerHash)
        assert.equal(peer.bump, peerBump)
    })

    it('sets rate limit', async () => {
        await initializeVault()
        const {oappPda} = await initializeOapp()
        const {peerPda} = await initializePeer()

        await program.methods
            .setRateLimit({
                dstEid: 12,
                refillPerSecond: new BN('13'),
                capacity: new BN('1000'),
                enabled: true
            })
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda,
                peer: peerPda
            })
            .rpc()
        
        const peer = await program.account.peer.fetch(peerPda)
        assert.isTrue(peer.rateLimiter.capacity.eq(new BN('1000')))
        assert.isTrue(peer.rateLimiter.refillPerSecond.eq(new BN('13')))
    })

    it('sets admin', async () => {
        await initializeVault()
        const {oappPda} = await initializeOapp()
        const newAdmin = Keypair.generate()
        
        await program.methods
            .transferAdmin({
                admin: newAdmin.publicKey
            })
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda
            })
            .rpc()
        
        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        assert.equal(oappConfig.admin.toString(), newAdmin.publicKey.toString())

        await program.methods
            .transferAdmin({
                admin: wallet.publicKey
            })
            .accounts({
                admin: newAdmin.publicKey,
                oappConfig: oappPda
            })
            .signers([newAdmin])
            .rpc()
    })

    it('sets enforced options', async () => {
        await initializeVault()
        const dstEid = 12
        const buf = Buffer.alloc(4)
        buf.writeUInt32BE(dstEid)
        const {oappPda} = await initializeOapp()
        const [efOptionsPda, efOptionsBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("EnforcedOptions"), oappPda.toBuffer(), buf],
            program.programId
        )

        await program.methods
            .setEnforcedOptions({
                dstEid: dstEid,
                send: Buffer.from([0, 3, 3]),
                sendAndCall: Buffer.from([0, 3, 3])
            })
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda,
                enforcedOptions: efOptionsPda,
                systemProgram: SystemProgram.programId
            })
            .signers([wallet.payer])
            .rpc()

        const enforcedOptions = await program.account.enforcedOptions.fetch(efOptionsPda)
        assert.isTrue(enforcedOptions.send.equals(Buffer.from([0, 3, 3])))
        assert.isTrue(enforcedOptions.sendAndCall.equals(Buffer.from([0, 3, 3])))
        assert.equal(enforcedOptions.bump, efOptionsBump)
    })

    it('lzReceive', async () => {
        this.timeout(300000); // Set timeout to 120 seconds (2 minutes)
        
        const guid = Array.from(Keypair.generate().publicKey.toBuffer())
        await registerOapp()
        const {oappPda} = await initializeOapp()
        const {vaultAuthorityPda} = await initializeVault()
        const [oappRegistryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp"), oappPda.toBuffer()],
            endpointProgram.programId
        )
        const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(EVENT_SEED)],
            endpointProgram.programId
        )

        const bufferSrcEid = Buffer.alloc(4)
        bufferSrcEid.writeUInt32BE(ETHEREUM_EID)
        const bufferNonce = Buffer.alloc(8)
        bufferNonce.writeBigUInt64BE(BigInt("1"))

        const [payloadHashPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("PayloadHash"), oappPda.toBuffer(), bufferSrcEid, wallet.publicKey.toBuffer(), bufferNonce],
            endpointProgram.programId
        )

        const [noncePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("Nonce"), oappPda.toBuffer(), bufferSrcEid, wallet.publicKey.toBuffer()],
            endpointProgram.programId
        )

        const [pendingInboundNoncePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("PendingNonce"), oappPda.toBuffer(), bufferSrcEid, wallet.publicKey.toBuffer()],
            endpointProgram.programId
        )

        const [endpointPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("Endpoint")],
            endpointProgram.programId
        )
        const endpointAdmin = wallet.payer

        // Setup Endpoint V2 settings
        await endpointProgram.methods
            .initEndpoint({
                eid: 30168,
                admin: endpointAdmin.publicKey
            })
            .accounts({
                endpoint: endpointPda,
                payer: wallet.publicKey,
                systemProgram: SystemProgram.programId
            })
            .rpc()
        
        // [RECEIVE_LIBRARY_CONFIG_SEED, &params.receiver.to_bytes(), &params.src_eid.to_be_bytes()]
        const [receiveLibraryConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("ReceiveLibraryConfig"), oappPda.toBytes(), bufferSrcEid],
            endpointProgram.programId
        )

        const [defaultReceiveLibraryConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("ReceiveLibraryConfig"), bufferSrcEid],
            endpointProgram.programId
        )
        const [messageLibPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(MESSAGE_LIB_SEED, "utf8")],
            ulnProgram.programId
        )
        const [messageLibInfoPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(MESSAGE_LIB_SEED), messageLibPda.toBytes()],
            endpointProgram.programId
        )

        const transaction = new Transaction()

        transaction.add(
            await endpointProgram.methods
                .registerLibrary({
                    libProgram: ulnProgram.programId,
                    libType: {sendAndReceive: {}}
                })
                .accounts({
                    admin: endpointAdmin.publicKey,
                    endpoint: endpointPda,
                    messageLibInfo: messageLibInfoPda,
                    systemProgram: SystemProgram.programId,
                })
                .instruction()
        )
        
        transaction.add(
            await endpointProgram.methods
                .initReceiveLibrary({
                    receiver: oappPda,
                    eid: ETHEREUM_EID
                })
                .accounts({
                    delegate: wallet.publicKey,
                    oappRegistry: oappRegistryPda,
                    receiveLibraryConfig: receiveLibraryConfigPda,
                    systemProgram: SystemProgram.programId,        
                })
                .instruction()
        )

        transaction.add(
            await endpointProgram.methods
                .initDefaultReceiveLibrary({
                    eid: ETHEREUM_EID,
                    newLib: messageLibPda
                })
                .accounts({
                    admin: endpointAdmin.publicKey,
                    endpoint: endpointPda,
                    defaultReceiveLibraryConfig: defaultReceiveLibraryConfigPda,
                    messageLibInfo: messageLibInfoPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([endpointAdmin])
                .instruction()
        )

        // Initialize the nonce before we can initialize verify
        transaction.add(
            await endpointProgram.methods
                .initNonce({
                    localOapp: oappPda,
                    remoteEid: ETHEREUM_EID,
                    remoteOapp: Array.from(wallet.publicKey.toBytes())
                })
                .accounts({
                    delegate: wallet.publicKey,
                    oappRegistry: oappRegistryPda,
                    nonce: noncePda,
                    pendingInboundNonce: pendingInboundNoncePda,
                    systemProgram: SystemProgram.programId
                })
                .instruction()
        )

        await provider.sendAndConfirm(transaction, [endpointAdmin, wallet.payer], confirmOptions)

        // This initializes the payload_hash account
        await endpointProgram.methods
            .initVerify({
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                receiver: oappPda,
                nonce: new BN('1')
            })
            .accounts({
                payer: wallet.publicKey,
                nonce: noncePda,
                payloadHash: payloadHashPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
        // console.log("PROGRAM ID: ", ulnProgram.programId)
        
        await ulnProgram.methods
            .initUln({
                eid: SOLANA_EID,
                endpoint: LAYERZERO_ENDPOINT_PROGRAM_ID,
                endpointProgram: LAYERZERO_ENDPOINT_PROGRAM_ID,
                admin: wallet.publicKey,
            })
            .accounts({
                payer: wallet.publicKey,
                uln: messageLibPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
        
        const msgType = 1 // Example message type
        const tokenAmountBuffer = Buffer.alloc(8);
        tokenAmountBuffer.writeBigUInt64BE(BigInt(1e9));

        const feeBuffer = Buffer.alloc(8);
        feeBuffer.writeBigUInt64BE(BigInt('100'));

        const chainIdBuffer = Buffer.alloc(8);
        chainIdBuffer.writeBigUInt64BE(BigInt('1'));

        const withdrawNonceBuffer = Buffer.alloc(8);
        withdrawNonceBuffer.writeBigUInt64BE(BigInt('2'));
        const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        // TODO: =================================================================>
        const payload = Buffer.concat([
            wallet.publicKey.toBuffer(),
            wallet.publicKey.toBuffer(),
            oappPda.toBuffer(),
            Buffer.from(tokenHash), // placeholder for broker hash
            Buffer.from(tokenHash), // placeholder
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        const message = encodeMessage(msgType, payload)

        // Verifies the payload and updates the nonce
        await ulnProgram.methods
            .commitVerification({
                nonce: new BN('1'),
                srcEid: ETHEREUM_EID,
                sender: wallet.publicKey,
                dstEid: SOLANA_EID,
                receiver: Array.from(oappPda.toBytes()),
                guid: guid,
                message: message,
            })
            .accounts({
                uln: messageLibPda
            })
            .remainingAccounts([
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: messageLibPda, // receiver library
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: receiveLibraryConfigPda, // receive library config
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: defaultReceiveLibraryConfigPda, // default receive libary config
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: noncePda, // nonce
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: pendingInboundNoncePda, // pending inbound nonce
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: payloadHashPda, // payload hash
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: eventAuthorityPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
            ])
            .rpc(confirmOptions)

        // await endpointProgram.methods
        //     .verify({
        //         srcEid: ETHEREUM_EID,
        //         sender: Array.from(wallet.publicKey.toBytes()),
        //         nonce: new BN('1'),
        //         payloadHash: payloadHashPda.toBytes(),
        //         receiver: oappPda
        //     })
        //     .accounts({
        //         payloadHash: payloadHashPda,
        //         pendingInboundNonce: pendingInboundNoncePda,
        //         nonce: noncePda,
        //         receiveLibrary: messageLibPda,
        //         receiveLibraryConfig: receiveLibraryConfigPda,
        //         defaultReceiveLibraryConfig: defaultReceiveLibraryConfigPda
        //     })
        //     .rpc(confirmOptions)
    
        const userDepositWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            wallet.publicKey
        )
        const vaultDepositWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            vaultAuthorityPda,
            true
        )
        const peerHash = Array.from(wallet.publicKey.toBytes())
        const [peerPda] =  PublicKey.findProgramAddressSync(
            [Buffer.from("Peer"), oappPda.toBuffer(), bufferSrcEid],
            program.programId
        )
        
        await program.methods
            .setPeer({
                dstEid: ETHEREUM_EID,
                peer: peerHash
            })
            .accounts({
                admin: wallet.publicKey,
                peer: peerPda,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)

        // Check initial balance
        let vaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address);
        console.log("Initial vault balance:", vaultBalance);

        try {
          // Mint 1000 USDC to the vault deposit wallet
          await mintUsdcTo(
            provider.connection,
            wallet.payer,
            usdcMintAuthority,
            USDC_MINT,
            vaultDepositWallet.address,
            1000000000 // 1000 USDC (remember to account for decimals)
          );

          // Check balance after minting
          vaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address);
          console.log("Vault balance after minting:", vaultBalance);
          assert.equal(vaultBalance, 1000000000, "Vault should have 1000 USDC after minting");
        } catch (error) {
          console.error("Error during minting process:", error);
          throw error;
        }

        try {
            const tx = await program.methods
                .lzReceive({
                    srcEid: ETHEREUM_EID,
                    sender: Array.from(wallet.publicKey.toBytes()),
                    nonce: new BN('1'),
                    guid: guid,
                    message: message,
                    extraData: Buffer.from([])
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappPda,
                    peer: peerPda,
                    user: wallet.publicKey,
                    userDepositWallet: userDepositWallet.address,
                    vaultDepositWallet: vaultDepositWallet.address,
                    depositToken: USDC_MINT,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    vaultAuthority: vaultAuthorityPda
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappPda, // signer and receiver
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappRegistryPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: noncePda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: payloadHashPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: endpointPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: eventAuthorityPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                ])
                .rpc(confirmOptions)
            
            console.log("Logs: ", await getLogs(provider.connection, tx))

            // Check balance after lzReceive
            vaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address);
            console.log("Vault balance after lzReceive:", vaultBalance);
            
            // You can add an assertion here based on how much you expect to be transferred
            // For example, if you expect 100 USDC to be transferred out:
            // assert.equal(vaultBalance, 900000000, "Vault should have 900 USDC after transfer")

        } catch(e) {
            console.log(e)
        }
    })
})