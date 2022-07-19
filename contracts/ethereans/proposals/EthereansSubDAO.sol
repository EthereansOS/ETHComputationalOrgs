// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import { Grimoire, Getters, State } from "../../base/lib/KnowledgeBase.sol";
import "../../core/model/IOrganization.sol";
import "../../base/model/ITreasuryManager.sol";
import "../../base/model/IStateManager.sol";
import "../osFixedInflationManager/model/IOSFixedInflationManager.sol";
import "../../ext/investmentsManager/model/IInvestmentsManager.sol";
import "../../ext/delegationsManager/model/IDelegationsManager.sol";
import { AddressUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { ComponentsGrimoire } from "../lib/KnowledgeBase.sol";
import { Getters as ExtGetters } from "../../ext/lib/KnowledgeBase.sol";

contract SetComponent {

    string public uri;

    IOrganization.Component public component;
    bool public changeHost;
    address public newHost;

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        IOrganization.Component memory _component;
        (_component, changeHost, newHost) = abi.decode(lazyInitResponseData, (IOrganization.Component, bool, address));

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

contract TransferManagerProposal {
    string public uri;
    address public treasuryManagerAddress;
    ITreasuryManager.TransferEntry[] public entries;

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        ITreasuryManager.TransferEntry[] memory _entries;
        (treasuryManagerAddress, _entries) = abi.decode(lazyInitResponseData, (address, ITreasuryManager.TransferEntry[]));
        require(treasuryManagerAddress != address(0), "zero");
        for(uint256 i = 0; i < _entries.length; i++) {
            entries.push(_entries[i]);
        }

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        ITreasuryManager(treasuryManagerAddress).batchTransfer(entries);
    }
}

contract DelegationsManagerDetacherProposal {
    using AddressUtilities for address;

    string public uri;
    address public delegationsManagerAddress;
    address public involvedDelegation;

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        (delegationsManagerAddress, involvedDelegation) = abi.decode(lazyInitResponseData, (address, address));
        require(delegationsManagerAddress != address(0), "zero");
        require(involvedDelegation != address(0), "zero");

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IDelegationsManager delegationsManager = IDelegationsManager(delegationsManagerAddress);
        delegationsManager.remove(involvedDelegation.asSingletonArray());
    }
}

//--- SUBDAO ---

contract SetUint256Proposal {
    using Getters for IOrganization;
    using State for IStateManager;

    string public constant LABEL = 'setUint256';

    string public uri;
    string public name;
    uint256 public value;

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        (name, value) = abi.decode(lazyInitResponseData, (string, uint256));

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).stateManager().setUint256(name, value);
    }
}

contract OSFixedInflationManagerChangeDailyInflationPercentage {

    string public constant LABEL = 'changeOSInflationRate';

    string public uri;
    uint256 public value;

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        value = abi.decode(lazyInitResponseData, (uint256));

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        address fixedInflationManagerAddress = IOrganization(ILazyInitCapableElement(msg.sender).host()).get(ComponentsGrimoire.COMPONENT_KEY_TOKEN_MINTER_AUTH);
        IOSFixedInflationManager(fixedInflationManagerAddress).updateTokenPercentage(value);
    }
}

contract ChangeInvestmentsManagerFourTokensFromETHList {
    using ExtGetters for IOrganization;

    string public constant LABEL = 'changeTokensBuy';

    string public uri;
    PrestoOperation[] private _operations;

    string public additionalUri;

    function operations() external view returns (PrestoOperation[] memory) {
        return _operations;
    }

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        PrestoOperation[] memory operationsArray;
        (additionalUri, operationsArray) = abi.decode(lazyInitResponseData, (string, PrestoOperation[]));

        require(operationsArray.length == 4, "length");
        for(uint256 i = 0; i < operationsArray.length; i++) {
            PrestoOperation memory operation = operationsArray[i];
            require(operation.ammPlugin != address(0), "AMM");
            require(operation.swapPath[operation.swapPath.length - 1] != address(0), "zero");
            require(operation.receivers.length > 0, "swap");
            _operations.push(operation);
        }

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IInvestmentsManager investmentsManager = IOrganization(ILazyInitCapableElement(msg.sender).host()).investmentsManager();
        _operations.push(investmentsManager.tokensFromETH()[4]);
        investmentsManager.setTokensFromETH(_operations);
    }
}

contract ChangeInvestmentsManagerFiveTokensToETHList {
    using ExtGetters for IOrganization;

    string public constant LABEL = 'changeTokensSell';

    uint256 public constant MAX_PERCENTAGE_PER_TOKEN = 50000000000000000;

    string public uri;
    PrestoOperation[] private _operations;

    string public additionalUri;

    function operations() external view returns (PrestoOperation[] memory) {
        return _operations;
    }

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        require(keccak256(bytes(uri)) == keccak256(""));
        (uri, lazyInitResponseData) = abi.decode(lazyInitData, (string, bytes));
        require(keccak256(bytes(uri)) != keccak256(""));

        PrestoOperation[] memory operationsArray;
        (additionalUri, operationsArray) = abi.decode(lazyInitResponseData, (string, PrestoOperation[]));

        require(operationsArray.length == 5, "length");

        for(uint256 i = 0; i < operationsArray.length - 1; i++) {
            PrestoOperation memory operation = operationsArray[i];
            require(operation.ammPlugin != address(0), "AMM");
            require(operation.inputTokenAddress != address(0), "zero");
            require(operation.inputTokenAmount > 0 && operation.inputTokenAmount <= MAX_PERCENTAGE_PER_TOKEN, "oob");
            _operations.push(operation);
        }

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization(ILazyInitCapableElement(msg.sender).host()).investmentsManager().setTokensToETH(_operations);
    }
}