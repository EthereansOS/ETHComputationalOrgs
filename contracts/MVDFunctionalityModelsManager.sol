pragma solidity ^0.6.0;

import "./interfaces/IMVDFunctionalityModelsManager.sol";
import "./Functionality.sol";

contract MVDFunctionalityModelsManager is IMVDFunctionalityModelsManager {

    // Mapping that stores a Functionality given its name
    mapping(string => Functionality) private _wellKnownFunctionalityModels;

    constructor() public {
        init();
    }

    /** @dev Performs the initialization. */
    function init() public override {
        // Check if the init was already called
        require(compareStrings("", _wellKnownFunctionalityModels["getMinimumBlockNumberForSurvey"].codeName), "Init already called!");
        // getMinimumBlockNumberForSurvey functionality
        _wellKnownFunctionalityModels["getMinimumBlockNumberForSurvey"] = Functionality("getMinimumBlockNumberForSurvey", address(0), 0, address(0), false, "getMinimumBlockNumberForSurvey()", '["uint256"]', false, false, address(0), true);
        // getMinimumBlockNumberForEmergencySurvey functionality
        _wellKnownFunctionalityModels["getMinimumBlockNumberForEmergencySurvey"] = Functionality("getMinimumBlockNumberForEmergencySurvey", address(0), 0, address(0), false, "getMinimumBlockNumberForEmergencySurvey()", '["uint256"]', false, false, address(0), true);
        // getEmergencySurveyStaking functionality
        _wellKnownFunctionalityModels["getEmergencySurveyStaking"] = Functionality("getEmergencySurveyStaking", address(0), 0, address(0), false, "getEmergencySurveyStaking()", '["uint256"]', false, false, address(0), true);
        // checkSurveyResult functionality
        _wellKnownFunctionalityModels["checkSurveyResult"] = Functionality("checkSurveyResult", address(0), 0, address(0), false, "checkSurveyResult(address)", '["bool"]', false, false, address(0), true);
        // getVotesHardCap functionality
        _wellKnownFunctionalityModels["getVotesHardCap"] = Functionality("getVotesHardCap", address(0), 0, address(0), false, "getVotesHardCap()", '["uint256"]', false, false, address(0), false);
        // onNewProposal functionality
        _wellKnownFunctionalityModels["onNewProposal"] = Functionality("onNewProposal", address(0), 0, address(0), true, "onNewProposal(address)", '[]', false, false, address(0), false);
        // startProposal functionality
        _wellKnownFunctionalityModels["startProposal"] = Functionality("startProposal", address(0), 0, address(0), true, "startProposal(address,uint256,address)", '[]', false, true, address(0), false);
        // disableProposal functionality
        _wellKnownFunctionalityModels["disableProposal"] = Functionality("disableProposal", address(0), 0, address(0), true, "disableProposal(address,uint256,address)", '[]', false, true, address(0), false);
        // getItemProposalWeight functionality
        _wellKnownFunctionalityModels["getItemProposalWeight"] = Functionality("getItemProposalWeight", address(0), 0, address(0), false, "getItemProposalWeight(address)", '["uint256"]', false, false, address(0), false);
        // proposalEnd functionality
        _wellKnownFunctionalityModels["proposalEnd"] = Functionality("proposalEnd", address(0), 0, address(0), true, "proposalEnd(address,bool)", "[]", false, false, address(0), false);
    }

    /** @dev Performs a check for the well know functionalities.
      * @param codeName name of the functionality.
      * @param submitable whether the functionality is submitable or not.
      * @param methodSignature functionality method signature (abi encoded).
      * @param returnAbiParametersArray functionality function return parameters as an array.
      * @param isInternal whether the functionality is internal or not.
      * @param needsSender whether the functionality needs the original sender or not.
      * @param replaces to be replaced functionality name.
     */
    function checkWellKnownFunctionalities(
        string memory codeName, 
        bool submitable, 
        string memory methodSignature, 
        string memory returnAbiParametersArray,
        bool isInternal, 
        bool needsSender, 
        string memory replaces
    ) public override view {
        // codeName and replaces can't both be null
        if (compareStrings(codeName, "") && compareStrings(replaces, "")) {
            return;
        }
        // Check if the given codeName is a well known one
        bool codeNameIsWellKnown = compareStrings(codeName, _wellKnownFunctionalityModels[string(codeName)].codeName);
        Functionality memory wellKnownFunctionality = _wellKnownFunctionalityModels[string(codeName)];
        // Perform the requires
        require(codeNameIsWellKnown ? wellKnownFunctionality.submitable == submitable : true, "Wrong submitable flag for this submission");
        require(codeNameIsWellKnown ? wellKnownFunctionality.needsSender == needsSender : true, "Wrong needsSender flag for this submission");
        require(codeNameIsWellKnown ? wellKnownFunctionality.isInternal == isInternal : true, "Wrong isInternal flag for this submission");
        require(codeNameIsWellKnown ? compareStrings(wellKnownFunctionality.methodSignature, methodSignature) : true, "Wrong method signature for this submission");
        require(codeNameIsWellKnown ? compareStrings(wellKnownFunctionality.returnAbiParametersArray, returnAbiParametersArray) : true, "Wrong return abi parameters array for this submission");
        require(codeNameIsWellKnown ? wellKnownFunctionality.active ? compareStrings(wellKnownFunctionality.codeName, replaces) : true : true, "Active well known functionality cannot be disabled");
        require(compareStrings(replaces, _wellKnownFunctionalityModels[replaces].codeName) ? compareStrings(codeName, "") ? !_wellKnownFunctionalityModels[replaces].active : true : true, "Active well known functionality cannot be disabled");
    }

    function compareStrings(string memory a, string memory b) internal pure returns(bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}