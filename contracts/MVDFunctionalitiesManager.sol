// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IMVDFunctionalitiesManager.sol";
import "./interfaces/IMVDProxy.sol";
import "./interfaces/IMVDFunctionalityProposal.sol";

contract MVDFunctionalitiesManager is IMVDFunctionalitiesManager {

    // Proxy address
    address private _proxy;
    // Number of functionalities registered
    uint256 private _functionalitiesAmount;
    // Mapping index => functionality
    mapping(uint256 => Functionality) private _functionalities;
    // Mapping functionality_name => index
    mapping(string => uint256) private _indexes;
    // Mapping functionality_address => count
    mapping(address => uint256) private _functionalityCount;
    // Private calling context
    address private _callingContext;

    constructor(FunctionalitiesManagerData memory initData) {
        if (initData.getMinimumBlockNumberFunctionalityAddress == address(0)) {
            return;
        }
        init(initData);
    }

    function init(FunctionalitiesManagerData memory initData) public override {

        require(_functionalitiesAmount == 0, "Init already called!");

        addFunctionality(
            "getMinimumBlockNumberForSurvey",
            initData.sourceLocation,
            initData.getMinimumBlockNumberSourceLocationId,
            initData.getMinimumBlockNumberFunctionalityAddress,
            false,
            "getMinimumBlockNumberForSurvey()",
            '["uint256"]',
            false,
            false
        );

        addFunctionality(
            "getMinimumBlockNumberForEmergencySurvey",
            initData.sourceLocation,
            initData.getEmergencyMinimumBlockNumberSourceLocationId,
            initData.getEmergencyMinimumBlockNumberFunctionalityAddress,
            false,
            "getMinimumBlockNumberForEmergencySurvey()",
            '["uint256"]',
            false,
            false
        );

        addFunctionality(
            "getEmergencySurveyStaking",
            initData.sourceLocation,
            initData.getEmergencySurveyStakingSourceLocationId,
            initData.getEmergencySurveyStakingFunctionalityAddress,
            false,
            "getEmergencySurveyStaking()",
            '["uint256"]',
            false,
            false
        );

        addFunctionality(
            "checkSurveyResult",
            initData.sourceLocation,
            initData.checkVoteResultSourceLocationId,
            initData.checkVoteResultFunctionalityAddress,
            false,
            "checkSurveyResult(address)",
            '["bool"]',
            false,
            false
        );

        addFunctionality(
            "getItemProposalWeight",
            initData.sourceLocation,
            initData.getItemProposalWeightSourceLocationId,
            initData.getItemProposalWeightAddress,
            false,
            "getItemProposalWeight(address)",
            '["uint256"]',
            false,
            false
        );

        _functionalitiesAmount = 5;
    }

    /** @dev Creates a new functionality using the input data.
      * @param codeName name of the functionality.
      * @param sourceLocation //
      * @param sourceLocationId //
      * @param location functionality location.
      * @param submitable whether the functionality is submitable or not.
      * @param methodSignature functionality method signature (abi encoded).
      * @param returnAbiParametersArray functionality function return parameters as an array.
      * @param isInternal whether the functionality is internal or not.
      * @param needsSender whether the functionality needs the original sender or not.
      */
    function addFunctionality(string memory codeName, address sourceLocation, uint256 sourceLocationId, address location, bool submitable, string memory methodSignature, string memory returnAbiParametersArray, bool isInternal, bool needsSender) public override {
        require(_proxy == address(0) || _callingContext == msg.sender, "Unauthorized call!");
        // Create the new functionality
        Functionality memory functionality = Functionality(
            codeName,
            sourceLocation,
            sourceLocationId,
            location,
            submitable,
            methodSignature,
            returnAbiParametersArray,
            isInternal,
            needsSender,
            address(0),
            true
        );
        // If the functionality already exists, just update it
        if (_functionalities[_indexes[codeName]].active) {
            _functionalities[_indexes[codeName]] = functionality;
        // If it does not exist, append it to the map instead
        } else {
            // Add it to the last place
            _functionalities[_functionalitiesAmount] = functionality;
            // Set its index to the last position
            _indexes[codeName] = _functionalitiesAmount;
            // Update the functionality count and the amount
            _functionalityCount[functionality.location] = _functionalityCount[functionality.location] + 1;
            _functionalitiesAmount++;
        }
    }

    /** @dev Removes the functionality with the input codeName.
      * @param codeName name of the functionality to remove.
      * @return removed true if the functionality has been removed, false otherwise.
      */
    function removeFunctionality(string memory codeName) public override returns(bool removed) {
        require(_proxy == address(0) || _callingContext == msg.sender, "Unauthorized call!");
        // Retrieve the functionality with the given codeName
        Functionality storage functionality = _functionalities[_indexes[codeName]];
        // Check if the functionality exists and if the code names match
        if (functionality.active && compareStrings(codeName, functionality.codeName)) {
            // Remove the functionality by swapping it with the last one
            Functionality memory lastElement = _functionalities[_functionalitiesAmount];
            _functionalities[_indexes[codeName]] = lastElement;
            _indexes[lastElement.codeName] = _indexes[codeName];
            delete _indexes[codeName];
            _functionalityCount[functionality.location] = _functionalityCount[functionality.location] - 1;
            _functionalitiesAmount--;
            // Return removed as true
            removed = true;
        }
    }

    /** @dev Performs some precondition checks on the execution of the functionality with the given codeName and parameters.
      * @param codeName name of the functionality.
      * @param data method call data.
      * @param submitable if the call is a send or not.
      * @param sender address of the sender (if override is needed).
      * @param value eth value of the call.
      * @return location the functionality location.
      * @return payload for the future call
      */
    function preConditionCheck(string memory codeName, bytes memory data, uint8 submitable, address sender, uint256 value) public override view returns(address location, bytes memory payload) {
        // Retrieve the functionality with the input codeName
        Functionality memory functionality = _functionalities[_indexes[codeName]];
        // Check if the functionality exists, it's active and matches the input codeName
        require(functionality.active && compareStrings(codeName, functionality.codeName), "Unauthorized functionality");
        // If a submit has been requested, the functionality must support it
        require(submitable == (functionality.submitable ? 1 : 0), "Functionality called in the wrong context!");
        // Check if an internal functionality has been called
        require(functionality.isInternal ? _functionalityCount[sender] > 0 || _callingContext == sender : true, "Internal functionalities can be called from other functionalities only!");
        // Update the location return parameter with the functionality location
        location = functionality.location;
        // If the functionality needs a sender, we must update the data payload with the input sender using assembly
        if (functionality.needsSender) {
            require(data.length >= (submitable == 1 ? 64 : 32), "Insufficient space in data payload");
            assembly {
                mstore(add(data, 0x20), sender)
                switch iszero(submitable) case 0 {
                    mstore(add(data, 0x40), value)
                }
            }
        }
        // Finally encode the payload
        payload = abi.encodePacked(bytes4(keccak256(bytes(functionality.methodSignature))), data);
    }

    /** @dev Performs the setup of the functionality voted at the proposal with the given address.
      * @param proposalAddress address of the proposal.
      * @return result true if the functionality has been added, false otherwise.
      */
    function setupFunctionality(address proposalAddress) public override returns(bool result) {
        // Check if it's the proxy calling this function
        require(_proxy == msg.sender, "Only Proxy can call This!");
        // Retrieve the proposal from the address
        IMVDFunctionalityProposal proposal = IMVDFunctionalityProposal(proposalAddress);
        // Retrieve proposal data
        ProposalData memory proposalData = proposal.getProposalData();
        // Get the code name and check if it's not empty
        string memory codeName = proposalData.codeName;
        bool hasCodeName = !compareStrings(codeName, "");
        // Get the replacemenet and check if it's not empty
        string memory replaces = proposalData.replaces;
        bool hasReplaces = !compareStrings(replaces, "");
        // If it does not have a codename and replaces, call a one time function with the proposal address
        if (!hasCodeName && !hasReplaces) {
            (result,) = IMVDProxy(_proxy).callFromManager(_callingContext = proposalData.location, abi.encodeWithSignature("callOneTime(address)", proposalAddress));
            _callingContext = address(0);
            return result;
        }
        // Retrieve the replaced functionality
        Functionality memory replacedFunctionality = _functionalities[_indexes[replaces]];
        // If it replaces a functionality it must overtake its index too
        uint256 position = hasReplaces ? _indexes[replaces] : _functionalitiesAmount;

        if (hasReplaces) {
            // Call the "onStop" function if it's replacing a functionality
            (result,) = IMVDProxy(_proxy).callFromManager(_callingContext = replacedFunctionality.location, abi.encodeWithSignature("onStop(address)", proposalAddress));
            _callingContext = address(0);
            // Revert everything if the "onStop" returned false
            if (!result) {
                revert("onStop failed!");
            }
        }

        // Decrease the functionalities amount and count if needed
        _functionalitiesAmount -= hasReplaces ? 1 : 0;
        _functionalityCount[replacedFunctionality.location] = _functionalityCount[replacedFunctionality.location] - (hasReplaces ? 1 : 0);
        Functionality memory newFunctionality = Functionality(
            codeName,
            proposalData.sourceLocation,
            proposalData.sourceLocationId,
            proposalData.location,
            proposalData.submitable,
            proposalData.methodSignature,
            proposalData.returnAbiParametersArray,
            proposalData.isInternal,
            proposalData.needsSender,
            proposalAddress,
            true
        );

        // Check if has codename
        if (hasCodeName) {
            // Update amount
            _functionalitiesAmount += 1;
            // Set it in the position (whether it's replacing or a new one)
            _functionalities[position] = newFunctionality;
            // Update the index for this codeName
            _indexes[codeName] = position;
            // Update the count for the location
            _functionalityCount[newFunctionality.location] += 1;
            // Call the on start function
            (result,) = IMVDProxy(_proxy).callFromManager(_callingContext = newFunctionality.location, abi.encodeWithSignature("onStart(address,address)", proposalAddress, hasReplaces ? replacedFunctionality.location : address(0)));
            _callingContext = address(0);
            // Revert everything if the onStart method failed
            if (!result) {
                revert("onStart failed!");
            }
        }  else {
            _indexes[codeName] = 0;
        }
        if (hasCodeName || hasReplaces) {
            // Emit the event for the changed functionality
            IMVDProxy(_proxy).emitFromManager(hasCodeName ? codeName : "", proposalAddress, hasReplaces ? replacedFunctionality.codeName : "", hasReplaces ? replacedFunctionality.sourceLocation : address(0), hasReplaces ? replacedFunctionality.sourceLocationId : 0, hasReplaces ? replacedFunctionality.location : address(0), hasReplaces ? replacedFunctionality.submitable : false, hasReplaces ? replacedFunctionality.methodSignature : "", hasReplaces ? replacedFunctionality.isInternal : false, hasReplaces ? replacedFunctionality.needsSender : false, hasReplaces ? replacedFunctionality.proposalAddress : address(0));
        }
        // Reset calling context
        _callingContext = address(0);
        return true;
    }


    /** @dev Returns the amount of functionalities registered. 
      * @return int representing the amount of functionalities.
      */
    function getFunctionalitiesAmount() public override view returns(uint256) {
        return _functionalitiesAmount;
    }

    /** @dev Returns true if the functionality with the given address has been registered (count > 0), false otherwise.
      * @param functionality functionality address.
      * @return true or false if the functionality has been registered or not.
      */
    function isValidFunctionality(address functionality) public override view returns(bool) {
        return _functionalityCount[functionality] > 0;
    }

    /** @dev Returns true if the functionality call is authorized, false otherwise.
      * @param functionality functionality address.
      * @return true or false if the functionality call is authorized or not.
      */
    function isAuthorizedFunctionality(address functionality) public override view returns(bool) {
        return _callingContext != address(0) && (_functionalityCount[functionality] > 0 || _callingContext == functionality);
    }

    /** @dev Returns the data associated with the functionality with the given codeName.
      * @param codeName name of the functionality.
      * @return functionality data.
      */
    function getFunctionalityData(string memory codeName) public override view returns(address, string memory, address, uint256) {
        Functionality memory functionality = _functionalities[_indexes[codeName]];
        return (compareStrings(codeName, functionality.codeName) && functionality.active ? functionality.location : address(0), functionality.methodSignature, functionality.sourceLocation, functionality.sourceLocationId);
    }

    /** @dev Returns true if the functionality exists and it's active.
      * @param codeName name of the functionality to check.
      * @return true or false if the functionality is active or not.
      */
    function hasFunctionality(string memory codeName) public override view returns(bool) {
        Functionality memory functionality = _functionalities[_indexes[codeName]];
        return compareStrings(codeName, functionality.codeName) && functionality.active;
    }

    /** @dev Returns all the functionalities as a JSON array. Calls the helper method below.
      * @return res JSON array string containing all the functionalities.
      */
    function functionalitiesToJSON() public override view returns(Functionality[] memory) {
        return functionalitiesToJSON(0, _functionalitiesAmount - 1);
    }

    /** @dev Returns the functionalities from the start index to the end index.
      * @param start start index.
      * @param end end index.
      * @return functionsJSONArray JSON array string containing functionalities from start to end.
      */
    function functionalitiesToJSON(uint256 start, uint256 end) public override view returns(Functionality[] memory) {
        Functionality[] memory res;
        uint256 length = start + end + 1;
        for(uint256 i = start; i < length; i++) {
            if (_functionalities[i].active) {
                res[i] = _functionalities[i];
            }
        }
        return res;
    }

    /** @dev Returns all the functionalities names. Calls the helper method below.
      * @return res JSON array string containing all the functionalities names.
      */ 
    function functionalityNames() public override view returns(string memory) {
        return functionalityNames(0, _functionalitiesAmount - 1);
    }

    /** @dev Returns the functionalities names from the start index to the end index.
      * @param start start index.
      * @param end end index.
      * @return functionsJSONArray JSON array string containing the functionalities names from start to end.
      */
    function functionalityNames(uint256 start, uint256 end) public override view returns(string memory functionsJSONArray) {
        uint256 length = start + end + 1;
        functionsJSONArray = "[";
        for(uint256 i = start; i < length; i++) {
            functionsJSONArray = !_functionalities[i].active ? functionsJSONArray : string(abi.encodePacked(functionsJSONArray, '"', _functionalities[i].codeName, '"', i == length - (_functionalities[i].active ? 1 : 0) ? "" : ","));
            length += _functionalities[i].active ? 0 : 1;
            length = length > _functionalitiesAmount ? _functionalitiesAmount : length;
        }
        functionsJSONArray = string(abi.encodePacked(functionsJSONArray, "]"));
    }

    /** @dev Returns the functionality with the given code name as a JSON string.
      * @param codeName name of the function to serialize.
      * @return functionality serialized as JSON string.
      */
    function functionalityToJSON(string memory codeName) public override view returns(Functionality memory) {
        return _functionalities[_indexes[codeName]];
    }

    /** @dev Returns the proxy for the manager.
      * @return proxy address.
      */
    function getProxy() public override view returns(address) {
        return _proxy;
    }

    /** @dev Allows the proxy to update itself.
      */
    function setProxy() public override {
        require(_functionalitiesAmount != 0, "Init not called!");
        require(_proxy == address(0) || _proxy == msg.sender, _proxy != address(0) ? "Proxy already set!" : "Only Proxy can toggle itself!");
        _proxy = _proxy == address(0) ?  msg.sender : address(0);
    }


    /** @dev This function sets the callingContext equal to the input location address.
      * @param location new location address.
      * @return changed true if the calling context has changed, false otherwise.
      */
    function setCallingContext(address location) public override returns(bool changed) {
        require(msg.sender == _proxy, "Unauthorized Access");
        _callingContext = (changed = _callingContext == address(0)) ? location : _callingContext;
    }

    /** @dev Function used to clear the calling context.
      */
    function clearCallingContext() public override {
        require(msg.sender == _proxy, "Unauthorized Access");
        _callingContext = address(0);
    }

    function compareStrings(string memory a, string memory b) private pure returns(bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}