pragma solidity ^0.6.0;

import "./interfaces/IMVDFunctionalityProposalManager.sol";
import "./interfaces/IMVDProxy.sol";
import "./MVDFunctionalityProposal.sol";
import "./interfaces/IMVDFunctionalitiesManager.sol";

contract MVDFunctionalityProposalManager is IMVDFunctionalityProposalManager {

    // Proxy address
    address private _proxy;
    // Returns true if the given address is a proposal, false otherwise
    mapping(address => bool) private _proposals;

    /** @dev modifier user that requires the proxy as the msg.sender */
    modifier onlyProxy() {
        require(msg.sender == address(_proxy), "Only Proxy can call this functionality");
        _;
    }

    /** @dev Creates a new MVDFunctionalityProposal using the input data. calls the helper method "setProposal".
      * @param codeName new functionality name. if populated and replaces is blank, it's a new functionality; if it's blank and replaces is populated, it replaces an existing one.
      * @param location functionality address location.
      * @param methodSignature functionality method signature.
      * @param returnAbiParametersArray functionality method return parameters array.
      * @param replaces old functionality name to replace. if populated and codeName is blank, it replaces an existing functionality; if it's blank and codeName is populated, it creates a new one.
      * @return the new proposal address.
      */
    function newProposal(string memory codeName, address location, string memory methodSignature, string memory returnAbiParametersArray, string memory replaces) public override onlyProxy returns(address) {
        return _setProposal(codeName, location, methodSignature, replaces, returnAbiParametersArray);
    }

    /** @dev Performs a precondition check on the given parameters. Reverts if something goes wrong.
      * @param codeName new functionality name. if populated and replaces is blank, it's a new functionality; if it's blank and replaces is populated, it replaces an existing one.
      * @param location functionality address location.
      * @param methodSignature functionality method signature.
      * @param replaces old functionality name to replace. if populated and codeName is blank, it replaces an existing functionality; if it's blank and codeName is populated, it creates a new one.
      */
    function _preconditionCheck(string memory codeName, address location, string memory methodSignature, string memory replaces) private view {
        // Check if codeName exists and if hasReplaces exists
        bool hasCodeName = !compareStrings(codeName, "");
        bool hasReplaces = !compareStrings(replaces, "");
        // One of them is required
        require((hasCodeName || !hasCodeName && !hasReplaces) ? location != address(0) : true, "Cannot have zero address for functionality to set or one time functionality to call");
        // Location cannot be 0x0 and the methodSignature cannot be empty
        require(location == address(0) || !compareStrings(methodSignature, ""), "Cannot have empty string for methodSignature or an empty location");
        // Check for the callOneTime functionality method signature if it does not replace
        require(hasCodeName || hasReplaces ? true : compareStrings(methodSignature, "callOneTime(address)"), "One Time Functionality method signature allowed is callOneTime(address)");
        // Retrieve the functionality manager contract
        IMVDFunctionalitiesManager functionalitiesManager = IMVDFunctionalitiesManager(IMVDProxy(_proxy).getMVDFunctionalitiesManagerAddress());
        // Check if we're trying to create a functionality with the same name as an existing one without replacing it
        require(hasCodeName && functionalitiesManager.hasFunctionality(codeName) ? compareStrings(codeName, replaces) : true, "codeName is already used by another functionality");
        // Check if we're trying to replace a functionality that does not exist or an inactive one
        require(hasReplaces ? functionalitiesManager.hasFunctionality(replaces) : true, "Cannot replace unexisting or inactive functionality");
    }

    /** @dev Helper method that performs a precondition check before creating the proposal and returning its address.
      * @param codeName new functionality name. if populated and replaces is blank, it's a new functionality; if it's blank and replaces is populated, it replaces an existing one.
      * @param location functionality address location.
      * @param methodSignature functionality method signature.
      * @param replaces old functionality name to replace. if populated and codeName is blank, it replaces an existing functionality; if it's blank and codeName is populated, it creates a new one.
      * @param returnAbiParametersArray functionality method return parameters array.
      * @return the new proposal address.
      */
    function _setProposal(string memory codeName, address location, string memory methodSignature, string memory returnAbiParametersArray, string memory replaces) private returns(address) {
        // Perform the precondition check
        _preconditionCheck(codeName, location, methodSignature, replaces);
        // Create the new functionality proposal and retrieve its address
        address proposalAddress = address(new MVDFunctionalityProposal(codeName, location, methodSignature, returnAbiParametersArray, replaces, _proxy));
        _proposals[proposalAddress] = true;
        // Return its address
        return proposalAddress;
    }

    /** @dev Allows the proxy to check the proposal with the given address.
      * @param proposalAddress proposal contract address.
      */
    function checkProposal(address proposalAddress) public override onlyProxy {
        // The proposal address given is not a valid one.
        require(_proposals[proposalAddress], "Unauthorized Access!");
        // Retrieve the proposal
        IMVDFunctionalityProposal proposal = IMVDFunctionalityProposal(proposalAddress);
        // Get the survey end block
        uint256 surveyEndBlock = proposal.getSurveyEndBlock();
        // Check if the survey is started
        require(surveyEndBlock > 0, "Survey was not started!");
        // Check if the proposal is disabled
        require(!proposal.isDisabled(), "Proposal is disabled!");
        // Check if the hard cap has been reached
        if(!proposal.isVotesHardCapReached()) {
            // If it is, check if the suvery is still running
            require(block.number >= surveyEndBlock, "Survey is still running!");
        }
        // Check if the proposal is not terminated
        require(!proposal.isTerminated(), "Survey already terminated!");
    }

    /** @dev Returns true if the proposal is a valid one, false otherwise.
      * @param proposal proposal address.
      * @return true if the proposal is a valid one, false otherwise.
      */
    function isValidProposal(address proposal) public override view returns (bool) {
        return _proposals[proposal];
    }

    /** @dev Returns the proxy address.
      * @return proxy address.
      */
    function getProxy() public override view returns (address) {
        return _proxy;
    }

    /** @dev Allows the proxy to toggle itself. */
    function setProxy() public override {
        require(_proxy == address(0) || _proxy == msg.sender, _proxy != address(0) ? "Proxy already set!" : "Only Proxy can toggle itself!");
        _proxy = _proxy == address(0) ?  msg.sender : address(0);
    }

    /** @dev Compares the given strings and returns true if they match, false otherwise. 
      * @param a first string.
      * @param b second string.
      * @return  true if the strings match, false otherwise. 
      */
    function compareStrings(string memory a, string memory b) private pure returns(bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}