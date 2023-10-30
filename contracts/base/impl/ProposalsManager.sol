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

    event ProposalCreated(address indexed proposer, address indexed code, bytes32 indexed proposalId);
    event ProposalWeight(bytes32 indexed proposalId, address indexed collection, uint256 indexed id, bytes32 key, uint256 weight);
    event ProposalTerminated(bytes32 indexed proposalId, bool result, bytes errorData);

    event Accept(bytes32 indexed proposalId, address indexed voter, bytes32 indexed item, uint256 amount);
    event MoveToAccept(bytes32 indexed proposalId, address indexed voter, bytes32 indexed item, uint256 amount);
    event RetireAccept(bytes32 indexed proposalId, address indexed voter, bytes32 indexed item, uint256 amount);

    event Refuse(bytes32 indexed proposalId, address indexed voter, bytes32 indexed item, uint256 amount);
    event MoveToRefuse(bytes32 indexed proposalId, address indexed voter, bytes32 indexed item, uint256 amount);
    event RetireRefuse(bytes32 indexed proposalId, address indexed voter, bytes32 indexed item, uint256 amount);

    function votes(ProposalsManager.Storage storage _storage, bytes32[] calldata proposalIds, address[] calldata voters, bytes32[][] calldata items) external view returns(uint256[][] memory accepts, uint256[][] memory refuses, uint256[][] memory toWithdraw) {
        accepts = new uint256[][](proposalIds.length);
        refuses = new uint256[][](proposalIds.length);
        toWithdraw = new uint256[][](proposalIds.length);
        for(uint256 i = 0; i < proposalIds.length; i++) {
            accepts[i] = new uint256[](items[i].length);
            refuses[i] = new uint256[](items[i].length);
            toWithdraw[i] = new uint256[](items[i].length);
            for(uint256 z = 0; z < items[i].length; z++) {
                accepts[i][z] = _storage._accept[proposalIds[i]][voters[i]][items[i][z]];
                refuses[i][z] = _storage._refuse[proposalIds[i]][voters[i]][items[i][z]];
                toWithdraw[i][z] = _storage._toWithdraw[proposalIds[i]][voters[i]][items[i][z]];
            }
        }
    }

    function batchCreate(ProposalsManager.Storage storage _storage, address host, IProposalsManager.ProposalCodes[] calldata proposalCodesArray) external returns(bytes32[] memory createdProposalIds) {
        createdProposalIds = new bytes32[](proposalCodesArray.length);
        IProposalsManager.ProposalConfiguration memory standardConfiguration = _storage._configuration;
        for(uint256 i = 0; i < proposalCodesArray.length; i++) {
            IProposalsManager.ProposalCodes memory proposalCodes = proposalCodesArray[i];
            bytes32 proposalId = createdProposalIds[i] = _storage.lastProposalId = _randomKey(_storage);
            if(proposalCodes.alsoTerminate) {
                _storage._toTerminate.push(proposalId);
            }
            (address[] memory codeSequence, IProposalsManager.ProposalConfiguration memory localConfiguration) =
            _storage._hostIsProposalCommand ? IExternalProposalsManagerCommands(host).createProposalCodeSequence(proposalId, proposalCodes.codes, msg.sender) :
            (_createCodeSequence(proposalCodes.codes), standardConfiguration);
            (codeSequence, localConfiguration) = codeSequence.length != 0 ? (codeSequence, localConfiguration) :
            (_createCodeSequence(proposalCodes.codes), standardConfiguration);
            localConfiguration = _cleanConfiguration(standardConfiguration, localConfiguration);
            (address[] memory collections, uint256[] memory objectIds, uint256[] memory weights) = (
                localConfiguration.collections,
                localConfiguration.objectIds,
                localConfiguration.weights
            );
            _emitProposalWeight(_storage, proposalId, collections, objectIds, weights);
            IProposalsManager.Proposal memory proposal = IProposalsManager.Proposal(
                msg.sender,
                codeSequence,
                block.number,
                block.timestamp,
                0,
                0,
                localConfiguration.triggeringRules,
                localConfiguration.canTerminateAddresses,
                localConfiguration.validatorsAddresses,
                false,
                0,
                abi.encode(collections, objectIds, weights),
                localConfiguration.triggeringData,
                localConfiguration.canTerminateData,
                localConfiguration.validatorsData
            );
            _storage._proposal[proposalId] = proposal;
            (bool result, bytes memory response) = _validateRules(localConfiguration.creationRules, localConfiguration.creationData, proposalId, abi.encode(proposal), msg.sender);
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
    }

    function _cleanConfiguration(IProposalsManager.ProposalConfiguration memory standardConfiguration, IProposalsManager.ProposalConfiguration memory localConfiguration) private pure returns(IProposalsManager.ProposalConfiguration memory configuration) {
        configuration.collections = localConfiguration.collections.length > 0 ? localConfiguration.collections : standardConfiguration.collections;
        configuration.objectIds = localConfiguration.objectIds.length > 0 ? localConfiguration.objectIds : standardConfiguration.objectIds;
        configuration.weights = localConfiguration.weights.length > 0 ? localConfiguration.weights : standardConfiguration.weights;

        configuration.creationRules = localConfiguration.creationRules;
        configuration.triggeringRules = localConfiguration.triggeringRules;
        configuration.canTerminateAddresses = localConfiguration.canTerminateAddresses.length > 0 ? localConfiguration.canTerminateAddresses : standardConfiguration.canTerminateAddresses;
        configuration.validatorsAddresses = localConfiguration.validatorsAddresses.length > 0 ? localConfiguration.validatorsAddresses : standardConfiguration.validatorsAddresses;

        configuration.creationData = localConfiguration.creationData;
        configuration.triggeringData = localConfiguration.triggeringData;
        configuration.canTerminateData = localConfiguration.canTerminateAddresses.length > 0 ? localConfiguration.canTerminateData : standardConfiguration.canTerminateData;
        configuration.validatorsData = localConfiguration.validatorsAddresses.length > 0 ? localConfiguration.validatorsData : standardConfiguration.validatorsData;
    }

    function _emitProposalWeight(ProposalsManager.Storage storage _storage, bytes32 proposalId, address[] memory collections, uint256[] memory objectIds, uint256[] memory weights) private {
        for(uint256 z = 0; z < collections.length; z++) {
            bytes32 key = keccak256(abi.encodePacked(proposalId, collections[z], objectIds[z]));
            emit ProposalWeight(proposalId, collections[z], objectIds[z], key, _storage.weight[key] = weights[z]);
        }
    }

    function _createCodeSequence(IProposalsManager.ProposalCode[] memory codeSequenceInput) private returns (address[] memory codeSequence) {
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

    function _vote(ProposalsManager.Storage storage _storage, address from, address collection, uint256 objectId, uint256 amount, bytes32 proposalId, uint256 accept, uint256 refuse, address voterInput) external {
        require(amount == (accept + refuse) && amount != 0, "amount");
        address voter = voterInput == address(0) ? from : voterInput;
        bytes32 item = keccak256(abi.encodePacked(proposalId, collection, objectId));
        uint256 proposalWeight = _storage.weight[item];
        require(proposalWeight > 0, "item");
        _storage._toWithdraw[proposalId][voter][item] += (accept + refuse);
        if(accept > 0) {
            _storage._accept[proposalId][voter][item] += accept;
            _storage._proposal[proposalId].accept += (accept * proposalWeight);
            emit Accept(proposalId, voter, item, accept);
        }
        if(refuse > 0) {
            _storage._refuse[proposalId][voter][item] += refuse;
            _storage._proposal[proposalId].refuse += (refuse * proposalWeight);
            emit Refuse(proposalId, voter, item, refuse);
        }
        if(accept > 0 || refuse > 0) {
            _storage.lastVoteBlock[voter] = block.number;
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
        _configuration.creationData = newValue.creationData;
        _configuration.validatorsData = newValue.validatorsData;
        _configuration.canTerminateData = newValue.canTerminateData;
        _configuration.triggeringData = newValue.triggeringData;
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

    function _randomKey(ProposalsManager.Storage storage _storage) private returns (bytes32) {
        return keccak256(abi.encode(_storage._keyIndex++, block.timestamp, block.number, tx.origin, tx.gasprice, block.coinbase, block.difficulty, msg.sender, blockhash(block.number - 5)));
    }

    function _validateRules(address rulesToValidate, bytes memory rulesData, bytes32 key, bytes memory payload, address sender) private returns(bool result, bytes memory response) {
        if(rulesToValidate == address(0)) {
            return (true, "");
        }
        (result, response) = rulesToValidate.call(abi.encodeWithSelector(IProposalChecker(address(0)).check.selector, address(this), rulesData, key, payload, sender, sender));
        if(result) {
            result = abi.decode(response, (bool));
            response = "";
        }
    }
}

contract ProposalsManager is IProposalsManager, LazyInitCapableElement {
    using ReflectionUtilities for address;

    struct Storage {
        mapping(bytes32 => Proposal) _proposal;
        mapping(bytes32 => uint256) weight;
        mapping(bytes32 => mapping(address => mapping(bytes32 => uint256))) _accept;
        mapping(bytes32 => mapping(address => mapping(bytes32 => uint256))) _refuse;
        mapping(bytes32 => mapping(address => mapping(bytes32 => uint256))) _toWithdraw;
        ProposalConfiguration _configuration;
        uint256 _keyIndex;
        bool _hostIsProposalCommand;
        bytes32 lastProposalId;
        mapping(address => uint256) lastVoteBlock;
        bytes32[] _toTerminate;
    }

    Storage private _storage;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        (_storage._hostIsProposalCommand, lazyInitData) = abi.decode(lazyInitData, (bool, bytes));
        if(lazyInitData.length > 0) {
            ProposalsManagerLibrary.setConfiguration(_storage._configuration, abi.decode(lazyInitData, (ProposalConfiguration)));
        }
        return "";
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IProposalsManager).interfaceId;
    }

    function lastProposalId() external override view returns(bytes32) {
        return _storage.lastProposalId;
    }

    function lastVoteBlock(address voter) external override view returns (uint256) {
        return _storage.lastVoteBlock[voter];
    }

    function weight(bytes32 code) external override view returns(uint256) {
        return _storage.weight[code];
    }

    function batchCreate(ProposalCodes[] calldata proposalCodesArray) external override returns(bytes32[] memory createdProposalIds) {
        createdProposalIds = ProposalsManagerLibrary.batchCreate(_storage, host, proposalCodesArray);
        bytes32[] memory toTerminate = _storage._toTerminate;
        delete _storage._toTerminate;
        if(toTerminate.length > 0) {
            terminate(toTerminate);
        }
    }

    function list(bytes32[] calldata proposalIds) external override view returns(Proposal[] memory proposals) {
        proposals = new Proposal[](proposalIds.length);
        for(uint256 i = 0; i < proposalIds.length; i++) {
            proposals[i] = _storage._proposal[proposalIds[i]];
        }
    }

    function votes(bytes32[] calldata proposalIds, address[] calldata voters, bytes32[][] calldata items) external override view returns(uint256[][] memory accepts, uint256[][] memory refuses, uint256[][] memory toWithdraw) {
        return ProposalsManagerLibrary.votes(_storage, proposalIds, voters, items);
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

    function _vote(address from, address collection, uint256 objectId, uint256 amount, bytes32 proposalId, uint256 accept, uint256 refuse, address voterInput, bool alsoTerminate) private {

        _ensure(proposalId, from, voterInput == address(0) ? from : voterInput, true);

        ProposalsManagerLibrary._vote(_storage, from, collection, objectId, amount, proposalId, accept, refuse, voterInput);

        if(alsoTerminate) {
            bytes32[] memory proposalIds = new bytes32[](1);
            proposalIds[0] = proposalId;
            terminate(proposalIds);
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
            Proposal storage proposal = _storage._proposal[proposalIds[i]];
            require(proposal.terminationBlock == 0, "terminated");
            require(proposal.validationPassed || _mustStopAtFirst(true, proposal.canTerminateAddresses, proposal.canTerminateData, proposalIds[i], msg.sender, msg.sender), "Cannot Terminate");
            if(!proposal.validationPassed) {
                if(_mustStopAtFirst(false, proposal.validatorsAddresses, proposal.validatorsData, proposalIds[i], msg.sender, msg.sender)) {
                    _finalizeTermination(proposalIds[i], proposal, false, false);
                    emit ProposalTerminated(proposalIds[i], false, "");
                    continue;
                }
            }
            (bool result, bytes memory errorData) = address(this).call(abi.encodeWithSelector(this.tryExecute.selector, proposal.codeSequence, abi.encodeWithSelector(0xe751f271, proposalIds[i]), new bytes[](0)));//execute(bytes32)
            if(result && errorData.length == 0) {
                (result, ) = _validateRules(proposal.triggeringRules, proposal.triggeringData, proposalIds[i], abi.encode(proposal), msg.sender);
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
        return _storage._configuration;
    }

    function setConfiguration(ProposalConfiguration calldata newValue) external override authorizedOnly returns(ProposalConfiguration memory oldValue) {
        return ProposalsManagerLibrary.setConfiguration(_storage._configuration, newValue);
    }

    function _ensure(bytes32 proposalId, address from, address voter, bool voteOrWithtraw) private view returns (bool canVote) {
        Proposal memory proposal =_storage._proposal[proposalId];
        require(proposal.creationBlock > 0, "proposal");
        if(_storage._hostIsProposalCommand) {
            bytes memory response = IExternalProposalsManagerCommands(host).isVotable(proposalId, proposal, from, voter, voteOrWithtraw);
            if(response.length > 0) {
                return abi.decode(response, (bool));
            }
        }
        bool isTerminated;
        canVote = !(isTerminated = proposal.terminationBlock != 0) && !proposal.validationPassed && !_mustStopAtFirst(true, proposal.canTerminateAddresses, proposal.canTerminateData, proposalId, from, voter);
        if(voteOrWithtraw) {
            require(canVote, "vote");
        } else {
            require(block.number > _storage.lastVoteBlock[voter], "wait 1 block");
            require(!isTerminated || _storage._proposal[proposalId].terminationBlock < block.number, "early");
        }
    }

    function _mustStopAtFirst(bool value, address[] memory checkers, bytes[] memory checkersData, bytes32 proposalId, address from, address voter) private view returns(bool) {
        if(checkers.length == 0 || (checkers.length == 1 && checkers[0] == address(0))) {
            return value;
        }
        Proposal memory proposal = _storage._proposal[proposalId];
        for(uint256 i = 0; i < checkers.length; i++) {
            bytes memory inputData = abi.encodeWithSelector(IProposalChecker(address(0)).check.selector, address(this), checkersData[i], proposalId, abi.encode(proposal), from, voter);
            (bool result, bytes memory response) = checkers[i].staticcall(inputData);
            if((!result || abi.decode(response, (bool))) == value) {
                return true;
            }
        }
        return false;
    }

    function _validateRules(address rulesToValidate, bytes memory rulesData, bytes32 key, bytes memory payload, address sender) private returns(bool result, bytes memory response) {
        if(rulesToValidate == address(0)) {
            return (true, "");
        }
        (result, response) = rulesToValidate.call(abi.encodeWithSelector(IProposalChecker(address(0)).check.selector, address(this), rulesData, key, payload, sender, sender));
        if(result) {
            result = abi.decode(response, (bool));
            response = "";
        }
    }

    function _finalizeTermination(bytes32 proposalId, Proposal storage proposal, bool validationPassed, bool result) internal virtual {
        proposal.validationPassed = validationPassed;
        if(_storage._hostIsProposalCommand) {
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
        return keccak256(abi.encode(_storage._keyIndex++, block.timestamp, block.number, tx.origin, tx.gasprice, block.coinbase, block.difficulty, msg.sender, blockhash(block.number - 5)));
    }

    function _withdrawAll(bytes32 proposalId, address sender, address voter) private returns(bool canVote, address[] memory collections, uint256[] memory objectIds, uint256[] memory accepts, uint256[] memory refuses) {
        canVote = _ensure(proposalId, sender, voter, false);
        Proposal storage proposal = _storage._proposal[proposalId];
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
        uint256 proposalWeight = _storage.weight[item];
        require(proposalWeight > 0, "item");
        accept = _storage._accept[proposalId][voter][item];
        refuse = _storage._refuse[proposalId][voter][item];
        require(_storage._toWithdraw[proposalId][voter][item] >= (accept + refuse), "amount");
        if(accept > 0) {
            _storage._toWithdraw[proposalId][voter][item] -= accept;
            if(canVote) {
                _storage._accept[proposalId][voter][item] -= accept;
                proposal.accept -= (accept * proposalWeight);
                emit RetireAccept(proposalId, voter, item, accept);
            }
        }
        if(refuse > 0) {
            _storage._toWithdraw[proposalId][voter][item] -= refuse;
            if(canVote) {
                _storage._refuse[proposalId][voter][item] -= refuse;
                proposal.refuse -= (refuse * proposalWeight);
                emit RetireRefuse(proposalId, voter, item, refuse);
            }
        }
    }
}