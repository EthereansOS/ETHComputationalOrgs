// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IFixedInflationManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import { ReflectionUtilities, TransferUtilities, Uint256Utilities, AddressUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { Getters, Grimoire } from "../../../base/lib/KnowledgeBase.sol";
import "../../../core/model/IOrganization.sol";
import "../../../base/model/ITreasuryManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Mintable {
    function mint(address account, uint256 amount) external returns (bool);
}

contract FixedInflationManager is IFixedInflationManager, LazyInitCapableElement {
    using Uint256Utilities for uint256;
    using AddressUtilities for address;
    using Getters for IOrganization;
    using TransferUtilities for address;

    uint256 public constant override ONE_HUNDRED = 1e18;

    uint256 public constant ONE_YEAR = 31540000;
    uint256 public constant DAYS_IN_YEAR = 365;

    address public override prestoAddress;

    uint256 public override executorRewardPercentage;

    address private _tokenToMintAddress;
    address private _tokenMinterAddress;

    uint256 public override lastTokenPercentage;
    uint256 public override executionInterval;
    uint256 public override lastExecutionEvent;

    address private _bootstrapFundWalletOwner;
    address private _bootstrapFundWalletAddress;
    uint256 private _bootstrapFundWalletPercentage;
    bool private _bootstrapFundIsRaw;
    bytes32 private _defaultBootstrapFundComponentKey;

    bytes32[] private _rawTokenComponentKeys;
    uint256[] private _rawTokenComponentsPercentages;

    bytes32[] private _swappedTokenComponentKeys;
    uint256[] private _swappedTokenComponentsPercentages;

    address private _ammPlugin;
    address[] private _liquidityPoolAddresses;
    address[] private _swapPath;

    uint256 public override lastTokenTotalSupply;
    uint256 public override lastTokenTotalSupplyUpdate;
    uint256 public override lastDailyInflation;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override virtual returns (bytes memory lazyInitResponse) {
        bytes[] memory lazyInitDataArray;
        (lazyInitDataArray) = abi.decode(lazyInitData, (bytes[]));
        _initializeContractInvariants(lazyInitDataArray[0]);
        _initializeExecutionData(lazyInitDataArray[1]);
        _initializeBootstrapFundData(lazyInitDataArray[2]);
        _initializeComponentsData(lazyInitDataArray[3]);
        _initializeSwapData(lazyInitDataArray[4]);
        return "";
    }

    function _initializeContractInvariants(bytes memory contractInvariantsData) private {
        (prestoAddress, executorRewardPercentage, _tokenToMintAddress, contractInvariantsData) = abi.decode(contractInvariantsData, (address, uint256, address, bytes));
        _tokenMinterAddress = _create(contractInvariantsData);
    }

    function _create(bytes memory sourceAddressOrBytecode) private returns(address source) {
        if(sourceAddressOrBytecode.length == 32) {
            source = abi.decode(sourceAddressOrBytecode, (address));
        } else if(sourceAddressOrBytecode.length == 20) {
            assembly {
                source := div(mload(add(sourceAddressOrBytecode, 32)), 0x1000000000000000000000000)
            }
        } else {
            uint256 codeSize;
            assembly {
                source := create(0, add(sourceAddressOrBytecode, 32), mload(sourceAddressOrBytecode))
                codeSize := extcodesize(source)
            }
            require(source != address(0) && codeSize > 0, "source");
        }
    }

    function _initializeExecutionData(bytes memory executionData) private {
        uint256 firstExecutionEvent;
        uint256 _executionInterval;
        (lastTokenPercentage, _executionInterval, firstExecutionEvent) = abi.decode(executionData, (uint256, uint256, uint256));
        executionInterval = _executionInterval;
        if(firstExecutionEvent != 0 && _executionInterval < firstExecutionEvent) {
            lastExecutionEvent = firstExecutionEvent - _executionInterval;
        }
    }

    function _initializeBootstrapFundData(bytes memory bootstrapFundData) private {
        (_bootstrapFundWalletOwner, _bootstrapFundWalletAddress, _bootstrapFundWalletPercentage, _bootstrapFundIsRaw, _defaultBootstrapFundComponentKey) = abi.decode(bootstrapFundData, (address, address, uint256, bool, bytes32));
    }

    function _initializeComponentsData(bytes memory componentsData) private {
        (_rawTokenComponentKeys, _rawTokenComponentsPercentages, _swappedTokenComponentKeys, _swappedTokenComponentsPercentages) = abi.decode(componentsData, (bytes32[], uint256[], bytes32[], uint256[]));
        _checkPercentages();
    }

    function _initializeSwapData(bytes memory swapDataInput) private {
        (_ammPlugin, _liquidityPoolAddresses, _swapPath) = abi.decode(swapDataInput, (address, address[], address[]));
        require(_ammPlugin != address(0), "AMM");
        require(_liquidityPoolAddresses.length != 0, "LP");
        require(_swapPath.length == _liquidityPoolAddresses.length, "PATH");
    }

    function _checkPercentages() private view {
        uint256 percentage = executorRewardPercentage;
        require(percentage != 0, "PRC");
        percentage += _bootstrapFundIsRaw ? _bootstrapFundWalletPercentage : 0;
        require(_rawTokenComponentKeys.length == _rawTokenComponentsPercentages.length, "PRC");
        for(uint256 i = 0; i < _rawTokenComponentsPercentages.length; i++) {
            require(_rawTokenComponentsPercentages[i] != 0, "PRC");
            percentage += _rawTokenComponentsPercentages[i];
        }
        require(percentage < ONE_HUNDRED, "PRC");

        percentage = _bootstrapFundIsRaw ? 0 : _bootstrapFundWalletPercentage;

        require(_swappedTokenComponentKeys.length == (_swappedTokenComponentsPercentages.length + (_swappedTokenComponentKeys.length == 0 ? 0 : 1)), "PRC");

        for(uint256 i = 0; i < _swappedTokenComponentsPercentages.length; i++) {
            require(_swappedTokenComponentsPercentages[i] != 0, "PRC");
            percentage += _swappedTokenComponentsPercentages[i];
        }
        require(percentage < ONE_HUNDRED, "PRC");
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IFixedInflationManager).interfaceId ||
            interfaceId == this.ONE_HUNDRED.selector ||
            interfaceId == this.swapData.selector ||
            interfaceId == this.tokenInfo.selector||
            interfaceId == this.updateTokenPercentage.selector ||
            interfaceId == this.updateInflationData.selector||
            interfaceId == this.executorRewardPercentage.selector ||
            interfaceId == this.prestoAddress.selector||
            interfaceId == this.lastTokenTotalSupply.selector ||
            interfaceId == this.lastTokenTotalSupplyUpdate.selector||
            interfaceId == this.lastTokenPercentage.selector ||
            interfaceId == this.lastDailyInflation.selector||
            interfaceId == this.lastExecutionEvent.selector ||
            interfaceId == this.executionInterval.selector||
            interfaceId == this.nextExecutionEvent.selector ||
            interfaceId == this.rawTokenComponents.selector||
            interfaceId == this.swappedTokenComponents.selector ||
            interfaceId == this.bootstrapFund.selector||
            interfaceId == this.setBootstrapFund.selector ||
            interfaceId == this.execute.selector;
    }

    bool private _receiving;
    receive() external payable {
        require(_receiving);
    }

    function swapData() external override view returns(address ammPlugin, address[] memory liquidityPoolAddresses, address[] memory swapPath) {
        return (_ammPlugin, _liquidityPoolAddresses, _swapPath);
    }

    function tokenInfo() public override view returns(address tokenToMintAddress, address tokenMinterAddress) {
        tokenToMintAddress = _tokenToMintAddress;
        tokenMinterAddress = _tokenMinterAddress;
    }

    function updateTokenPercentage(uint256 newValue) external override authorizedOnly returns(uint256 oldValue) {
        oldValue = lastTokenPercentage;
        updateInflationData();
        if(newValue != lastTokenPercentage) {
            //let's change percentage
            lastTokenPercentage = newValue;
            lastDailyInflation = _calculatePercentage(lastTokenTotalSupply, lastTokenPercentage) / DAYS_IN_YEAR;
        }
    }

    function updateInflationData() public override {
        //If first time or almost one year passed since last totalSupply update
        if(lastTokenTotalSupply == 0 || (block.timestamp >= (lastTokenTotalSupplyUpdate + ONE_YEAR))) {
            (address tokenAddress,) = tokenInfo();
            lastTokenTotalSupply = IERC20(tokenAddress).totalSupply();
            lastTokenTotalSupplyUpdate = block.timestamp;
            lastDailyInflation = _calculatePercentage(lastTokenTotalSupply, lastTokenPercentage) / DAYS_IN_YEAR;
        }
    }

    function nextExecutionEvent() public view override returns(uint256) {
        return lastExecutionEvent == 0 ? 0 : (lastExecutionEvent + executionInterval);
    }

    function bootstrapFund() external override view returns(address bootstrapFundWalletOwner, address bootstrapFundWalletAddress, uint256 bootstrapFundWalletPercentage, bool bootstrapFundIsRaw, bytes32 defaultBootstrapFundComponentKey) {
        return (_bootstrapFundWalletOwner, _bootstrapFundWalletAddress, _bootstrapFundWalletPercentage, _bootstrapFundIsRaw, _defaultBootstrapFundComponentKey);
    }

    function setBootstrapFund(address bootstrapFundWalletOwner, address bootstrapFundWalletAddress) external override returns (address oldBootstrapFundWalletOwner, address oldBootstrapFundWalletAddress) {
        require(msg.sender == _bootstrapFundWalletOwner);
        oldBootstrapFundWalletOwner = _bootstrapFundWalletOwner;
        oldBootstrapFundWalletAddress = _bootstrapFundWalletAddress;
        _bootstrapFundWalletOwner = bootstrapFundWalletOwner;
        _bootstrapFundWalletAddress = bootstrapFundWalletAddress;
    }

    function rawTokenComponents() external override view returns(bytes32[] memory componentKeys, address[] memory components, uint256[] memory percentages) {
        return(_rawTokenComponentKeys, IOrganization(host).list(_rawTokenComponentKeys), _rawTokenComponentsPercentages);
    }

    function swappedTokenComponents() external override view returns(bytes32[] memory componentKeys, address[] memory components, uint256[] memory percentages) {
        return(_swappedTokenComponentKeys, IOrganization(host).list(_swappedTokenComponentKeys), _swappedTokenComponentsPercentages);
    }

    //-1. BootstrapFund has percentage and bootstrapFundWalletAddress is address(0) ? You must specify the default component that will receive tokens, if no specified treasuryManager is the one.
    //0. Mint
    //1. Calculate the executor reward percentage in tokens from the already minted amount, to be swapped for ETH
    //2. send to rawTokenComponents (including bootstrapFund if bootstrapFundPercentage is != 0 and bootstrapFundIsRaw is true, if bootstrapFundWallet is address(0) tokens will be burnt) and the percentages must be the same of the compents and sum must be less than 100%
    //3. Swap
    //4. Send calculated amount to the executor
    //5. Try send to bootstrapFund (if bootstrapFundPercentage is != 0 and bootstrapFundIsRaw is false, if bootstrapFundWallet is address(0) ETH will be sent to the treasuryManager)
    //6. Send swapped tokens to swappedTokenComponents (if list is != 0 percentages length must be less of the components, otherwhise the rest goes to treasuryManager)
    function execute(uint256[] calldata minAmounts, address executorRewardReceiver) external override returns (uint256 swappedValue, uint256 ethReceived, uint256 executorReward) {
        require(block.timestamp >= nextExecutionEvent(), "Too early BRO");
        lastExecutionEvent = block.timestamp;

        emit FixedInflation();

        updateInflationData();

        (address treasuryManagerAddress, address[] memory swappedTokenReceivers, uint256[] memory swappedTokenReceiverPercentages, address tokenAddress, uint256 rewardReceiverValue) = _transfer();

        return _swapToETH(tokenAddress, executorRewardReceiver != address(0) ? executorRewardReceiver : msg.sender, rewardReceiverValue, minAmounts, treasuryManagerAddress, swappedTokenReceivers, swappedTokenReceiverPercentages);
    }

    function _transfer() private returns(address treasuryManagerAddress, address[] memory swappedTokenReceivers, uint256[] memory swappedTokenReceiverPercentages, address tokenAddress, uint256 rewardReceiverValue) {
        address[] memory rawTokenReceivers;
        uint256[] memory rawTokenReceiverPercentages;
        (treasuryManagerAddress, rawTokenReceivers, rawTokenReceiverPercentages, swappedTokenReceivers, swappedTokenReceiverPercentages) = _receivers();

        uint256 value;
        (tokenAddress, value, rewardReceiverValue) = _mint();

        for(uint256 i = 0; i < rawTokenReceivers.length; i++) {
            address receiver = rawTokenReceivers[i];
            if(receiver == address(this)) {
                continue;
            }
            uint256 val = rawTokenReceiverPercentages[i];
            if(val == 0) {
                continue;
            }
            val = _calculatePercentage(value, val);
            if(val == 0) {
                continue;
            }
            if(receiver == address(0)) {
                _safeBurn(tokenAddress, val);
            } else {
                tokenAddress.safeTransfer(receiver, val);
            }
        }
    }

    function _mint() private returns(address tokenAddress, uint256 value, uint256 rewardReceiverValue) {
        address tokenMinterAddress;
        (tokenAddress, tokenMinterAddress) = tokenInfo();
        IERC20Mintable(tokenMinterAddress != address(0) ? tokenMinterAddress : tokenAddress).mint(address(this), lastDailyInflation);

        value = tokenAddress.balanceOf(address(this));

        rewardReceiverValue = _calculatePercentage(value, executorRewardPercentage);
        value -= rewardReceiverValue;
    }

    function _swapToETH(address tokenAddress, address rewardReceiver, uint256 rewardReceiverValue, uint256[] memory minAmounts, address treasuryManagerAddress, address[] memory swappedTokenReceivers, uint256[] memory swappedTokenReceiverPercentages) private returns(uint256 swappedValue, uint256 ethReceived, uint256 executorReward) {
        require(minAmounts[0] > 0 && minAmounts[1] > 0, "SLIPPPPPPPPPPPPPAGE");

        swappedValue = tokenAddress.balanceOf(address(this));

        IERC20(tokenAddress).approve(prestoAddress, swappedValue);

        swappedValue -= rewardReceiverValue;

        PrestoOperation[] memory prestoOperations = new PrestoOperation[](2);
        prestoOperations[0] = PrestoOperation({
            inputTokenAddress : tokenAddress,
            inputTokenAmount : rewardReceiverValue,
            ammPlugin : _ammPlugin,
            liquidityPoolAddresses : _liquidityPoolAddresses,
            swapPath : _swapPath,
            enterInETH : false,
            exitInETH : true,
            tokenMins : minAmounts[0].asSingletonArray(),
            receivers : rewardReceiver.asSingletonArray(),
            receiversPercentages : new uint256[](0)
        });
        prestoOperations[1] = PrestoOperation({
            inputTokenAddress : tokenAddress,
            inputTokenAmount : swappedValue,
            ammPlugin : _ammPlugin,
            liquidityPoolAddresses : _liquidityPoolAddresses,
            swapPath : _swapPath,
            enterInETH : false,
            exitInETH : true,
            tokenMins : minAmounts[1].asSingletonArray(),
            receivers : swappedTokenReceivers,
            receiversPercentages : swappedTokenReceiverPercentages
        });

        _receiving = true;
        uint256[] memory ethReceivedArray = IPrestoUniV3(prestoAddress).execute(prestoOperations);
        _receiving = false;

        executorReward = ethReceivedArray[0];
        ethReceived = ethReceivedArray[1];

        address(0).safeTransfer(treasuryManagerAddress, address(this).balance);
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns(uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    function _receivers() public view returns(address treasuryManagerAddress, address[] memory rawTokenReceivers, uint256[] memory rawTokenReceiverPercentages, address[] memory swappedTokenReceivers, uint256[] memory swappedTokenReceiverPercentages) {
        address[] memory allTokens = _allTokens();

        treasuryManagerAddress = allTokens[0];

        address bootstrapFundWalletAddress = _bootstrapFundWalletAddress;
        bool bootstrapFundIsRaw = _bootstrapFundIsRaw;
        bootstrapFundWalletAddress = bootstrapFundWalletAddress != address(0) ? bootstrapFundWalletAddress : allTokens[1];

        rawTokenReceivers = new address[](_rawTokenComponentKeys.length + (bootstrapFundIsRaw ? 1 : 0));
        rawTokenReceiverPercentages = new uint256[](rawTokenReceivers.length);
        if(bootstrapFundIsRaw) {
            rawTokenReceivers[0] = bootstrapFundWalletAddress;
            rawTokenReceiverPercentages[0] = _bootstrapFundWalletPercentage;
        }
        uint256 rawTokenReceiversIndex = bootstrapFundIsRaw ? 1 : 0;
        uint256 rawTokenReceiverPercentagesIndex = 0;
        uint256 cursor = 2;
        uint256 length = cursor + _rawTokenComponentKeys.length;
        for(cursor; cursor < length; cursor++) {
            rawTokenReceivers[rawTokenReceiversIndex] = allTokens[cursor];
            rawTokenReceiverPercentages[rawTokenReceiversIndex++] = _rawTokenComponentsPercentages[rawTokenReceiverPercentagesIndex++];
        }
        uint256 bootstrapFundWalletPercentage = bootstrapFundIsRaw || bootstrapFundWalletAddress == address(0) ? 0 : _bootstrapFundWalletPercentage;
        swappedTokenReceivers = new address[](_swappedTokenComponentKeys.length != 0 ? _swappedTokenComponentKeys.length : 1 + (bootstrapFundWalletPercentage == 0 ? 0 : 1));
        swappedTokenReceiverPercentages = new uint256[](swappedTokenReceivers.length - 1);
        if(bootstrapFundWalletPercentage != 0) {
            swappedTokenReceivers[0] = bootstrapFundWalletAddress;
            swappedTokenReceiverPercentages[0] = bootstrapFundWalletPercentage;
        }
        uint256 swappedTokenReceiversIndex = bootstrapFundWalletPercentage == 0 ? 0 : 1;
        if(cursor != allTokens.length -1) {
            for(uint256 i = 0; i < _swappedTokenComponentKeys.length; i++) {
                if(i < _swappedTokenComponentKeys.length - 1) {
                    swappedTokenReceiverPercentages[swappedTokenReceiversIndex] = _swappedTokenComponentsPercentages[i];
                }
                swappedTokenReceivers[swappedTokenReceiversIndex++] = allTokens[cursor++];
            }
        } else {
            swappedTokenReceivers[swappedTokenReceiversIndex] = allTokens[0];
        }
    }

    function _allTokens() private view returns (address[] memory allTokens) {
        bytes32[] memory allKeys = new bytes32[](2 + _rawTokenComponentKeys.length + _swappedTokenComponentKeys.length);
        allKeys[0] = Grimoire.COMPONENT_KEY_TREASURY_MANAGER;
        allKeys[1] = _defaultBootstrapFundComponentKey;
        uint256 cursor = 2;
        for(uint256 i = 0; i < _rawTokenComponentKeys.length; i++) {
            allKeys[cursor++] = _rawTokenComponentKeys[i];
        }
        for(uint256 i = 0; i < _swappedTokenComponentKeys.length; i++) {
            allKeys[cursor++] = _swappedTokenComponentKeys[i];
        }

        allTokens = IOrganization(host).list(allKeys);

        for(uint256 i = 2; i < allTokens.length; i++) {
            allTokens[i] = allTokens[allTokens[i] != address(0) ? i : 0];
        }
    }

    function _safeBurn(address erc20TokenAddress, uint256 value) private returns(uint256 burnt) {
        if(erc20TokenAddress == address(0) || value == 0) {
            return 0;
        }
        uint256 before = erc20TokenAddress.balanceOf(address(this));
        (bool result, bytes memory returnData) = erc20TokenAddress.call(abi.encodeWithSelector(0x42966c68, value));//burn(uint256)
        result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        if(!result) {
            (result, returnData) = erc20TokenAddress.call(abi.encodeWithSelector(IERC20(erc20TokenAddress).transfer.selector, address(0), value));
            result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        }
        if(!result) {
            (result, returnData) = erc20TokenAddress.call(abi.encodeWithSelector(IERC20(erc20TokenAddress).transfer.selector, 0x000000000000000000000000000000000000dEaD, value));
            result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        }
        if(!result) {
            erc20TokenAddress.safeTransfer(0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD, value);
        }
        return before - erc20TokenAddress.balanceOf(address(this));
    }
}