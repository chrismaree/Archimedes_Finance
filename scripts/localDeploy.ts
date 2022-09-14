import hre, { ethers } from "hardhat";
import { helperSwapETHWithOUSD,addressOUSD, abiOUSDToken } from "../test/MainnetHelper";
import { buildContractTestContext, setRolesForEndToEnd } from "../test/ContractTestContext";
import dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

dotenv.config({ path: "secrets/alchemy.env" });

export const signers = ethers.getSigners();

let context;

async function fundLVUSDToCoordinator () {
    console.log("Funding lvUSD to coordinator");
    const amount = "10000";

    await context.lvUSD.setMintDestination(context.coordinator.address);
    await context.lvUSD.mint(ethers.utils.parseUnits(amount, 18));

    console.log(context.coordinator.address + " funded with " + amount + " LVUSD");
}

const fundARCH = async () => {
    console.log("Funding Arch to owner");
    const archAmountToFund = "1000";
    await context.archToken.connect(context.treasurySigner).transfer(context.owner.address, ethers.utils.parseUnits(archAmountToFund));
    console.log(context.owner.address + " funded with " + archAmountToFund + " ARCH");
};

async function verifyDeployment () {
    console.log("lvUSD address is", await context.lvUSD.address);
    console.log("Arch address is", await context.archToken.address);
    console.log("LevEngine address is", await context.leverageEngine.address);
    console.log("PositionToken address is", await context.positionToken.address);
    console.log("(local) OUSD address is", await context.externalOUSD.address);
    console.log("--Exchanger address is", await context.exchanger.address);
    console.log("--Coordinator address is", await context.coordinator.address);
    console.log("--ParamStore address is", await context.parameterStore.address);
    console.log("--Vault address is", await context.vault.address);
    console.log("--CDP address is", await context.cdp.address);
    console.log("------ owner address is", await context.owner.address);
    console.log("------ curve pool address is", await context.curveLvUSDPool.address);
    console.log("---- test calculateArchNeededForLeverage - ",
        await context.parameterStore.calculateArchNeededForLeverage(ethers.utils.parseUnits("3.67")));
}

const deployScript = async () => {
    // hacky way to go around pool balances not working on local instance.. skipPoolBalances = true
    context = await buildContractTestContext(true);
    // await context.parameterStore.changeArchToLevRatio(ethers.utils.parseUnits("1.0"));
    await setRolesForEndToEnd(context);
    await helperSwapETHWithOUSD(context.owner, ethers.utils.parseUnits("1.0"));
    await fundLVUSDToCoordinator();
    await fundARCH();
    await fundDemoAccount()
    await verifyDeployment();
};

const simulateRebase = async () => {
    const [owner,addr1] = await ethers.getSigners();
    const vaultAddress = "0x22a9B82A6c3D2BFB68F324B2e8367f346Dd6f32a"
    await helperSwapETHWithOUSD(owner, ethers.utils.parseUnits("1.0"));
    const externalOUSD = new ethers.Contract(addressOUSD, abiOUSDToken, owner);
    await externalOUSD.transfer(vaultAddress,ethers.utils.parseUnits("20.0"))
}

const fundDemoAccount = async () => {
    let signers: SignerWithAddress[] = await ethers.getSigners();
    
    // remove owner and addr1 by shifting twice 
    signers.shift();
    signers.shift();
    for (let i = 0; i < 9; i++) {
        let signerToFund = signers[i];
        const archAmountToFund = "200";
        await context.archToken.connect(context.treasurySigner)
            .transfer(signerToFund.address, ethers.utils.parseUnits(archAmountToFund));
        await helperSwapETHWithOUSD(signerToFund, ethers.utils.parseUnits("0.1"));
        console.log("Funded address "  + signerToFund.address);
    }
}

deployScript();
// simulateRebase()

