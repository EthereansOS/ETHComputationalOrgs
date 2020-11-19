pragma solidity ^0.6.0;

import "./interfaces/IMVDWallet.sol";
import "./interfaces/IMVDProxy.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC165.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/IERC721Receiver.sol";
import "./interfaces/IERC1155.sol";
import "./interfaces/IERC1155Receiver.sol";

contract MVDWallet is IMVDWallet, IERC721Receiver, IERC1155Receiver {

    // Proxy address
    address private _proxy;
    // New wallet address
    address payable private _newWallet;
    // EthItem orchestrator
    address private _orchestrator;

    constructor(address orchestrator) public {
        _orchestrator = orchestrator;
    }

    /** @dev Allows the proxy contract to update the ETHItemOrchestrator used by the wallet to wrap/unwrap ETHItems.
      * @param newOrchestrator new orchestrator address.
      */
    function setOrchestrator(address newOrchestrator) public override {
        require(msg.sender == _proxy, "Unauthorized Access!");
        emit OrchestratorChanged(_orchestrator, newOrchestrator);
        _orchestrator = newOrchestrator;
    }

    /** @dev Sets the _newWallet variable to the input newWallet one.
      * @param newWallet new wallet address.
      * @param tokenAddress token address.
      */
    function setNewWallet(address payable newWallet, address tokenAddress) public override {
        require(msg.sender == _proxy, "Unauthorized Access!");
        _newWallet = newWallet;
        _newWallet.transfer(address(this).balance);
        IERC20 token = IERC20(tokenAddress);
        token.transfer(_newWallet, token.balanceOf(address(this)));
    }

    /** @dev Flushes all the ETH (if tokenAddress = 0x0) or all the ERC20 tokens to the new wallet.
      * @param tokenAddress tokenAddress to flush or 0x0 (for ETH).
      */
    function flushToNewWallet(address tokenAddress) public override {
        require(_newWallet != address(0), "Unauthorized Access!");
        if(tokenAddress == address(0)) {
            payable(_newWallet).transfer(address(this).balance);
            return;
        }
        IERC20 token = IERC20(tokenAddress);
        token.transfer(_newWallet, token.balanceOf(address(this)));
    }

    /** @dev Flushes the ERC721 with the given tokenAddress and tokenId to the new wallet.
      * @param tokenId id of the token to flush.
      * @param data transfer call data.
      * @param safe whether the transfer function to be called is safe or not.
      * @param tokenAddress address of the ERC721 token.
      */
    function flush721ToNewWallet(uint256 tokenId, bytes memory data, bool safe, address tokenAddress) public override {
        require(_newWallet != address(0) && tokenAddress != address(0), "Unauthorized Access!");
        _transfer(_newWallet, tokenId, data, safe, tokenAddress);
    }

    /** @dev Allows the proxy or a functionality to transfer the amount of ERC20 tokens to the given receiver.
      * @param receiver token transfer receiver.
      * @param value amount of ERC20 to transfer.
      * @param token address of the ERC20 token.
      */
    function transfer(address receiver, uint256 value, address token) public override {
        require(msg.sender == _proxy || IMVDProxy(_proxy).isAuthorizedFunctionality(msg.sender), "Unauthorized Access!");
        if(value == 0) {
            return;
        }
        if(token == address(0)) {
            payable(receiver).transfer(value);
            return;
        }
        IERC20(token).transfer(receiver, value);
    }

    /** @dev Allows the proxy or a functionality to transfer an ERC721 token using the _transfer function.
      * @param receiver token transfer receiver.
      * @param tokenId id of the token to transfer.
      * @param data transfer call data.
      * @param safe whether the transfer call must be safeTransferFrom or just transferFrom.
      * @param token address of the ERC721 token.
      */
    function transfer(address receiver, uint256 tokenId, bytes memory data, bool safe, address token) public override {
        require(msg.sender == _proxy || IMVDProxy(_proxy).isAuthorizedFunctionality(msg.sender), "Unauthorized Access!");
        _transfer(receiver, tokenId, data, safe, token);
    }

    /** @dev The private function that actually performs the ERC721 token transfer.
      * @param receiver token transfer receiver.
      * @param tokenId id of the token to transfer.
      * @param data transfer call data.
      * @param safe whether the transfer call must be safeTransferFrom or just transferFrom.
      * @param token address of the ERC721 token.
      */
    function _transfer(address receiver, uint256 tokenId, bytes memory data, bool safe, address token) private {
        if(safe) {
            IERC721(token).safeTransferFrom(address(this), receiver, tokenId, data);
        } else {
            IERC721(token).transferFrom(address(this), receiver, tokenId);
        }
    }
    
    /** @dev Allows this contract to receive ETH.
      * If a _newWallet is set it performs the flush of this contract balance to it.
      */
    receive() external payable {
        if(_newWallet != address(0)) {
            _newWallet.transfer(address(this).balance);
        }
    }

    /** @dev Returns the proxy address.
     */
    function getProxy() public override view returns(address) {
        return _proxy;
    }

    /** @dev Sets the _proxy of this contract to the msg sender.
     */
    function setProxy() public override {
        require(_proxy == address(0) || _proxy == msg.sender, _proxy != address(0) ? "Proxy already set!" : "Only Proxy can toggle itself!");
        _proxy = _proxy == address(0) ?  msg.sender : address(0);
    }
    
    /** @dev Function called after a ERC721 has been received by this contract.
      * If a _newWallet is set the token is flushed to it; otherwise the token is sent
      * to the EthItemOrchestrator for the wrapping.
      * @param operator address that called the transfer to this contract.
      * @param tokenId id of the received token.
      * @param data transfer call data.
      * @return 0x150b7a02.
      */
    function onERC721Received(address operator, address, uint256 tokenId, bytes memory data) public override returns (bytes4) {
        if(_newWallet != address(0)) {
            _transfer(_newWallet, tokenId, data, true, msg.sender);
        } else {
            if (operator != _orchestrator && _orchestrator != address(0) && !_isEthItem(msg.sender)) {
                _transfer(_orchestrator, tokenId, data, true, msg.sender);
            }
        }
        return 0x150b7a02;
    }

    /** @dev Function called after a ERC1155 has been received by this contract.
      * If a _newWallet is set the token is flushed to it; otherwise the token is sent
      * to the EthItemOrchestrator for the wrapping.
      * @param operator address that called the transfer to this contract.
      * @param tokenId id of the received token.
      * @param value amount of tokens being transferred. 
      * @param data transfer call data.
      * @return 0xf23a6e61.
      */
    function onERC1155Received(address operator, address, uint256 tokenId, uint256 value, bytes memory data) public override returns(bytes4) {
        if (_newWallet != address(0)) {
            IERC1155(msg.sender).safeTransferFrom(address(this), _newWallet, tokenId, value, data);
        } else {
            if (operator != _orchestrator && _orchestrator != address(0) && !_isEthItem(msg.sender)) {
                IERC1155(msg.sender).safeTransferFrom(address(this), _orchestrator, tokenId, value, data);
            }
        }
        return 0xf23a6e61;
    }
    
    /** @dev Function called after a batch of ERC1155 has been received by this contract.
      * If a _newWallet is set the tokens are flushed to it; otherwise the tokens are sent
      * to the EthItemOrchestrator for the wrapping.
      * @param operator address that called the transfer to this contract.
      * @param ids array containing ids of each token being transferred (order and length must match values array).
      * @param values array containing amounts of each token being transferred (order and length must match ids array). 
      * @param data transfer call data.
      * @return 0xbc197c81.
      */
    function onERC1155BatchReceived(address operator, address, uint256[] memory ids, uint256[] memory values, bytes memory data) public override returns (bytes4) {
        if (_newWallet != address(0)) {
            IERC1155(msg.sender).safeBatchTransferFrom(address(this), _newWallet, ids, values, data);
        } else {
            if (operator != _orchestrator && _orchestrator != address(0) && !_isEthItem(msg.sender)) {
                IERC1155(msg.sender).safeBatchTransferFrom(address(this), _orchestrator, ids, values, data);
            }
        }
        return 0xbc197c81;
    }

    /** @dev Returns true if the given address is an EthItem, false otherwise.
      * @param addr EthItem address.
      * @return true if addr is an EthItem, false otherwise.
     */
    function _isEthItem(address addr) private view returns(bool) {
        if(!IERC165(addr).supportsInterface(0xd9b67a26)) {
          return false;
        }
        (bool result, bytes memory resultPayload) = addr.staticcall(abi.encodeWithSignature("mainInterfaceVersion()"));
        if(!result) {
          return false;
        }
        return resultPayload.length > 0 && abi.decode(resultPayload, (uint256)) > 0;
}
}
