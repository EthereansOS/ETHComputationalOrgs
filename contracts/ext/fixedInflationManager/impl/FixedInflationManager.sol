// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IFixedInflationManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "@ethereansos/covenants/contracts/fixed-inflation/IFixedInflation.sol";
import "@ethereansos/covenants/contracts/fixed-inflation/util/IERC20Mintable.sol";
import "@ethereansos/covenants/contracts/fixed-inflation/util/IERC20Burnable.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import { TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "../../../core/model/IOrganization.sol";
import "@ethereansos/covenants/contracts/fixed-inflation/IFixedInflationExtension.sol";

contract FixedInflationManager is IFixedInflationManager, LazyInitCapableElement {
    using Getters for IOrganization;
    using TransferUtilities for address;

    address private _fixedInflationContract;

    bool public override active;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory) internal override virtual returns (bytes memory) {
        _fixedInflationContract = msg.sender;
        return "";
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IFixedInflationExtension).interfaceId ||
            interfaceId == type(IFixedInflationManager).interfaceId ||
            interfaceId == this.init.selector ||
            interfaceId == this.data.selector ||
            interfaceId == this.receiveTokens.selector ||
            interfaceId == this.flushBack.selector ||
            interfaceId == this.deactivationByFailure.selector ||
            interfaceId == this.setEntry.selector ||
            interfaceId == this.active.selector ||
            interfaceId == this.setActive.selector ||
            interfaceId == this.burnToken.selector;
    }

    function init(address) external override {
        revert("Impossibru!");
    }

    function data() external override view returns(address fixedInflationContract, address) {
        fixedInflationContract = _fixedInflationContract;
    }

    modifier fixedInflationOnly() {
        require(_fixedInflationContract == msg.sender, "Unauthorized");
        _;
    }

    function setActive(bool _active) public override virtual authorizedOnly {
        active = _active;
    }

    function receiveTokens(address[] memory tokenAddresses, uint256[] memory transferAmounts, uint256[] memory amountsToMint) public override fixedInflationOnly {
        for(uint256 i = 0; i < tokenAddresses.length; i++) {
            if(transferAmounts[i] > 0) {
                IOrganization(host).treasuryManager().transfer(tokenAddresses[i], transferAmounts[i], msg.sender, 0, 0, false, false, "");
            }
            if(amountsToMint[i] > 0) {
                _mintAndTransfer(tokenAddresses[i], msg.sender, amountsToMint[i]);
            }
        }
    }

    function setEntry(FixedInflationEntry memory newEntry, FixedInflationOperation[] memory newOperations) public override authorizedOnly {
        IFixedInflation(_fixedInflationContract).setEntry(newEntry, newOperations);
    }

    function flushBack(address[] memory tokenAddresses) public override authorizedOnly {
        IFixedInflation(_fixedInflationContract).flushBack(tokenAddresses);
    }

    function deactivationByFailure() public override fixedInflationOnly {
        active = false;
    }

    function burnToken(address erc20TokenAddress, uint256 value) external override fixedInflationOnly {
        erc20TokenAddress.safeTransferFrom(_fixedInflationContract, address(this), value);
        _burn(erc20TokenAddress, value);
    }

    /** INTERNAL OVERRIDABLE METHODS */

    function _mintAndTransfer(address erc20TokenAddress, address recipient, uint256 value) internal virtual {
        IERC20Mintable(erc20TokenAddress).mint(recipient, value);
    }

    function _burn(address erc20TokenAddress, uint256 value) internal virtual {
        IERC20Burnable(erc20TokenAddress).burn(value);
    }
}