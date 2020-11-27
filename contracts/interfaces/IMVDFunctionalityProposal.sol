// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../ProposalData.sol";

interface IMVDFunctionalityProposal {

    function init(ProposalData calldata proposalData) external;

    function getProposalData() external view returns(ProposalData memory);
    function getVote(address addr) external view returns(uint256 accept, uint256 refuse);
    function getVotes() external view returns(uint256, uint256);
    function start() external;
    function disable() external;
    function isVotesHardCapReached() external view returns(bool);
    function isDisabled() external view returns(bool);
    function isTerminated() external view returns(bool);
    function retireAccept(uint256 amount, uint256 objectId) external;
    function batchRetireAccept(uint256[] calldata amounts, uint256[] calldata objectIds) external;
    function moveToAccept(uint256 amount, uint256 objectId) external;
    function retireRefuse(uint256 amount, uint256 objectId) external;
    function batchRetireRefuse(uint256[] calldata amounts, uint256[] calldata objectIds) external;
    function moveToRefuse(uint256 amount, uint256 objectId) external;
    function retireAll(uint256[] calldata objectIds) external;
    function withdraw() external;
    function terminate() external;
    function set() external;

    event Accept(address indexed voter, uint256 amount);
    event RetireAccept(address indexed voter, uint256 amount);
    event MoveToAccept(address indexed voter, uint256 amount);
    event Refuse(address indexed voter, uint256 amount);
    event RetireRefuse(address indexed voter, uint256 amount);
    event MoveToRefuse(address indexed voter, uint256 amount);
    event RetireAll(address indexed voter, uint256 amount);
}