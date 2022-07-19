// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";
import "@ethereansos/covenants-core/contracts/presto/IPrestoUniV3.sol";

interface IInvestmentsManager is ILazyInitCapableElement {

    function ONE_HUNDRED() external pure returns(uint256);

    function refundETHReceiver() external view returns(bytes32 key, address receiverAddress);

    function executorRewardPercentage() external view returns(uint256);

    function prestoAddress() external view returns(address prestoAddress);

    function tokensFromETH() external view returns(PrestoOperation[] memory tokensFromETHOperations);
    function setTokensFromETH(PrestoOperation[] calldata tokensFromETHOperations) external returns(PrestoOperation[] memory oldTokensFromETHOperations);

    function swapFromETH(uint256[] memory minAmounts, address executorRewardReceiver) external returns (uint256[] memory tokenAmounts, uint256 executorReward);

    function lastSwapToETHBlock() external view returns (uint256);

    function swapToETHInterval() external view returns (uint256);

    function nextSwapToETHBlock() external view returns (uint256);

    function tokensToETH() external view returns(PrestoOperation[] memory tokensToETHOperations);
    function setTokensToETH(PrestoOperation[] calldata tokensToETHOperations) external returns(PrestoOperation[] memory oldTokensToETHOperations);

    function swapToETH(uint256[] memory minAmounts, address executorRewardReceiver) external returns (uint256[] memory ETHAmounts, uint256[] memory executorRewards);

    function flushToWallet(address[] calldata tokenAddresses) external returns(uint256[] memory amounts);
}