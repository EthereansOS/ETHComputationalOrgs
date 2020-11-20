pragma solidity ^0.6.0;

import "./interfaces/IMVDProxy.sol";
import "./interfaces/IDoubleProxy.sol";
import "./interfaces/IMVDFunctionalityProposalManager.sol";
import "./interfaces/IMVDFunctionalityProposal.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/IMVDFunctionalityModelsManager.sol";
import "./interfaces/ICommonUtilities.sol";
import "./interfaces/IMVDFunctionalitiesManager.sol";
import "./interfaces/IMVDWallet.sol";
import "./interfaces/IMVDProxyDelegate.sol";

contract MVDProxy is IMVDProxy {

    // Double proxy address
    address private _doubleProxy;

    /** @dev Constructor allows us to build a Proxy that only references his double proxy father.
      * @param doubleProxyAddress address of the double proxy contract.
      */
    constructor(address doubleProxyAddress) public {
        if(doubleProxyAddress == address(0)) {
            return;
        }
        init(doubleProxyAddress);
    }

    /** @dev Initializes the Proxy contract with the double proxy address passed as input.
      * @param doubleProxyAddress address of the double proxy contract.
      */
    function init(address doubleProxyAddress) public override {
        require(_doubleProxy == address(0), "Init already called!");
        _doubleProxy = doubleProxyAddress;
        IMVDProxyDelegate(_doubleProxy).setProxy();
        IMVDProxyDelegate(IDoubleProxy(_doubleProxy).getToken()).setProxy();
        IMVDProxyDelegate(IDoubleProxy(_doubleProxy).getMVDFunctionalityProposalManagerAddress()).setProxy();
        IMVDProxyDelegate(IDoubleProxy(_doubleProxy).getStateHolderAddress()).setProxy();
        IMVDProxyDelegate(IDoubleProxy(_doubleProxy).getMVDFunctionalitiesManagerAddress()).setProxy();
        IMVDProxyDelegate(IDoubleProxy(_doubleProxy).getMVDWalletAddress()).setProxy();
    }

    /** @dev Sets the proxy for all the input contracts.
      * @param votingTokenAddress address of the voting token.
      * @param functionalityProposalManagerAddress functionality proposal manager address.
      * @param stateHolderAddress state holder address.
      * @param functionalitiesManagerAddress functionalities manager address.
      * @param walletAddress wallet address.
      */
    function setProxies(address votingTokenAddress, address functionalityProposalManagerAddress, address stateHolderAddress, address functionalitiesManagerAddress, address walletAddress) public override {
        require(_doubleProxy != address(0), "Init not called!");
        require(msg.sender == _doubleProxy, "Only the double proxy can call this function!");
        if (votingTokenAddress != address(0)) {
            IMVDProxyDelegate(votingTokenAddress).setProxy();
        }
        if (functionalityProposalManagerAddress != address(0)) {
            IMVDProxyDelegate(functionalityProposalManagerAddress).setProxy();
        }
        if (stateHolderAddress != address(0)) {
            IMVDProxyDelegate(stateHolderAddress).setProxy();
        }
        if (functionalitiesManagerAddress != address(0)) {
            IMVDProxyDelegate(functionalitiesManagerAddress).setProxy();
        }
        if (walletAddress != address(0)) {
            IMVDProxyDelegate(walletAddress).setProxy();
        }
    }

    /** @dev Revert any ETH sent to this contract. */
    receive() external payable {
        revert("No Eth Accepted");
    }

    /** @dev Calls the DoubleProxy contract and retrieves the delegates addresses.
      * @return delegates array.
      */
    function getDelegates() public override view returns(address[] memory) {
        return IDoubleProxy(_doubleProxy).getDelegates();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the token address.
      * @return voting token address.
      */
    function getToken() public override view returns(address) {
        return IDoubleProxy(_doubleProxy).getToken();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the functionality proposal manager address.
      * @return functionality proposal manager address.
      */
    function getMVDFunctionalityProposalManagerAddress() public override view returns(address) {
        return IDoubleProxy(_doubleProxy).getMVDFunctionalityProposalManagerAddress();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the state holder address.
      * @return state holder address.
      */
    function getStateHolderAddress() public override view returns(address) {
        return IDoubleProxy(_doubleProxy).getStateHolderAddress();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the functionality models manager address.
      * @return functionality models manager address.
      */
    function getMVDFunctionalityModelsManagerAddress() public override view returns(address) {
        return IDoubleProxy(_doubleProxy).getMVDFunctionalityModelsManagerAddress();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the functionalities manager address. 
      * @return functionalities manager address.
      */
    function getMVDFunctionalitiesManagerAddress() public override view returns(address) {
        return IDoubleProxy(_doubleProxy).getMVDFunctionalitiesManagerAddress();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the eth item orchestrator address address.
      * @return eth item orchestrator address.
      */
    function getEthItemOrchestratorAddress() public override view returns(address) {
        return return IDoubleProxy(_doubleProxy).getEthItemOrchestratorAddress();
    }

    /** @dev Calls the DoubleProxy contract and retrieves the wallet address.
      * @return wallet address.
      */
    function getMVDWalletAddress() public override view returns(address) {
        return IDoubleProxy(_doubleProxy).getMVDWalletAddress();
    }

    /** @dev Returns the double proxy address.
      * @return double proxy address.
      */
    function getDoubleProxyAddress() public override view returns(address) {
        return _doubleProxy;
    }

    /** @dev Flushes the given token address to the wallet. If the provided address is 0, flushes ETH instead.
      * @param tokenAddress token address to flush or address(0).
      * @param is721 whether the token is an ERC721 or not.
      * @param tokenId id of the erc721 token to flush.
      */
    function flushToWallet(address tokenAddress, bool is721, uint256 tokenId) public override {
        // Check if the sender is authorized
        require(IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(msg.sender), "Unauthorized action!");
        // Flush ETH if no address is provided
        if(tokenAddress == address(0)) {
            payable(getMVDWalletAddress()).transfer(payable(address(this)).balance);
            return;
        }
        // Flush the ERC721 token and return
        if(is721) {
            IERC721(tokenAddress).transferFrom(address(this), _delegates[5], tokenId);
            return;
        }
        // Flush the ERC20 token
        IERC20 token = IERC20(tokenAddress);
        token.transfer(getMVDWalletAddress(), token.balanceOf(address(this)));
    }

    /** @dev Calls the functionality proposal manager contract and returns true if the given address is a valid proposal, false otherwise.
      * @param proposal to check.
      * @return true if the address is a valid proposal, false otherwise.
      */
    function isValidProposal(address proposal) public override view returns (bool) {
        return IMVDFunctionalityProposalManager(getMVDFunctionalityProposalManagerAddress()).isValidProposal(proposal);
    }

    /** @dev Calls the functionalities manager and returns true if the given address is an authorized functionality, false otherwise.
      * @param functionality to check.
      * @return true if the address is an authorized functionality, false otherwise.
     */
    function isAuthorizedFunctionality(address functionality) public override view returns(bool) {
        return IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(functionality);
    }

    function newProposal(string memory codeName, bool emergency, address sourceLocation, uint256 sourceLocationId, address location, bool submitable, string memory methodSignature, string memory returnAbiParametersArray, bool isInternal, bool needsSender, string memory replaces) public override returns(address proposalAddress) {
        if (emergency) {
            _emergencyBehavior();
        }

        IMVDFunctionalityModelsManager(getMVDFunctionalityModelsManagerAddress()).checkWellKnownFunctionalities(codeName, submitable, methodSignature, returnAbiParametersArray, isInternal, needsSender, replaces);

        IMVDFunctionalitiesManager functionalitiesManager = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress());

        IMVDFunctionalityProposal proposal = IMVDFunctionalityProposal(proposalAddress = IMVDFunctionalityProposalManager(getStateHolderAddress()).newProposal(codeName, location, methodSignature, returnAbiParametersArray, replaces));
        proposal.setCollateralData(emergency, sourceLocation, sourceLocationId, submitable, isInternal, needsSender, msg.sender, functionalitiesManager.hasFunctionality("getVotesHardCap") ? toUint256(read("getVotesHardCap", "")) : 0);

        if(functionalitiesManager.hasFunctionality("onNewProposal")) {
            submit("onNewProposal", abi.encode(proposalAddress));
        }

        if(!IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).hasFunctionality("startProposal") || !IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).hasFunctionality("disableProposal")) {
            proposal.start();
        }

        emit Proposal(proposalAddress);
    }

    function _emergencyBehavior() private {
        (address loc, string memory meth,,) = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).getFunctionalityData("getEmergencySurveyStaking");
        (, bytes memory payload) = loc.staticcall(abi.encodeWithSignature(meth));
        uint256 staking = toUint256(payload);
        if(staking > 0) {
            IERC20(getToken()).transferFrom(msg.sender, address(this), staking);
        }
    }

    function startProposal(address proposalAddress) public override {
        require(IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(msg.sender), "Unauthorized action!");
        (address location,,,) = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).getFunctionalityData("startProposal");
        require(location == msg.sender, "Only startProposal Functionality can enable a delayed proposal");
        require(IMVDFunctionalityProposalManager(getStateHolderAddress()).isValidProposal(proposalAddress), "Invalid Proposal Address!");
        IMVDFunctionalityProposal(proposalAddress).start();
    }

    function disableProposal(address proposalAddress) public override {
        require(IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(msg.sender), "Unauthorized action!");
        (address location,,,) = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).getFunctionalityData("disableProposal");
        require(location == msg.sender, "Only disableProposal Functionality can disable a delayed proposal");
        IMVDFunctionalityProposal(proposalAddress).disable();
    }

    function transfer(address receiver, uint256 value, address token) public override {
        require(IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(msg.sender), "Only functionalities can transfer Proxy balances!");
        IMVDWallet(getMVDWalletAddress()).transfer(receiver, value, token);
    }

    function setProposal() public override {

        IMVDFunctionalityProposalManager(getStateHolderAddress()).checkProposal(msg.sender);

        emit ProposalCheck(msg.sender);

        IMVDFunctionalitiesManager functionalitiesManager = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress());

        (address addressToCall,string memory methodSignature,,) = functionalitiesManager.getFunctionalityData("checkSurveyResult");

        (bool surveyResult, bytes memory response) = addressToCall.staticcall(abi.encodeWithSignature(methodSignature, msg.sender));

        surveyResult = toUint256(response) > 0;

        bool collateralCallResult = true;
        (addressToCall,methodSignature,,) = functionalitiesManager.getFunctionalityData("proposalEnd");
        if(addressToCall != address(0)) {
            functionalitiesManager.setCallingContext(addressToCall);
            (collateralCallResult,) = addressToCall.call(abi.encodeWithSignature(methodSignature, msg.sender, surveyResult));
            functionalitiesManager.clearCallingContext();
        }

        IMVDFunctionalityProposal proposal = IMVDFunctionalityProposal(msg.sender);

        uint256 staking = 0;
        address tokenAddress = getToken();
        address walletAddress = getMVDWalletAddress();

        if(proposal.isEmergency()) {
            (addressToCall,methodSignature,,) = functionalitiesManager.getFunctionalityData("getEmergencySurveyStaking");
            (, response) = addressToCall.staticcall(abi.encodeWithSignature(methodSignature));
            staking = toUint256(response);
        }

        if(!surveyResult) {
            if(collateralCallResult) {
                proposal.set();
                emit ProposalSet(msg.sender, surveyResult);
                if(staking > 0) {
                    IERC20(tokenAddress).transfer(walletAddress, staking);
                }
            }
            return;
        }

        if(collateralCallResult) {
            try functionalitiesManager.setupFunctionality(msg.sender) returns(bool managerResult) {
                collateralCallResult = managerResult;
            } catch {
                collateralCallResult = false;
            }
        }

        if(collateralCallResult) {
            proposal.set();
            emit ProposalSet(msg.sender, surveyResult);
            if(staking > 0) {
                IERC20(tokenAddress).transfer(surveyResult ? proposal.getProposer() : walletAddress, staking);
            }
        }
    }

    function read(string memory codeName, bytes memory data) public override view returns(bytes memory returnData) {

        (address location, bytes memory payload) = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).preConditionCheck(codeName, data, 0, msg.sender, 0);

        bool ok;
        (ok, returnData) = location.staticcall(payload);

        require(ok, "Failed to read from functionality");
    }

    function submit(string memory codeName, bytes memory data) public override payable returns(bytes memory returnData) {

        if(msg.value > 0) {
            payable(getMVDWalletAddress()).transfer(msg.value);
        }

        IMVDFunctionalitiesManager manager = IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress());
        (address location, bytes memory payload) = manager.preConditionCheck(codeName, data, 1, msg.sender, msg.value);

        bool changed = manager.setCallingContext(location);

        bool ok;
        (ok, returnData) = location.call(payload);

        if(changed) {
            manager.clearCallingContext();
        }
        require(ok, "Failed to submit functionality");
    }

    function callFromManager(address location, bytes memory payload) public override returns(bool, bytes memory) {
        require(msg.sender == getMVDFunctionalitiesManagerAddress(), "Only Functionalities Manager can call this!");
        return location.call(payload);
    }

    function emitFromManager(string memory codeName, address proposal, string memory replaced, address replacedSourceLocation, uint256 replacedSourceLocationId, address location, bool submitable, string memory methodSignature, bool isInternal, bool needsSender, address proposalAddress) public override {
        require(msg.sender == getMVDFunctionalitiesManagerAddress(), "Only Functionalities Manager can call this!");
        emit FunctionalitySet(codeName, proposal, replaced, replacedSourceLocation, replacedSourceLocationId, location, submitable, methodSignature, isInternal, needsSender, proposalAddress);
    }

    function emitEvent(string memory eventSignature, bytes memory firstIndex, bytes memory secondIndex, bytes memory data) public override {
        require(IMVDFunctionalitiesManager(getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(msg.sender), "Only authorized functionalities can emit events!");
        emit Event(eventSignature, keccak256(firstIndex), keccak256(secondIndex), data);
    }

    function compareStrings(string memory a, string memory b) private pure returns(bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function toUint256(bytes memory bs) internal pure returns(uint256 x) {
        if(bs.length >= 32) {
            assembly {
                x := mload(add(bs, add(0x20, 0)))
            }
        }
    }
}