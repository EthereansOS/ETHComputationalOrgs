pragma solidity ^0.6.0;

interface IDoubleProxy {
    function init(address[] calldata proxies, address currentProxy, address votingTokenAddress, address functionalityProposalManagerAddress, address stateHolderAddress, address functionalityModelsManagerAddress, address functionalitiesManagerAddress, address walletAddress) external;
    function proxy() external view returns(address);
    function setProxy() external;
    function changeProxy(address newAddress, bytes calldata initPayload) external;
    function isProxy(address) external view returns(bool);
    function proxiesLength() external view returns(uint256);
    function proxies(uint256 start, uint256 offset) external view returns(address[] memory);
    function proxies() external view returns(address[] memory);
    function getDelegates() external view returns(address[] memory);
    function getDelegate(uint256 position) external view returns(address);
    function setDelegate(uint256 position, address newAddress) external returns(address oldAddress);
    function getToken() external view returns(address);
    function getMVDFunctionalityProposalManagerAddress() external view returns(address);
    function getStateHolderAddress() external view returns(address);
    function getMVDFunctionalityModelsManagerAddress() external view returns(address);
    function getMVDFunctionalitiesManagerAddress() external view returns(address);
    function getMVDWalletAddress() external view returns(address);

    event ProxyChanged(address indexed newAddress);
    event DelegateChanged(uint256 position, address indexed oldAddress, address indexed newAddress);
}