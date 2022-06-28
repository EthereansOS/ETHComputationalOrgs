// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import { FactoryOfFactories as Original } from "../../../../../ethereans/factoryOfFactories/impl/FactoryOfFactories.sol";

contract FactoryOfFactories is Original {

    uint256 private _feePercentage;
    address private _feeReceiver;
    uint256 private _burnPercentage;

    constructor(bytes memory lazyInitData) Original(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns (bytes memory lazyInitResponse) {
        (_feePercentage, _feeReceiver, _burnPercentage, lazyInitResponse) = abi.decode(lazyInitData, (uint256, address, uint256, bytes));
        return super._lazyInit(lazyInitResponse);
    }

    function _feeInfo() internal override view returns(uint256 feePercentage, address feeReceiver, uint256 burnPercentage) {
        feePercentage = _feePercentage;
        feeReceiver = _feeReceiver;
        burnPercentage = _burnPercentage;
    }

    function _checkAmountBehavior(uint256 amount, string memory errorMessage) internal override returns(bool) {
        return amount > 0;
    }
}