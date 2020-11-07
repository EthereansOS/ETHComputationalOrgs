// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../core/model/IOrganization.sol";

interface IMultisigOrganization is IOrganization {

    function TYPEHASH_REQUEST() external view returns(bytes32);
    function DOMAIN_SEPARATOR() external view returns(bytes32);
    function EIP712_REQUEST_DOMAINSEPARATOR_NAME_AND_VERSION() external pure returns(string memory domainSeparatorName, string memory domainSeparatorVersion);

    event MultisigAddress(address indexed from, address indexed to);

    function isAddress(address subject) external view returns (bool);
    function setAddresses(address[] calldata froms, address[] calldata tos) external;

    function nonces(address subject) external view returns (uint256);

    function minimumSignatures() external view returns(uint256);
    function setMinimumSignatures(uint256 newValue) external returns(uint256 oldValue);

    struct Call {
        address location;
        bytes bytecode;
        bytes payload;
        uint256 value;
        bool asActiveComponent;
    }

    struct CallRequest {
        Call call;
        bytes[] requestSignatures;
    }

    function request(CallRequest[] calldata requests) external payable;
}