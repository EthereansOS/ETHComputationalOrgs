// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;

struct Functionality {
    string codeName;
    address sourceLocation;
    uint256 sourceLocationId;
    address location;
    bool submitable;
    string methodSignature;
    string returnAbiParametersArray;
    bool isInternal;
    bool needsSender;
    address proposalAddress;
    bool active;
}