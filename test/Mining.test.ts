/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

import { AkwaContext, getAkwaContext } from './utils/Context';
import { decimalStr, MAX_UINT256 } from './utils/Converter';
// import * as assert from "assert"
import { newContract, AKWA_TOKEN_CONTRACT_NAME, AKWA_MINE_NAME, TEST_ERC20_CONTRACT_NAME, getContractWithAddress, AKWA_MINE_READER_NAME } from './utils/Contracts';
import { Contract } from 'web3-eth-contract';
import { assert } from 'chai';
import { logGas } from './utils/Log';

let BaseDLP: Contract
let QuoteDLP: Contract
let AKWAToken: Contract
let AkwaMine: Contract
let AkwaMineReader: Contract
let lp1: string;
let lp2: string;

async function init(ctx: AkwaContext): Promise<void> {

  lp1 = ctx.spareAccounts[0];
  lp2 = ctx.spareAccounts[1];
  await ctx.mintTestToken(lp1, decimalStr("100"), decimalStr("10000"));
  await ctx.mintTestToken(lp2, decimalStr("100"), decimalStr("10000"));

  await ctx.approveAkwaPool(lp1);
  await ctx.approveAkwaPool(lp2);

  await ctx.AkwaPool.methods.depositBase(decimalStr("100")).send(ctx.sendParam(lp1))
  await ctx.AkwaPool.methods.depositQuote(decimalStr("10000")).send(ctx.sendParam(lp1))

  await ctx.AkwaPool.methods.depositBase(decimalStr("100")).send(ctx.sendParam(lp2))
  await ctx.AkwaPool.methods.depositQuote(decimalStr("10000")).send(ctx.sendParam(lp2))

  AKWAToken = await newContract(AKWA_TOKEN_CONTRACT_NAME)
  AkwaMine = await newContract(AKWA_MINE_NAME, [AKWAToken.options.address, (await ctx.Web3.eth.getBlockNumber()).toString()])
  AkwaMineReader = await newContract(AKWA_MINE_READER_NAME)

  BaseDLP = await getContractWithAddress(TEST_ERC20_CONTRACT_NAME, await ctx.AkwaPool.methods._BASE_CAPITAL_TOKEN_().call())
  QuoteDLP = await getContractWithAddress(TEST_ERC20_CONTRACT_NAME, await ctx.AkwaPool.methods._QUOTE_CAPITAL_TOKEN_().call())

  await BaseDLP.methods.approve(AkwaMine.options.address, MAX_UINT256).send(ctx.sendParam(lp1))
  await QuoteDLP.methods.approve(AkwaMine.options.address, MAX_UINT256).send(ctx.sendParam(lp1))

  await BaseDLP.methods.approve(AkwaMine.options.address, MAX_UINT256).send(ctx.sendParam(lp2))
  await QuoteDLP.methods.approve(AkwaMine.options.address, MAX_UINT256).send(ctx.sendParam(lp2))

  await AkwaMine.methods.setReward(decimalStr("100"), true).send(ctx.sendParam(ctx.Deployer))
  await AkwaMine.methods.addLpToken(BaseDLP.options.address, "1", true).send(ctx.sendParam(ctx.Deployer))
  await AkwaMine.methods.addLpToken(QuoteDLP.options.address, "2", true).send(ctx.sendParam(ctx.Deployer))

  const rewardVault = await AkwaMine.methods.dodoRewardVault().call()
  await AKWAToken.methods.transfer(rewardVault, decimalStr("100000000")).send(ctx.sendParam(ctx.Deployer))
}

describe("Lock DODO Token", () => {

  let snapshotId: string
  let ctx: AkwaContext

  before(async () => {
    ctx = await getAkwaContext();
    await init(ctx);
  })

  beforeEach(async () => {
    snapshotId = await ctx.EVM.snapshot();
  });

  afterEach(async () => {
    await ctx.EVM.reset(snapshotId)
  });

  describe("Lp Deposit", () => {
    it("single lp deposit", async () => {
      await logGas(AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")), ctx.sendParam(lp1), "deposit")
      await ctx.EVM.fastMove(100)
      assert.strictEqual(await AkwaMine.methods.getPendingReward(BaseDLP.options.address, lp1).call(), "3333333333333333333300")
      assert.strictEqual(await AkwaMine.methods.getDlpMiningSpeed(BaseDLP.options.address).call(), "33333333333333333333")
    });

    it("multi lp deposit", async () => {
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))
      await ctx.EVM.fastMove(100)
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp2))
      await ctx.EVM.fastMove(100)
      assert.strictEqual(await AkwaMine.methods.getPendingReward(BaseDLP.options.address, lp1).call(), "5033333333333333333200")
      assert.strictEqual(await AkwaMine.methods.getPendingReward(BaseDLP.options.address, lp2).call(), "1666666666666666666600")

      await AkwaMine.methods.deposit(QuoteDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))
      await ctx.EVM.fastMove(100)
      await AkwaMine.methods.deposit(QuoteDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp2))
      await ctx.EVM.fastMove(100)
      assert.strictEqual(await AkwaMine.methods.getPendingReward(QuoteDLP.options.address, lp1).call(), "10066666666666666666600")
      assert.strictEqual(await AkwaMine.methods.getPendingReward(QuoteDLP.options.address, lp2).call(), "3333333333333333333300")

      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp1).call(), "18466666666666666666500")
      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp2).call(), "8366666666666666666600")
    });

    it("lp multi deposit and withdraw", async () => {
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp2))
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))
      await ctx.EVM.fastMove(100)
      await logGas(AkwaMine.methods.withdraw(BaseDLP.options.address, decimalStr("50")), ctx.sendParam(lp1), "withdraw")
      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp1).call(), "0")
      assert.strictEqual(await AKWAToken.methods.balanceOf(lp1).call(), "1683333333333333333300")
      assert.strictEqual(await AkwaMine.methods.getRealizedReward(lp1).call(), "1683333333333333333300")
      await ctx.EVM.fastMove(100)
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("50")).send(ctx.sendParam(lp1))
      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp1).call(), "0")
      assert.strictEqual(await AKWAToken.methods.balanceOf(lp1).call(), "2805555555555555555500")
      assert.strictEqual(await AkwaMine.methods.getRealizedReward(lp1).call(), "2805555555555555555500")

      var balance = await AkwaMineReader.methods.getUserStakedBalance(AkwaMine.options.address, ctx.AkwaPool.options.address, lp1).call()
      assert.strictEqual(balance.baseBalance, decimalStr("100"))
      assert.strictEqual(balance.quoteBalance, decimalStr("0"))
    });

    it("lp claim", async () => {
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp2))

      await AkwaMine.methods.deposit(QuoteDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))
      await AkwaMine.methods.deposit(QuoteDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp2))

      await ctx.EVM.fastMove(100)

      await logGas(AkwaMine.methods.claim(BaseDLP.options.address), ctx.sendParam(lp1), "claim")
      assert.strictEqual(await AkwaMine.methods.getPendingReward(BaseDLP.options.address, lp1).call(), "0")
      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp1).call(), "3433333333333333333200")
      assert.strictEqual(await AkwaMine.methods.getRealizedReward(lp1).call(), "1749999999999999999900")
      assert.strictEqual(await AKWAToken.methods.balanceOf(lp1).call(), "1749999999999999999900")

      await logGas(AkwaMine.methods.claimAll(), ctx.sendParam(lp2), "claim 2 pool")
      assert.strictEqual(await AkwaMine.methods.getPendingReward(BaseDLP.options.address, lp2).call(), "0")
      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp2).call(), "0")
      assert.strictEqual(await AkwaMine.methods.getRealizedReward(lp2).call(), "5133333333333333333200")
      assert.strictEqual(await AKWAToken.methods.balanceOf(lp2).call(), "5133333333333333333200")
    });

    it("lp emergency withdraw", async () => {
      await AkwaMine.methods.deposit(QuoteDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))

      await ctx.EVM.fastMove(100)

      await AkwaMine.methods.emergencyWithdraw(QuoteDLP.options.address).send(ctx.sendParam(lp1))

      assert.strictEqual(await QuoteDLP.methods.balanceOf(lp1).call(), decimalStr("10000"))
      assert.strictEqual(await AkwaMine.methods.getPendingReward(QuoteDLP.options.address, lp1).call(), "0")
      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp1).call(), "0")
      assert.strictEqual(await AkwaMine.methods.getRealizedReward(lp1).call(), "0")
      assert.strictEqual(await AKWAToken.methods.balanceOf(lp1).call(), "0")
    });

    it("setLpToken", async () => {
      await AkwaMine.methods.deposit(BaseDLP.options.address, decimalStr("100")).send(ctx.sendParam(lp1))
      await ctx.EVM.fastMove(100)
      await AkwaMine.methods.setLpToken(BaseDLP.options.address, "2", true).send(ctx.sendParam(ctx.Deployer))
      await ctx.EVM.fastMove(100)

      assert.strictEqual(await AkwaMine.methods.getAllPendingReward(lp1).call(), "8366666666666666666600")
    });

  })

})