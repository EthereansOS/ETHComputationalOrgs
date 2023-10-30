// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../ext/proposals/HardCabledInfo.sol";
import { Grimoire, Getters, State } from "../../base/lib/KnowledgeBase.sol";
import "../../core/model/IOrganization.sol";
import "../../base/model/ITreasuryManager.sol";
import "../../base/model/IStateManager.sol";
import "../../ext/investmentsManager/model/IInvestmentsManager.sol";
import "../../ext/delegationsManager/model/IDelegationsManager.sol";
import { AddressUtilities, TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { ComponentsGrimoire } from "../lib/KnowledgeBase.sol";
import { Getters as ExtGetters } from "../../ext/lib/KnowledgeBase.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract SetComponent is LazyInitCapableHardCabledInfo {

    IOrganization.Component public component;
    bool public changeHost;
    address public newHost;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        IOrganization.Component memory _component;
        (_component, changeHost, newHost) = abi.decode(lazyInitData, (IOrganization.Component, bool, address));

        require(_component.key != bytes32(0), "key");

        component = _component;

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization organization = IOrganization(ILazyInitCapableElement(msg.sender).host());
        if(changeHost) {
            address oldValue = organization.get(component.key);
            if(oldValue != address(0)) {
                ILazyInitCapableElement(oldValue).setHost(newHost);
            }
        }
        organization.set(component);
        organization.set(IOrganization.Component(organization.keyOf(address(this)), address(0), false, false));
    }
}

contract TransferManagerProposal is LazyInitCapableHardCabledInfo {
    using TransferUtilities for address;

    uint256 public constant ONE_HUNDRED = 1e18;

    uint256 public maxPercentagePerToken;

    string public additionalUri;
    address public treasuryManagerAddress;
    ITreasuryManager.TransferEntry[] private _entries;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal virtual override returns(bytes memory lazyInitResponseData) {
        (lazyInitData, lazyInitResponseData) = abi.decode(lazyInitData, (bytes, bytes));
        maxPercentagePerToken = abi.decode(lazyInitData, (uint256));
        maxPercentagePerToken = maxPercentagePerToken == 0 || maxPercentagePerToken > ONE_HUNDRED ? ONE_HUNDRED : maxPercentagePerToken;
        ITreasuryManager.TransferEntry[] memory __entries;
        (additionalUri, treasuryManagerAddress, __entries) = abi.decode(lazyInitResponseData, (string, address, ITreasuryManager.TransferEntry[]));
        require(treasuryManagerAddress != address(0), "zero");
        for(uint256 i = 0; i < __entries.length; i++) {
            _entries.push(__entries[i]);
        }

        lazyInitResponseData = "";
    }

    function entries() external view returns (ITreasuryManager.TransferEntry[] memory) {
        return _entries;
    }

    function execute(bytes32) external {
        (ITreasuryManager.TransferEntry[] memory __entries, address _treasuryManagerAddress) = (_entries, treasuryManagerAddress);
        _ensure(__entries, _treasuryManagerAddress);
        ITreasuryManager(_treasuryManagerAddress).batchTransfer(__entries);
    }

    function _ensure(ITreasuryManager.TransferEntry[] memory __entries, address _treasuryManagerAddress) private {
        _collect(__entries);
        uint256 percentage = maxPercentagePerToken;
        for(uint256 i = 0; i < _tokenAddresses.length; i++) {
            address tokenAddress = _tokenAddresses[i];
            uint256[] memory ids = _ids[tokenAddress];
            uint256[] memory balances;
            if(tokenAddress == address(0)) {
                balances = new uint256[](ids.length);
                for(uint256 z = 0; z < ids.length; z++) {
                    balances[z] = address(uint160(ids[z])).balanceOf(_treasuryManagerAddress);
                }
            } else {
                address[] memory accounts = new address[](ids.length);
                for(uint256 z = 0; z < ids.length; z++) {
                    accounts[z] = _treasuryManagerAddress;
                }
                balances = IERC1155(tokenAddress).balanceOfBatch(accounts, ids);
            }
            for(uint256 z = 0; z < ids.length; z++) {
                uint256 id = ids[z];
                uint256 balance = balances[z];
                uint256 value = _amounts[tokenAddress][id];
                require(balance > 0, "balance");
                require(value <= balance, "value");
                uint256 valueInPercentage = _calculatePercentage(balance, percentage);
                require(valueInPercentage == 0 || value <= valueInPercentage, "percentage");
                delete _amounts[tokenAddress][id];
            }
            delete _ids[tokenAddress];
        }
        delete _tokenAddresses;
    }

    address[] private _tokenAddresses;
    mapping(address => uint256[]) private _ids;
    mapping(address => mapping(uint256 => uint256)) private _amounts;

    function _collect(ITreasuryManager.TransferEntry[] memory __entries) private {
        for(uint256 i = 0; i < __entries.length; i++) {
            ITreasuryManager.TransferEntry memory transferEntry = __entries[i];
            if(transferEntry.values.length == 0) {
                continue;
            }
            address tokenAddress = transferEntry.token;
            for(uint256 z = 0; z < transferEntry.objectIds.length; z++) {
                uint256 value = transferEntry.values[z];
                if(value == 0) {
                    continue;
                }
                uint256 objectId = transferEntry.objectIds[z];
                if(_ids[tokenAddress].length == 0) {
                    _tokenAddresses.push(tokenAddress);
                }
                if(_amounts[tokenAddress][objectId] == 0) {
                    _ids[tokenAddress].push(objectId);
                }
                _amounts[tokenAddress][objectId] += value;
            }
        }
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns (uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }
}

contract DelectionsManagerSetAttachInsuranceProposal is LazyInitCapableHardCabledInfo {
    using ExtGetters for IOrganization;

    uint256 public value;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        value = abi.decode(lazyInitData, (uint256));
        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).delegationsManager().setAttachInsurance(value);
    }
}

contract DelegationsManagerDetacherProposal is LazyInitCapableHardCabledInfo {
    using AddressUtilities for address;

    string public additionalUri;
    address public delegationsManagerAddress;
    address public involvedDelegation;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        (additionalUri, delegationsManagerAddress, involvedDelegation) = abi.decode(lazyInitData, (string, address, address));
        require(delegationsManagerAddress != address(0), "zero");
        require(involvedDelegation != address(0), "zero");

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IDelegationsManager(delegationsManagerAddress).remove(involvedDelegation.asSingletonArray());
    }
}

//--- SUBDAO ---

contract SetUint256Proposal is LazyInitCapableHardCabledInfo {
    using Getters for IOrganization;
    using State for IStateManager;

    string public name;
    uint256 public value;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        (name, value) = abi.decode(lazyInitData, (string, uint256));
        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).stateManager().setUint256(name, value);
    }
}

contract FixedInflationManagerChangeDailyInflationPercentage is LazyInitCapableHardCabledInfo {
    using ExtGetters for IOrganization;

    uint256 public value;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        value = abi.decode(lazyInitData, (uint256));
        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).fixedInflationManager().updateTokenPercentage(value);
    }
}

contract ChangeInvestmentsManagerTokensFromETHList is LazyInitCapableHardCabledInfo {
    using ExtGetters for IOrganization;

    PrestoOperation[] private _operations;

    string public additionalUri;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        (lazyInitData, lazyInitResponseData) = abi.decode(lazyInitData, (bytes, bytes));

        uint256 maxTokens = abi.decode(lazyInitData, (uint256));

        PrestoOperation[] memory operationsArray;
        (additionalUri, operationsArray) = abi.decode(lazyInitData, (string, PrestoOperation[]));

        require(operationsArray.length == maxTokens, "length");
        for(uint256 i = 0; i < operationsArray.length; i++) {
            PrestoOperation memory operation = operationsArray[i];
            require(operation.ammPlugin != address(0), "AMM");
            require(operation.swapPath[operation.swapPath.length - 1] != address(0), "zero");
            _operations.push(operation);
        }

        lazyInitResponseData = "";
    }

    function operations() external view returns (PrestoOperation[] memory) {
        return _operations;
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).investmentsManager().setTokensFromETH(_operations);
    }
}

contract ChangeInvestmentsManagerTokensToETHList is LazyInitCapableHardCabledInfo {
    using ExtGetters for IOrganization;

    uint256 public constant ONE_HUNDRED = 1e18;

    string public additionalUri;
    PrestoOperation[] private _operations;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        (lazyInitData, lazyInitResponseData) = abi.decode(lazyInitData, (bytes, bytes));

        (uint256 maxTokens, uint256 maxPercentagePerToken) = abi.decode(lazyInitData, (uint256, uint256));
        maxPercentagePerToken = maxPercentagePerToken == 0 || maxPercentagePerToken > ONE_HUNDRED ? ONE_HUNDRED : maxPercentagePerToken;

        PrestoOperation[] memory operationsArray;
        (additionalUri, operationsArray) = abi.decode(lazyInitData, (string, PrestoOperation[]));

        require(operationsArray.length == maxTokens, "length");
        for(uint256 i = 0; i < operationsArray.length - 1; i++) {
            PrestoOperation memory operation = operationsArray[i];
            require(operation.ammPlugin != address(0), "AMM");
            require(operation.inputTokenAddress != address(0), "zero");
            require(operation.inputTokenAmount > 0 && operation.inputTokenAmount <= maxPercentagePerToken, "oob");
            _operations.push(operation);
        }

        lazyInitResponseData = "";
    }

    function operations() external view returns (PrestoOperation[] memory) {
        return _operations;
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).investmentsManager().setTokensToETH(_operations);
    }
}