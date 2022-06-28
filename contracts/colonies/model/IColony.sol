// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";

interface IColony is ILazyInitCapableElement {

    event ColonyTransfer();

    function sendTokens(address[] memory tokenAddresses, uint32[] memory l1GasArray, address _rewardReceiver) external;
}