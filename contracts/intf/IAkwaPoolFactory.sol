/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;


interface IAkwaPoolFactory {
    function getAkwaPool(address baseToken, address quoteToken) external view returns (address);
}

