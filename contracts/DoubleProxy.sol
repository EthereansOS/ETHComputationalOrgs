pragma solidity ^0.6.0;

import "./interfaces/IDoubleProxy.sol";
import "./interfaces/IMVDProxy.sol";
import "./interfaces/IMVDWallet.sol";
import "./interfaces/IMVDProxyDelegate.sol";

contract DoubleProxy is IDoubleProxy {

    // Current proxy address
    address private _proxy;
    // Mapping to check if an address is a proxy or not
    mapping(address => bool) private _isProxy;
    // Array of proxies
    address[] private _proxies;
    // Array of delegates
    address[] private _delegates;

    /** @dev Constructor that builds the pivotal DoubleProxy.
      * @param proxies array of proxies addresses.
      * @param currentProxy address of the current proxy.
      * @param votingTokenAddress address of the voting token contract.
      * @param functionalityProposalManagerAddress address of the functionality proposal manager contract.
      * @param stateHolderAddress address of the state holder contract.
      * @param functionalityModelsManagerAddress address of the functionality models manager contract.
      * @param functionalitiesManagerAddress address of the functionalities manager contract.
      * @param walletAddress address of the wallet contract.
     */
    constructor(address[] memory proxies, address currentProxy, address votingTokenAddress, address functionalityProposalManagerAddress, address stateHolderAddress, address functionalityModelsManagerAddress, address functionalitiesManagerAddress, address walletAddress) public {
        if(votingTokenAddress == address(0)) {
            return;
        }
        init(proxies, currentProxy, votingTokenAddress, functionalityProposalManagerAddress, stateHolderAddress, functionalityModelsManagerAddress, functionalitiesManagerAddress, walletAddress);
    }

    /** @dev Initializes the pivotal DoubleProxy contract.
      * @param proxies array of proxies addresses.
      * @param currentProxy address of the current proxy.
      * @param votingTokenAddress address of the voting token contract.
      * @param functionalityProposalManagerAddress address of the functionality proposal manager contract.
      * @param stateHolderAddress address of the state holder contract.
      * @param functionalityModelsManagerAddress address of the functionality models manager contract.
      * @param functionalitiesManagerAddress address of the functionalities manager contract.
      * @param walletAddress address of the wallet contract.
     */
    function init(address[] memory proxies, address currentProxy, address votingTokenAddress, address functionalityProposalManagerAddress, address stateHolderAddress, address functionalityModelsManagerAddress, address functionalitiesManagerAddress, address walletAddress) public override {
      require(_proxies.length == 0 && _delegates.length == 0, "Init already called!");
      for(uint256 i = 0; i < proxies.length; i++) {
          if(proxies[i] != address(0)) {
              _proxies.push(proxies[i]);
              _isProxy[proxies[i]] = true;
          }
      }
      if(currentProxy != address(0)) {
        _delegates[0] = votingTokenAddress;
        _delegates[1] = functionalityProposalManagerAddress;
        _delegates[2] = stateHolderAddress;
        _delegates[3] = functionalityModelsManagerAddress;
        _delegates[4] = functionalitiesManagerAddress;
        _delegates[5] = walletAddress;
        _proxy = currentProxy;
        if(!_isProxy[currentProxy]) {
            _proxies.push(currentProxy);
            _isProxy[currentProxy] = true;
        }
        IMVDProxy(_proxy).setProxies(votingTokenAddress, functionalityProposalManagerAddress, stateHolderAddress, functionalitiesManagerAddress, walletAddress);
      }
    }

    /** @dev Returns the current proxy address.
      * @return address current proxy address.
      */
    function proxy() public override view returns(address) {
        return _proxy;
    }

    /** @dev Allows the proxy to set itself in this contract and in all the delegates. */
    function setProxy() public override {
        require(_proxy == address(0) || _proxy == msg.sender, _proxy != address(0) ? "Proxy already set!" : "Only Proxy can toggle itself!");
        _proxy = _proxy == address(0) ? msg.sender : address(0);
        if(_proxy != address(0) && !_isProxy[_proxy]) {
            _proxies.push(_proxy);
            _isProxy[_proxy] = true;
        }
        IMVDProxy(_proxy).setProxies(
            getToken(), 
            getMVDFunctionalityProposalManagerAddress(),
            getStateHolderAddress(), 
            getMVDFunctionalitiesManagerAddress(), 
            getMVDWalletAddress()
        );
        // ProxyChanged(_proxy);
    }

    /** @dev Allows the proxy to change the address to a new one. 
      * @param newAddress new proxy address.
      * @param initPayload proxy init payload.
      */
    function changeProxy(address newAddress, bytes memory initPayload) public override {
        require(IMVDProxy(_proxy).isAuthorizedFunctionality(msg.sender), "Unauthorized action!");
        require(newAddress != address(0), "Cannot set void address!");
        _proxy = newAddress;
        if(!_isProxy[_proxy]) {
            _proxies.push(_proxy);
            _isProxy[_proxy] = true;
        }
        IMVDProxy(_proxy).setProxies(
            getToken(), 
            getMVDFunctionalityProposalManagerAddress(),
            getStateHolderAddress(), 
            getMVDFunctionalitiesManagerAddress(), 
            getMVDWalletAddress()
        );
        emit ProxyChanged(newAddress);

        (bool response,) = newAddress.call(initPayload);
        require(response, "New Proxy initPayload failed!");
    } 

    /** @dev Checks if the input address is a proxy or not.
      * @param addr address to check.
      * @return res true if the address is a proxy, false otherwise.
      */
    function isProxy(address addr) public override view returns(bool) {
        return _isProxy[addr];
    }

    /** @dev Returns the proxies array length.
      * @return res proxies array length. 
      */
    function proxiesLength() public override view returns(uint256) {
        return _proxies.length;
    }

    /** @dev Returns the proxies addresses array.
      * @return res array containing all the proxies addresses.
      */
    function proxies() public override view returns(address[] memory) {
        return proxies(0, _proxies.length);
    }

    /** @dev Returns the proxies addresses array from the start index using the given offset.
      * @param start start index.
      * @param offset offset int.
      * @return out array containing the proxy addresses in the range.
     */
    function proxies(uint256 start, uint256 offset) public override view returns(address[] memory out) {
        require(start < _proxies.length, "Invalid start");
        uint256 length = offset > _proxies.length ? _proxies.length : offset;
        out = new address[](length);
        length += start;
        length = length > _proxies.length ? _proxies.length : length;
        uint256 pos = 0;
        for(uint256 i = start; i < length; i++) {
            out[pos++] = _proxies[i];
        }
    }

    /** @dev Returns the list of delegates.
      * @return res array containing all the addresses of the delegates.
      */
    function getDelegates() public override view returns(address[] memory) {
        return _delegates;
    }

    /** @dev Returns the voting token address.
      * @return res voting token address.
      */
    function getToken() public override view returns(address) {
        return _delegates[0];
    }

    /** @dev Returns the functionality proposal manager address.
      * @return res functionality proposal manager address.
      */
    function getMVDFunctionalityProposalManagerAddress() public override view returns(address) {
        return _delegates[1];
    }

    /** @dev Returns the state holder address.
      * @return res state holder address.
      */
    function getStateHolderAddress() public override view returns(address) {
        return _delegates[2];
    }

    /** @dev Returns the functionality models manager address.
      * @return res functionality models manager address.
      */
    function getMVDFunctionalityModelsManagerAddress() public override view returns(address) {
        return _delegates[3];
    }

    /** @dev Returns the functionalities manager address.
      * @return res functionalities manager address.
      */
    function getMVDFunctionalitiesManagerAddress() public override view returns(address) {
        return _delegates[4];
    }

    /** @dev Returns the wallet address.
      * @return res wallet address.
      */
    function getMVDWalletAddress() public override view returns(address) {
        return _delegates[5];
    }

    /** @dev Returns the delegate at the input position.
      * @param position delegate position in the array.
      * @return res delegate address at the given position.
      */
    function getDelegate(uint256 position) public override view returns(address) {
      return _delegates[position];
    }

    /** @dev Changes the delegate at the given position with the new address.
      * @param position delegate position.
      * @param newAddress new delegate address.
      * @return oldAddress old delegate address.
     */
    function setDelegate(uint256 position, address newAddress) public override returns(address oldAddress) {
        require(IMVDProxy(_proxy).isAuthorizedFunctionality(msg.sender), "Unauthorized action!");
        require(newAddress != address(0), "Cannot set void address!");
        if(position == 5) {
            IMVDWallet(getMVDWalletAddress()).setNewWallet(payable(newAddress), getToken());
        }
        oldAddress = _delegates[position];
        _delegates[position] = newAddress;
        if(position != 3) {
            IMVDProxyDelegate(oldAddress).setProxy();
            IMVDProxyDelegate(newAddress).setProxy();
        }
        emit DelegateChanged(position, oldAddress, newAddress);
    }
}