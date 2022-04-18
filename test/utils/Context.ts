/*

    Copyright 2020 DODO ZOO.
    SPDX-License-Identifier: Apache-2.0

*/

import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

import * as contracts from './Contracts';
import { decimalStr, gweiStr, MAX_UINT256 } from './Converter';
import { EVM, getDefaultWeb3 } from './EVM';
import * as log from './Log';

BigNumber.config({
  EXPONENTIAL_AT: 1000,
  DECIMAL_PLACES: 80,
});

export interface AkwaContextInitConfig {
  lpFeeRate: string;
  mtFeeRate: string;
  k: string;
  gasPriceLimit: string;
}

/*
  price curve when k=0.1
  +──────────────────────+───────────────+
  | purchase percentage  | avg slippage  |
  +──────────────────────+───────────────+
  | 1%                   | 0.1%         |
  | 5%                   | 0.5%         |
  | 10%                  | 1.1%         |
  | 20%                  | 2.5%         |
  | 50%                  | 10%          |
  | 70%                  | 23.3%        |
  +──────────────────────+───────────────+
*/
export let DefaultAkwaContextInitConfig = {
  lpFeeRate: decimalStr("0.002"),
  mtFeeRate: decimalStr("0.001"),
  k: decimalStr("0.1"),
  gasPriceLimit: gweiStr("100"),
};

export class AkwaContext {
  EVM: EVM;
  Web3: Web3;
  AkwaPool: Contract;
  AkwaPoolFactory: Contract;
  BASE: Contract;
  BaseCapital: Contract;
  QUOTE: Contract;
  QuoteCapital: Contract;
  ORACLE: Contract;
  Deployer: string;
  Supervisor: string;
  Maintainer: string;
  spareAccounts: string[];

  constructor() {}

  async init(config: AkwaContextInitConfig) {
    this.EVM = new EVM();
    this.Web3 = getDefaultWeb3();

    var cloneFactory = await contracts.newContract(
      contracts.CLONE_FACTORY_CONTRACT_NAME
    );

    this.BASE = await contracts.newContract(
      contracts.TEST_ERC20_CONTRACT_NAME,
      ["TestBase", 18]
    );
    this.QUOTE = await contracts.newContract(
      contracts.TEST_ERC20_CONTRACT_NAME,
      ["TestQuote", 18]
    );
    this.ORACLE = await contracts.newContract(
      contracts.NAIVE_ORACLE_CONTRACT_NAME
    );

    const allAccounts = await this.Web3.eth.getAccounts();
    this.Deployer = allAccounts[0];
    this.Supervisor = allAccounts[1];
    this.Maintainer = allAccounts[2];
    this.spareAccounts = allAccounts.slice(3, 10);

    var AkwaPoolTemplate = await contracts.newContract(
      contracts.AKWA_POOL_CONTRACT_NAME
    );
    this.AkwaPoolFactory = await contracts.newContract(
      contracts.AKWA_POOL_FACTORY_CONTRACT_NAME,
      [
        AkwaPoolTemplate.options.address,
        cloneFactory.options.address,
        this.Supervisor,
      ]
    );

    await this.AkwaPoolFactory.methods
      .createNewAkwaPool(
        this.Maintainer,
        this.BASE.options.address,
        this.QUOTE.options.address,
        this.ORACLE.options.address,
        config.lpFeeRate,
        config.mtFeeRate,
        config.k,
        config.gasPriceLimit
      )
      .send(this.sendParam(this.Deployer));

    this.AkwaPool = contracts.getContractWithAddress(
      contracts.AKWA_POOL_CONTRACT_NAME,
      await this.AkwaPoolFactory.methods
        .getAkwaPool(this.BASE.options.address, this.QUOTE.options.address)
        .call()
    );
    await this.AkwaPool.methods
      .enableBaseDeposit()
      .send(this.sendParam(this.Deployer));
    await this.AkwaPool.methods
      .enableQuoteDeposit()
      .send(this.sendParam(this.Deployer));
    await this.AkwaPool.methods.enableTrading().send(this.sendParam(this.Deployer));

    this.BaseCapital = contracts.getContractWithAddress(
      contracts.AKWA_LP_TOKEN_CONTRACT_NAME,
      await this.AkwaPool.methods._BASE_CAPITAL_TOKEN_().call()
    );
    this.QuoteCapital = contracts.getContractWithAddress(
      contracts.AKWA_LP_TOKEN_CONTRACT_NAME,
      await this.AkwaPool.methods._QUOTE_CAPITAL_TOKEN_().call()
    );

    console.log(log.blueText("[Init AkwaContext]"));
  }

  sendParam(sender, value = "0") {
    return {
      from: sender,
      gas: process.env["COVERAGE"] ? 10000000000 : 7000000,
      gasPrice: process.env.GAS_PRICE,
      value: decimalStr(value),
    };
  }

  async setOraclePrice(price: string) {
    await this.ORACLE.methods
      .setPrice(price)
      .send(this.sendParam(this.Deployer));
  }

  async mintTestToken(to: string, base: string, quote: string) {
    await this.BASE.methods.mint(to, base).send(this.sendParam(this.Deployer));
    await this.QUOTE.methods
      .mint(to, quote)
      .send(this.sendParam(this.Deployer));
  }

  async approveAkwaPool(account: string) {
    await this.BASE.methods
      .approve(this.AkwaPool.options.address, MAX_UINT256)
      .send(this.sendParam(account));
    await this.QUOTE.methods
      .approve(this.AkwaPool.options.address, MAX_UINT256)
      .send(this.sendParam(account));
  }
}

export async function getAkwaContext(
  config: AkwaContextInitConfig = DefaultAkwaContextInitConfig
): Promise<AkwaContext> {
  var context = new AkwaContext();
  await context.init(config);
  return context;
}
