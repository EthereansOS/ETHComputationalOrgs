pragma solidity ^0.6.0;

interface IMVDFunctionalitiesManager {
    // Initialization function
    function init(address sourceLocation,
        uint256 getMinimumBlockNumberSourceLocationId, address getMinimumBlockNumberFunctionalityAddress,
        uint256 getEmergencyMinimumBlockNumberSourceLocationId, address getEmergencyMinimumBlockNumberFunctionalityAddress,
        uint256 getEmergencySurveyStakingSourceLocationId, address getEmergencySurveyStakingFunctionalityAddress,
        uint256 checkVoteResultSourceLocationId, address checkVoteResultFunctionalityAddress) external;
    // Methods used to add, remove, setup and check a functionality
    function addFunctionality(string calldata codeName, address sourceLocation, uint256 sourceLocationId, address location, bool submitable, string calldata methodSignature, string calldata returnAbiParametersArray, bool isInternal, bool needsSender) external;
    function removeFunctionality(string calldata codeName) external returns(bool removed);
    function preConditionCheck(string calldata codeName, bytes calldata data, uint8 submitable, address sender, uint256 value) external view returns(address location, bytes memory payload);
    function setupFunctionality(address proposalAddress) external returns (bool);
    // Validation, authorization and existance checks
    function isValidFunctionality(address functionality) external view returns(bool);
    function isAuthorizedFunctionality(address functionality) external view returns(bool);
    function hasFunctionality(string calldata codeName) external view returns(bool);
    // Getters and setters
    function getProxy() external view returns (address);
    function setProxy() external;
    function setCallingContext(address location) external returns(bool);
    function clearCallingContext() external;
    // Only getters
    function getFunctionalityData(string calldata codeName) external view returns(address, string memory, address, uint256);
    function getFunctionalitiesAmount() external view returns(uint256);
    // Getters and serializers
    function functionalitiesToJSON() external view returns(string memory);
    function functionalitiesToJSON(uint256 start, uint256 l) external view returns(string memory functionsJSONArray);
    function functionalityNames() external view returns(string memory);
    function functionalityNames(uint256 start, uint256 l) external view returns(string memory functionsJSONArray);
    function functionalityToJSON(string calldata codeName) external view returns(string memory);
}