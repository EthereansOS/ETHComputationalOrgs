// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../delegationsManager/model/IDelegationsManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "@ethereansos/swissknife/contracts/factory/model/IFactory.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { BehaviorUtilities, ReflectionUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "../../../core/model/IOrganization.sol";
import "@ethereansos/items-v2/contracts/model/Item.sol";
import "../../../core/model/IOrganization.sol";
import "../../delegation/model/IDelegationTokensManager.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import { DelegationGetters } from "../../lib/KnowledgeBase.sol";

contract DelegationsManager is IDelegationsManager, LazyInitCapableElement {
    using ReflectionUtilities for address;
    using Getters for IOrganization;
    using DelegationGetters for IOrganization;

    uint256 private constant ONE_HUNDRED = 1e18;

    address private _collection;
    uint256 private _objectId;

    address private _treasuryManagerModelAddress;

    mapping(address => address) public override treasuryOf;
    mapping(uint256 => DelegationData) private _storage;
    mapping(address => uint256) private _index;
    uint256 public override size;

    uint256 public override maxSize;

    uint256 public override executorRewardPercentage;

    mapping(address => bool) public override factoryIsAllowed;
    mapping(address => bool) public override isDisallowed;

    bytes32 public flusherKey;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns (bytes memory lazyInitResponse) {

        (maxSize, _treasuryManagerModelAddress, lazyInitResponse) = abi.decode(lazyInitData, (uint256, address, bytes));

        (flusherKey, executorRewardPercentage, _collection, _objectId, lazyInitResponse) = abi.decode(lazyInitResponse, (bytes32, uint256, address, uint256, bytes));

        if(lazyInitResponse.length > 0) {
            (address[] memory allowedFactories, address[] memory disallowedDelegations) = abi.decode(lazyInitResponse, (address[], address[]));

            for(uint256 i = 0; i < allowedFactories.length; i++) {
                factoryIsAllowed[allowedFactories[i]] = true;
            }
            for(uint256 i = 0; i < disallowedDelegations.length; i++) {
                isDisallowed[disallowedDelegations[i]] = true;
            }
        }
        lazyInitResponse = "";
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IDelegationsManager).interfaceId ||
            interfaceId == this.split.selector ||
            interfaceId == this.supportedToken.selector ||
            interfaceId == this.setSupportedToken.selector ||
            interfaceId == this.maxSize.selector ||
            interfaceId == this.setMaxSize.selector ||
            interfaceId == this.size.selector ||
            interfaceId == this.list.selector ||
            interfaceId == this.partialList.selector ||
            interfaceId == this.listByAddresses.selector ||
            interfaceId == this.listByIndices.selector ||
            interfaceId == this.exists.selector ||
            interfaceId == this.treasuryOf.selector ||
            interfaceId == this.get.selector ||
            interfaceId == this.getByIndex.selector ||
            interfaceId == this.set.selector ||
            interfaceId == this.remove.selector ||
            interfaceId == this.removeByIndices.selector ||
            interfaceId == this.executorRewardPercentage.selector ||
            interfaceId == this.getSplit.selector ||
            interfaceId == this.factoryIsAllowed.selector ||
            interfaceId == this.setFactoriesAllowed.selector ||
            interfaceId == this.isDisallowed.selector ||
            interfaceId == this.setDisallowed.selector ||
            interfaceId == this.isValid.selector;
    }

    receive() external payable {
    }

    function supportedToken() external override view returns(address, uint256) {
        return (_collection, _objectId);
    }

    function setSupportedToken(address collection, uint256 objectId) external override authorizedOnly {
        _collection = collection;
        _objectId = objectId;
    }

    function setMaxSize(uint256 newValue) external override authorizedOnly returns(uint256 oldValue) {
        oldValue = maxSize;
        maxSize = newValue;
    }

    function list() override public view returns (DelegationData[] memory) {
        return partialList(0, size);
    }

    function partialList(uint256 start, uint256 offset) override public view returns (DelegationData[] memory delegations) {
        (uint256 projectedArraySize, uint256 projectedArrayLoopUpperBound) = BehaviorUtilities.calculateProjectedArraySizeAndLoopUpperBound(size, start, offset);
        if(projectedArraySize > 0) {
            delegations = new DelegationData[](projectedArraySize);
            uint256 cursor = 0;
            for(uint256 i = start; i < projectedArrayLoopUpperBound; i++) {
                delegations[cursor++] = _storage[i];
            }
        }
    }

    function listByAddresses(address[] calldata delegationAddresses) override external view returns (DelegationData[] memory delegations) {
        delegations = new DelegationData[](delegationAddresses.length);
        for(uint256 i = 0; i < delegations.length; i++) {
            delegations[i] = _storage[_index[delegationAddresses[i]]];
        }
    }

    function listByIndices(uint256[] memory indices) override public view returns (DelegationData[] memory delegations) {
        delegations = new DelegationData[](indices.length);
        for(uint256 i = 0; i < delegations.length; i++) {
            delegations[i] = _storage[indices[i]];
        }
    }

    function exists(address delegationAddress) public override view returns(bool result, uint256 index, address treasuryAddress) {
        treasuryAddress = treasuryOf[delegationAddress];
        result = delegationAddress != address(0) && _storage[index = _index[delegationAddress]].location == delegationAddress;
    }

    function get(address delegationAddress) external override view returns(DelegationData memory) {
        return _storage[_index[delegationAddress]];
    }

    function getByIndex(uint256 index) override external view returns(DelegationData memory) {
        return _storage[index];
    }

    function split(address executorRewardReceiver) external override {
        require(address(this).balance > 0, "No ETH");
        (address[] memory receivers, uint256[] memory values) = getSplit(executorRewardReceiver);
        if(receivers.length == 0) {
            return;
        }
        for(uint256 i = 0; i < receivers.length; i++) {
            if(values[i] == 0) {
                continue;
            }
            receivers[i].submit(values[i], "");
        }
    }

    function set(address[] calldata delegationAddresses) external authorizedOnly override {
        for(uint256 i = 0; i < delegationAddresses.length; i++) {
            _set(delegationAddresses[i]);
        }
    }

    function remove(address[] calldata delegationAddresses) external override authorizedOnly returns(DelegationData[] memory removedDelegations) {
        removedDelegations = new DelegationData[](delegationAddresses.length);
        for(uint256 i = 0; i < delegationAddresses.length; i++) {
            removedDelegations[i] = _remove(delegationAddresses[i]);
        }
    }

    function removeByIndices(uint256[] calldata indices) external override authorizedOnly returns(DelegationData[] memory removedDelegations) {
        removedDelegations = new DelegationData[](indices.length);
        for(uint256 i = 0; i < indices.length; i++) {
            removedDelegations[i] = _remove(indices[i]);
        }
    }

    function setFactoriesAllowed(address[] memory factoryAddresses, bool[] memory allowed) external override authorizedOnly {
        for(uint256 i = 0; i < factoryAddresses.length; i++) {
            emit Factory(factoryAddresses[i], factoryIsAllowed[factoryAddresses[i]] = allowed[i]);
        }
    }

    function setDisallowed(address[] memory productAddresses, bool[] memory disallowed) external override authorizedOnly {
        for(uint256 i = 0; i < productAddresses.length; i++) {
            isDisallowed[productAddresses[i]] = disallowed[i];
        }
    }

    function isValid(address delegationAddress, address) public override view returns(bool) {
        if(isDisallowed[delegationAddress]) {
            return false;
        }
        IFactory factory = IFactory(ILazyInitCapableElement(delegationAddress).initializer());
        if(!factoryIsAllowed[address(factory)]) {
            return false;
        }
        if(factory.deployer(delegationAddress) == address(0)) {
            return false;
        }
        return true;
    }

    function getSplit(address executorRewardReceiver) public override view returns (address[] memory receivers, uint256[] memory values) {

        (address[] memory treasuries, uint256[] memory treasuryPercentages) = getSituation();

        receivers = new address[](treasuries.length + (executorRewardPercentage == 0 ? 1 : 2));
        values = new uint256[](receivers.length);

        uint256 availableAmount = address(this).balance;
        uint256 index = 0;

        if(executorRewardPercentage > 0) {
            receivers[index] = executorRewardReceiver != address(0) ? executorRewardReceiver : msg.sender;
            values[index] = _calculatePercentage(availableAmount, executorRewardPercentage);
            availableAmount -= values[index++];
        }

        uint256 remainingAmount = availableAmount;

        for(uint256 i = 0; i < treasuries.length; i++) {
            receivers[index] = treasuries[i];
            values[index] = _calculatePercentage(availableAmount, treasuryPercentages[i]);
            remainingAmount -= values[index++];
        }

        receivers[index] = _flusher();
        values[index] = remainingAmount;
    }

    function getSituation() public override view returns(address[] memory treasuries, uint256[] memory treasuryPercentages) {
        IDelegationsManager.DelegationData[] memory delegations = list();
        uint256 totalSupply;
        uint256[] memory totalSupplyArray = new uint256[](delegations.length);
        treasuries = new address[](delegations.length);
        for(uint256 i = 0; i < delegations.length; i++) {
            totalSupplyArray[i] = _getDelegationTotalSupply(delegations[i].location);
            totalSupply += totalSupplyArray[i];
            treasuries[i] = delegations[i].treasury;
        }
        treasuryPercentages = new uint256[](delegations.length);
        for(uint256 i = 0; i < treasuryPercentages.length; i++) {
            treasuryPercentages[i] = _retrievePercentage(totalSupplyArray[i], totalSupply);
        }
    }

    function _set(address delegationAddress) private {
        require(maxSize == 0 || size < maxSize, "full");
        (bool result,,) = exists(delegationAddress);
        require(!result, "exists");
        require(isValid(delegationAddress, msg.sender), "not valid");
        _index[delegationAddress] = size++;
        address treasuryAddress = treasuryOf[delegationAddress];
        if(treasuryAddress == address(0)) {
            ILazyInitCapableElement(treasuryOf[delegationAddress] = treasuryAddress = _treasuryManagerModelAddress.clone()).lazyInit(abi.encode(delegationAddress, bytes("")));
        }
        _storage[_index[delegationAddress]] = DelegationData({
            location : delegationAddress,
            treasury : treasuryAddress
        });
        emit DelegationSet(delegationAddress, treasuryAddress);
    }

    function _remove(address delegationAddress) private returns(DelegationData memory removedDelegation) {
        (bool result, uint256 index,) = exists(delegationAddress);
        removedDelegation = result ? _remove(index) : removedDelegation;
    }

    function _remove(uint256 index) private returns(DelegationData memory removedDelegation) {
        if(index >= size) {
            return removedDelegation;
        }
        delete _index[(removedDelegation = _storage[index]).location];
        if(index != --size) {
            DelegationData memory lastEntry = _storage[size];
            _storage[_index[lastEntry.location] = index] = lastEntry;
        }
    }

    function _subjectIsAuthorizedFor(address subject, address location, bytes4 selector, bytes calldata payload, uint256) internal virtual override view returns (bool, bool) {
        if(location == address(this) && (selector == this.set.selector || selector == this.remove.selector || selector == this.removeByIndices.selector)) {
            bytes memory inputData = payload[4:payload.length];
            if(selector == this.removeByIndices.selector) {
                DelegationData[] memory delegations = listByIndices(abi.decode(inputData, (uint256[])));
                if(delegations.length == 1 && delegations[0].location == subject) {
                    return (true, true);
                }
            } else {
                address[] memory delegationAddresses = abi.decode(inputData, (address[]));
                if(delegationAddresses.length == 1 && delegationAddresses[0] == subject) {
                    return (true, true);
                }
            }
        }
        return (false, false);
    }

    function _getDelegationTotalSupply(address delegationAddress) private view returns(uint256) {
        (address wrappedCollection, uint256 wrappedObjectId) = IOrganization(delegationAddress).tokensManager().wrapped(_collection, _objectId, address(this));
        try Item(wrappedCollection).totalSupply(wrappedObjectId) returns (uint256 ts) {
            return ts;
        } catch {
            return 0;
        }
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns(uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    function _retrievePercentage(uint256 numerator, uint256 denominator) private pure returns(uint256) {
        if(denominator == 0) {
            return 0;
        }
        return (numerator * ONE_HUNDRED) / denominator;
    }

    function _flusher() private view returns (address flusher) {
        IOrganization org = IOrganization(host);
        if(flusherKey != bytes32(0)) {
            flusher = org.get(flusherKey);
        }
        flusher = flusher != address(0) ? flusher : address(org.treasuryManager());
    }
}