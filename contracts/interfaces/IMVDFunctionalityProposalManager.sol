// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../ProposalData.sol";

interface IMVDFunctionalityProposalManager {
    function init(address proposalModelAddress) external returns(address);
    function model() external view returns(address);
    function newProposal(ProposalData calldata proposalData) external returns(address);
    function checkProposal(address proposalAddress) external view;
    function getProxy() external view returns (address);
    function setProxy() external;
    function isValidProposal(address proposal) external view returns (bool);
}