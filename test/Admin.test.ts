/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

import * as assert from 'assert';

import { AkwaContext, getAkwaContext } from './utils/Context';
import { decimalStr } from './utils/Converter';

//const truffleAssert = require('truffle-assertions');
import {truffleAssert} from './utils/TruffleReverts';

let lp1: string;
let lp2: string;
let trader: string;
let tempAccount: string;

async function init(ctx: AkwaContext): Promise<void> {
  await ctx.setOraclePrice(decimalStr("100"));
  tempAccount = ctx.spareAccounts[5];
  lp1 = ctx.spareAccounts[0];
  lp2 = ctx.spareAccounts[1];
  trader = ctx.spareAccounts[2];
  await ctx.mintTestToken(lp1, decimalStr("100"), decimalStr("10000"));
  await ctx.mintTestToken(lp2, decimalStr("100"), decimalStr("10000"));
  await ctx.mintTestToken(trader, decimalStr("100"), decimalStr("10000"));
  await ctx.approveAkwaPool(lp1);
  await ctx.approveAkwaPool(lp2);
  await ctx.approveAkwaPool(trader);
}

describe("Admin", () => {
  let snapshotId: string;
  let ctx: AkwaContext;

  before(async () => {
    ctx = await getAkwaContext();
    await init(ctx);
  });

  beforeEach(async () => {
    snapshotId = await ctx.EVM.snapshot();
  });

  afterEach(async () => {
    await ctx.EVM.reset(snapshotId);
  });

  describe("Settings", () => {
    it("set oracle", async () => {
      await ctx.AkwaPool.methods
        .setOracle(tempAccount)
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(await ctx.AkwaPool.methods._ORACLE_().call(), tempAccount);
    });

    it("set suprevisor", async () => {
      await ctx.AkwaPool.methods
        .setSupervisor(tempAccount)
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(await ctx.AkwaPool.methods._SUPERVISOR_().call(), tempAccount);
    });

    it("set maintainer", async () => {
      await ctx.AkwaPool.methods
        .setMaintainer(tempAccount)
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(await ctx.AkwaPool.methods._MAINTAINER_().call(), tempAccount);
    });

    it("set liquidity provider fee rate", async () => {
      await ctx.AkwaPool.methods
        .setLiquidityProviderFeeRate(decimalStr("0.01"))
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(
        await ctx.AkwaPool.methods._LP_FEE_RATE_().call(),
        decimalStr("0.01")
      );
    });

    it("set maintainer fee rate", async () => {
      await ctx.AkwaPool.methods
        .setMaintainerFeeRate(decimalStr("0.01"))
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(
        await ctx.AkwaPool.methods._MT_FEE_RATE_().call(),
        decimalStr("0.01")
      );
    });

    it("set k", async () => {
      await ctx.AkwaPool.methods
        .setK(decimalStr("0.2"))
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(await ctx.AkwaPool.methods._K_().call(), decimalStr("0.2"));
    });

    it("set gas price limit", async () => {
      await ctx.AkwaPool.methods
        .setGasPriceLimit(decimalStr("100"))
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(
        await ctx.AkwaPool.methods._GAS_PRICE_LIMIT_().call(),
        decimalStr("100")
      );
    });
  });

  describe("Controls", () => {
    it("control flow", async () => {
      await ctx.AkwaPool.methods
        .disableBaseDeposit()
        .send(ctx.sendParam(ctx.Supervisor));

      await truffleAssert.reverts(ctx.AkwaPool.methods.depositBase(decimalStr("10")).send(ctx.sendParam(lp1)),
                                  "DEPOSIT_BASE_NOT_ALLOWED");
                                  
      await ctx.AkwaPool.methods
        .enableBaseDeposit()
        .send(ctx.sendParam(ctx.Deployer));
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));

      assert.strictEqual(
        await ctx.AkwaPool.methods._TARGET_BASE_TOKEN_AMOUNT_().call(),
        decimalStr("10")
      );

      await ctx.AkwaPool.methods
        .disableQuoteDeposit()
        .send(ctx.sendParam(ctx.Supervisor));

      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .depositQuote(decimalStr("1000"))
          .send(ctx.sendParam(lp1)),
        "DEPOSIT_QUOTE_NOT_ALLOWED"
      );

      await ctx.AkwaPool.methods
        .enableQuoteDeposit()
        .send(ctx.sendParam(ctx.Deployer));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      assert.strictEqual(
        await ctx.AkwaPool.methods._TARGET_QUOTE_TOKEN_AMOUNT_().call(),
        decimalStr("10")
      );

      await ctx.AkwaPool.methods
        .disableTrading()
        .send(ctx.sendParam(ctx.Supervisor));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .buyBaseToken(decimalStr("1"), decimalStr("200"), "0x")
          .send(ctx.sendParam(trader)),
        "TRADE_NOT_ALLOWED"
      );

      await ctx.AkwaPool.methods.enableTrading().send(ctx.sendParam(ctx.Deployer));
      await ctx.AkwaPool.methods
        .buyBaseToken(decimalStr("1"), decimalStr("200"), "0x")
        .send(ctx.sendParam(trader));
      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(trader).call(),
        decimalStr("101")
      );
    });

    it("control flow premission", async () => {
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.setGasPriceLimit("1").send(ctx.sendParam(trader)),
        "NOT_SUPERVISOR_OR_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.disableTrading().send(ctx.sendParam(trader)),
        "NOT_SUPERVISOR_OR_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.disableQuoteDeposit().send(ctx.sendParam(trader)),
        "NOT_SUPERVISOR_OR_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.disableBaseDeposit().send(ctx.sendParam(trader)),
        "NOT_SUPERVISOR_OR_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.disableBuying().send(ctx.sendParam(trader)),
        "NOT_SUPERVISOR_OR_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.disableSelling().send(ctx.sendParam(trader)),
        "NOT_SUPERVISOR_OR_OWNER"
      );

      await truffleAssert.reverts(
        ctx.AkwaPool.methods.setOracle(trader).send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.setSupervisor(trader).send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.setMaintainer(trader).send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setLiquidityProviderFeeRate(decimalStr("0.1"))
          .send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setMaintainerFeeRate(decimalStr("0.1"))
          .send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.setK(decimalStr("0.1")).send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );

      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableTrading().send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableQuoteDeposit().send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableBaseDeposit().send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableBuying().send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableSelling().send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setBaseBalanceLimit(decimalStr("0"))
          .send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setQuoteBalanceLimit(decimalStr("0"))
          .send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableTrading().send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
    });

    it("advanced controls", async () => {
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("10"))
        .send(ctx.sendParam(lp1));

      await ctx.AkwaPool.methods
        .disableBuying()
        .send(ctx.sendParam(ctx.Supervisor));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .buyBaseToken(decimalStr("1"), decimalStr("200"), "0x")
          .send(ctx.sendParam(trader)),
        "BUYING_NOT_ALLOWED"
      );
      await ctx.AkwaPool.methods.enableBuying().send(ctx.sendParam(ctx.Deployer));

      await ctx.AkwaPool.methods
        .disableSelling()
        .send(ctx.sendParam(ctx.Supervisor));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .sellBaseToken(decimalStr("1"), decimalStr("200"), "0x")
          .send(ctx.sendParam(trader)),
        "SELLING_NOT_ALLOWED"
      );
      await ctx.AkwaPool.methods.enableSelling().send(ctx.sendParam(ctx.Deployer));

      await ctx.AkwaPool.methods
        .setBaseBalanceLimit(decimalStr("0"))
        .send(ctx.sendParam(ctx.Deployer));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .depositBase(decimalStr("1000"))
          .send(ctx.sendParam(lp1)),
        "BASE_BALANCE_LIMIT_EXCEEDED"
      );

      await ctx.AkwaPool.methods
        .setQuoteBalanceLimit(decimalStr("0"))
        .send(ctx.sendParam(ctx.Deployer));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .depositQuote(decimalStr("1000"))
          .send(ctx.sendParam(lp1)),
        "QUOTE_BALANCE_LIMIT_EXCEEDED"
      );
    });
  });

  describe("Final settlement", () => {
    it("final settlement when R is ONE", async () => {
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("1000"))
        .send(ctx.sendParam(lp1));

      await ctx.AkwaPool.methods
        .finalSettlement()
        .send(ctx.sendParam(ctx.Deployer));

      await ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp1));

      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(lp1).call(),
        decimalStr("100")
      );
      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(lp1).call(),
        decimalStr("10000")
      );
    });

    it("final settlement when R is ABOVE ONE", async () => {
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("1000"))
        .send(ctx.sendParam(lp1));

      await ctx.AkwaPool.methods
        .buyBaseToken(decimalStr("5"), decimalStr("1000"), "0x")
        .send(ctx.sendParam(trader));
      await ctx.AkwaPool.methods
        .finalSettlement()
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(await ctx.AkwaPool.methods._R_STATUS_().call(), "0");

      await ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp1));

      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(lp1).call(),
        decimalStr("94.995")
      );
      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(lp1).call(),
        "10551951805416248746110"
      );
    });

    it("final settlement when R is BELOW ONE", async () => {
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("1000"))
        .send(ctx.sendParam(lp1));

      await ctx.AkwaPool.methods
        .sellBaseToken(decimalStr("5"), decimalStr("100"), "0x")
        .send(ctx.sendParam(trader));
      await ctx.AkwaPool.methods
        .finalSettlement()
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(await ctx.AkwaPool.methods._R_STATUS_().call(), "0");

      await ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp1));

      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(lp1).call(),
        decimalStr("105")
      );
      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(lp1).call(),
        "9540265973590798352835"
      );
    });

    it("final settlement when only deposit base", async () => {
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));

      await ctx.AkwaPool.methods
        .finalSettlement()
        .send(ctx.sendParam(ctx.Deployer));

      await ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp1));

      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(lp1).call(),
        decimalStr("100")
      );
    });

    it("final settlement when only deposit quote", async () => {
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("1000"))
        .send(ctx.sendParam(lp1));

      await ctx.AkwaPool.methods
        .finalSettlement()
        .send(ctx.sendParam(ctx.Deployer));

      await ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp1));

      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(lp1).call(),
        decimalStr("10000")
      );
    });

    it("final settlement revert cases", async () => {
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp1)),
        "AKWA_POOL_NOT_CLOSED"
      );
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("500"))
        .send(ctx.sendParam(lp2));

      await ctx.AkwaPool.methods
        .buyBaseToken(decimalStr("5"), decimalStr("1000"), "0x")
        .send(ctx.sendParam(trader));
      await ctx.AkwaPool.methods
        .finalSettlement()
        .send(ctx.sendParam(ctx.Deployer));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.finalSettlement().send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_CLOSED"
      );

      await truffleAssert.reverts(
        ctx.AkwaPool.methods.withdrawAllBase().send(ctx.sendParam(lp1)),
        "AKWA_POOL_CLOSED"
      )
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.withdrawAllQuote().send(ctx.sendParam(lp1)),
        "AKWA_POOL_CLOSED"
      )

      await ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp2));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.claimAssets().send(ctx.sendParam(lp2)),
        "ALREADY_CLAIMED"
      );

      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableQuoteDeposit().send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_CLOSED"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableBaseDeposit().send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_CLOSED"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableTrading().send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_CLOSED"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableBuying().send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_CLOSED"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods.enableSelling().send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_CLOSED"
      );
    });
  });

  describe("donate", () => {
    it("donate quote & base token", async () => {
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("10"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositBase(decimalStr("20"))
        .send(ctx.sendParam(lp2));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("1000"))
        .send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods
        .depositQuote(decimalStr("2000"))
        .send(ctx.sendParam(lp2));

      await ctx.AkwaPool.methods
        .donateBaseToken(decimalStr("2"))
        .send(ctx.sendParam(trader));
      await ctx.AkwaPool.methods
        .donateQuoteToken(decimalStr("500"))
        .send(ctx.sendParam(trader));

      assert.strictEqual(
        await ctx.AkwaPool.methods.getLpBaseBalance(lp1).call(),
        "10666666666666666666"
      );
      assert.strictEqual(
        await ctx.AkwaPool.methods.getLpQuoteBalance(lp1).call(),
        "1166666666666666666666"
      );
      assert.strictEqual(
        await ctx.AkwaPool.methods.getLpBaseBalance(lp2).call(),
        "21333333333333333333"
      );
      assert.strictEqual(
        await ctx.AkwaPool.methods.getLpQuoteBalance(lp2).call(),
        "2333333333333333333333"
      );

      await ctx.AkwaPool.methods.withdrawAllBase().send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods.withdrawAllBase().send(ctx.sendParam(lp2));

      await ctx.AkwaPool.methods.withdrawAllQuote().send(ctx.sendParam(lp1));
      await ctx.AkwaPool.methods.withdrawAllQuote().send(ctx.sendParam(lp2));

      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(lp1).call(),
        "100666666666666666666"
      );
      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(lp2).call(),
        "101333333333333333334"
      );
      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(lp1).call(),
        "10166666666666666666666"
      );
      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(lp2).call(),
        "10333333333333333333334"
      );
    });
  });

  describe("retrieve", () => {
    it("retrieve base token", async () => {
      await ctx.BASE.methods
        .transfer(ctx.AkwaPool.options.address, decimalStr("1"))
        .send(ctx.sendParam(trader));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .retrieve(ctx.BASE.options.address, decimalStr("1"))
          .send(ctx.sendParam(trader)),
        "NOT_OWNER"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .retrieve(ctx.BASE.options.address, decimalStr("2"))
          .send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_BASE_BALANCE_NOT_ENOUGH"
      );
      await ctx.AkwaPool.methods
        .retrieve(ctx.BASE.options.address, decimalStr("1"))
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(
        await ctx.BASE.methods.balanceOf(ctx.Deployer).call(),
        decimalStr("1")
      );
    });

    it("retrieve quote token", async () => {
      await ctx.QUOTE.methods
        .transfer(ctx.AkwaPool.options.address, decimalStr("1"))
        .send(ctx.sendParam(trader));
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .retrieve(ctx.QUOTE.options.address, decimalStr("2"))
          .send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_QUOTE_BALANCE_NOT_ENOUGH"
      );
      await ctx.AkwaPool.methods
        .retrieve(ctx.QUOTE.options.address, decimalStr("1"))
        .send(ctx.sendParam(ctx.Deployer));
      assert.strictEqual(
        await ctx.QUOTE.methods.balanceOf(ctx.Deployer).call(),
        decimalStr("1")
      );
    });
  });

  describe("revert cases", () => {
    it("k revert cases", async () => {
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setK(decimalStr("1"))
          .send(ctx.sendParam(ctx.Deployer)),
        "K>=1"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setK(decimalStr("0"))
          .send(ctx.sendParam(ctx.Deployer)),
        "K=0"
      );
    });

    it("fee revert cases", async () => {
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setLiquidityProviderFeeRate(decimalStr("0.999"))
          .send(ctx.sendParam(ctx.Deployer)),
        "FEE_RATE>=1"
      );
      await truffleAssert.reverts(
        ctx.AkwaPool.methods
          .setMaintainerFeeRate(decimalStr("0.998"))
          .send(ctx.sendParam(ctx.Deployer)),
        "FEE_RATE>=1"
      );
    });
  });
});
