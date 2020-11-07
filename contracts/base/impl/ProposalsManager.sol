// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IProposalsManager.sol";
import "../../core/model/IOrganization.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

library ProposalsManagerLibrary {
    using ReflectionUtilities for address;

    function createCodeSequence(IProposalsManager.ProposalCode[] memory codeSequenceInput) external returns (address[] memory codeSequence) {
        require(codeSequenceInput.length > 0, "code");
        codeSequence = new address[](codeSequenceInput.length);
        for(uint256 i = 0; i < codeSequenceInput.length; i++) {
            address code = codeSequenceInput[i].location;
            bytes memory bytecode = codeSequenceInput[i].bytecode;
            if(bytecode.length > 0) {
                assembly {
                    code := create(0, add(bytecode, 0x20), mload(bytecode))
                }
            }
            codeSequence[i] = code;
            bool isContract;
            assembly {
                isContract := not(iszero(extcodesize(code)))
            }
            require(isContract, "code");
        }
    }

    function giveBack(address[] memory collections, uint256[] memory objectIds, uint256[] memory accepts, uint256[] memory refuses, address receiver) external returns (bool almostOne) {
        for(uint256 i = 0; i < collections.length; i++) {
            uint256 amount = accepts[i] + refuses[i];
            if(amount == 0) {
                continue;
            }
            if(collections[i] != address(0)) {
                collections[i].submit(0, abi.encodeWithSelector(IERC1155(address(0)).safeTransferFrom.selector, address(this), receiver, objectIds[i], amount, ""));
            } else {
                _safeTransferOrTransferFrom(address(uint160(objectIds[i])), address(0), receiver, amount);
            }
            almostOne = true;
        }
    }

    function safeTransferOrTransferFrom(address erc20TokenAddress, address from, address to, uint256 value) external {
        _safeTransferOrTransferFrom(erc20TokenAddress, from, to, value);
    }

    function _safeTransferOrTransferFrom(address erc20TokenAddress, address from, address to, uint256 value) private {
        if(value == 0) {
            return;
        }
        if(erc20TokenAddress == address(0)) {
            if(from != address(0)) {
                return;
            }
            to.submit(value, "");
            return;
        }
        bytes memory returnData = erc20TokenAddress.submit(0, from == address(0) ? abi.encodeWithSelector(IERC20(address(0)).transfer.selector, to, value) : abi.encodeWithSelector(IERC20(address(0)).transferFrom.selector, from, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)));
    }

    function setConfiguration(IProposalsManager.ProposalConfiguration storage _configuration, IProposalsManager.ProposalConfiguration memory newValue) external returns(IProposalsManager.ProposalConfiguration memory oldValue) {
        oldValue = _configuration;
        require(newValue.collections.length == newValue.objectIds.length && newValue.collections.length == newValue.weights.length, "lengths");
        _configuration.collections = newValue.collections;
        _configuration.objectIds = newValue.objectIds;
        _configuration.weights = newValue.weights;
        _configuration.creationRules = newValue.creationRules;
        _configuration.triggeringRules = newValue.triggeringRules;
        _configuration.canTerminateAddresses = newValue.canTerminateAddresses;
        _configuration.validatorsAddresses = newValue.validatorsAddresses;
    }

    function performAuthorizedCall(address host, bytes32 key, address subject, bytes memory inputData) external {
        IOrganization organization = IOrganization(host);
        organization.set(IOrganization.Component(key, subject, true, false));
        (bool result, bytes memory returnData) = subject.call(inputData);
        if(!result) {
            returnData = abi.encode(subject, returnData);
            assembly {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
        if(organization.isActive(subject)) {
            organization.set(IOrganization.Component(key, address(0), false, false));
        }
    }
}

contract ProposalsManager is IProposalsManager, LazyInitCapableElement {
    using ReflectionUtilities for address;

    mapping(bytes32 => Proposal) private _proposal;
    mapping(bytes32 => uint256) public override weight;

    // Mapping for proposalId => address => item => weighted accept votes
    mapping(bytes32 => mapping(address => mapping(bytes32 => uint256))) private _accept;

    // Mapping for proposalId => address => item => weighted refuse votes
    mapping(bytes32 => mapping(address => mapping(bytes32 => uint256))) private _refuse;

    // If the address has withdrawed or not the given objectId
    mapping(bytes32 => mapping(address => mapping(bytes32 => uint256))) private _toWithdraw;

    ProposalConfiguration private _configuration;

    uint256 private _keyIndex;

    bool private _hostIsProposalCommand;

    bytes32 public override lastProposalId;

    mapping(address => uint256) public override lastVoteBlock;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        (_hostIsProposalCommand, lazyInitData) = abi.decode(lazyInitData, (bool, bytes));
        if(lazyInitData.length > 0) {
            ProposalsManagerLibrary.setConfiguration(_configuration, abi.decode(lazyInitData, (ProposalConfiguration)));
        }
        return "";
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IProposalsManager).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }

    bytes32[] private _toTerminate;

    function batchCreate(ProposalCodes[] calldata proposalCodesArray) external override returns(bytes32[] memory createdProposalIds) {
        createdProposalIds = new bytes32[](proposalCodesArray.length);
        ProposalConfiguration memory standardConfiguration = _configuration;
        for(uint256 i = 0; i < proposalCodesArray.length; i++) {
            ProposalCodes memory proposalCodes = proposalCodesArray[i];
            bytes32 proposalId = createdProposalIds[i] = lastProposalId = _randomKey();
            if(proposalCodes.alsoTerminate) {
                _toTerminate.push(proposalId);
            }
            (address[] memory codeSequence, ProposalConfiguration memory localConfiguration) =
            _hostIsProposalCommand ? IExternalProposalsManagerCommands(host).createProposalCodeSequence(proposalId, proposalCodes.codes, msg.sender) :
            (ProposalsManagerLibrary.createCodeSequence(proposalCodes.codes), standardConfiguration);
            (address[] memory collections, uint256[] memory objectIds, uint256[] memory weights) = (
                localConfiguration.collections.length > 0 ? localConfiguration.collections : standardConfiguration.collections,
                localConfiguration.objectIds.length > 0 ? localConfiguration.objectIds : standardConfiguration.objectIds,
                localConfiguration.weights.length > 0 ? localConfiguration.weights : standardConfiguration.weights
            );
            for(uint256 z = 0; z < collections.length; z++) {
                bytes32 key = keccak256(abi.encodePacked(proposalId, collections[z], objectIds[z]));
                emit ProposalWeight(proposalId, collections[z], objectIds[z], key, weight[key] = weights[z]);
            }
            (bool result, bytes memory response) = _validateRules(localConfiguration.creationRules != address(0) ? localConfiguration.creationRules : standardConfiguration.creationRules, proposalId, abi.encode(_proposal[proposalId] = Proposal(
                msg.sender,
                codeSequence,
                block.number,
                0,
                0,
                localConfiguration.triggeringRules != address(0) ? localConfiguration.triggeringRules : standardConfiguration.triggeringRules,
                localConfiguration.canTerminateAddresses.length > 0 ? localConfiguration.canTerminateAddresses : standardConfiguration.canTerminateAddresses,
                localConfiguration.validatorsAddresses.length > 0 ? localConfiguration.validatorsAddresses : standardConfiguration.validatorsAddresses,
                false,
                0,
                abi.encode(collections, objectIds, weights)
            )), msg.sender);
            if(!result) {
                if(response.length > 0) {
                    assembly {
                        revert(add(response, 0x20), mload(response))
                    }
                } else {
                    revert("creation");
                }
            }
            for(uint256 z = 0; z < codeSequence.length; z++) {
                emit ProposalCreated(msg.sender, codeSequence[z], proposalId);
            }
        }
        bytes32[] memory toTerminate = _toTerminate;
        delete _toTerminate;
        if(toTerminate.length > 0) {
            terminate(toTerminate);
        }
    }

    function list(bytes32[] calldata proposalIds) external override view returns(Proposal[] memory proposals) {
        proposals = new Proposal[](proposalIds.length);
        for(uint256 i = 0; i < proposalIds.length; i++) {
            proposals[i] = _proposal[proposalIds[i]];
        }
    }

    function votes(bytes32[] calldata proposalIds, address[] calldata voters, bytes32[][] calldata items) external override view returns(uint256[][] memory accepts, uint256[][] memory refuses, uint256[][] memory toWithdraw) {
        accepts = new uint256[][](proposalIds.length);
        refuses = new uint256[][](proposalIds.length);
        toWithdraw = new uint256[][](proposalIds.length);
        for(uint256 i = 0; i < proposalIds.length; i++) {
            accepts[i] = new uint256[](items[i].length);
            refuses[i] = new uint256[](items[i].length);
            toWithdraw[i] = new uint256[](items[i].length);
            for(uint256 z = 0; z < items[i].length; z++) {
                accepts[i][z] = _accept[proposalIds[i]][voters[i]][items[i][z]];
                refuses[i][z] = _refuse[proposalIds[i]][voters[i]][items[i][z]];
                toWithdraw[i][z] = _toWithdraw[proposalIds[i]][voters[i]][items[i][z]];
            }
        }
    }

    function onERC1155Received(address operator, address from, uint256 objectId, uint256 amount, bytes calldata data) external override returns(bytes4) {
        if(operator != address(this) || data.length > 0) {
            _onItemReceived(from, objectId, amount, data);
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address operator, address from, uint256[] calldata objectIds, uint256[] calldata amounts, bytes calldata data) external override returns (bytes4) {
        if(operator != address(this) || data.length > 0) {
            bytes[] memory dataArray = abi.decode(data, (bytes[]));
            for(uint256 i = 0; i < objectIds.length; i++) {
                _onItemReceived(from, objectIds[i], amounts[i], dataArray[i]);
            }
        }
        return this.onERC1155BatchReceived.selector;
    }

    function vote(address erc20TokenAddress, bytes memory permitSignature, bytes32 proposalId, uint256 accept, uint256 refuse, address voter, bool alsoTerminate) public override payable {
        if(permitSignature.length > 0) {
            (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = abi.decode(permitSignature, (uint8, bytes32, bytes32, uint256));
            IERC20Permit(erc20TokenAddress).permit(msg.sender, address(this), (accept + refuse), deadline, v, r, s);
        }
        uint256 transferedValue = _safeTransferFrom(erc20TokenAddress, (accept + refuse));
        require(erc20TokenAddress != address(0) || transferedValue == msg.value, "ETH");
        _vote(msg.sender, address(0), uint160(erc20TokenAddress), transferedValue, proposalId, accept, refuse, voter, alsoTerminate);
    }

    function batchVote(bytes[] calldata data) external override payable {
        for(uint256 i = 0; i < data.length; i++) {
            (address erc20TokenAddress, bytes memory permitSignature, bytes32 proposalId, uint256 accept, uint256 refuse, address voter, bool alsoTerminate) = abi.decode(data[i], (address, bytes, bytes32, uint256, uint256, address, bool));
            vote(erc20TokenAddress, permitSignature, proposalId, accept, refuse, voter, alsoTerminate);
        }
    }

    function withdrawAll(bytes32[] memory proposalIds, address voterOrReceiver, bool afterTermination) external override {
        bool almostOne = false;
        address voter = msg.sender;
        address receiver = voterOrReceiver != address(0) ? voterOrReceiver : msg.sender;
        if(afterTermination) {
            require(voterOrReceiver != address(0), "Mandatory");
            voter = voterOrReceiver;
            receiver = voterOrReceiver;
        }
        for(uint256 z = 0; z < proposalIds.length; z++) {
            bytes32 proposalId = proposalIds[z];
            (bool canVote, address[] memory collections, uint256[] memory objectIds, uint256[] memory accepts, uint256[] memory refuses) = _withdrawAll(proposalId, afterTermination ? voter : msg.sender, voter);
            require(canVote ? !afterTermination : afterTermination, "termination switch");
            bool result = ProposalsManagerLibrary.giveBack(collections, objectIds, accepts, refuses, receiver);
            almostOne = almostOne || result;
        }
        require(almostOne, "No transfers");
    }

    function terminate(bytes32[] memory proposalIds) public override {
        for(uint256 i = 0; i < proposalIds.length; i++) {
            Proposal storage proposal = _proposal[proposalIds[i]];
            require(proposal.terminationBlock == 0, "terminated");
            require(proposal.validationPassed || _mustStopAtFirst(true, proposal.canTerminateAddresses, proposalIds[i], msg.sender, msg.sender), "Cannot Terminate");
            if(!proposal.validationPassed) {
                if(_mustStopAtFirst(false, proposal.validatorsAddresses, proposalIds[i], msg.sender, msg.sender)) {
                    _finalizeTermination(proposalIds[i], proposal, false, false);
                    emit ProposalTerminated(proposalIds[i], false, "");
                    continue;
                }
            }
            (bool result, bytes memory errorData) = address(this).call(abi.encodeWithSelector(this.tryExecute.selector, proposal.codeSequence, abi.encodeWithSelector(0xe751f271, proposalIds[i]), new bytes[](0)));//execute(bytes32)
            if(result && errorData.length == 0) {
                (result, ) = _validateRules(proposal.triggeringRules, proposalIds[i], abi.encode(proposal), msg.sender);
                errorData = result ? errorData : bytes("triggering");
            }
            _finalizeTermination(proposalIds[i], proposal, true, result && errorData.length == 0);
            emit ProposalTerminated(proposalIds[i], result, errorData);
        }
    }

    function tryExecute(address[] memory codeSequence, bytes memory inputData, bytes[] memory bytecodes) external {
        require(msg.sender == address(this));
        for(uint256 i = 0; i < codeSequence.length; i++) {
            address codeLocation = codeSequence[i];
            if(i < bytecodes.length && bytecodes[i].length > 0) {
                require(codeSequence[i] == address(0), "codeLocation");
                bytes memory bytecode = bytecodes[i];
                uint256 codeSize;
                assembly {
                    codeLocation := create(0, add(bytecode, 0x20), mload(bytecode))
                    codeSize := extcodesize(codeLocation)
                }
                require(codeLocation != address(0), "codeLocation");
                require(codeSize > 0, "codeSize");
            }
            ProposalsManagerLibrary.performAuthorizedCall(host, _randomKey(), codeLocation, inputData);
        }
    }

    function configuration() external override view returns(ProposalConfiguration memory) {
        return _configuration;
    }

    function setConfiguration(ProposalConfiguration calldata newValue) external override authorizedOnly returns(ProposalConfiguration memory oldValue) {
        return ProposalsManagerLibrary.setConfiguration(_configuration, newValue);
    }

    function _onItemReceived(address from, uint256 objectId, uint256 amount, bytes memory data) private {
        (bytes32 proposalId, uint256 accept, uint256 refuse, address voter, bool alsoTterminate) = abi.decode(data, (bytes32, uint256, uint256, address, bool));
        _vote(from, msg.sender, objectId, amount, proposalId, accept, refuse, voter, alsoTterminate);
    }

    function _vote(address from, address collection, uint256 objectId, uint256 amount, bytes32 proposalId, uint256 accept, uint256 refuse, address voterInput, bool alsoTterminate) private {
        if(amount == 0) {
            return;
        }
        require(amount == (accept + refuse), "amount");
        address voter = voterInput == address(0) ? from : voterInput;
        _ensure(proposalId, from, voter, true);
        bytes32 item = keccak256(abi.encodePacked(proposalId, collection, objectId));
        uint256 proposalWeight = weight[item];
        require(proposalWeight > 0, "item");
        _toWithdraw[proposalId][voter][item] += (accept + refuse);
        if(accept > 0) {
            _accept[proposalId][voter][item] += accept;
            _proposal[proposalId].accept += (accept * proposalWeight);
            emit Accept(proposalId, voter, item, accept);
        }
        if(refuse > 0) {
            _refuse[proposalId][voter][item] += refuse;
            _proposal[proposalId].refuse += (refuse * proposalWeight);
            emit Refuse(proposalId, voter, item, refuse);
        }
        if(accept > 0 || refuse > 0) {
            lastVoteBlock[voter] = block.number;
        }
        if(alsoTterminate) {
            bytes32[] memory proposalIds = new bytes32[](1);
            proposalIds[0] = proposalId;
            terminate(proposalIds);
        }
    }

    function _ensure(bytes32 proposalId, address from, address voter, bool voteOrWithtraw) private view returns (bool canVote) {
        Proposal memory proposal = _proposal[proposalId];
        require(proposal.creationBlock > 0, "proposal");
        if(_hostIsProposalCommand) {
            bytes memory response = IExternalProposalsManagerCommands(host).isVotable(proposalId, proposal, from, voter, voteOrWithtraw);
            if(response.length > 0) {
                return abi.decode(response, (bool));
            }
        }
        bool isTerminated;
        canVote = !(isTerminated = proposal.terminationBlock != 0) && !proposal.validationPassed && !_mustStopAtFirst(true, proposal.canTerminateAddresses, proposalId, from, voter);
        if(voteOrWithtraw) {
            require(canVote, "vote");
        } else {
            require(block.number > lastVoteBlock[voter], "wait 1 block");
            require(!isTerminated || _proposal[proposalId].terminationBlock < block.number, "early");
        }
    }

    function _mustStopAtFirst(bool value, address[] memory checkers, bytes32 proposalId, address from, address voter) private view returns(bool) {
        if(checkers.length == 0 || (checkers.length == 1 && checkers[0] == address(0))) {
            return value;
        }
        Proposal memory proposal = _proposal[proposalId];
        bytes memory inputData = abi.encodeWithSelector(IProposalChecker(address(0)).check.selector, address(this), proposalId, abi.encode(proposal), from, voter);
        for(uint256 i = 0; i < checkers.length; i++) {
            (bool result, bytes memory response) = checkers[i].staticcall(inputData);
            if((!result || abi.decode(response, (bool))) == value) {
                return true;
            }
        }
        return false;
    }

    function _validateRules(address rulesToValidate, bytes32 key, bytes memory payload, address sender) private returns(bool result, bytes memory response) {
        if(rulesToValidate == address(0)) {
            return (true, "");
        }
        (result, response) = rulesToValidate.call(abi.encodeWithSelector(IProposalChecker(address(0)).check.selector, address(this), key, payload, sender, sender));
        if(result) {
            result = abi.decode(response, (bool));
            response = "";
        }
    }

    function _finalizeTermination(bytes32 proposalId, Proposal storage proposal, bool validationPassed, bool result) internal virtual {
        proposal.validationPassed = validationPassed;
        if(_hostIsProposalCommand) {
            proposal.terminationBlock = IExternalProposalsManagerCommands(host).proposalCanBeFinalized(proposalId, proposal, validationPassed, result) ? block.number : proposal.terminationBlock;
            return;
        }
        proposal.terminationBlock = !validationPassed || result ? block.number : proposal.terminationBlock;
    }

    function _safeTransferFrom(address erc20TokenAddress, uint256 value) private returns(uint256) {
        if(erc20TokenAddress == address(0)) {
            return value;
        }
        uint256 previousBalance = IERC20(erc20TokenAddress).balanceOf(address(this));
        ProposalsManagerLibrary.safeTransferOrTransferFrom(erc20TokenAddress, msg.sender, address(this), value);
        uint256 actualBalance = IERC20(erc20TokenAddress).balanceOf(address(this));
        require(actualBalance > previousBalance);
        require(actualBalance - previousBalance == value, "unsupported");
        return actualBalance - previousBalance;
    }

    function _randomKey() private returns (bytes32) {
        return keccak256(abi.encode(_keyIndex++, block.timestamp, block.number, tx.origin, tx.gasprice, block.coinbase, block.difficulty, msg.sender, blockhash(block.number - 5)));
    }

    function _withdrawAll(bytes32 proposalId, address sender, address voter) private returns(bool canVote, address[] memory collections, uint256[] memory objectIds, uint256[] memory accepts, uint256[] memory refuses) {
        canVote = _ensure(proposalId, sender, voter, false);
        Proposal storage proposal = _proposal[proposalId];
        require(!canVote || block.number > proposal.creationBlock, "Cannot withdraw during creation");
        (collections, objectIds,) = abi.decode(proposal.votingTokens, (address[], uint256[], uint256[]));
        accepts = new uint256[](collections.length);
        refuses = new uint256[](collections.length);
        for(uint256 i = 0; i < collections.length; i++) {
            (accepts[i], refuses[i]) = _singleWithdraw(proposal, proposalId, collections[i], objectIds[i], voter, canVote);
        }
    }

    function _singleWithdraw(Proposal storage proposal, bytes32 proposalId, address collection, uint256 objectId, address voter, bool canVote) private returns(uint256 accept, uint256 refuse) {
        bytes32 item = keccak256(abi.encodePacked(proposalId, collection, objectId));
        uint256 proposalWeight = weight[item];
        require(proposalWeight > 0, "item");
        accept = _accept[proposalId][voter][item];
        refuse = _refuse[proposalId][voter][item];
        require(_toWithdraw[proposalId][voter][item] >= (accept + refuse), "amount");
        if(accept > 0) {
            _toWithdraw[proposalId][voter][item] -= accept;
            if(canVote) {
                _accept[proposalId][voter][item] -= accept;
                proposal.accept -= (accept * proposalWeight);
                emit RetireAccept(proposalId, voter, item, accept);
            }
        }
        if(refuse > 0) {
            _toWithdraw[proposalId][voter][item] -= refuse;
            if(canVote) {
                _refuse[proposalId][voter][item] -= refuse;
                proposal.refuse -= (refuse * proposalWeight);
                emit RetireRefuse(proposalId, voter, item, refuse);
            }
        }
    }
}