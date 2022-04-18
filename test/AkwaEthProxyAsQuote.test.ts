/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/
import * as assert from 'assert';
import BigNumber from 'bignumber.js';
import { TransactionReceipt } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import {truffleAssert} from './utils/TruffleReverts';

import {
  DefaultAkwaContextInitConfig,
  AkwaContext,
  getAkwaContext,
} from './utils/Context';
import * as contracts from './utils/Contracts';
import { decimalStr, MAX_UINT256 } from './utils/Converter';
import { logGas } from './utils/Log';

let lp: string;
let trader: string;
let AKWAEthProxy: Contract;

async function init(ctx: AkwaContext): Promise<void> {
  // switch ctx to eth proxy mode
  const WETH = await contracts.newContract(contracts.WETH_CONTRACT_NAME);
  await ctx.AkwaPoolFactory.methods
    .createNewAkwaPool(
      ctx.Maintainer,
      ctx.BASE.options.address,
      WETH.options.address,
      ctx.ORACLE.options.address,
      DefaultAkwaContextInitConfig.lpFeeRate,
      DefaultAkwaContextInitConfig.mtFeeRate,
      DefaultAkwaContextInitConfig.k,
      DefaultAkwaContextInitConfig.gasPriceLimit
    )
    .send(ctx.sendParam(ctx.Deployer));

  ctx.AkwaPool = contracts.getContractWithAddress(
    contracts.AKWA_POOL_CONTRACT_NAME,
    await ctx.AkwaPoolFactory.methods
      .getAkwaPool(ctx.BASE.options.address, WETH.options.address)
      .call()
  );
  await ctx.AkwaPool.methods.enableBaseDeposit().send(ctx.sendParam(ctx.Deployer));
  await ctx.AkwaPool.methods.enableQuoteDeposit().send(ctx.sendParam(ctx.Deployer));
  await ctx.AkwaPool.methods.enableTrading().send(ctx.sendParam(ctx.Deployer));

  ctx.QUOTE = WETH;

  AKWAEthProxy = await contracts.newContract(
    contracts.DODO_ETH_PROXY_CONTRACT_NAME,
    [ctx.AkwaPoolFactory.options.address, WETH.options.address]
  );

  // env
  lp = ctx.spareAccounts[0];
  trader = ctx.spareAccounts[1];
  await ctx.setOraclePrice(decimalStr("0.01"));
  await ctx.approveAkwaPool(lp);
  await ctx.approveAkwaPool(trader);

  await ctx.BASE.methods
    .mint(lp, decimalStr("1000"))
    .send(ctx.sendParam(ctx.Deployer));
  await ctx.BASE.methods
    .mint(trader, decimalStr("1000"))
    .send(ctx.sendParam(ctx.Deployer));
  await ctx.BASE.methods
    .approve(AKWAEthProxy.options.address, MAX_UINT256)
    .send(ctx.sendParam(trader));

  await ctx.AkwaPool.methods
    .depositBase(decimalStr("1000"))
    .send(ctx.sendParam(lp));
}

describe("Akwa ETH PROXY", () => {
  let snapshotId: string;
  let ctx: AkwaContext;

  before(async () => {
    ctx = await getAkwaContext();
    await init(ctx);
    await ctx.BASE.methods
      .approve(AKWAEthProxy.options.address, MAX_UINT256)
      .send(ctx.sendParam(trader));
  });

  beforeEach(async () => {
    snapshotId = await ctx.EVM.snapshot();
    let depositAmount = "10";
    await AKWAEthProxy.methods
      .depositEthAsQuote(decimalStr(depositAmount), ctx.BASE.options.address)
      .send(ctx.sendParam(lp, depositAmount));
  });

  afterEach(async () => {
    await ctx.EVM.reset(snapshotId);
  });

  describe("buy&sell eth directly", () => {
    it("buy", async () => {
      const maxPayEthAmount = "2.1";
      const ethInPoolBefore = decimalStr("10");
      const traderEthBalanceBefore = await ctx.Web3.eth.getBalance(trader);
      const txReceipt: TransactionReceipt = await logGas(
        AKWAEthProxy.methods.buyTokenWithEth(
          ctx.BASE.options.address,
          decimalStr("200"),
          decimalStr(maxPayEthAmount)
        ),
        ctx.sendParam(trader, maxPayEthAmount),
        "buy token with ETH directly"
      );
      const ethInPoolAfter = "12056338203652739553";
      assert.strictEqual(
        await ctx.AkwaPool.methods._QUOTE_BALANCE_().call(),
        ethInPoolAfter
      );
      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(trader).call(),
        decimalStr("1200")
      );
      const tx = await ctx.Web3.eth.getTransaction(txReceipt.transactionHash);
      const ethSpentOnGas = new BigNumber(tx.gasPrice).times(txReceipt.gasUsed);
      const traderEthBalanceAfter = await ctx.Web3.eth.getBalance(trader);

      const totalEthBefore = new BigNumber(traderEthBalanceBefore).plus(
        ethInPoolBefore
      );
      const totalEthAfter = new BigNumber(traderEthBalanceAfter)
        .plus(ethSpentOnGas)
        .plus(ethInPoolAfter);
      assert.ok(totalEthBefore.eq(totalEthAfter));
    });
    it("sell", async () => {
      const minReceiveEthAmount = "0.45";
      await logGas(
        AKWAEthProxy.methods.sellTokenToEth(
          ctx.BASE.options.address,
          decimalStr("50"),
          decimalStr(minReceiveEthAmount)
        ),
        ctx.sendParam(trader),
        "sell token to ETH directly"
      );
      assert.strictEqual(
        await ctx.AkwaPool.methods._QUOTE_BALANCE_().call(),
        "9503598324131652490"
      );
      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(trader).call(),
        decimalStr("950")
      );
    });
  });

  describe("withdraw eth directly", () => {
    it("withdraw", async () => {
      const withdrawAmount = decimalStr("5");
      const quoteLpTokenAddress = await ctx.AkwaPool.methods
        ._QUOTE_CAPITAL_TOKEN_()
        .call();
      const quoteLpToken = contracts.getContractWithAddress(
        contracts.TEST_ERC20_CONTRACT_NAME,
        quoteLpTokenAddress
      );
      await quoteLpToken.methods
        .approve(AKWAEthProxy.options.address, MAX_UINT256)
        .send(ctx.sendParam(lp));
      const lpEthBalanceBefore = await ctx.Web3.eth.getBalance(lp);
      const txReceipt: TransactionReceipt = await AKWAEthProxy.methods
        .withdrawEthAsQuote(withdrawAmount, ctx.BASE.options.address)
        .send(ctx.sendParam(lp));

      assert.strictEqual(
        await ctx.AkwaPool.methods.getLpQuoteBalance(lp).call(),
        withdrawAmount
      );
      const tx = await ctx.Web3.eth.getTransaction(txReceipt.transactionHash);
      const ethSpentOnGas = new BigNumber(tx.gasPrice).times(txReceipt.gasUsed);
      const lpEthBalanceAfter = await ctx.Web3.eth.getBalance(lp);
      assert.ok(
        new BigNumber(lpEthBalanceBefore)
          .plus(withdrawAmount)
          .minus(ethSpentOnGas)
          .eq(lpEthBalanceAfter)
      );
    });

    it("withdraw all", async () => {
      const withdrawAmount = decimalStr("10");
      const quoteLpTokenAddress = await ctx.AkwaPool.methods
        ._QUOTE_CAPITAL_TOKEN_()
        .call();
      const quoteLpToken = contracts.getContractWithAddress(
        contracts.TEST_ERC20_CONTRACT_NAME,
        quoteLpTokenAddress
      );
      await quoteLpToken.methods
        .approve(AKWAEthProxy.options.address, MAX_UINT256)
        .send(ctx.sendParam(lp));
      const lpEthBalanceBefore = await ctx.Web3.eth.getBalance(lp);
      const txReceipt: TransactionReceipt = await AKWAEthProxy.methods
        .withdrawAllEthAsQuote(ctx.BASE.options.address)
        .send(ctx.sendParam(lp));

      assert.strictEqual(
        await ctx.AkwaPool.methods.getLpQuoteBalance(lp).call(),
        "0"
      );
      const tx = await ctx.Web3.eth.getTransaction(txReceipt.transactionHash);
      const ethSpentOnGas = new BigNumber(tx.gasPrice).times(txReceipt.gasUsed);
      const lpEthBalanceAfter = await ctx.Web3.eth.getBalance(lp);
      assert.ok(
        new BigNumber(lpEthBalanceBefore)
          .plus(withdrawAmount)
          .minus(ethSpentOnGas)
          .eq(lpEthBalanceAfter)
      );
    });
  });

  describe("revert cases", () => {
    it("value not match", async () => {
      await truffleAssert.reverts(
        AKWAEthProxy.methods
          .buyTokenWithEth(
            ctx.BASE.options.address,
            decimalStr("50"),
            decimalStr("1")
          )
          .send(ctx.sendParam(trader, "2")),
        "ETH_AMOUNT_NOT_MATCH"
      );
      await truffleAssert.reverts(
        AKWAEthProxy.methods
          .depositEthAsQuote(decimalStr("1"), ctx.BASE.options.address)
          .send(ctx.sendParam(lp, "2")),
        "ETH_AMOUNT_NOT_MATCH"
      );
    });
  });
});
