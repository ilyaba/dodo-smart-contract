/*

    Copyright 2022 Akwa Finance
    SPDX-License-Identifier: Apache-2.0

*/

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import {Ownable} from "./lib/Ownable.sol";
import {IAkwaPool} from "./intf/IAkwaPool.sol";
import {IAkwaPoolFactory} from "./intf/IAkwaPoolFactory.sol";
import {ICloneFactory} from "./helper/CloneFactory.sol";


/**
 * @title AkwaPoolFactory
 * @author DODO Breeder
 *
 * @notice Register of All Akwa
 */
contract AkwaPoolFactory is Ownable, IAkwaPoolFactory {
    address public _AKWA_LOGIC_;
    address public _CLONE_FACTORY_;

    address public _DEFAULT_SUPERVISOR_;

    mapping(address => mapping(address => address)) internal _AKWA_REGISTER_;
    address[] public _AKWAs;

    // ============ Events ============

    event NewAkwaPool(address newAkwaPool, address baseToken, address quoteToken);

    // ============ Constructor Function ============

    constructor(
        address _akwaLogic,
        address _cloneFactory,
        address _defaultSupervisor
    ) public {
        _AKWA_LOGIC_ = _akwaLogic;
        _CLONE_FACTORY_ = _cloneFactory;
        _DEFAULT_SUPERVISOR_ = _defaultSupervisor;
    }

    // ============ Admin Function ============

    function setAKWALogic(address _akwaLogic) external onlyOwner {
        _AKWA_LOGIC_ = _akwaLogic;
    }

    function setCloneFactory(address _cloneFactory) external onlyOwner {
        _CLONE_FACTORY_ = _cloneFactory;
    }

    function setDefaultSupervisor(address _defaultSupervisor) external onlyOwner {
        _DEFAULT_SUPERVISOR_ = _defaultSupervisor;
    }

    function removeAkwaPool(address akwaPool) external onlyOwner {
        address baseToken = IAkwaPool(akwaPool)._BASE_TOKEN_();
        address quoteToken = IAkwaPool(akwaPool)._QUOTE_TOKEN_();
        require(isAkwaPoolRegistered(baseToken, quoteToken), "AKWA_POOL_NOT_REGISTERED");
        _AKWA_REGISTER_[baseToken][quoteToken] = address(0);
        for (uint256 i = 0; i <= _AKWAs.length - 1; i++) {
            if (_AKWAs[i] == akwaPool) {
                _AKWAs[i] = _AKWAs[_AKWAs.length - 1];
                _AKWAs.pop();
                break;
            }
        }
    }

    function addAkwaPool(address akwaPool) public onlyOwner {
        address baseToken = IAkwaPool(akwaPool)._BASE_TOKEN_();
        address quoteToken = IAkwaPool(akwaPool)._QUOTE_TOKEN_();
        require(!isAkwaPoolRegistered(baseToken, quoteToken), "AKWA_POOL_ALREADY_REGISTERED");
        _AKWA_REGISTER_[baseToken][quoteToken] = akwaPool;
        _AKWAs.push(akwaPool);
    }

    // ============ Create Akwa Pool Function ============

    function createNewAkwaPool(
        address maintainer,
        address baseToken,
        address quoteToken,
        address oracle,
        uint256 lpFeeRate,
        uint256 mtFeeRate,
        uint256 k,
        uint256 gasPriceLimit
    ) external onlyOwner returns (address newAkwaPool) {
        require(!isAkwaPoolRegistered(baseToken, quoteToken), "AKWA_POOL_ALREADY_REGISTERED");
        newAkwaPool = ICloneFactory(_CLONE_FACTORY_).clone(_AKWA_LOGIC_);
        IAkwaPool(newAkwaPool).init(
            _OWNER_,
            _DEFAULT_SUPERVISOR_,
            maintainer,
            baseToken,
            quoteToken,
            oracle,
            lpFeeRate,
            mtFeeRate,
            k,
            gasPriceLimit
        );
        addAkwaPool(newAkwaPool);
        emit NewAkwaPool(newAkwaPool, baseToken, quoteToken);(newAkwaPool, baseToken, quoteToken);
        return newAkwaPool;
    }

    // ============ View Functions ============

    function isAkwaPoolRegistered(address baseToken, address quoteToken) public view returns (bool) {
        if (
            _AKWA_REGISTER_[baseToken][quoteToken] == address(0) &&
            _AKWA_REGISTER_[quoteToken][baseToken] == address(0)
        ) {
            return false;
        } else {
            return true;
        }
    }

    function getAkwaPool(address baseToken, address quoteToken) override external view returns (address) {
        return _AKWA_REGISTER_[baseToken][quoteToken];
    }

    function getAllAkwaPools() external view returns (address[] memory) {
        return _AKWAs;
    }
}
