import * as anchor from '@coral-xyz/anchor'
import { BN, Program } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
// import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, getMintLen } from '@solana/spl-token'
import { EVENT_SEED } from "@layerzerolabs/lz-solana-sdk-v2";
import { getLogs } from "@solana-developers/helpers";
import { Connection, ConfirmOptions, Keypair, SendTransactionError, PublicKey, SystemProgram } from '@solana/web3.js'
import { assert, expect } from 'chai'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'


const confirmOptions: ConfirmOptions = { maxRetries: 3, commitment: "confirmed" }

const LAYERZERO_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")

describe('solana-vault', () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const program = anchor.workspace.SolanaVault as Program<SolanaVault>

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
                    endpointProgram: LAYERZERO_ENDPOINT_PROGRAM_ID,
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
        const [oappPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("LzReceiveTypes"), oappPda.toBuffer()],
            program.programId
        )

        const [oappRegistryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp"), oappPda.toBuffer()],
            program.programId
        )

        const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(EVENT_SEED)],
            LAYERZERO_ENDPOINT_PROGRAM_ID
        )

        // const accountInfo = await provider.connection.getAccountInfo(LAYERZERO_ENDPOINT_PROGRAM_ID)
        // console.log("============ ENDPOINT: ", accountInfo.executable)
        // console.log(" =============== Program Data: ", accountInfo.data)
        // const balance = await provider.connection.getBalance(wallet.publicKey);
        // console.log("Wallet balance:", balance);
        
        let tx
        try {
            tx = await program.methods
                    .initOapp({
                    admin: wallet.publicKey,
                    endpointProgram: null,
                    usdcHash: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
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
                        pubkey: LAYERZERO_ENDPOINT_PROGRAM_ID,
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
                        pubkey: LAYERZERO_ENDPOINT_PROGRAM_ID,
                        isWritable: true,
                        isSigner: false,
                    },
                ])
                .signers([wallet.payer])
                .rpc()        
            const logs = await getLogs(provider.connection, tx)
            console.log(logs)
        } catch (e) {
            console.log("=================================== ERROR")
            const logs = await e.getLogs(provider.connection)
            console.log(logs)
            console.log(e.transactionError)
        }
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
            .reinitOapp({
                admin: wallet.publicKey,
                endpointProgram: LAYERZERO_ENDPOINT_PROGRAM_ID,
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
        assert.equal(oappConfig.endpointProgram.toString(), LAYERZERO_ENDPOINT_PROGRAM_ID.toString())
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
})
