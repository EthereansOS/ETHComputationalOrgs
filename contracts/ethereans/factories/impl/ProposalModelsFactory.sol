//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/IProposalModelsFactory.sol";
import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

contract ProposalModelsFactory is Factory, IProposalModelsFactory {
    using ReflectionUtilities for address;

    address[] private _models;
    string[] private _uris;

    address[] private _singletons;

    constructor(bytes memory lazyInitData) Factory(lazyInitData) {
    }

    function _factoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponse) {
        if(lazyInitData.length == 0) {
            return "";
        }
        bytes[] memory modelCodes;
        bytes[] memory singletonCodes;
        (modelCodes, _uris, singletonCodes) = abi.decode(lazyInitData, (bytes[], string[], bytes[]));
        require(modelCodes.length == _uris.length, "models");
        for(uint256 i = 0; i < modelCodes.length; i++) {
            bytes memory code = modelCodes[i];
            address createdModel;
            assembly {
                createdModel := create(0, add(code, 0x20), mload(code))
            }
            require(createdModel != address(0), "model");
            _models.push(createdModel);
        }
        for(uint256 i = 0; i < singletonCodes.length; i++) {
            bytes memory singletonCode = singletonCodes[i];
            address deployedAddress;
            assembly {
                deployedAddress := create(0, add(singletonCode, 0x20), mload(singletonCode))
            }
            require(deployedAddress != address(0), "singleton");
            _singletons.push(deployedAddress);
            emit Singleton(deployedAddress);
        }
        return "";
    }

    function models() external override view returns(address[] memory addresses, string[] memory uris) {
        return (_models, _uris);
    }

    function model(uint256 i) external override view returns(address modelAddress, string memory modelUri) {
        return (_models[i], _uris[i]);
    }

    function setModelUris(uint256[] memory indices, string[] memory uris) external override authorizedOnly {
        for(uint256 i = 0; i < indices.length; i++) {
            _uris[indices[i]] = uris[i];
        }
    }

    function singletons() external override view returns(address[] memory addresses) {
        return _singletons;
    }

    function singleton(uint256 i) external view override returns(address singletonAddress) {
        return _singletons[i];
    }

    function addModel(bytes memory code, string calldata uri) external override authorizedOnly returns(address modelAddress, uint256 positionIndex) {
        positionIndex = _models.length;
        assembly {
            modelAddress := create(0, add(code, 0x20), mload(code))
        }
        _models.push(modelAddress);
        _uris.push(uri);
    }

    function deploySingleton(bytes memory code, bytes calldata deployData) external authorizedOnly override returns(address deployedAddress, bytes memory deployLazyInitResponse) {
        assembly {
            deployedAddress := create(0, add(code, 0x20), mload(code))
        }
        deployLazyInitResponse = _deploy(address(0), deployedAddress, deployData);
        _singletons.push(deployedAddress);
        emit Singleton(deployedAddress);
    }

    function deploy(bytes calldata deployData) external payable override(Factory, IFactory) returns(address deployedAddress, bytes memory deployedLazyInitResponse) {
        uint256 modelIndex;
        (modelIndex, deployedLazyInitResponse) = abi.decode(deployData, (uint256, bytes));
        require(modelIndex < _models.length, "Model");
        address chosenModel = _models[modelIndex];
        deployedLazyInitResponse = _deploy(chosenModel, deployedAddress = chosenModel.clone(), abi.encode(_uris[modelIndex], deployedLazyInitResponse));
    }

    function _deploy(address chosenModel, address deployedAddress, bytes memory deployData) private returns(bytes memory deployedLazyInitResponse) {
        require(deployedAddress != address(0), "product");
        deployer[deployedAddress] = msg.sender;
        emit Deployed(chosenModel, deployedAddress, msg.sender, deployedLazyInitResponse = ILazyInitCapableElement(deployedAddress).lazyInit(deployData));
    }

    function _subjectIsAuthorizedFor(address, address, bytes4 selector, bytes calldata, uint256) internal override pure returns (bool, bool) {
        if(selector == this.setModelAddress.selector || selector == this.setDynamicUriResolver.selector) {
            return (true, false);
        }
        return (false, false);
    }
}