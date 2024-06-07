// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";
import "@ethereansos/covenants-core/contracts/fixed-inflation/FixedInflationData.sol";

interface ICovenantsRoutinesManager is ILazyInitCapableElement {

    function init(address host) external;

    function data() external view returns(address fixedInflationContract, address host);

    function receiveTokens(address[] memory tokenAddresses, uint256[] memory transferAmounts, uint256[] memory amountsToMint) external;

    function flushBack(address[] memory tokenAddresses) external;

    function deactivationByFailure() external;

    function setEntry(FixedInflationEntry memory entryData, FixedInflationOperation[] memory operations) external;

    function active() external view returns(bool);

    function setActive(bool _active) external;

    function burnToken(address erc20TokenAddress, uint256 value) external;
}