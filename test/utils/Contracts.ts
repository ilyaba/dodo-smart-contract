/*

    Copyright 2020 DODO ZOO.
    SPDX-License-Identifier: Apache-2.0

*/
var jsonPath: string = "../../build/contracts/"
if (process.env["COVERAGE"]) {
  console.log("[Coverage mode]")
  jsonPath = "../../.coverage_artifacts/contracts/"
}

const CloneFactory = require(`${jsonPath}CloneFactory.json`)
const AkwaPool = require(`${jsonPath}AkwaPool.json`)
const AkwaPoolFactory = require(`${jsonPath}AkwaPoolFactory.json`)
const AKWAEthProxy = require(`${jsonPath}AKWAEthProxy.json`)
const WETH = require(`${jsonPath}WETH9.json`)
const TestERC20 = require(`${jsonPath}TestERC20.json`)
const NaiveOracle = require(`${jsonPath}NaiveOracle.json`)
const AkwaLpToken = require(`${jsonPath}AkwaLpToken.json`)
const Uniswap = require(`${jsonPath}UniswapV2Pair.json`)
const UniswapArbitrageur = require(`${jsonPath}UniswapArbitrageur.json`)
const AKWAToken = require(`${jsonPath}AKWAToken.json`)
const AkwaMine = require(`${jsonPath}AkwaMine.json`)
const AkwaMineReader = require(`${jsonPath}AkwaMineReader.json`)
const LockedTokenVault = require(`${jsonPath}LockedTokenVault.json`)

import { getDefaultWeb3 } from './EVM';
import { Contract } from 'web3-eth-contract';

export const CLONE_FACTORY_CONTRACT_NAME = "CloneFactory";
export const AKWA_POOL_CONTRACT_NAME = "AkwaPool";
export const TEST_ERC20_CONTRACT_NAME = "TestERC20";
export const NAIVE_ORACLE_CONTRACT_NAME = "NaiveOracle";
export const AKWA_LP_TOKEN_CONTRACT_NAME = "AkwaLpToken";
export const AKWA_POOL_FACTORY_CONTRACT_NAME = "AkwaPoolFactory";
export const DODO_ETH_PROXY_CONTRACT_NAME = "AKWAEthProxy";
export const WETH_CONTRACT_NAME = "WETH";
export const UNISWAP_CONTRACT_NAME = "Uniswap";
export const UNISWAP_ARBITRAGEUR_CONTRACT_NAME = "UniswapArbitrageur";
export const AKWA_TOKEN_CONTRACT_NAME = "AKWAToken";
export const LOCKED_TOKEN_VAULT_CONTRACT_NAME = "LockedTokenVault";
export const AKWA_MINE_NAME = "AkwaMine";
export const AKWA_MINE_READER_NAME = "AkwaMineReader";

var contractMap: { [name: string]: any } = {};

contractMap[CLONE_FACTORY_CONTRACT_NAME] = CloneFactory;
contractMap[AKWA_POOL_CONTRACT_NAME] = AkwaPool;
contractMap[TEST_ERC20_CONTRACT_NAME] = TestERC20;
contractMap[NAIVE_ORACLE_CONTRACT_NAME] = NaiveOracle;
contractMap[AKWA_LP_TOKEN_CONTRACT_NAME] = AkwaLpToken;
contractMap[AKWA_POOL_FACTORY_CONTRACT_NAME] = AkwaPoolFactory;
contractMap[DODO_ETH_PROXY_CONTRACT_NAME] = AKWAEthProxy;
contractMap[WETH_CONTRACT_NAME] = WETH;
contractMap[UNISWAP_CONTRACT_NAME] = Uniswap;
contractMap[UNISWAP_ARBITRAGEUR_CONTRACT_NAME] = UniswapArbitrageur;
contractMap[AKWA_TOKEN_CONTRACT_NAME] = AKWAToken;
contractMap[LOCKED_TOKEN_VAULT_CONTRACT_NAME] = LockedTokenVault;
contractMap[AKWA_MINE_NAME] = AkwaMine;
contractMap[AKWA_MINE_READER_NAME] = AkwaMineReader;

interface ContractJson {
  abi: any;
  networks: { [network: number]: any };
  byteCode: string;
}

export function getContractJSON(contractName: string): ContractJson {
  var info = contractMap[contractName];
  return {
    abi: info.abi,
    networks: info.networks,
    byteCode: info.bytecode
  };
}

export function getContractWithAddress(contractName: string, address: string) : Contract{
  var Json = getContractJSON(contractName);
  var web3 = getDefaultWeb3();
  var c = new web3.eth.Contract(Json.abi, address);

  c.handleRevert = true;

  return c;
}

export function getDepolyedContract(contractName: string): Contract {
  var Json = getContractJSON(contractName);
  var networkId = process.env.NETWORK_ID;
  var deployedAddress = getContractJSON(contractName).networks[networkId].address;
  var web3 = getDefaultWeb3();
  var c = new web3.eth.Contract(Json.abi, deployedAddress);

  c.handleRevert = true;

  return c;
}

export async function newContract(contractName: string, args: any[] = []): Promise<Contract> {
  var web3 = getDefaultWeb3();
  var Json = getContractJSON(contractName);
  var contract = new web3.eth.Contract(Json.abi);
  var adminAccount = (await web3.eth.getAccounts())[0];
  let parameter = {
    from: adminAccount,
    gas: process.env["COVERAGE"] ? 10000000000 : 700000000,
    gasPrice: web3.utils.toHex(web3.utils.toWei('10000000000', 'wei'))
  };

  let c = await contract.deploy({ data: Json.byteCode, arguments: args }).send(parameter);

  c.handleRevert = true;
  
  return c;
}