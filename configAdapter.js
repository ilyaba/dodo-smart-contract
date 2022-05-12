const { KOVAN_CONFIG } = require("./config/kovan-config");
const { GOERLI_CONFIG } = require("./config/goerli-config");

exports.GetConfig = function(network, accounts) {
    var CONFIG = {};

    switch(network) {
        case "kovan":
            CONFIG = KOVAN_CONFIG;
            break;
        case "goerli":
            CONFIG = GOERLI_CONFIG;
            break;
    }

    return CONFIG;
}