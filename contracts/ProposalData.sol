// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

struct ProposalData {
    address proxy;
    string codeName;
    bool emergency;
    address sourceLocation;
    uint256 sourceLocationId;
    address location;
    bool submitable;
    string methodSignature;
    string returnAbiParametersArray;
    bool isInternal;
    bool needsSender;
    string replaces;
    uint256 surveyEndBlock;
    address proposer;
    address getItemProposalWeightFunctionalityAddress;
    address dfoItemCollectionAddress;
    address emergencyTokenAddress;
    uint256 votesHardCap;
}