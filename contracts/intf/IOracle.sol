/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;


interface IOracle {
    function getPrice() external view returns (uint256);
}
