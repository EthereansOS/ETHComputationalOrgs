// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";
import "@ethereansos/covenants-core/contracts/presto/IPrestoUniV3.sol";

interface IOSFixedInflationManager is ILazyInitCapableElement {

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

    function lastInflationPerDay() external view returns (uint256);

    function lastSwapToETHEvent() external view returns (uint256);

    function swapToETHInterval() external view returns (uint256);

    function nextSwapToETHEvent() external view returns (uint256);

    function tokenReceiverPercentage() external view returns(uint256);

    function destination() external view returns(address destinationWalletOwner, address destinationWalletAddress, uint256 destinationWalletPercentage);

    function setDestination(address destinationWalletOwner, address destinationWalletAddress) external returns (address oldDestinationWalletOwner, address oldDestinationWalletAddress);

    function swapToETH(uint256 minAmount, address executorRewardReceiver) external returns (uint256 executorReward, uint256 destinationAmount, uint256 treasurySplitterAmount);
}