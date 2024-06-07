// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";
import "@ethereansos/covenants-core/contracts/presto/IPrestoUniV3.sol";

interface IFixedInflationManager is ILazyInitCapableElement {

    event FixedInflation();

    function ONE_HUNDRED() external pure returns(uint256);

    function swapData() external view returns(address ammPlugin, address[] memory liquidityPoolAddresses, address[] memory swapPath);

    function tokenInfo() external view returns(address erc20tokenAddress, address tokenMinterAddress);

    function updateTokenPercentage(uint256 newValue) external returns(uint256 oldValue);

    function updateInflationData() external;

    function executorRewardPercentage() external view returns(uint256);

    function prestoAddress() external view returns(address prestoAddress);

    function lastTokenTotalSupply() external view returns (uint256);

    function lastTokenTotalSupplyUpdate() external view returns (uint256);

    function lastTokenPercentage() external view returns (uint256);

    function lastDailyInflation() external view returns (uint256);

    function lastExecutionEvent() external view returns (uint256);

    function executionInterval() external view returns (uint256);

    function nextExecutionEvent() external view returns (uint256);

    function rawTokenComponents() external view returns(bytes32[] memory componentKeys, address[] memory components, uint256[] memory percentages);

    function swappedTokenComponents() external view returns(bytes32[] memory componentKeys, address[] memory components, uint256[] memory percentages);

    function bootstrapFund() external view returns(address bootstrapFundWalletOwner, address bootstrapFundWalletAddress, uint256 bootstrapFundWalletPercentage, bool bootstrapFundIsRaw, bytes32 defaultBootstrapFundComponentKey);

    function setBootstrapFund(address bootstrapFundWalletOwner, address bootstrapFundWalletAddress) external returns (address oldBootstrapFundWalletOwner, address oldBootstrapFundWalletAddress);

    function execute(uint256[] calldata minAmounts, address executorRewardReceiver) external returns (uint256 swappedValue, uint256 ethReceived, uint256 executorReward);
}