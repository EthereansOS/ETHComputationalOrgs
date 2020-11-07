// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IPollMaker.sol";
import "../../subDAO/impl/SubDAO.sol";
import "../../../base/model/IProposalsManager.sol";
import { AddressUtilities, ReflectionUtilities, Bytes32Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { Grimoire, Getters } from "../../../base/lib/KnowledgeBase.sol";

contract PollMaker is IPollMaker, SubDAO {
    using ReflectionUtilities for address;
    using Getters for IOrganization;
    using Bytes32Utilities for bytes32;
    using AddressUtilities for address;

    mapping(bytes32 => bytes) private _pollData;
    mapping(bytes32 => bytes32) private _pollOptions;

    constructor(bytes memory lazyInitData) SubDAO(lazyInitData) {
    }

    function _dynamicMetadataElementLazyInit(bytes memory lazyInitData) internal virtual override returns(bytes memory) {
        _firstProposalSet = true;
        (uint256 localPresetArrayMaxSize, address proposalsManager) = abi.decode(lazyInitData, (uint256, address));
        ILazyInitCapableElement(proposalsManager = proposalsManager.clone()).lazyInit(abi.encode(address(this), abi.encode(true, bytes(""))));
        IOrganization.Component[] memory components = new IOrganization.Component[](1);
        components[0] = IOrganization.Component(Grimoire.COMPONENT_KEY_PROPOSALS_MANAGER, proposalsManager, true, true);
        return super._dynamicMetadataElementLazyInit(abi.encode(false, localPresetArrayMaxSize, abi.encode(new SubDAOProposalModel[](0), abi.encode(components))));
    }

    function _dynamicMetadataElementSupportsInterface(bytes4 interfaceId) internal pure override returns(bool) {
        return
            interfaceId == type(IPollMaker).interfaceId ||
            interfaceId == this.createPoll.selector ||
            super._dynamicMetadataElementSupportsInterface(interfaceId);
    }

    function createPoll(address subject, string memory uri, bytes[] memory values, uint256 duration, address[] memory collectionAddresses, uint256[] memory collectionIds, uint256[] memory weights) external override returns(bytes32[] memory proposalIds) {
        require(values.length > 0 && values.length < presetArrayMaxSize, "Values length");
        require(collectionAddresses.length > 0 && collectionAddresses.length == collectionIds.length && collectionIds.length == weights.length, "voting tokens");
        IProposalsManager.ProposalCodes[] memory proposalCodesArray = new IProposalsManager.ProposalCodes[](values.length);
        for(uint256 i = 0; i < values.length; i++) {
            IProposalsManager.ProposalCode[] memory proposalCodes = new IProposalsManager.ProposalCode[](1);
            proposalCodes[0] = IProposalsManager.ProposalCode(address(0), abi.encode(collectionAddresses, collectionIds, weights));
            proposalCodesArray[i] = IProposalsManager.ProposalCodes(proposalCodes, false);
        }
        proposalIds = IOrganization(this).proposalsManager().batchCreate(proposalCodesArray);
        _pollData[proposalIds[0]] = abi.encode(subject, uri, values, proposalIds, duration);
        for(uint256 i = 0; i < values.length; i++) {
            _pollOptions[proposalIds[i]] = proposalIds[0];
        }
        emit Poll(subject, msg.sender, proposalIds[0]);
    }

    function createProposalCodeSequence(bytes32, IProposalsManager.ProposalCode[] memory codeSequenceInput, address sender) external authorizedOnly override(IExternalProposalsManagerCommands, SubDAO) virtual returns (address[] memory codeSequence, IProposalsManager.ProposalConfiguration memory localConfiguration) {

        require(sender == address(this), "Call createPoll");

        (address[] memory collections, uint256[] memory objectIds, uint256[] memory weights) = abi.decode(codeSequenceInput[0].bytecode, (address[], uint256[], uint256[]));

        require(collections.length > 0 && collections.length == objectIds.length && objectIds.length == weights.length, "voting tokens");

        codeSequence = address(this).asSingletonArray();
        localConfiguration = IProposalsManager.ProposalConfiguration(
            collections,
            objectIds,
            weights,
            address(0),
            address(0),
            address(this).asSingletonArray(),
            address(0).asSingletonArray()
        );
    }

    function proposalCanBeFinalized(bytes32, IProposalsManager.Proposal memory, bool validationPassed, bool result) external override(IExternalProposalsManagerCommands, SubDAO) view virtual returns (bool) {
        return !validationPassed || result;
    }

    function execute(bytes32 proposalId) public override view returns(address subject, string memory uri, bytes[] memory values, bytes32[] memory proposalIds, uint256 ballotDuration) {
        (subject, uri, values, proposalIds, ballotDuration) = abi.decode(_pollData[_pollOptions[proposalId]], (address, string, bytes[], bytes32[], uint256));
    }

    function check(address, bytes32 id, bytes calldata data, address, address) external override view returns(bool) {
        (,,, bytes32[] memory proposalIds, uint256 ballotDuration) = execute(id);
        return proposalIds.length > 0 && block.number > ((abi.decode(data, (IProposalsManager.Proposal))).creationBlock + ballotDuration);
    }
}