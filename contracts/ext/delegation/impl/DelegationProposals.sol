// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../proposals/HardCabledInfo.sol";
import "../../../ethereans/proposals/EthereansSubDAO.sol";
import "../../delegationsManager/model/IDelegationsManager.sol";
import "@ethereansos/swissknife/contracts/factory/model/IFactory.sol";
import "../../../base/model/IProposalsManager.sol";
import "../../../base/model/ITreasuryManager.sol";
import "../../../core/model/IOrganization.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import { Uint256Utilities, AddressUtilities, TransferUtilities, Bytes32Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "../../../ext/subDAO/model/ISubDAO.sol";
import { Getters as ExternalGetters, DelegationUtilities } from "../../../ext/lib/KnowledgeBase.sol";
import "../../../ethereans/factories/model/IDelegationFactory.sol";

contract DelegationsManagerAttacherProposal is LazyInitCapableHardCabledInfo {
    using AddressUtilities for address;

    address public delegationsManagerAddress;

    string public additionalUri;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {
        (additionalUri, delegationsManagerAddress) = abi.decode(lazyInitData, (string, address));

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        IOrganization organization = IOrganization(ILazyInitCapableElement(msg.sender).host());
        organization.submit(delegationsManagerAddress, abi.encodeWithSignature("set()"), address(0));
    }
}

contract DelegationTransferManagerProposal is TransferManagerProposal {

    constructor(bytes32[] memory strings, bytes memory lazyInitData) TransferManagerProposal(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {

        lazyInitResponseData = super._lazyInit(lazyInitData);

        require(ILazyInitCapableElement(treasuryManagerAddress).host() == msg.sender, "Wrong Treasury Manager");

        lazyInitResponseData = DelegationUtilities.extractVotingTokens(ILazyInitCapableElement(treasuryManagerAddress).initializer(), msg.sender);
    }
}

contract VoteProposal is LazyInitCapableHardCabledInfo {
    using Getters for IOrganization;
    using ExternalGetters for IOrganization;
    using Uint256Utilities for uint256;
    using TransferUtilities for address;
    using Bytes32Utilities for bytes32;

    address public proposalsManagerAddress;
    bytes32 public organizationProposalID;
    address public collectionAddress;
    uint256 public objectId;
    uint256 public accept;
    uint256 public refuse;
    bool public vote;
    bool public afterTermination;

    bool public _voting;

    string public additionalUri;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {

        _lazyInit1(lazyInitData);

        lazyInitResponseData = DelegationUtilities.extractVotingTokens(address(IOrganization(ILazyInitCapableElement(proposalsManagerAddress).host()).delegationsManager()), msg.sender);
    }

    function _lazyInit1(bytes memory lazyInitResponseData) private {
        (proposalsManagerAddress, organizationProposalID, collectionAddress, lazyInitResponseData) = abi.decode(lazyInitResponseData, (address, bytes32, address, bytes));
        _lazyInit2(lazyInitResponseData);
    }

    function _lazyInit2(bytes memory lazyInitResponseData) private {
        (objectId, accept, refuse, vote, afterTermination, additionalUri) = abi.decode(lazyInitResponseData, (uint256, uint256, uint256, bool, bool, string));
    }

    receive() external payable {
        require(_voting, "not voting");
    }

    function execute(bytes32) external {
        ITreasuryManager treasuryManager = IOrganization(ILazyInitCapableElement(msg.sender).host()).treasuryManager();
        return vote ? _vote(treasuryManager) : _withdraw(treasuryManager);
    }

    function _vote(ITreasuryManager treasuryManager) private {
        bool hasERC20 = collectionAddress == address(0);
        ITreasuryManager.TransferEntry[] memory transferEntries = new ITreasuryManager.TransferEntry[](1);
        transferEntries[0] = ITreasuryManager.TransferEntry({
            token : hasERC20 ? address(uint160(objectId)) : collectionAddress,
            objectIds : hasERC20 ? new uint256[](0) : objectId.asSingletonArray(),
            values : (accept + refuse).asSingletonArray(),
            receiver : hasERC20 ? address(this) : proposalsManagerAddress,
            safe : false,
            batch : false,
            withData : false,
            data : hasERC20 ? bytes("") : abi.encode(organizationProposalID, accept, refuse, address(treasuryManager), false)
        });
        _voting = hasERC20;
        treasuryManager.batchTransfer(transferEntries);
        _voting = false;
        IProposalsManager proposalsManager = IProposalsManager(proposalsManagerAddress);
        if(hasERC20) {
            address erc20TokenAddress = address(uint160(objectId));
            if(erc20TokenAddress != address(0)) {
                erc20TokenAddress.safeApprove(proposalsManagerAddress, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
            }
            proposalsManager.vote{value : erc20TokenAddress != address(0) ? 0 : (accept + refuse)}(erc20TokenAddress, "", organizationProposalID, accept, refuse, address(treasuryManager), false);
        }
    }

    function _withdraw(ITreasuryManager treasuryManager) private {
        treasuryManager.submit(proposalsManagerAddress, abi.encodeWithSelector(IProposalsManager(proposalsManagerAddress).withdrawAll.selector, organizationProposalID.asSingletonArray(), address(treasuryManager), afterTermination), address(treasuryManager));
    }
}

interface IDelegationRulesChanger {

    function createNewRules(
        address delegationAddress,
        uint256 quorum,
        uint256 validationBomb,
        uint256 votePeriod,
        uint256 hardCap) external returns (address[] memory validationAddresses, bytes[] memory validationData, address[] memory canTerminateAddresses, bytes[] memory canTerminateData);
}

contract DelegationChangeRulesProposal is LazyInitCapableHardCabledInfo {
    uint256 public quorum;

    uint256 public validationBomb;

    uint256 public votePeriod;

    uint256 public hardCap;

    string public additionalUri;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) LazyInitCapableHardCabledInfo(strings, lazyInitData) {}

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponseData) {

        (additionalUri, quorum, validationBomb, votePeriod, hardCap) = abi.decode(lazyInitData, (string, uint256, uint256, uint256, uint256));

        require(votePeriod > 0 || hardCap > 0, "No termination rules");

        lazyInitResponseData = "";
    }

    function execute(bytes32) external {
        ISubDAO subDAO = ISubDAO(ILazyInitCapableElement(msg.sender).host());

        (address[] memory validators, bytes[] memory validationData, address[] memory canTerminates, bytes[] memory canTerminateData) = IDelegationRulesChanger(subDAO.initializer()).createNewRules(address(subDAO), quorum, validationBomb, votePeriod, hardCap);

        ISubDAO.SubDAOProposalModel[] memory proposalModels = subDAO.proposalModels();

        ISubDAO.SubDAOProposalModel memory prop = proposalModels[proposalModels.length - 2];
        prop.validatorsAddresses[0] = validators;
        prop.validatorsData[0] = validationData;
        prop.canTerminateAddresses[0] = canTerminates;
        prop.canTerminateData[0] = canTerminateData;
        proposalModels[proposalModels.length - 2] = prop;

        prop = proposalModels[proposalModels.length - 1];
        prop.validatorsAddresses[0] = validators;
        prop.validatorsData[0] = validationData;
        prop.canTerminateAddresses[0] = canTerminates;
        prop.canTerminateData[0] = canTerminateData;
        proposalModels[proposalModels.length - 1] = prop;

        subDAO.setProposalModels(proposalModels);
    }
}