// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IMVDFunctionalityProposal.sol";
import "./interfaces/IMVDProxy.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC1155Receiver.sol";

contract MVDFunctionalityProposal is IMVDFunctionalityProposal, IERC1155Receiver {

    bool private _collateralDataSet;

    address private _proxy;
    string private _codeName;
    bool private _emergency;
    address private _sourceLocation;
    uint256 private _sourceLocationId;
    address private _location;
    bool private _submitable;
    string private _methodSignature;
    string private _returnAbiParametersArray;
    bool private _isInternal;
    bool private _needsSender;
    string private _replaces;
    uint256 private _surveyEndBlock;
    uint256 private _surveyDuration;
    bool private _terminated;
    address private _proposer;
    bool private _disabled;

    mapping(address => mapping(uint256 => uint256)) private _accept;
    mapping(address => mapping(uint256 => uint256)) private _refuse;
    uint256 private _totalAccept;
    uint256 private _totalRefuse;
    mapping(address => mapping(uint256 => bool)) private _withdrawed;

    uint256 private _votesHardCap;
    bool private _votesHardCapReached;
    
    mapping(address => uint256[]) private _userObjectIds;
    mapping(address => mapping(uint256 => bool)) private _hasVotedWith;

    address private _getItemProposalWeightFunctionalityAddress;
    address private _dfoItemCollectionAddress;
    address private _emergencyTokenAddress;

    constructor(
        string memory codeName, 
        address location, 
        string memory methodSignature, 
        string memory returnAbiParametersArray, 
        string memory replaces, 
        address proxy
    ) public {
        init(codeName, location, methodSignature, returnAbiParametersArray, replaces, proxy);
    }

    function init(
        string memory codeName, 
        address location, 
        string memory methodSignature, 
        string memory returnAbiParametersArray, 
        string memory replaces, 
        address proxy
    ) public override {
        require(_proxy == address(0), "Already initialized!");
        _proxy = proxy;
        _codeName = codeName;
        _location = location;
        _methodSignature = methodSignature;
        _returnAbiParametersArray = returnAbiParametersArray;
        _replaces = replaces;
    }

    function setCollateralData(
        bool emergency, 
        address sourceLocation, 
        uint256 sourceLocationId, 
        bool submitable, 
        bool isInternal, 
        bool needsSender, 
        address proposer, 
        uint256 votesHardCap
    ) public override {
        require(!_collateralDataSet, "setCollateralData already called!");
        require(_proxy == msg.sender, "Only Original Proxy can call this method!");
        _sourceLocation = sourceLocation;
        _sourceLocationId = sourceLocationId;
        _submitable = submitable;
        _isInternal = isInternal;
        _needsSender = needsSender;
        _proposer = proposer;
        _surveyDuration = toUint256(IMVDProxy(_proxy).read((_emergency = emergency) ? "getMinimumBlockNumberForEmergencySurvey" : "getMinimumBlockNumberForSurvey", bytes("")));
        _votesHardCap = votesHardCap;
        _collateralDataSet = true;
    }

    function setAddresses(
        address getItemProposalWeightFunctionalityAddress, 
        address dfoItemCollectionAddress, 
        address emergencyTokenAddress
    ) public override {
        require(_proxy == msg.sender, "Only Original Proxy can call this method!");
        require(getItemProposalWeightFunctionalityAddress == address(0), "Already called!");
        _getItemProposalWeightFunctionalityAddress = getItemProposalWeightFunctionalityAddress;
        _dfoItemCollectionAddress = dfoItemCollectionAddress;
        _emergencyTokenAddress = emergencyTokenAddress;
    }

    function start() public override {
        require(_collateralDataSet, "Still waiting for setCollateralData to be called!");
        require(msg.sender == _proxy, "Only Proxy can call this function!");
        require(_surveyEndBlock == 0, "Already started!");
        require(!_disabled, "Already disabled!");
        _surveyEndBlock = block.number + _surveyDuration;
    }

    function disable() public override {
        require(_collateralDataSet, "Still waiting for setCollateralData to be called!");
        require(msg.sender == _proxy, "Only Proxy can call this function!");
        require(_surveyEndBlock == 0, "Already started!");
        _disabled = true;
        _terminated = true;
    }

    modifier duringSurvey() {
        require(_collateralDataSet, "Still waiting for setCollateralData to be called!");
        require(!_disabled, "Survey disabled!");
        require(!_terminated, "Survey Terminated!");
        require(!_votesHardCapReached, "Votes Hard Cap reached!");
        require(_surveyEndBlock > 0, "Survey Not Started!");
        require(block.number < _surveyEndBlock, "Survey ended!");
        _;
    }

    modifier onSurveyEnd() {
        require(_collateralDataSet, "Still waiting for setCollateralData to be called!");
        require(!_disabled, "Survey disabled!");
        require(_surveyEndBlock > 0, "Survey Not Started!");
        if (!_votesHardCapReached) {
            require(block.number >= _surveyEndBlock, "Survey is still running!");
        }
        _;
    }

    function _checkVotesHardCap() private {
        if (_votesHardCap == 0 || (_totalAccept < _votesHardCap && _totalRefuse < _votesHardCap)) {
            return;
        }
        _votesHardCapReached = true;
        terminate();
    }

    /** @dev Allows the user to vote for acceptance using the ETHItem with the given object id.
      * The vote is weighted calling the getItemProposalWeight function. 
      * @param amount total amount of tokens to use for the vote.
      * @param objectId ETHItem ERC-1155 object id.
     */
    function accept(uint256 amount, uint256 objectId) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256 tokenWeight = functionality.getItemProposalWeight(objectId);
        uint256 objectIdVotes = _accept[msg.sender][objectId];
        uint256 weightedAmount = amount * tokenWeight;
        if (weightedAmount > 0) {
            // TODO safeTransferFrom
            if (!_hasVotedWith[msg.sender][objectId]) {
                _hasVotedWith[msg.sender][objectId] = true;
                _userObjectIds[msg.sender].push(objectId);
            }
            objectIdVotes += weightedAmount;
            _accept[msg.sender][objectId] = objectIdVotes;
            _totalAccept += weightedAmount;
            emit Accept(msg.sender, weightedAmount);
            _checkVotesHardCap();
        }
    }

    /** @dev Allows the user to vote using multiple ETHItems with multiple amounts.
      * @param amounts array containing all the amounts.
      * @param objectIds array containing all the ETHItem object ids.
     */
    function batchAccept(uint256[] memory amounts, uint256[] memory objectIds) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        // TODO safeBatchTransferFrom
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 currentTokenVote = _accept[msg.sender][objectIds[i]];
            uint256 currentTokenWeight = functionality.getItemProposalWeight(objectIds[i]);
            uint256 currentTokenWeightedAmount = amounts[i] * currentTokenWeight;
            require(currentTokenWeightedAmount > 0, "Token weight must not be 0 in batch vote!");
            if (!_hasVotedWith[msg.sender][objectIds[i]]) {
                _hasVotedWith[msg.sender][objectIds[i]] = true;
                _userObjectIds[msg.sender].push(objectIds[i]);
            }
            currentTokenVote += currentTokenWeightedAmount;
            _accept[msg.sender][objectIds[i]] = currentTokenVote;
            _totalAccept += currentTokenWeightedAmount;
        }
        _checkVotesHardCap();
    }

    /** @dev Allows the user to retire the given amount of tokens related to the given object id.
      * @param amount total amount to retire from the accept votes.
      * @param objectId ETHItem ERC-1155 object id.
     */
    function retireAccept(uint256 amount, uint256 objectId) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256 tokenWeight = functionality.getItemProposalWeight(objectId);
        uint256 weightedAmount = amount * tokenWeight;
        require(_accept[msg.sender][objectId] >= weightedAmount, "Insufficient funds!");
        // TODO safeTransferFrom
        uint256 vote = _accept[msg.sender][objectId];
        vote -= weightedAmount;
        _accept[msg.sender][objectId] = vote;
        _totalAccept -= weightedAmount;
        emit RetireAccept(msg.sender, weightedAmount);
    }

    /** @dev Allows a user to batch retire the given amounts of objectIds from the accept votes.
      * @param amounts array containing all the amounts.
      * @param objectIds array containing all the ETHItem object ids.
     */
    function batchRetireAccept(uint256[] memory amounts, uint256[] memory objectIds) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256[] memory weightedAmounts = new uint256[](amounts.length);
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 tokenWeight = functionality.getItemProposalWeight(objectIds[i]);
            uint256 weightedAmount = amounts[i] * tokenWeight;
            require(_accept[msg.sender][objectIds[i]] >= weightedAmount, "Insufficient funds!");
            weightedAmounts[i] = weightedAmount;
        }
        // TODO batchSafeTransferFrom
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 vote = _accept[msg.sender][objectIds[i]];
            vote -= weightedAmounts[i];
            _accept[msg.sender][objectIds[i]] = vote;
            _totalAccept -= weightedAmounts[i];
        }
    }

    /** @dev Allows the user to vote for refusal using the ETHItem with the given object id.
      * The vote is weighted calling the getItemProposalWeight function. 
      * @param amount total amount of tokens to use for the vote.
      * @param objectId ETHItem ERC-1155 object id.
     */
    function refuse(uint256 amount, uint256 objectId) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256 tokenWeight = functionality.getItemProposalWeight(objectId);
        uint256 objectIdVotes = _refuse[msg.sender][objectId];
        uint256 weightedAmount = amount * tokenWeight;
        if (weightedAmount > 0) {
            // TODO safeTransferFrom
            if (!_hasVotedWith[msg.sender][objectId]) {
                _hasVotedWith[msg.sender][objectId] = true;
                _userObjectIds[msg.sender].push(objectId);
            }
            objectIdVotes += weightedAmount;
            _refuse[msg.sender][objectId] = objectIdVotes;
            _totalRefuse += weightedAmount;
            emit Refuse(msg.sender, weightedAmount);
            _checkVotesHardCap();
        }
    }

    /** @dev Allows the user to vote for refusal using multiple ETHItems with multiple amounts.
      * @param amounts array containing all the amounts.
      * @param objectIds array containing all the ETHItem object ids.
     */
    function batchRefuse(uint256[] memory amounts, uint256[] memory objectIds) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        // TODO safeBatchTransferFrom
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 currentTokenVote = _refuse[msg.sender][objectIds[i]];
            uint256 currentTokenWeight = functionality.getItemProposalWeight(objectIds[i]);
            uint256 currentTokenWeightedAmount = amounts[i] * currentTokenWeight;
            require(currentTokenWeightedAmount > 0, "Token weight must not be 0 in batch vote!");
            if (!_hasVotedWith[msg.sender][objectIds[i]]) {
                _hasVotedWith[msg.sender][objectIds[i]] = true;
                _userObjectIds[msg.sender].push(objectIds[i]);
            }
            currentTokenVote += currentTokenWeightedAmount;
            _refuse[msg.sender][objectIds[i]] = currentTokenVote;
            _totalRefuse += currentTokenWeightedAmount;
        }
        _checkVotesHardCap();
    }

    /** @dev Allows the user to retire the given amount of tokens used for refuse related to the given object id.
      * @param amount total amount to retire from the accept votes.
      * @param objectId ETHItem ERC-1155 object id.
     */
    function retireRefuse(uint256 amount, uint256 objectId) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256 tokenWeight = functionality.getItemProposalWeight(objectId);
        uint256 weightedAmount = amount * tokenWeight;
        require(_refuse[msg.sender][objectId] >= weightedAmount, "Insufficient funds!");
        // TODO safeTransferFrom
        uint256 vote = _refuse[msg.sender][objectId];
        vote -= weightedAmount;
        _refuse[msg.sender][objectId] = vote;
        _totalRefuse -= weightedAmount;
        emit RetireRefuse(msg.sender, weightedAmount);
    }

    /** @dev Allows a user to batch retire the given amounts of objectIds from the refuse votes.
      * @param amounts array containing all the amounts.
      * @param objectIds array containing all the ETHItem object ids.
     */
    function batchRetireRefuse(uint256[] memory amounts, uint256[] memory objectIds) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256[] memory weightedAmounts = new uint256[](amounts.length);
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 tokenWeight = functionality.getItemProposalWeight(objectIds[i]);
            uint256 weightedAmount = amounts[i] * tokenWeight;
            require(_refuse[msg.sender][objectIds[i]] >= weightedAmount, "Insufficient funds!");
            weightedAmounts[i] = weightedAmount;
        }
        // TODO batchSafeTransferFrom
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 vote = _refuse[msg.sender][objectIds[i]];
            vote -= weightedAmounts[i];
            _refuse[msg.sender][objectIds[i]] = vote;
            _totalRefuse -= weightedAmounts[i];
        }
    }

    /** @dev Allows the sender to retire all the tokens used for voting in this proposal.
      * @param objectIds array containing all the ETHItem object ids.
     */
    function retireAll(uint256[] memory objectIds) public override duringSurvey {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256 total = 0;
        uint256[] memory amounts = new uint256[](objectIds.length);
        for (uint256 i = 0; i < objectIds.length; i++) {
            require(_accept[msg.sender][objectIds[i]] + _refuse[msg.sender][objectIds[i]] > 0, "No votes for the object id!");
        }
        // TODO safeBatchTransferFrom
        for (uint256 i = 0; i < objectIds.length; i++) {
            uint256 tokenWeight = functionality.getItemProposalWeight(objectIds[i]);
            if (tokenWeight > 0) {
                uint256 acpt = _accept[msg.sender][objectIds[i]];
                uint256 rfs = _refuse[msg.sender][objectIds[i]];
                uint256 wAcpt = acpt / tokenWeight;
                uint256 wRfs = rfs / tokenWeight;
                amounts[i] = wAcpt + wRfs;
                _accept[msg.sender][objectIds[i]] = 0;
                _refuse[msg.sender][objectIds[i]] = 0;
                _totalAccept -= acpt;
                _totalRefuse -= rfs;
                total += (acpt + rfs);
            } else {
                amounts[i] = 0;
            }
        }
        emit RetireAll(msg.sender, total);
    }

    /** @dev Moves the given amount of the token with the given object id to the accept count.
      * @param amount total amount of tokens to use for the vote.
      * @param objectId ETHItem ERC-1155 object id.
     */
    function moveToAccept(uint256 amount, uint256 objectId) public override duringSurvey {
        require(_refuse[msg.sender][objectId] >= amount, "Insufficient funds!");
        uint256 vote = _refuse[msg.sender][objectId];
        vote -= amount;
        _refuse[msg.sender][objectId] = vote;
        _totalRefuse -= amount;

        vote = _accept[msg.sender][objectId];
        vote += amount;
        _accept[msg.sender][objectId] = vote;
        _totalAccept += amount;
        emit MoveToAccept(msg.sender, amount);
        _checkVotesHardCap();
    }

    /** @dev Moves the given amount of the token with the given object id to the refuse count.
      * @param amount total amount of tokens to use for the vote.
      * @param objectId ETHItem ERC-1155 object id.
     */
    function moveToRefuse(uint256 amount, uint256 objectId) public override duringSurvey {
        require(_accept[msg.sender][objectId] >= amount, "Insufficient funds!");
        uint256 vote = _accept[msg.sender][objectId];
        vote -= amount;
        _accept[msg.sender][objectId] = vote;
        _totalAccept -= amount;

        vote = _refuse[msg.sender][objectId];
        vote += amount;
        _refuse[msg.sender][objectId] = vote;
        _totalRefuse += amount;
        emit MoveToRefuse(msg.sender, amount);
        _checkVotesHardCap();
    }

    /** @dev Allows the sender to withdraw all the tokens inside the proposal.
     */
    function withdraw() public override onSurveyEnd {
        // Check if the proposal is not terminated nor disabled
        if (!_terminated && !_disabled) {
            terminate();
            return;
        }
        // Withdraw all the tokens
        _withdraw(true);
    }

    /** @dev Allows the sender to terminate the proposal (only on survey end).
     */
    function terminate() public override onSurveyEnd {
        require(!_terminated, "Already terminated!");
        IMVDProxy(_proxy).setProposal();
        _withdraw(false);
    }

    /** @dev Private function used for token withdrawal.
      * @param launchError ??
     */
    function _withdraw(bool launchError) private {
        IGetItemProposalWeightFunctionality functionality = IGetItemProposalWeightFunctionality(_getItemProposalWeightFunctionalityAddress);
        uint256[] memory amounts = new uint256[](_userObjectIds[msg.sender].length);
        for (uint256 i = 0; i < _userObjectIds[msg.sender].length; i++) {
            require(!launchError || _accept[msg.sender][_userObjectIds[msg.sender][i]] + _refuse[msg.sender][_userObjectIds[msg.sender][i]] > 0, "Nothing to Withdraw!");
            require(!launchError || !_withdrawed[msg.sender][_userObjectIds[msg.sender][i]], "Already Withdrawed!");
            if (_accept[msg.sender][_userObjectIds[msg.sender][i]] + _refuse[msg.sender][_userObjectIds[msg.sender][i]] > 0 && !_withdrawed[msg.sender][_userObjectIds[msg.sender][i]]) {
                uint256 tokenWeight = functionality.getItemProposalWeight(_userObjectIds[msg.sender][i]);
                if (tokenWeight > 0) {
                    uint256 wAccept = _accept[msg.sender][_userObjectIds[msg.sender][i]] / tokenWeight;
                    uint256 wRefuse = _refuse[msg.sender][_userObjectIds[msg.sender][i]] / tokenWeight;
                    amounts[i] = wAccept + wRefuse;
                } else {
                    amounts[i] = 0;
                }
                _withdrawed[msg.sender][_userObjectIds[msg.sender][i]] = true;
            }
        }
        // TODO safeBatchTransferFrom
    }

    /** @dev Allows the proxy to terminate this proposal.
     */
    function set() public override onSurveyEnd {
        require(msg.sender == _proxy, "Unauthorized Access!");
        require(!_terminated, "Already terminated!");
        _terminated = true;
    }

    /** @dev Returns the proposal proxy address.
      * @return proposal proxy address.
      */
    function getProxy() public override view returns(address) {
        return _proxy;
    }

    /** @dev Returns the proposal codename.
      * @return proposal codename. 
      */
    function getCodeName() public override view returns(string memory) {
        return _codeName;
    }

    /** @dev Returns true if this proposal is an emergency, false otherwise.
      * @return true if this proposal is an emergency, false otherwise.
      */
    function isEmergency() public override view returns(bool) {
        return _emergency;
    }

    /** @dev Returns the proposal source location address.
      * @return proposal source location address.
     */
    function getSourceLocation() public override view returns(address) {
        return _sourceLocation;
    }

    function getSourceLocationId() public override view returns(uint256) {
        return _sourceLocationId;
    }

    function getLocation() public override view returns(address) {
        return _location;
    }

    function isSubmitable() public override view returns(bool) {
        return _submitable;
    }

    function getMethodSignature() public override view returns(string memory) {
        return _methodSignature;
    }

    function getReturnAbiParametersArray() public override view returns(string memory) {
        return _returnAbiParametersArray;
    }

    function isInternal() public override view returns(bool) {
        return _isInternal;
    }

    function needsSender() public override view returns(bool) {
        return _needsSender;
    }

    function getReplaces() public override view returns(string memory) {
        return _replaces;
    }

    function getProposer() public override view returns(address) {
        return _proposer;
    }

    function getSurveyEndBlock() public override view returns(uint256) {
        return _surveyEndBlock;
    }

    function getSurveyDuration() public override view returns(uint256) {
        return _surveyDuration;
    }

    /** @dev Returns the DFO item collection address for this proposal.
      * @return dfo item collection addrress.
      */
    function getDFOItemCollectionAddress() public override view returns(address) {
        return _dfoItemCollectionAddress;
    } 

    /** @dev Returns the emergency token address for this proposal.
      * @return emergency token address.
      */
    function getEmergencyTokenAddress() public override view returns(address) {
        return _emergencyTokenAddress;
    }

    /** @dev Returns all the votes for the given address. It calculates the values
      * by iterating on all the tokens that the address used.
      * @param addr address votes.
      * @return addrAccept accept amount of votes for the accept.
      * @return addrRefuse refuse amount of votes for the refuse.
     */
    function getVote(address addr) public override view returns(uint256 addrAccept, uint256 addrRefuse) {
        for (uint256 i = 0; i < _userObjectIds[addr].length; i++) {
            addrAccept += _accept[addr][_userObjectIds[addr][i]];
            addrRefuse += _refuse[addr][_userObjectIds[addr][i]];
        }
    }

    function getVotes() public override view returns(uint256, uint256) {
        return (_totalAccept, _totalRefuse);
    }

    function isTerminated() public override view returns(bool) {
        return _terminated;
    }

    function isDisabled() public override view returns(bool) {
        return _disabled;
    }

    function isVotesHardCapReached() public override view returns(bool) {
        return _votesHardCapReached;
    }

    function getVotesHardCapToReach() public override view returns(uint256) {
        return _votesHardCap;
    }

    function toUint256(bytes memory bs) public pure returns(uint256 x) {
        if (bs.length >= 32) {
            assembly {
                x := mload(add(bs, add(0x20, 0)))
            }
        }
    }

    function toString(address _addr) public pure returns(string memory) {
        bytes32 value = bytes32(uint256(_addr));
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
        }
        return string(str);
    }

    function toString(uint _i) public pure returns(string memory) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }

    function toJSON() public override view returns(string memory) {
        return string(abi.encodePacked(
            '{',
            getFirstJSONPart(_sourceLocation, _sourceLocationId, _location),
            '","submitable":',
            _submitable ? "true" : "false",
            ',"emergency":',
            _emergency ? "true" : "false",
            ',"isInternal":',
            _isInternal ? "true" : "false",
            ',"needsSender":',
            _needsSender ? "true" : "false",
            ',',
            getSecondJSONPart(),
            ',"proposer":"',
            toString(_proposer),
            '","endBlock":',
            toString(_surveyEndBlock),
            ',"terminated":',
            _terminated ? "true" : "false",
            ',"accepted":',
            toString(_totalAccept),
            ',"refused":',
            toString(_totalRefuse),
            ',"disabled":',
            _disabled ? 'true' : 'false',
            '}')
        );
    }

    function getFirstJSONPart(address sourceLocation, uint256 sourceLocationId, address location) public pure returns(bytes memory) {
        return abi.encodePacked(
            '"sourceLocation":"',
            toString(sourceLocation),
            '","sourceLocationId":',
            toString(sourceLocationId),
            ',"location":"',
            toString(location)
        );
    }

    function getSecondJSONPart() private view returns (string memory){
        return string(abi.encodePacked(
            '"codeName":"',
            _codeName,
            '","methodSignature":"',
            _methodSignature,
            '","returnAbiParametersArray":',
            formatReturnAbiParametersArray(_returnAbiParametersArray),
            ',"replaces":"',
            _replaces,
            '"'));
    }

    function formatReturnAbiParametersArray(string memory m) public pure returns(string memory) {
        bytes memory b = bytes(m);
        if (b.length < 2) {
            return "[]";
        }
        if (b[0] != bytes1("[")) {
            return "[]";
        }
        if (b[b.length - 1] != bytes1("]")) {
            return "[]";
        }
        return m;
    }

    /** @dev Function called after a ERC1155 has been received by this contract.
      * @return 0xf23a6e61.
      */
    function onERC1155Received(address, address, uint256, uint256, bytes memory) public override pure returns(bytes4) {
        return 0xf23a6e61;
    }
    
    /** @dev Function called after a batch of ERC1155 has been received by this contract.
      * @return 0xbc197c81.
      */
    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public override pure returns (bytes4) {
        return 0xbc197c81;
    }
}

interface IGetItemProposalWeightFunctionality {
    function getItemProposalWeight(uint256 itemAddress) external returns (uint256);
}