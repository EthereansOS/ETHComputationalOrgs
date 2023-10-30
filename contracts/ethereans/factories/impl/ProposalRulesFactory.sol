//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/IProposalRulesFactory.sol";
import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

contract ProposalRulesFactory is Factory, IProposalRulesFactory {
    using ReflectionUtilities for address;

    address[] private _models;
    mapping(uint256 => bool) private _singletons;
    mapping(uint256 => bool) private _deprecated;
    mapping(address => uint256) public override indexOf;

    constructor(bytes memory lazyInitData) Factory(lazyInitData) {
    }

    function _factoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponse) {
        if(lazyInitData.length == 0) {
            return "";
        }
        (bytes[] memory addressesOrCodes, bool[] memory singletons) = abi.decode(lazyInitData, (bytes[], bool[]));
        _add(addressesOrCodes, singletons);
        return "";
    }

    function list() external override view returns(address[] memory addresses, bool[] memory singletons, bool[] memory deprecated) {
        return subList(new uint256[](0));
    }

    function subList(uint256[] memory modelIndices) public override view returns(address[] memory modelAddresses, bool[] memory singletons, bool[] memory deprecated) {
        modelAddresses = new address[](modelIndices.length != 0 ? modelIndices.length : _models.length);
        singletons = new bool[](modelAddresses.length);
        deprecated = new bool[](modelAddresses.length);
        for(uint256 i = 0; i < modelAddresses.length; i++) {
            (modelAddresses[i], singletons[i], deprecated[i]) = get(modelIndices.length != 0 ? modelIndices[i] : i);
        }
    }

    function get(uint256 modelIndex) public override view returns(address modelAddress, bool singleton, bool deprecated) {
        return (_models[modelIndex], _singletons[modelIndex], _deprecated[modelIndex]);
    }

    function add(bytes[] calldata addressesOrCodes, bool[] calldata singletons) external override authorizedOnly returns(address[] memory modelAddresses, uint256[] memory positionIndices) {
        return _add(addressesOrCodes, singletons);
    }

    function validateInputs(uint256[] calldata modelIndices, bytes[] calldata inputData) external override view returns(bool[] memory results) {
        results = new bool[](modelIndices.length);
        for(uint256 i = 0; i < results.length; i++) {
            results[i] = _validateInput(_models[modelIndices[i]], i < inputData.length ? inputData[i] : bytes(""));
        }
    }

    function deprecate(uint256[] calldata modelIndices) external override authorizedOnly {
        for(uint256 i = 0; i < modelIndices.length; i++) {
            _deprecated[modelIndices[i]] = true;
        }
    }

    function deploy(bytes memory deployData) external payable override(Factory, IFactory) returns(address, bytes memory) {
        uint256 mode;
        (mode, deployData) = abi.decode(deployData, (uint256, bytes));
        (address[] memory addresses, bytes[] memory inputData) = mode == 1 ? _retrieveAddressesConcatenatedData(deployData) : abi.decode(deployData, (address[], bytes[]));

        uint256 modelsLength = _models.length;
        for(uint256 i = 0; i < addresses.length; i++) {
            address addr = addresses[i];
            addresses[i] = addr = uint256(uint160(addr)) < modelsLength ? _models[uint256(uint160(addr))] : addr;
            (bool isModel, uint256 index) = _isModel(addr);
            if(!isModel && deployer[addr] == address(0)) {
                (addresses[i], inputData[i], index) = _create2(addresses[i], inputData[i]);
                addr = addresses[i];
            }
            require(isModel || deployer[addr] != address(0), "unknown");
            require(!isModel || !_deprecated[index], "deprecated");
            if(isModel && !_singletons[index]) {
                (addresses[i], inputData[i],) = Initializer.create(abi.encodePacked(addr), inputData[i]);
                deployer[addresses[i]] = msg.sender;
                emit Deployed(addr, addresses[i], msg.sender, deployData);
            }
            require(_validateInput(addresses[i], inputData[i]), "invalid input");
        }
        emit DeployResult(addresses, inputData);
        return(address(0), abi.encode(addresses, inputData));
    }

    function bySalt(address dataCollector) public override view returns(address productAddress, bytes32 salt, bytes memory bytecode, uint256 index, address modelAddress, bool singleton, bool deprecated) {
        bytes memory lazyInitData = abi.encode(dataCollector);

        salt = abi.decode(lazyInitData, (bytes32));

        bytes memory indexData = abi.encode(index);
        indexData[28] = lazyInitData[12];
        indexData[29] = lazyInitData[13];
        indexData[30] = lazyInitData[14];
        indexData[31] = lazyInitData[15];

        index = abi.decode(indexData, (uint256));

        modelAddress = _models[index];
        singleton = _singletons[index];
        deprecated = _deprecated[index];

        bytecode = abi.encode(modelAddress);
        bytecode = abi.encodePacked(type(GeneralPurposeProxy).creationCode, bytecode);

        productAddress = address(uint160(uint(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))))));
    }

    function bySalt(uint256 modelIndex, bytes32 initialSalt) public override view returns(address dataCollector, address productAddress, bytes32 salt, bytes memory bytecode, uint256 index, address modelAddress, bool singleton, bool deprecated) {
        bytecode = abi.encode(salt);
        bytes memory data = abi.encode(modelIndex);
        bytecode[12] = data[28];
        bytecode[13] = data[29];
        bytecode[14] = data[30];
        bytecode[15] = data[31];
        data = abi.encode(initialSalt);
        for(uint256 i = 16; i < 32; i++) {
            bytecode[i] = data[i - 16];
        }

        (productAddress, salt, bytecode, index, modelAddress, singleton, deprecated) = bySalt(dataCollector = abi.decode(bytecode, (address)));
    }

    function _subjectIsAuthorizedFor(address, address, bytes4 selector, bytes calldata, uint256) internal override pure returns (bool, bool) {
        if(selector == this.setModelAddress.selector || selector == this.setDynamicUriResolver.selector) {
            return (true, false);
        }
        return (false, false);
    }

    function _add(bytes[] memory addressesOrCodes, bool[] memory singletons) private returns(address[] memory modelAddresses, uint256[] memory positionIndices) {
        modelAddresses = new address[](addressesOrCodes.length);
        positionIndices = new uint256[](modelAddresses.length);
        bool defaultSingleton = singletons.length == 1 && singletons[0];
        for(uint256 i = 0; i < addressesOrCodes.length; i++) {
            (modelAddresses[i], positionIndices[i]) = _add(addressesOrCodes[i], i < singletons.length ? singletons[i] : defaultSingleton);
        }
    }

    function _add(bytes memory addressOrCode, bool singleton) private returns(address modelAddress, uint256 positionIndex) {
        positionIndex = _models.length;
        _models.push(modelAddress = _getOrCreateAddress(addressOrCode));
        _singletons[positionIndex] = singleton;
        emit Model(modelAddress, singleton, positionIndex);
        if(singleton) {
            deployer[modelAddress] = msg.sender;
        }
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
        }
        require(modelAddress != address(0), "modelAddress");
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(modelAddress)
        }
        require(codeSize > 0, "modelAddress");
    }

    function _isModel(address modelAddress) private view returns(bool isModel, uint256 index) {
        isModel = _models[index = indexOf[modelAddress]] == modelAddress;
    }

    function _retrieveAddressesConcatenatedData(bytes memory deployData) private pure returns(address[] memory addresses, bytes[] memory modelData) {
        uint256 cursor;
        bytes memory partialData = deployData;
        while(partialData.length != 0) {
            cursor++;
            (,, partialData) = abi.decode(partialData, (address, bytes, bytes));
        }
        addresses = new address[](cursor);
        modelData = new bytes[](cursor);
        partialData = deployData;
        while(partialData.length != 0) {
            (addresses[--cursor], modelData[cursor], partialData) = abi.decode(partialData, (address, bytes, bytes));
        }
    }

    function _validateInput(address addr, bytes memory inputData) private view returns(bool result) {
        (result, ) = addr.staticcall(abi.encodeWithSignature("validateInput(bytes)", inputData));
    }

    function _create2(address dataCollector, bytes memory inputData) private returns(address productAddress, bytes memory lazyInitData, uint256 index) {

        bytes32 salt;
        address modelAddress;
        bool singleton;
        bool deprecated;
        (, salt, lazyInitData, index, modelAddress, singleton, deprecated) = bySalt(dataCollector);
        require(!deprecated, "deprecated");
        require(!singleton, "singleton");

        uint256 size;
        assembly {
            productAddress := create2(0, add(lazyInitData, 0x20), mload(lazyInitData), salt)
            size := extcodesize(productAddress)
        }
        require(productAddress != address(0) && size > 0, "creation");

        lazyInitData = ILazyInitCapableElement(productAddress).lazyInit(inputData);

        require(ILazyInitCapableElement(productAddress).initializer() == address(this), "initializer");
        deployer[productAddress] = msg.sender;
        emit Deployed(modelAddress, productAddress, msg.sender, lazyInitData);
    }
}