/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

import { AkwaContext, getAkwaContext } from './utils/Context';
import * as assert from "assert"
import { newContract, TEST_ERC20_CONTRACT_NAME, getContractWithAddress, AKWA_POOL_CONTRACT_NAME } from './utils/Contracts';
import {truffleAssert} from './utils/TruffleReverts';

async function init(ctx: AkwaContext): Promise<void> { }

describe("AkwaPoolFactory", () => {

  let snapshotId: string;
  let ctx: AkwaContext;

  before(async () => {
    ctx = await getAkwaContext()
    await init(ctx);
  })

  beforeEach(async () => {
    snapshotId = await ctx.EVM.snapshot();
  });

  afterEach(async () => {
    await ctx.EVM.reset(snapshotId)
  });

  describe("Create new pool", () => {
    it("could not deploy the same dodo", async () => {
      await truffleAssert.reverts(
        ctx.AkwaPoolFactory.methods.createNewAkwaPool(ctx.Maintainer, ctx.BASE.options.address, ctx.QUOTE.options.address, ctx.ORACLE.options.address, "0", "0", "1", "0").send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_ALREADY_REGISTERED"
      )

      await truffleAssert.reverts(
        ctx.AkwaPoolFactory.methods.createNewAkwaPool(ctx.Maintainer, ctx.QUOTE.options.address, ctx.BASE.options.address, ctx.ORACLE.options.address, "0", "0", "1", "0").send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_ALREADY_REGISTERED"
      )
    })

    it("create new AkwaPool", async () => {
      let newBase = await newContract(TEST_ERC20_CONTRACT_NAME, ["AnotherBase", 18])
      let newQuote = await newContract(TEST_ERC20_CONTRACT_NAME, ["AnotherQuote", 18])
      await truffleAssert.reverts(
        ctx.AkwaPoolFactory.methods.createNewAkwaPool(ctx.Maintainer, newBase.options.address, newQuote.options.address, ctx.ORACLE.options.address, "0", "0", "1", "0").send(ctx.sendParam(ctx.Maintainer)),
        "NOT_OWNER"
      )
      await ctx.AkwaPoolFactory.methods.createNewAkwaPool(ctx.Maintainer, newBase.options.address, newQuote.options.address, ctx.ORACLE.options.address, "0", "0", "1", "0").send(ctx.sendParam(ctx.Deployer))

      let newAkwaPool = getContractWithAddress(AKWA_POOL_CONTRACT_NAME, await ctx.AkwaPoolFactory.methods.getAkwaPool(newBase.options.address, newQuote.options.address).call())
      assert.strictEqual(await newAkwaPool.methods._BASE_TOKEN_().call(), newBase.options.address)
      assert.strictEqual(await newAkwaPool.methods._QUOTE_TOKEN_().call(), newQuote.options.address)

      // could not init twice
      await truffleAssert.reverts(
        newAkwaPool.methods.init(ctx.Deployer, ctx.Supervisor, ctx.Maintainer, ctx.QUOTE.options.address, ctx.BASE.options.address, ctx.ORACLE.options.address, "0", "0", "1", "0").send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_ALREADY_INITIALIZED"
      )

      // console.log(await ctx.AkwaFactory.methods.getAKWAs().call())
    })

    // it.only("remove dodo", async () => {
    //   console.log(await ctx.AkwaFactory.methods.getAKWAs().call())
    //   await ctx.AkwaFactory.methods.removeAKWA(ctx.DODO.options.address).send(ctx.sendParam(ctx.Deployer))
    //   console.log(await ctx.AkwaFactory.methods.getAKWA(ctx.BASE.options.address, ctx.QUOTE.options.address).call())
    //   console.log(await ctx.AkwaFactory.methods.getAKWAs().call())
    // })

    it("dodo register control flow", async () => {
      await ctx.AkwaPoolFactory.methods.removeAkwaPool(ctx.AkwaPool.options.address).send(ctx.sendParam(ctx.Deployer))
      assert.strictEqual(await ctx.AkwaPoolFactory.methods.getAkwaPool(ctx.BASE.options.address, ctx.QUOTE.options.address).call(), "0x0000000000000000000000000000000000000000")
      await truffleAssert.reverts(
        ctx.AkwaPoolFactory.methods.removeAkwaPool(ctx.AkwaPool.options.address).send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_NOT_REGISTERED"
      )
      await ctx.AkwaPoolFactory.methods.addAkwaPool(ctx.AkwaPool.options.address).send(ctx.sendParam(ctx.Deployer))
      assert.strictEqual(await ctx.AkwaPoolFactory.methods.getAkwaPool(ctx.BASE.options.address, ctx.QUOTE.options.address).call(), ctx.AkwaPool.options.address)
      await truffleAssert.reverts(
        ctx.AkwaPoolFactory.methods.addAkwaPool(ctx.AkwaPool.options.address).send(ctx.sendParam(ctx.Deployer)),
        "AKWA_POOL_ALREADY_REGISTERED"
      )
    })

  })
})