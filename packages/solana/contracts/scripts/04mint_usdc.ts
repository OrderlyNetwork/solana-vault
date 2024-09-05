import { setAnchor, getUSDCAddress, mintUSDC, getUSDCAccount } from "./utils";

const [provider, wallet, rpc] = setAnchor();

const amountToMint = 100000;

async function mint() {
    const usdcAddress = await getUSDCAddress(provider, wallet, rpc);
    const userUSDCAccount = await getUSDCAccount(provider, wallet, usdcAddress, wallet.publicKey);
    await mintUSDC(provider, wallet, usdcAddress, userUSDCAccount, amountToMint);
}

mint();