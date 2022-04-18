/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import {IAkwaPool} from "../intf/IAkwaPool.sol";
import {IERC20} from "../intf/IERC20.sol";
import {SafeMath} from "../lib/SafeMath.sol";


interface IAkwaMine {
    function getUserLpBalance(address _lpToken, address _user) external view returns (uint256);
}


contract AkwaMineReader {
    using SafeMath for uint256;

    function getUserStakedBalance(
        address _AkwaMine,
        address _dodo,
        address _user
    ) external view returns (uint256 baseBalance, uint256 quoteBalance) {
        address baseLpToken = IAkwaPool(_dodo)._BASE_CAPITAL_TOKEN_();
        address quoteLpToken = IAkwaPool(_dodo)._QUOTE_CAPITAL_TOKEN_();

        uint256 baseLpBalance = IAkwaMine(_AkwaMine).getUserLpBalance(baseLpToken, _user);
        uint256 quoteLpBalance = IAkwaMine(_AkwaMine).getUserLpBalance(quoteLpToken, _user);

        uint256 baseLpTotalSupply = IERC20(baseLpToken).totalSupply();
        uint256 quoteLpTotalSupply = IERC20(quoteLpToken).totalSupply();

        (uint256 baseTarget, uint256 quoteTarget) = IAkwaPool(_dodo).getExpectedTarget();
        baseBalance = baseTarget.mul(baseLpBalance).div(baseLpTotalSupply);
        quoteBalance = quoteTarget.mul(quoteLpBalance).div(quoteLpTotalSupply);

        return (baseBalance, quoteBalance);
    }
}
