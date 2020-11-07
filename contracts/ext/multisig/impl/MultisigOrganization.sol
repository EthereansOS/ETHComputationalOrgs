// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../core/impl/Organization.sol";
import "../model/IMultisigOrganization.sol";
import { BehaviorUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract MultisigOrganization is IMultisigOrganization, Organization {
    using ReflectionUtilities for address;

    bytes32 override public constant TYPEHASH_REQUEST = keccak256("Request(address sender,address location,bytes32 bytecodeHash,bytes32 payloadHash,uint256 value,bool asActiveComponent,uint256 nonce,uint256 deadline)");

    mapping(address => bool) public override isAddress;
    mapping(address => uint256) public override nonces;
    uint256 public override minimumSignatures;

    bytes32 public override DOMAIN_SEPARATOR;

    uint256 private _key;
    mapping(address => bool) private _signed;

    constructor(bytes memory lazyInitData) Organization(lazyInitData) {
    }

    function _dynamicMetadataElementLazyInit(bytes memory lazyInitData) internal virtual override returns(bytes memory) {
        (address[] memory addresses, uint256 _minimumSignatures, bytes memory superLazyInitData) = abi.decode(lazyInitData, (address[], uint256, bytes));
        require(addresses.length > 1, "addresses");
        require((minimumSignatures = _minimumSignatures) > 1, "signatures");
        require(minimumSignatures <= addresses.length, "length");
        for(uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "address");
            isAddress[addresses[i]] = true;
            emit MultisigAddress(address(0), addresses[i]);
        }
        (string memory domainSeparatorName, string memory domainSeparatorVersion) = EIP712_REQUEST_DOMAINSEPARATOR_NAME_AND_VERSION();
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(domainSeparatorName)),
                keccak256(bytes(domainSeparatorVersion)),
                block.chainid,
                address(this)
            )
        );
        return super._dynamicMetadataElementLazyInit(superLazyInitData);
    }

    function _dynamicMetadataElementSupportsInterface(bytes4 interfaceId) internal pure override returns(bool) {
        return
            interfaceId == type(IMultisigOrganization).interfaceId ||
            interfaceId == this.TYPEHASH_REQUEST.selector ||
            interfaceId == this.DOMAIN_SEPARATOR.selector ||
            interfaceId == this.EIP712_REQUEST_DOMAINSEPARATOR_NAME_AND_VERSION.selector ||
            interfaceId == this.isAddress.selector ||
            interfaceId == this.setAddresses.selector ||
            interfaceId == this.nonces.selector ||
            interfaceId == this.minimumSignatures.selector ||
            interfaceId == this.setMinimumSignatures.selector ||
            interfaceId == this.request.selector ||
            super._dynamicMetadataElementSupportsInterface(interfaceId);
    }

    function EIP712_REQUEST_DOMAINSEPARATOR_NAME_AND_VERSION() public override pure returns(string memory domainSeparatorName, string memory domainSeparatorVersion) {
        return ("Multisig", "1");
    }

    function setAddresses(address[] memory froms, address[] memory tos) external override authorizedOnly {
        for(uint256 i = 0; i < froms.length; i++) {
            if(froms[i] != address(0)) {
                isAddress[froms[i]] = false;
            }
            if(tos[i] != address(0)) {
                isAddress[tos[i]] = true;
            }
            emit MultisigAddress(froms[i], tos[i]);
        }
    }

    function setMinimumSignatures(uint256 newValue) external override authorizedOnly returns(uint256 oldValue) {
        oldValue = minimumSignatures;
        minimumSignatures = newValue;
    }

    function request(CallRequest[] calldata requests) external payable override {
        for(uint256 i = 0; i < requests.length; i++) {
            _request(requests[i]);
        }
    }

    function _request(CallRequest calldata singleRequest) private {
        address[] memory signers = new address[](singleRequest.requestSignatures.length);
        require((((_signed[msg.sender] = isAddress[msg.sender]) ? 1 : 0) + signers.length) >= minimumSignatures, "insufficient signatures");
        for(uint256 i = 0; i < signers.length; i++) {
            signers[i] = _validate(singleRequest.call, singleRequest.requestSignatures[i]);
        }
        _call(singleRequest.call);
        delete _signed[msg.sender];
        for(uint256 i = 0; i < signers.length; i++) {
            delete _signed[signers[i]];
        }
    }

    function _validate(Call memory _callData, bytes memory permitSignature) private returns(address) {
        (address signer, uint8 v, bytes32 r, bytes32 s, uint256 deadline) = abi.decode(permitSignature, (address, uint8, bytes32, bytes32, uint256));

        require(block.timestamp < deadline, "deadline");
        require(isAddress[signer], "signer");
        require(!_signed[signer], "already signed");

        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(TYPEHASH_REQUEST, msg.sender, _callData.location, keccak256(_callData.bytecode), keccak256(_callData.payload), _callData.value, _callData.asActiveComponent, nonces[signer]++, deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == signer, 'INVALID_SIGNATURE');

        _signed[signer] = true;

        return signer;
    }

    function _call(Call memory _callData) private {
        address location = _callData.location;
        if(_callData.bytecode.length > 0) {
            require(_callData.location == address(0), "location");
            bytes memory bytecode = _callData.bytecode;
            uint256 codeSize;
            assembly {
                location := create(0, add(bytecode, 0x20), mload(bytecode))
                codeSize := extcodesize(location)
            }
            require(location != address(0), "code location");
            require(codeSize > 0, "code size");
        }
        if(_callData.payload.length == 0) {
            require(_callData.bytecode.length > 0, "bytecode");
            return;
        }
        require(location != address(0), "location");
        bytes32 key = _callData.asActiveComponent ? BehaviorUtilities.randomKey(_key++) : bytes32(0);
        if(key != bytes32(0)) {
            _set(Component(key, location, true, false));
        }
        location.submit(_callData.value, _callData.payload);
        if(key != bytes32(0)) {
            _set(Component(key, address(0), false, false));
        }
    }
}