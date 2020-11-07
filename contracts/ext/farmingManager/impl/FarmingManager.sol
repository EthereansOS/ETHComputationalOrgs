// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IFarmingManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "@ethereansos/covenants/contracts/farming/IFarmMainRegular.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import { TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "../../../core/model/IOrganization.sol";
import "../../../base/model/ITreasuryManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FarmingManager is IFarmingManager, LazyInitCapableElement {
    using Getters for IOrganization;
    using TransferUtilities for address;

    address private _farmingContract;

    address private _rewardTokenAddress;

    modifier farmingOnly() {
        require(msg.sender == _farmingContract, "Unauthorized");
        _;
    }

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory) internal override returns(bytes memory) {
        _rewardTokenAddress = IFarmMainRegular(_farmingContract = msg.sender)._rewardTokenAddress();
        return "";
    }

    function _supportsInterface(bytes4 interfaceId) override internal pure returns(bool) {
        return
            interfaceId == type(IFarmingExtensionRegular).interfaceId ||
            interfaceId == this.init.selector ||
            interfaceId == this.setTreasury.selector ||
            interfaceId == this.data.selector ||
            interfaceId == this.transferTo.selector ||
            interfaceId == this.backToYou.selector ||
            interfaceId == this.setFarmingSetups.selector;
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
        IOrganization(host).treasuryManager().transfer(_rewardTokenAddress, amount, _farmingContract, 0, 0, false, false, "");
    }

    function backToYou(uint256 amount) payable external override farmingOnly {
        require(_rewardTokenAddress != address(0) || msg.value == amount, "invalid sent amount");
        return _rewardTokenAddress.safeTransferFrom(_rewardTokenAddress == address(0) ? address(this) : msg.sender, address(IOrganization(host).treasuryManager()), amount);
    }

    function setFarmingSetups(FarmingSetupConfiguration[] memory farmingSetups) external override authorizedOnly {
        IFarmMainRegular(_farmingContract).setFarmingSetups(farmingSetups);
    }
}