// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

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
    // Mapping that given the address returns the position
    mapping(address => uint256) private _delegatesIndexes;
    // Array of delegates
    address[] private _delegates;

    /** @dev Constructor that builds the pivotal DoubleProxy.
      * @param proxies array of proxies addresses.
      * @param currentProxy address of the current proxy.
      * @param dfoItemCollectionAddress address of the dfo item collection.
      * @param functionalityProposalManagerAddress address of the functionality proposal manager contract.
      * @param stateHolderAddress address of the state holder contract.
      * @param functionalityModelsManagerAddress address of the functionality models manager contract.
      * @param functionalitiesManagerAddress address of the functionalities manager contract.
      * @param ethItemOrchestratorAddress address of the ethItemOrchestrator contract.
      * @param walletAddress address of the wallet contract.
     */
    constructor(address[] memory proxies, address currentProxy, address dfoItemCollectionAddress, address functionalityProposalManagerAddress, address stateHolderAddress, address functionalityModelsManagerAddress, address functionalitiesManagerAddress, address ethItemOrchestratorAddress, address walletAddress) public {
        if (dfoItemCollectionAddress == address(0)) {
            return;
        }
        init(proxies, currentProxy, dfoItemCollectionAddress, functionalityProposalManagerAddress, stateHolderAddress, functionalityModelsManagerAddress, functionalitiesManagerAddress, ethItemOrchestratorAddress, walletAddress);
    }

    /** @dev Initializes the pivotal DoubleProxy contract.
      * @param proxies array of proxies addresses.
      * @param currentProxy address of the current proxy.
      * @param dfoItemCollectionAddress address of the dfo item collection.
      * @param functionalityProposalManagerAddress address of the functionality proposal manager contract.
      * @param stateHolderAddress address of the state holder contract.
      * @param functionalityModelsManagerAddress address of the functionality models manager contract.
      * @param functionalitiesManagerAddress address of the functionalities manager contract.
      * @param ethItemOrchestratorAddress address of the eth item orchestrator contract.
      * @param walletAddress address of the wallet contract.
     */
    function init(address[] memory proxies, address currentProxy, address dfoItemCollectionAddress, address functionalityProposalManagerAddress, address stateHolderAddress, address functionalityModelsManagerAddress, address functionalitiesManagerAddress, address ethItemOrchestratorAddress, address walletAddress) public override {
      require(_proxies.length == 0 && _delegates.length == 0, "Init already called!");
      for(uint256 i = 0; i < proxies.length; i++) {
          if (proxies[i] != address(0)) {
              _proxies.push(proxies[i]);
              _isProxy[proxies[i]] = true;
          }
      }
      _delegates.push(dfoItemCollectionAddress);
      _delegatesIndexes[dfoItemCollectionAddress] = 0;
      _delegates.push(functionalityProposalManagerAddress);
      _delegatesIndexes[functionalityProposalManagerAddress] = 1;
      _delegates.push(stateHolderAddress);
      _delegatesIndexes[stateHolderAddress] = 2;
      _delegates.push(functionalityModelsManagerAddress);
      _delegatesIndexes[functionalityModelsManagerAddress] = 3;
      _delegates.push(functionalitiesManagerAddress);
      _delegatesIndexes[functionalitiesManagerAddress] = 4;
      _delegates.push(ethItemOrchestratorAddress);
      _delegatesIndexes[ethItemOrchestratorAddress] = 5;
      _delegates.push(walletAddress);
      _delegatesIndexes[walletAddress] = 6;
      if (currentProxy != address(0)) {
        _proxy = currentProxy;
        if (!_isProxy[currentProxy]) {
            _proxies.push(currentProxy);
            _isProxy[currentProxy] = true;
        }
        IMVDProxy(_proxy).setProxies(functionalityProposalManagerAddress, stateHolderAddress, functionalitiesManagerAddress, walletAddress);
      }
    }

    /** @dev Returns the current proxy address.
      * @return address current proxy address.
      */
    function proxy() public override view returns(address) {
        return _proxy;
    }

    /** @dev Allows the proxy to set itself in this contract. */
    function setProxy() public override {
        require(_proxy == address(0) || _proxy == msg.sender, _proxy != address(0) ? "Proxy already set!" : "Only Proxy can toggle itself!");
        _proxy = _proxy == address(0) ? msg.sender : address(0);
        if (_proxy != address(0) && !_isProxy[_proxy]) {
            _proxies.push(_proxy);
            _isProxy[_proxy] = true;
        }
    }

    /** @dev Allows the proxy to change the address to a new one. 
      * @param newAddress new proxy address.
      * @param initPayload proxy init payload.
      */
    function changeProxy(address newAddress, bytes memory initPayload) public override {
        require(IMVDProxy(_proxy).isAuthorizedFunctionality(msg.sender), "Unauthorized action!");
        require(newAddress != address(0), "Cannot set void address!");
        _proxy = newAddress;
        if (!_isProxy[_proxy]) {
            _proxies.push(_proxy);
            _isProxy[_proxy] = true;
        }
        IMVDProxy(_proxy).setProxies(
            _delegates[1],
            _delegates[2], 
            _delegates[4], 
            _delegates[6]
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

    /** @dev Returns the dfo item collection address.
      * @return dfo item collection address.
      */
    function getItemCollection() public override view returns(address) {
        return _delegates[0];
    }

    /** @dev Returns the functionality proposal manager address.
      * @return functionality proposal manager address.
      */
    function getMVDFunctionalityProposalManagerAddress() public override view returns(address) {
        return _delegates[1];
    }

    /** @dev Returns the state holder address.
      * @return state holder address.
      */
    function getStateHolderAddress() public override view returns(address) {
        return _delegates[2];
    }

    /** @dev Returns the functionality models manager address.
      * @return functionality models manager address.
      */
    function getMVDFunctionalityModelsManagerAddress() public override view returns(address) {
        return _delegates[3];
    }

    /** @dev Returns the functionalities manager address.
      * @return functionalities manager address.
      */
    function getMVDFunctionalitiesManagerAddress() public override view returns(address) {
        return _delegates[4];
    }

    /** @dev Returns the eth item orchestrator address.
      * @return eth item orchestrator adddress.
      */
    function getEthItemOrchestratorAddress() public override view returns(address) {
        return _delegates[5];
    }

    /** @dev Returns the wallet address.
      * @return wallet address.
      */
    function getMVDWalletAddress() public override view returns(address) {
        return _delegates[6];
    }

    /** @dev Returns the delegate at the input position.
      * @param position delegate position in the array.
      * @return delegate address at the given position.
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
        if (position == 5) {
            IMVDWallet(getMVDWalletAddress()).setNewWallet(payable(newAddress));
        }
        oldAddress = _delegates[position];
        _delegates[position] = newAddress;
        _delegatesIndexes[newAddress] = position;
        if (position != 3) {
            IMVDProxy(_proxy).setProxies(
                oldAddress == _delegates[1] ? oldAddress : address(0), 
                oldAddress == _delegates[2] ? oldAddress : address(0), 
                oldAddress == _delegates[4] ? oldAddress : address(0), 
                oldAddress == _delegates[6] ? oldAddress : address(0) 
            );
            IMVDProxy(_proxy).setProxies(
                newAddress == _delegates[1] ? newAddress : address(0), 
                newAddress == _delegates[2] ? newAddress : address(0), 
                newAddress == _delegates[4] ? newAddress : address(0), 
                newAddress == _delegates[6] ? newAddress : address(0) 
            );
        }
        emit DelegateChanged(position, oldAddress, newAddress);
    }

    /** @dev Allows the proxy to add a new delegate to the array.
      * @param delegateAddress new delegate address.
      */
    function addDelegate(address delegateAddress) public override {
        require(_proxy == msg.sender, "Unauthorized action!");
        require(delegateAddress != address(0), "Cannot set void address!");
        _delegates.push(delegateAddress);
        _delegatesIndexes[delegateAddress] = _delegates.length - 1;
        emit DelegateAdded(_delegates.length - 1, delegateAddress);
    }
}