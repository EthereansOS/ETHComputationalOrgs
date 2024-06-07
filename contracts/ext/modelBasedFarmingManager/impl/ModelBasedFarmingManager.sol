// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IModelBasedFarmingManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "@ethereansos/covenants-core/contracts/farming/IFarmMainRegular.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import { TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "../../../core/model/IOrganization.sol";
import "../../../base/model/ITreasuryManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ModelBasedFarmingManager is IModelBasedFarmingManager, LazyInitCapableElement {
    using Getters for IOrganization;
    using TransferUtilities for address;

    uint256 private constant ONE_HUNDRED = 1e18;

    uint256 public override executorRewardPercentage;

    bytes32 private _flushKey;

    FarmingSetupInfo[] private _models;
    uint256[] private _rebalancePercentages;

    address private _farmingContract;

    address private _rewardTokenAddress;

    uint256 public override lastRebalanceEvent;
    uint256 public override rebalanceInterval;

    uint256 public override reservedBalance;

    modifier farmingOnly() {
        require(msg.sender == _farmingContract, "Unauthorized");
        _;
    }

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        uint256 firstRebalanceEvent;
        uint256 _rebalanceInterval;

        FarmingSetupInfo[] memory infoModels;
        (_flushKey, executorRewardPercentage, infoModels, _rebalancePercentages, firstRebalanceEvent, _rebalanceInterval) = abi.decode(lazyInitData, (bytes32, uint256, FarmingSetupInfo[], uint256[], uint256, uint256));

        for(uint256 i = 0; i < infoModels.length; i++) {
            _models.push(infoModels[i]);
        }

        if((rebalanceInterval = _rebalanceInterval) > 0) {
            if(firstRebalanceEvent != 0 && _rebalanceInterval < firstRebalanceEvent) {
                lastRebalanceEvent = firstRebalanceEvent - _rebalanceInterval;
            }
        }
        _rewardTokenAddress = IFarmMainRegular(_farmingContract = msg.sender)._rewardTokenAddress();
        _setModels(_models, _rebalancePercentages);
        return "";
    }

    receive() external payable {
        require (_rewardTokenAddress == address(0));
    }

    function _supportsInterface(bytes4 interfaceId) override internal pure returns(bool) {
        return
            interfaceId == type(IFarmingExtensionRegular).interfaceId ||
            interfaceId == this.init.selector ||
            interfaceId == this.setTreasury.selector ||
            interfaceId == this.data.selector ||
            interfaceId == this.transferTo.selector ||
            interfaceId == this.backToYou.selector ||
            interfaceId == this.setFarmingSetups.selector ||
            interfaceId == type(IModelBasedFarmingManager).interfaceId ||
            interfaceId == this.reservedBalance.selector ||
            interfaceId == this.lastRebalanceEvent.selector ||
            interfaceId == this.rebalanceInterval.selector ||
            interfaceId == this.nextRebalanceEvent.selector ||
            interfaceId == this.models.selector ||
            interfaceId == this.flushBackToTreasury.selector ||
            interfaceId == this.rebalanceRewardsPerEvent.selector;
    }

    function init(bool, address, address) external override {
        revert("Impossibru!");
    }

    function setTreasury(address) external override authorizedOnly {
        revert("Impossibru!");
    }

    function data() view public virtual override returns(address farmingContract, bool byMint, address _host, address treasury, address rewardTokenAddress) {
        return (_farmingContract, false, host, address(IOrganization(host).treasuryManager()), _rewardTokenAddress);
    }

    function transferTo(uint256 amount) external override farmingOnly {
        reservedBalance -= amount;
        _rewardTokenAddress.safeTransfer(_farmingContract, amount);
    }

    function backToYou(uint256 amount) payable external override farmingOnly {
        if(_rewardTokenAddress != address(0)) {
            return _rewardTokenAddress.safeTransferFrom(msg.sender, address(this), amount);
        }
        require(msg.value == amount, "invalid sent amount");
    }

    function setFarmingSetups(FarmingSetupConfiguration[] memory farmingSetups) external override authorizedOnly {
        IFarmMainRegular(_farmingContract).setFarmingSetups(farmingSetups);
    }

    function setExecutorRewardPercentage(uint256 newValue) external override authorizedOnly returns(uint256 oldValue) {
        oldValue = executorRewardPercentage;
        executorRewardPercentage = newValue;
    }

    function nextRebalanceEvent() public override view returns (uint256) {
        return lastRebalanceEvent == 0 || rebalanceInterval == 0 ? 0 : (lastRebalanceEvent + rebalanceInterval);
    }

    function models() external override view returns(FarmingSetupInfo[] memory, uint256[] memory) {
        return (_models, _rebalancePercentages);
    }

    function flushBackToTreasury(address[] calldata tokenAddresses) external override authorizedOnly {
        address to = _flushBackReceiver();
        for(uint256 i = 0; i < tokenAddresses.length; i++) {
            address tokenAddress = tokenAddresses[i];
            uint256 balance = tokenAddress.balanceOf(address(this));
            if(balance > 0) {
                tokenAddress.safeTransfer(to, balance);
            }
        }
    }

    function _flushBackReceiver() private view returns(address to) {
        if(_flushKey != bytes32(0)) {
            to = address(IOrganization(host).get(_flushKey));
        }
        to = to != address(0) ? to : address(IOrganization(host).treasuryManager());
    }

    function rebalanceRewardsPerEvent(address executorRewardReceiver) external override {
        require(block.timestamp >= nextRebalanceEvent(), "Too early BRO");
        lastRebalanceEvent = block.timestamp;

        uint256 actualBalance = _rewardTokenAddress.balanceOf(address(this));

        require(actualBalance > 0, "no balance");

        uint256 balance = actualBalance < reservedBalance ? 0 : actualBalance - reservedBalance;

        require(balance > 0, "No balance!");

        if(executorRewardPercentage > 0) {
            address to = executorRewardReceiver == address(0) ? msg.sender : executorRewardReceiver;
            uint256 executorRewardFee = _calculatePercentage(balance, executorRewardPercentage);
            _rewardTokenAddress.safeTransfer(to, executorRewardFee);
            balance -= executorRewardFee;
        }

        reservedBalance += balance;

        uint256 remainingBalance = balance;
        uint256 currentReward = 0;
        FarmingSetupConfiguration[] memory farmingSetups = new FarmingSetupConfiguration[](_models.length);
        uint256 i;
        for(i = 0; i < _rebalancePercentages.length; i++) {
            require((_models[i].originalRewardPerEvent = (currentReward = _calculatePercentage(balance, _rebalancePercentages[i])) / _models[i].blockDuration) > 0, "zero reward");
            require(currentReward < remainingBalance && currentReward < balance, "overflow");
            remainingBalance -= currentReward;
            farmingSetups[i] = FarmingSetupConfiguration(
                true,
                false,
                0,
                _models[i]
            );
        }
        i = _rebalancePercentages.length;
        _models[i].originalRewardPerEvent = remainingBalance / _models[i].blockDuration;
        farmingSetups[i] = FarmingSetupConfiguration(
            true,
            false,
            0,
            _models[i]
        );
        IFarmMainRegular(_farmingContract).setFarmingSetups(farmingSetups);
    }

    function _setModels(FarmingSetupInfo[] memory farmingSetups, uint256[] memory rebalancePercentages) private returns(FarmingSetupInfo[] memory oldFarmingSetups, uint256[] memory oldRebalancePercentages) {
        require(farmingSetups.length > 0 && (farmingSetups.length - 1) == _rebalancePercentages.length, "Invalid data");
        oldFarmingSetups = _models;
        oldRebalancePercentages = _rebalancePercentages;
        delete _rebalancePercentages;
        delete _models;
        uint256 percentage = 0;
        for(uint256 i = 0; i < rebalancePercentages.length; i++) {
            farmingSetups[i].renewTimes = 0;
            _models.push(farmingSetups[i]);
            percentage += rebalancePercentages[i];
            _rebalancePercentages.push(rebalancePercentages[i]);
        }
        farmingSetups[farmingSetups.length - 1].renewTimes = 0;
        _models.push(farmingSetups[farmingSetups.length - 1]);
        require(percentage < ONE_HUNDRED, "More than one hundred");
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns(uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }
}