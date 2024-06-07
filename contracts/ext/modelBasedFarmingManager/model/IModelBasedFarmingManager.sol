// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";
import "../../util/IFarmingExtensionRegular.sol";

interface IModelBasedFarmingManager is ILazyInitCapableElement, IFarmingExtensionRegular {

    function executorRewardPercentage() external view returns(uint256);

    function setExecutorRewardPercentage(uint256 newValue) external returns(uint256 oldValue);

    function reservedBalance() external view returns (uint256);

    function lastRebalanceEvent() external view returns (uint256);

    function rebalanceInterval() external view returns (uint256);

    function nextRebalanceEvent() external view returns (uint256);

    function models() external view returns(FarmingSetupInfo[] memory farmingSetups, uint256[] memory rebalancePercentages);

    function flushBackToTreasury(address[] calldata tokenAddresses) external;

    function rebalanceRewardsPerEvent(address executorRewardReceiver) external;
}