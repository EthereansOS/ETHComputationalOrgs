// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/IDelegationFactory.sol";
import "./EthereansFactory.sol";
import "../../../base/model/IProposalsManager.sol";
import { ReflectionUtilities, BehaviorUtilities, Uint256Utilities, AddressUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { Grimoire as BaseGrimoire, Getters } from "../../../base/lib/KnowledgeBase.sol";
import { Getters as ExternalGetters } from "../../../ext/lib/KnowledgeBase.sol";
import "../../../ext/subDAO/model/ISubDAO.sol";
import "../../../base/model/IProposalsManager.sol";
import "../../../core/model/IOrganization.sol";
import "../../../base/model/IStateManager.sol";
import { State } from "../../../base/lib/KnowledgeBase.sol";
import "@ethereansos/items-core/contracts/projection/IItemProjection.sol";
import "@ethereansos/items-core/contracts/projection/factory/model/IItemProjectionFactory.sol";

contract DelegationFactory is EthereansFactory, IDelegationFactory {
    using ReflectionUtilities for address;
    using Getters for IOrganization;
    using ExternalGetters for IOrganization;
    using State for IStateManager;
    using Uint256Utilities for uint256;
    using AddressUtilities for address;

    uint256 public constant MANDATORY_COMPONENTS = 3;
    //ProposalsManager true
    //TreasuryManager false
    //DelegationTokensManager true

    uint256 public constant PROPOSALS_MANAGER_POSITION = 0;

    address[] private _utilityModels;
    bytes32[] private _utilityModelKeys;
    bool[] private _utilityModelsActive;

    uint256 public presetArrayMaxSize;

    address public itemProjectionFactoryAddress;
    address public mainInterface;
    address public projectionAddress;
    bytes32 public collectionId;
    ISubDAO.SubDAOProposalModel[] private _proposalModels;

    uint256 private constant BY_SPECIFIC_ADDRESS_POSITION = 0;
    uint256 private constant VOTE_PERIOD_POSITION = 1;
    uint256 private constant HARD_CAP_POSITION = 2;
    uint256 private constant VALIDATION_BOMB_POSITION = 3;
    uint256 private constant QUORUM_POSITION = 4;
    address[] private _proposalRules;

    constructor(bytes memory lazyInitData) EthereansFactory(lazyInitData) {
    }

    function _ethosFactoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponse) {
        (_proposalRules, _utilityModels, _utilityModelKeys, _utilityModelsActive, lazyInitResponse) = abi.decode(lazyInitData, (address[], address[], bytes32[], bool[], bytes));
        ISubDAO.SubDAOProposalModel[] memory proposalModels;
        Header memory collectionHeader;
        (itemProjectionFactoryAddress, collectionHeader, presetArrayMaxSize, proposalModels) = abi.decode(lazyInitResponse, (address, Header, uint256, ISubDAO.SubDAOProposalModel[]));
        for(uint256 i = 0; i < proposalModels.length; i++) {
            _proposalModels.push(proposalModels[i]);
        }
        _deployCollection(collectionHeader);
        lazyInitResponse = "";
    }

    function mintItems(CreateItem[] memory items) external returns(uint256[] memory itemIds) {
        require(deployer[msg.sender] != address(0), "unauthorized");
        for(uint256 i = 0; i < items.length; i++) {
            items[i].collectionId = collectionId;
        }
        return IItemProjection(projectionAddress).mintItems(items);
    }

    function proposalRules() external view returns(address[] memory) {
        return _proposalRules;
    }

    function data() external override view returns(address[] memory utilityModels, bytes32[] memory utilitiyModelKeys, bool[] memory utilitiyModelActive) {
        return (_utilityModels, _utilityModelKeys, _utilityModelsActive);
    }

    function deploy(bytes calldata deployData) external payable override(Factory, IFactory) virtual returns(address productAddress, bytes memory productInitResponse) {
        (OrganizationDeployData memory organizationDeployData) = abi.decode(deployData, (OrganizationDeployData));

        (productAddress,) = Creator.create(abi.encodePacked(modelAddress));
        deployer[productAddress] = msg.sender;

        uint256 componentsLength = MANDATORY_COMPONENTS;
        IOrganization.Component[] memory components = new IOrganization.Component[](componentsLength);

        for(uint256 i = 0; i < MANDATORY_COMPONENTS; i++) {
            components[i] = _createOrganizationComponent(i, productAddress, i == PROPOSALS_MANAGER_POSITION ? abi.encode(true, organizationDeployData.mandatoryComponentsDeployData[i]) : organizationDeployData.mandatoryComponentsDeployData[i]);
        }

        productInitResponse = _emitDeploy(productAddress, organizationDeployData.uri, components, organizationDeployData.specificOrganizationData);

        require(ILazyInitCapableElement(productAddress).initializer() == address(this));
    }

    address[] private _validationAddresses;
    bytes[] private _validationData;
    address[] private _canTerminateAddresses;
    bytes[] private _canTerminateData;

    function createNewRules(
        address delegationAddress,
        uint256 quorumPercentage,
        uint256 validationBomb,
        uint256 votePeriod,
        uint256 hardCapPercentage
    ) external override returns  (address[] memory validationAddresses, bytes[] memory validationData, address[] memory canTerminateAddresses, bytes[] memory canTerminateData) {
        require(deployer[delegationAddress] != address(0), "unknown delegation");
        return _createNewRules(quorumPercentage, validationBomb, votePeriod, hardCapPercentage);
    }

    function generateProposalModels(
        address host,
        uint256 quorumPercentage,
        uint256 validationBomb,
        uint256 votePeriod,
        uint256 hardCapPercentage
    ) public returns(ISubDAO.SubDAOProposalModel[] memory proposalModels) {
        (address creationRules, bytes memory creationData,) = Initializer.create(abi.encodePacked(_proposalRules[BY_SPECIFIC_ADDRESS_POSITION]), abi.encode(host, host != address(0)));

        (address[] memory validationAddresses, bytes[] memory validationData, address[] memory canTerminateAddresses, bytes[] memory canTerminateData) = _createNewRules(
            quorumPercentage,
            validationBomb,
            votePeriod,
            hardCapPercentage
        );

        proposalModels = _proposalModels;
        proposalModels[0].creationRules = creationRules;//Attach-Detach
        proposalModels[0].creationData = creationData;

        proposalModels[1].creationRules = creationRules;//Change URI
        proposalModels[1].creationData = creationData;

        proposalModels[2].creationRules = creationRules;//Change Rules
        proposalModels[2].creationData = creationData;

        proposalModels[3].creationRules = creationRules;//Transfer
        proposalModels[3].creationData = creationData;
        proposalModels[3].validatorsAddresses[0] = validationAddresses;
        proposalModels[3].validatorsData[0] = validationData;
        proposalModels[3].canTerminateAddresses[0] = canTerminateAddresses;
        proposalModels[3].canTerminateData[0] = canTerminateData;

        proposalModels[4].creationRules = creationRules;//Vote
        proposalModels[4].creationData = creationData;
        proposalModels[4].validatorsAddresses[0] = validationAddresses;
        proposalModels[4].validatorsData[0] = validationData;
        proposalModels[4].canTerminateAddresses[0] = canTerminateAddresses;
        proposalModels[4].canTerminateData[0] = canTerminateData;
    }

    function initializeProposalModels(
        address delegationAddress,
        address host,
        uint256 quorumPercentage,
        uint256 validationBomb,
        uint256 votePeriod,
        uint256 hardCapPercentage
    ) external override {
        require(deployer[delegationAddress] == msg.sender, "unauthorized");
        ISubDAO(delegationAddress).setInitialProposalModels(generateProposalModels(host, quorumPercentage, validationBomb, votePeriod, hardCapPercentage));
    }

    function _addTo(uint256 position, uint256 value, bool valueIsPercentage, bool validators) private {
        address model = _proposalRules[position];
        bytes memory init = valueIsPercentage ? abi.encode(value, true) : abi.encode(value);
        if(validators) {
            _validationAddresses.push(model);
            _validationData.push(init);
        } else {
            _canTerminateAddresses.push(model);
            _canTerminateData.push(init);
        }
    }

    function _emitDeploy(address productAddress, string memory uri, IOrganization.Component[] memory components, bytes memory specificOrganizationData) private returns(bytes memory productInitResponse) {
        ISubDAO.SubDAOProposalModel[] memory proposalModels = new ISubDAO.SubDAOProposalModel[](0);
        if(specificOrganizationData.length != 0) {
            (address host, uint256 quorumPercentage, uint256 validationBomb, uint256 votePeriod, uint256 hardCapPercentage) = abi.decode(specificOrganizationData, (address, uint256, uint256, uint256, uint256));
            proposalModels = generateProposalModels(host, quorumPercentage, validationBomb, votePeriod, hardCapPercentage);
        }
        emit Deployed(modelAddress, productAddress, msg.sender, productInitResponse = ILazyInitCapableElement(productAddress).lazyInit(abi.encode(address(0), abi.encode(uri, dynamicUriResolver, abi.encode(proposalModels.length != 0, presetArrayMaxSize, abi.encode(proposalModels, abi.encode(components)))))));
    }

    function proposeToAttachOrDetach(address delegationAddress, address delegationsManagerAddress, bool attach) public returns(bytes32 proposalId) {
        require(deployer[delegationAddress] != address(0), "Unrecognized");

        IProposalsManager.ProposalCode[] memory proposalCodes = new IProposalsManager.ProposalCode[](1);
        proposalCodes[0] = IProposalsManager.ProposalCode(address(0), abi.encode(delegationsManagerAddress, attach));

        IProposalsManager.ProposalCodes[] memory proposalCodesArray = new IProposalsManager.ProposalCodes[](1);
        proposalCodesArray[0] = IProposalsManager.ProposalCodes(proposalCodes, true);

        return IOrganization(delegationAddress).proposalsManager().batchCreate(proposalCodesArray)[0];
    }

    function _createOrganizationComponent(uint256 index, address productAddress, bytes memory lazyInitData) private returns(IOrganization.Component memory organizationComponent) {
        (address utilityAddress,) = Creator.create(abi.encodePacked(_utilityModels[index]));
        ILazyInitCapableElement((organizationComponent = IOrganization.Component(_utilityModelKeys[index], utilityAddress, _utilityModelsActive[index], true)).location).lazyInit(abi.encode(productAddress, lazyInitData));
        deployer[organizationComponent.location] = msg.sender;
    }

    function _deployCollection(Header memory collectionHeader) private {
        mainInterface = IItemProjectionFactory(itemProjectionFactoryAddress).mainInterface();

        collectionHeader.host = address(0);

        bytes memory deployData = abi.encode((uint256(1)).asSingletonArray(), address(this).asSingletonArray());
        deployData = abi.encode(bytes32(0), collectionHeader, new CreateItem[](0), deployData);
        deployData = abi.encode(address(0), deployData);
        deployData = abi.encode(0, deployData);
        (projectionAddress,) = IItemProjectionFactory(itemProjectionFactoryAddress).deploy(deployData);
        collectionId = IItemProjection(projectionAddress).collectionId();
    }

    function _createNewRules(
        uint256 quorumPercentage,
        uint256 validationBomb,
        uint256 votePeriod,
        uint256 hardCapPercentage
    ) private returns (address[] memory validationAddresses, bytes[] memory validationData, address[] memory canTerminateAddresses, bytes[] memory canTerminateData) {
        _addTo(QUORUM_POSITION, quorumPercentage, true, true);
        if(validationBomb > 0) {
            _addTo(VALIDATION_BOMB_POSITION, validationBomb, false, true);
        }

        if(votePeriod > 0) {
            _addTo(VOTE_PERIOD_POSITION, votePeriod, false, false);
        }

        if(hardCapPercentage > 0) {
            _addTo(HARD_CAP_POSITION, hardCapPercentage, true, false);
        }

        validationAddresses = _validationAddresses;
        canTerminateAddresses = _canTerminateAddresses;
        validationData = _validationData;
        canTerminateData = _canTerminateData;

        require(validationAddresses.length > 0, "No validators");
        require(canTerminateAddresses.length > 0, "No canTerminates");

        delete _validationAddresses;
        delete _canTerminateAddresses;
        delete _validationData;
        delete _canTerminateData;
    }
}