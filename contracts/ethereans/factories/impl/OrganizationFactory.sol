// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IOrganizationFactory.sol";
import "./EthereansFactory.sol";
import "../../../core/model/IOrganization.sol";
import "../../../ext/subDAO/model/ISubDAO.sol";
import { Grimoire as ExternalGrimoire } from  "../../../ext/lib/KnowledgeBase.sol";
import { Getters } from  "../../../base/lib/KnowledgeBase.sol";

contract OrganizationFactory is IOrganizationFactory, EthereansFactory {
    using Getters for IOrganization;

    uint256 private constant MANDATORY_COMPONENTS = 1;
    //ProposalsManager true

    uint256 public constant PROPOSALS_MANAGER_POSITION = 0;
    uint256 public constant TREASURY_MANAGER_POSITION = 1;
    uint256 public constant DELEGATIONS_MANAGER_POSITION = 6;

    address[] private _utilityModels;
    bytes32[] private _utilityModelKeys;
    bool[] private _utilityModelsActive;

    address[] private _proposalModelAddresses;
    address public proposalRulesFactory;
    uint256 public presetArrayMaxSize;
    uint256 public delegationsMaxSize;

    constructor(bytes memory lazyInitData) EthereansFactory(lazyInitData) {
    }

    function _ethosFactoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponse) {
        (_utilityModels, _utilityModelKeys, _utilityModelsActive, _proposalModelAddresses, proposalRulesFactory, presetArrayMaxSize, delegationsMaxSize) = abi.decode(lazyInitData, (address[], bytes32[], bool[], address[], address, uint256, uint256));
        return "";
    }

    function data() external override view returns(address[] memory utilityModels, bytes32[] memory utilitiyModelKeys, bool[] memory utilitiyModelActive) {
        return (_utilityModels, _utilityModelKeys, _utilityModelsActive);
    }

    function deploy(bytes memory deployData) external virtual override(IFactory, Factory) payable returns(address productAddress, bytes memory productInitResponse) {

        OrganizationDeployData memory organizationDeployData = _prepareOrganizationDeployData(deployData);

        (productAddress,) = Creator.create(abi.encodePacked(modelAddress));
        deployer[productAddress] = msg.sender;

        uint256 componentsLength = MANDATORY_COMPONENTS + organizationDeployData.specialComponentsData.length;
        for(uint256 i = 0; i < organizationDeployData.additionalComponents.length; i++) {
            uint256 additionalComponentIndex = organizationDeployData.additionalComponents[i];
            require(i == 0 || additionalComponentIndex > organizationDeployData.additionalComponents[i - 1], "DESC");
            require(additionalComponentIndex >= MANDATORY_COMPONENTS && additionalComponentIndex < _utilityModels.length, "index");
            componentsLength++;
        }

        IOrganization.Component[] memory components = new IOrganization.Component[](componentsLength);

        for(uint256 i = 0; i < MANDATORY_COMPONENTS; i++) {
            components[i] = _createOrganizationComponent(i, productAddress, i == PROPOSALS_MANAGER_POSITION ? abi.encode(true, organizationDeployData.mandatoryComponentsDeployData[i]) : organizationDeployData.mandatoryComponentsDeployData[i]);
        }

        uint256 nextIndex = MANDATORY_COMPONENTS;
        if(organizationDeployData.additionalComponents.length > 0) {
            for(uint256 i = 0; i < organizationDeployData.additionalComponents.length; i++) {
                uint256 additionalComponentIndex = organizationDeployData.additionalComponents[i];
                components[nextIndex++] = additionalComponentIndex == DELEGATIONS_MANAGER_POSITION ? _deployDelegationsManager(productAddress, organizationDeployData.additionalComponentsDeployData[i]) : _createOrganizationComponent(additionalComponentIndex, productAddress, organizationDeployData.additionalComponentsDeployData[i]);
            }
        }

        if(organizationDeployData.specialComponentsData.length > 0) {
            for(uint256 i = 0; i < organizationDeployData.specialComponentsData.length; i++) {
                components[nextIndex++] = _deploySpecialComponent(productAddress, organizationDeployData.specialComponentsData[i]);
            }
        }

        productInitResponse = _emitDeploy(productAddress, organizationDeployData, components);
    }

    function _prepareOrganizationDeployData(bytes memory deployData) private returns(OrganizationDeployData memory organizationDeployData) {
        organizationDeployData = abi.decode(deployData, (OrganizationDeployData));

        deployData = "";

        IProposalsManager.ProposalConfiguration memory proposalConfiguration;
        if(organizationDeployData.mandatoryComponentsDeployData[PROPOSALS_MANAGER_POSITION].length != 0) {
            proposalConfiguration = abi.decode(organizationDeployData.mandatoryComponentsDeployData[PROPOSALS_MANAGER_POSITION], (IProposalsManager.ProposalConfiguration));
            if(proposalConfiguration.creationRules != address(0) || proposalConfiguration.creationData.length != 0) {
                deployData = abi.encode(proposalConfiguration.creationRules, proposalConfiguration.creationData, deployData);
            }
            if(proposalConfiguration.triggeringRules != address(0) || proposalConfiguration.triggeringData.length != 0) {
                deployData = abi.encode(proposalConfiguration.triggeringRules, proposalConfiguration.triggeringData, deployData);
            }
            for(uint256 i = 0; i < proposalConfiguration.canTerminateAddresses.length; i++) {
                deployData = abi.encode(proposalConfiguration.canTerminateAddresses[i], proposalConfiguration.canTerminateData[i], deployData);
            }
            for(uint256 i = 0; i < proposalConfiguration.validatorsAddresses.length; i++) {
                deployData = abi.encode(proposalConfiguration.validatorsAddresses[i], proposalConfiguration.validatorsData[i], deployData);
            }
        }

        ISubDAO.SubDAOProposalModel[] memory proposalModels;
        if(organizationDeployData.specificOrganizationData.length != 0) {
            proposalModels = abi.decode(organizationDeployData.specificOrganizationData, (ISubDAO.SubDAOProposalModel[]));
            for(uint256 i = 0; i < proposalModels.length; i++) {
                ISubDAO.SubDAOProposalModel memory proposalModel = proposalModels[i];
                if(proposalModel.creationRules != address(0) || proposalModel.creationData.length != 0) {
                    deployData = abi.encode(proposalModel.creationRules, proposalModel.creationData, deployData);
                }
                if(proposalModel.triggeringRules != address(0) || proposalModel.triggeringData.length != 0) {
                    deployData = abi.encode(proposalModel.triggeringRules, proposalModel.triggeringData, deployData);
                }
                for(uint256 z = 0; z < proposalModel.canTerminateAddresses.length; z++) {
                    for(uint256 j = 0; j < proposalModel.canTerminateAddresses[z].length; j++) {
                        deployData = abi.encode(proposalModel.canTerminateAddresses[z][j], proposalModel.canTerminateData[z][j], deployData);
                    }
                }
                for(uint256 z = 0; z < proposalModel.validatorsAddresses.length; z++) {
                    for(uint256 j = 0; j < proposalModel.validatorsAddresses[z].length; j++) {
                        deployData = abi.encode(proposalModel.validatorsAddresses[z][j], proposalModel.validatorsData[z][j], deployData);
                    }
                }
            }
        }

        if(proposalConfiguration.validatorsAddresses.length == 0 && proposalModels.length == 0) {
            return organizationDeployData;
        }

        (, deployData) = IFactory(proposalRulesFactory).deploy(abi.encode(1, deployData));
        (address[] memory addresses, bytes[] memory inputData) = abi.decode(deployData, (address[], bytes[]));
        uint256 cursor = 0;

        if(proposalConfiguration.validatorsAddresses.length != 0) {
            if(proposalConfiguration.creationRules != address(0) || proposalConfiguration.creationData.length != 0) {
                proposalConfiguration.creationRules = addresses[cursor];
                proposalConfiguration.creationData = inputData[cursor++];
            }
            if(proposalConfiguration.triggeringRules != address(0) || proposalConfiguration.triggeringData.length != 0) {
                proposalConfiguration.triggeringRules = addresses[cursor];
                proposalConfiguration.triggeringData = inputData[cursor++];
            }
            for(uint256 i = 0; i < proposalConfiguration.canTerminateAddresses.length; i++) {
                proposalConfiguration.canTerminateAddresses[i] = addresses[cursor];
                proposalConfiguration.canTerminateData[i] = inputData[cursor++];
            }
            for(uint256 i = 0; i < proposalConfiguration.validatorsAddresses.length; i++) {
                proposalConfiguration.validatorsAddresses[i] = addresses[cursor];
                proposalConfiguration.validatorsData[i] = inputData[cursor++];
            }
            organizationDeployData.mandatoryComponentsDeployData[PROPOSALS_MANAGER_POSITION] = abi.encode(proposalConfiguration);
        }

        if(proposalModels.length != 0) {
            for(uint256 i = 0; i < proposalModels.length; i++) {
                ISubDAO.SubDAOProposalModel memory proposalModel = proposalModels[i];
                if(proposalModel.creationRules != address(0) || proposalModel.creationData.length != 0) {
                    proposalModel.creationRules = addresses[cursor];
                    proposalModel.creationData = inputData[cursor++];
                }
                if(proposalModel.triggeringRules != address(0) || proposalModel.triggeringData.length != 0) {
                    proposalModel.triggeringRules = addresses[cursor];
                    proposalModel.triggeringData = inputData[cursor++];
                }
                for(uint256 z = 0; z < proposalModel.canTerminateAddresses.length; z++) {
                    for(uint256 j = 0; j < proposalModel.canTerminateAddresses[z].length; j++) {
                        proposalModel.canTerminateAddresses[z][j] = addresses[cursor];
                        proposalModel.canTerminateData[z][j] = inputData[cursor++];
                    }
                }
                for(uint256 z = 0; z < proposalModel.validatorsAddresses.length; z++) {
                    for(uint256 j = 0; j < proposalModel.validatorsAddresses[z].length; j++) {
                        proposalModel.validatorsAddresses[z][j] = addresses[cursor];
                        proposalModel.validatorsData[z][j] = inputData[cursor++];
                    }
                }
                proposalModels[i] = proposalModel;
            }
            organizationDeployData.specificOrganizationData = abi.encode(proposalModels);
        }
    }

    function _emitDeploy(address productAddress, OrganizationDeployData memory organizationDeployData, IOrganization.Component[] memory components) private returns(bytes memory productInitResponse) {
        ISubDAO.SubDAOProposalModel[] memory proposalModels = _prepareProposalModels(organizationDeployData.specificOrganizationData);

        productInitResponse = ILazyInitCapableElement(productAddress).lazyInit(abi.encode(address(0), abi.encode(organizationDeployData.uri, dynamicUriResolver, abi.encode(proposalModels.length != 0, presetArrayMaxSize, abi.encode(proposalModels, abi.encode(components))))));

        emit Deployed(modelAddress, productAddress, msg.sender, productInitResponse);

        require(ILazyInitCapableElement(productAddress).initializer() == address(this));

        _initializePresetProposals(productAddress, proposalModels);
    }

    function _prepareProposalModels(bytes memory specificOrganizationData) private view returns(ISubDAO.SubDAOProposalModel[] memory proposalModels) {
        proposalModels = abi.decode(specificOrganizationData, (ISubDAO.SubDAOProposalModel[]));

        require(proposalModels.length == 5 || proposalModels.length == 6, "models");

        for(uint256 i = 0; i < proposalModels.length; i++) {
            proposalModels[i].source = _proposalModelAddresses[i];
            require(!proposalModels[i].isPreset || i == 2 || i == 5, "preset");
            if(proposalModels[i].isPreset) {
                bytes[] memory presetValues = proposalModels[i].presetValues;
                require(presetValues.length != 0, "preset");
                for(uint256 z = 0; z < presetValues.length; z++) {
                    abi.decode(presetValues[z], (uint256));
                }
            }
        }

        abi.decode(proposalModels[0].presetValues[0], (uint256));
        abi.decode(proposalModels[3].presetValues[0], (uint256));
        abi.decode(proposalModels[4].presetValues[0], (uint256, uint256));
    }

    function _initializePresetProposals(address productAddress, ISubDAO.SubDAOProposalModel[] memory proposalModels) private {
        uint256 cursor = 0;
        bytes memory indices;
        for(uint256 i = 0; i < proposalModels.length; i++) {
            ISubDAO.SubDAOProposalModel memory proposalModel = proposalModels[i];
            if(proposalModel.isPreset) {
                cursor += proposalModel.presetValues.length;
                indices = abi.encode(i, indices);
            }
        }
        if(cursor == 0) {
            return;
        }
        IProposalsManager.ProposalCodes[] memory proposalCodes = new IProposalsManager.ProposalCodes[](cursor);
        cursor = 0;
        while (indices.length != 0) {
            uint256 proposalModelIndex;
            (proposalModelIndex, indices) = abi.decode(indices, (uint256, bytes));
            ISubDAO.SubDAOProposalModel memory proposalModel = proposalModels[proposalModelIndex];
            for(uint256 i = 0; i < proposalModel.presetValues.length; i++) {
                IProposalsManager.ProposalCode[] memory codes = new IProposalsManager.ProposalCode[](1);
                codes[0] = IProposalsManager.ProposalCode(address(uint160(proposalModelIndex)), abi.encode(i));
                proposalCodes[cursor++] = IProposalsManager.ProposalCodes(codes, false);
            }
        }
        IOrganization(productAddress).proposalsManager().batchCreate(proposalCodes);
    }

    function _deployDelegationsManager(address organizationAddress, bytes memory deployData) private returns(IOrganization.Component memory) {
        return _createOrganizationComponent(DELEGATIONS_MANAGER_POSITION, organizationAddress, abi.encode(delegationsMaxSize, _utilityModels[TREASURY_MANAGER_POSITION], deployData));
    }

    function _createOrganizationComponent(uint256 index, address productAddress, bytes memory lazyInitData) private returns(IOrganization.Component memory organizationComponent) {
        (address utilityAddress,) = Creator.create(abi.encodePacked(_utilityModels[index]));
        ILazyInitCapableElement((organizationComponent = IOrganization.Component(_utilityModelKeys[index], utilityAddress, _utilityModelsActive[index], true)).location).lazyInit(abi.encode(productAddress, lazyInitData));
        deployer[organizationComponent.location] = msg.sender;
    }

    function _deploySpecialComponent(address productAddress, bytes memory specialComponentData) private returns(IOrganization.Component memory organizationComponent) {
        (bytes32 key, bool active, address modelOrLocation, bytes memory modelOrLocationData, bytes memory lazyInitData) = abi.decode(specialComponentData, (bytes32, bool, address, bytes, bytes));
        if(modelOrLocation == address(0)) {
            modelOrLocation = _getOrCreateAddress(modelOrLocationData);
            modelOrLocationData = "";
        }
        if(modelOrLocationData.length != 0) {
            (modelOrLocation,) = Creator.create(abi.encodePacked(modelOrLocation));
            deployer[modelOrLocation] = msg.sender;
        }
        if(lazyInitData.length != 0) {
            ILazyInitCapableElement(modelOrLocation).lazyInit(abi.encode(productAddress, lazyInitData));
        }
        organizationComponent = IOrganization.Component(key, modelOrLocation, active, true);
    }

    function _getOrCreateAddress(bytes memory sourceAddressOrBytecode) private returns(address modelAddress) {
        if(sourceAddressOrBytecode.length == 32) {
            modelAddress = abi.decode(sourceAddressOrBytecode, (address));
        } else if(sourceAddressOrBytecode.length == 20) {
            assembly {
                modelAddress := div(mload(add(sourceAddressOrBytecode, 32)), 0x1000000000000000000000000)
            }
        } else {
            assembly {
                modelAddress := create(0, add(sourceAddressOrBytecode, 32), mload(sourceAddressOrBytecode))
            }
            deployer[modelAddress] = msg.sender;
        }
        require(modelAddress != address(0), "modelAddress");
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(modelAddress)
        }
        require(codeSize > 0, "modelAddress");
    }
}