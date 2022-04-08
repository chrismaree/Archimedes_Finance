const { expect } = require("chai");
const exp = require("constants");
const { ethers } = require("hardhat");
const {
    BigNumber,
    FixedFormat,
    FixedNumber,
    formatFixed,
    parseFixed
} = require("@ethersproject/bignumber");

const getEighteenDecimal = (naturalNumber) => {
    return ethers.utils.parseEther(naturalNumber.toString())
}

describe("CDPosition test suit", function () {

    async function validateCDP(nftID, principle, interestEarned, total, borrowed, firstCycle) {
        expect(await cdp.getOUSDPrinciple(nftID)).to.equal(principle);
        expect(await cdp.getOUSDInterestEarned(nftID)).to.equal(interestEarned);
        expect(await cdp.getOUSDTotal(nftID)).to.equal(total);
        expect(await cdp.getLvUSDBorrowed(nftID)).to.equal(borrowed);
        expect(await cdp.getFirstCycle(nftID)).to.equal(firstCycle);
    }

    let cdp;

    const NFT_ID = 1234;
    const NFT_ID_SECONDARY = 67889;
    const BASIC_OUSD_PRINCIPLE_NATURAL = 1000000
    const BASIC_OUSD_PRINCIPLE = getEighteenDecimal(BASIC_OUSD_PRINCIPLE_NATURAL)

    beforeEach(async () => {
        let contract = await ethers.getContractFactory("CDPosition");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        cdp
            = await contract.deploy();
    });

    describe("Create position", () => {
        it("Should create position", async function () {
            // create a new position
            await cdp.createPosition(NFT_ID
                , BASIC_OUSD_PRINCIPLE)

            // validate CDP Values
            await validateCDP(NFT_ID
                , BASIC_OUSD_PRINCIPLE, 0, BASIC_OUSD_PRINCIPLE, 0, true)
        });
        it("Should not create position on existing address", async function () {
            // create a new position
            await cdp.createPosition(NFT_ID
                , BASIC_OUSD_PRINCIPLE)
            // Try to create position again, expect to revert
            await expect(cdp.createPosition(NFT_ID
                , BASIC_OUSD_PRINCIPLE)).to.be.revertedWith("NFT ID must not exist")
        })
    });

    describe("Delete Position", function () {
        it("Should delete position", async function () {
            await cdp.createPosition(NFT_ID
                , BASIC_OUSD_PRINCIPLE)
            // validate CDP Values
            await validateCDP(NFT_ID
                , BASIC_OUSD_PRINCIPLE, 0, BASIC_OUSD_PRINCIPLE, 0, true)
            await cdp.deletePosition(NFT_ID)
            // expect validation to revert since key is missing in CDP
            await expect(validateCDP(NFT_ID
                , 0, 0, 0, 0, false)).to.be.revertedWith("NFT ID must exist")
        });
        it("Should not delete position if position still has borrowed lvUSD", async function () {
            await cdp.createPosition(NFT_ID
                , BASIC_OUSD_PRINCIPLE)
            cdp.borrowLvUSDFromPosition(NFT_ID, getEighteenDecimal(100))
            await expect(cdp.deletePosition(NFT_ID)).to.be
                .revertedWith("Borrowed LvUSD must be zero before deleting")
        });
        it("Should not delete position if address does not exist in mapping", async function () {
            await expect(cdp.deletePosition(NFT_ID)).to.be.revertedWith("NFT ID must exist")
        });
    });

    describe("Borrow and deposit actions for position", function () {
        const LVUSD_AMOUNT_NATURAL = 10000
        const LVUSD_AMOUNT = getEighteenDecimal(LVUSD_AMOUNT_NATURAL)
        const OUSD_AMOUNT_NATURAL = 50000
        const OUSD_AMOUNT = getEighteenDecimal(OUSD_AMOUNT_NATURAL)
        beforeEach(async function () {
            // create a new position
            await cdp.createPosition(NFT_ID
                , BASIC_OUSD_PRINCIPLE)
        })

        /* borrowLvUSDFromPosition section */
        it("Should mark up borrowed LvUSD from NFT position", async function () {
            await cdp.borrowLvUSDFromPosition(NFT_ID, LVUSD_AMOUNT)
            await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0, BASIC_OUSD_PRINCIPLE, LVUSD_AMOUNT, true);
        })

        /* repayLvUSDToPosition section */

        it("Should mark down repayed lvUSD from NFT position", async function () {
            // borrow lvUSD before trying to repay lvUSD
            await cdp.borrowLvUSDFromPosition(NFT_ID, LVUSD_AMOUNT)

            await cdp.repayLvUSDToPosition(NFT_ID, getEighteenDecimal(1000))
            await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0, BASIC_OUSD_PRINCIPLE, getEighteenDecimal(LVUSD_AMOUNT_NATURAL - 1000), true)
        })

        it("Should not mark down repayed lvUSD if not enough borrowed lvUSD", async function () {
            await expect(cdp.repayLvUSDToPosition(NFT_ID, getEighteenDecimal(1000)))
                .to.be.revertedWith("lvUSD Borrowed amount must be greater than amount to repay")
        })

        /* depositOUSDtoPosition section */

        it("Should mark up deposited OUSD in NFT position", async function () {
            await cdp.depositOUSDtoPosition(NFT_ID, OUSD_AMOUNT)
            await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0,
                getEighteenDecimal(OUSD_AMOUNT_NATURAL + BASIC_OUSD_PRINCIPLE_NATURAL), 0, true)
        })

        /* withdrawOUSDFromPosition */

        it("Should mark down OUSD withdrawn from position", async function () {
            // await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0, BASIC_OUSD_PRINCIPLE, 0, true)
            await cdp.withdrawOUSDFromPosition(NFT_ID, getEighteenDecimal(30000))
            await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0, getEighteenDecimal(BASIC_OUSD_PRINCIPLE_NATURAL - 30000), 0, true)
        })

        it("Should mark down OUSD withdrawn from position taking into account OUSD deposited after principle ", async function () {
            // deposit OUSD before withdrawing from position
            await cdp.depositOUSDtoPosition(NFT_ID, OUSD_AMOUNT)
            let OUSDBalanceInTotalAfterDepositNatural = BASIC_OUSD_PRINCIPLE_NATURAL + OUSD_AMOUNT_NATURAL
            await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0,
                getEighteenDecimal(OUSDBalanceInTotalAfterDepositNatural), 0, true)

            await cdp.withdrawOUSDFromPosition(NFT_ID, getEighteenDecimal(30000))
            await validateCDP(NFT_ID, BASIC_OUSD_PRINCIPLE, 0, getEighteenDecimal(OUSDBalanceInTotalAfterDepositNatural - 30000), 0, true)
        })

        it("Should not mark down withdraw OUSD if total deposited OUSD is lower then amount to withdraw", async function () {
            await expect(cdp.withdrawOUSDFromPosition(NFT_ID, getEighteenDecimal(1100000)))
                .to.be.revertedWith("OUSD total amount must be greater than amount to withdraw");
        })


    })
});