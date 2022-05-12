const fs = require("fs");
const file = fs.createWriteStream("../deploy-contracts.txt", { 'flags': 'a' });
let logger = new console.Console(file, file);
const { GetConfig } = require("../configAdapter.js")

const CloneFactory = artifacts.require("CloneFactory");
const AkwaPoolTemplate = artifacts.require("AkwaPool");
const AkwaPoolFactory = artifacts.require("AkwaPoolFactory");
const NaiveOracle = artifacts.require("NaiveOracle");
const AkwaToken = artifacts.require("AkwaToken");
const TestERC20 = artifacts.require("TestERC20");

module.exports = async (deployer, network, accounts) => {
    let CONFIG = GetConfig(network, accounts);

    if (!CONFIG.CloneFactory) {
        await deployer.deploy(CloneFactory);
        CONFIG.CloneFactory = CloneFactory.address;
        logger.log("CONFIG.CloneFactory: ", CONFIG.CloneFactory);
    }
    
    if (!CONFIG.AkwaPoolTemplate) {
        await deployer.deploy(AkwaPoolTemplate);
        CONFIG.AkwaPoolTemplate = AkwaPoolTemplate.address;
        logger.log("CONFIG.AkwaPoolTemplate: ", CONFIG.AkwaPoolTemplate);
    }

    if (!CONFIG.AkwaPoolFactory) {
        await deployer.deploy(AkwaPoolFactory, 
                              CONFIG.AkwaPoolTemplate, 
                              CONFIG.CloneFactory,
                              CONFIG.Supervisor);
        CONFIG.AkwaPoolFactory = AkwaPoolFactory.address;
        logger.log("CONFIG.AkwaPoolFactory: ", CONFIG.AkwaPoolFactory);
    }

    if (!CONFIG.NaiveOracle) {
        await deployer.deploy(NaiveOracle);
        CONFIG.NaiveOracle = NaiveOracle.address;
        logger.log("CONFIG.NaiveOracle: ", CONFIG.NaiveOracle);
    }

    if (!CONFIG.AkwaToken) {
        await deployer.deploy(AkwaToken);
        CONFIG.AkwaToken = AkwaToken.address;
        logger.log("CONFIG.AkwaToken: ", CONFIG.AkwaToken);
    }

    if (!CONFIG.ETHA) {
        await deployer.deploy(TestERC20, "ETHA", 18);
        CONFIG.ETHA = TestERC20.address;
        logger.log("CONFIG.ETHA: ", CONFIG.ETHA);
    }

    if (!CONFIG.USDA) {
        await deployer.deploy(TestERC20, "USDA", 18);
        CONFIG.USDA = TestERC20.address;
        logger.log("CONFIG.USDA: ", CONFIG.USDA);
    }

    if (!CONFIG.ETHA2) {
        await deployer.deploy(TestERC20, "ETHA2", 18);
        CONFIG.ETHA2 = TestERC20.address;
        logger.log("CONFIG.ETHA2: ", CONFIG.ETHA2);
    }

    if (!CONFIG.USDA2) {
        await deployer.deploy(TestERC20, "USDA2", 18);
        CONFIG.USDA2 = TestERC20.address;
        logger.log("CONFIG.USDA2: ", CONFIG.USDA2);
    }

};
