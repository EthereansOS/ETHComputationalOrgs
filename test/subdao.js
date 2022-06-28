var keccak = require('keccak');

var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";

var rootAddress = "0xc9EbaD0f2D24Df4cD3617b374260c4CA28A3ae39";
var subDAOAddress = "0x5906b9D616C93074B5EF2E7e5f0F244D43527265";
var delegationAddress = "0x95eab297b6a4A881ef70A2ebf5b80984EC264B3f";
var delegationFactory="0xeCaa0B4e3a5725b2E588229337ede9c324619f6d";

describe("SubDAO", () => {

    var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
    var osAddress;
    var mainInterface;

    before(async () => {
        osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        console.log({data})

        mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        try {
            await blockchainConnection.unlockAccounts(organizationHost)
        } catch(e) {
        }
    })

    it("Proposals", async () => {
        var organizationAddress = "0xd6a3F8bB4c233AAcba47f42C0aAAae1919E004fB";
        var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";
        try {
            await blockchainConnection.unlockAccounts(organizationHost)
        } catch(e) {
        }
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, organizationAddress)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)
        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [0]))[0],
                bytecode : abi.encode(["uint256"], [0])
            }],
            alsoTerminate : false
        }]

        var oSFixedInlfationAddress = await organization.methods.get("0x9c4db151be7222e332a1dcdb260c7b85b81f214f6b6d83d96c94f814d48a75a5").call()
        var OSFixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
        var oSFixedInflation = new web3.eth.Contract(OSFixedInflationManager.abi, oSFixedInlfationAddress);

        await oSFixedInflation.methods.updateInflationData().send(blockchainConnection.getSendingOptions())

        console.log(await oSFixedInflation.methods.lastTokenPercentage().call())
        console.log(await oSFixedInflation.methods.lastInflationPerDay().call())

        var transaction = await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions())
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var logs = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Proposed(uint256,uint256,bytes32)'))[0]
        var proposalId = logs.topics[3]

        var value = utilities.numberToString(250000*1e18)
        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, true])

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        await proposalsManager.methods.terminate([proposalId]).send(blockchainConnection.getSendingOptions())

        console.log(await oSFixedInflation.methods.lastTokenPercentage().call())
        console.log(await oSFixedInflation.methods.lastInflationPerDay().call())

        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, data.OS_ID, value, payload).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        console.log(await oSFixedInflation.methods.lastTokenPercentage().call())
        console.log(await oSFixedInflation.methods.lastInflationPerDay().call())

        //await proposalsManager.methods.withdrawAll([proposalId], organizationHost, false).send(blockchainConnection.getSendingOptions({from: organizationHost}))
        console.log(await oSFixedInflation.methods.lastTokenPercentage().call())
        console.log(await oSFixedInflation.methods.lastInflationPerDay().call())

        await oSFixedInflation.methods.updateInflationData().send(blockchainConnection.getSendingOptions())

        console.log(await oSFixedInflation.methods.lastTokenPercentage().call())
        console.log(await oSFixedInflation.methods.lastInflationPerDay().call())

    })

    async function changeUint256Value(label, position, value) {
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)

        var stateManagerAddress = await organization.methods.get("0xd1d09e8f5708558865b8acd5f13c69781ae600e42dbc7f52b8ef1b9e33dbcd36").call()
        var StateManager = await compile('base/impl/StateManager')
        var stateManager = new web3.eth.Contract(StateManager.abi, stateManagerAddress)

        console.log(await stateManager.methods.get(label).call())

        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)
        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [position]))[0],
                bytecode : abi.encode(["uint256"], [value])
            }],
            alsoTerminate : false
        }]

        var transaction = await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions())
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var logs = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Proposed(uint256,uint256,bytes32)'))[0]
        var proposalId = logs.topics[3]

        var value = utilities.numberToString(250000*1e18)
        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, true])

        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, data.OS_ID, value, payload).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        await proposalsManager.methods.withdrawAll([proposalId], organizationHost, false).send(blockchainConnection.getSendingOptions({from: organizationHost}))

        console.log(await stateManager.methods.get(label).call())

    }

    it("StateManager", async () => {
        await changeUint256Value("factoryOfFactoriesFeePercentageTransacted", 1, 0)
        await changeUint256Value("factoryOfFactoriesFeePercentageBurn", 2, 3)
        await changeUint256Value("farmingFeePercentageTransacted", 3, 5)
        await changeUint256Value("farmingFeeBurnOS", 4, 4)
        await changeUint256Value("inflationFeePercentageTransacted", 5, 2)
    })

    it("TokenBuy", async () => {

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)

        var ProposalsManager = await compile('base/impl/ProposalsManager')


        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var tokens = [
            delegationAddress,
            delegationAddress,
            delegationAddress,
            delegationAddress
        ]

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [6]))[0],
                bytecode : abi.encode(["address[]"], [tokens])
            }],
            alsoTerminate : false
        }]

        var investmentsManagerAddress = await organization.methods.get("0x4f3ad97a91794a00945c0ead3983f793d34044c6300048d8b4ef95636edd234b").call()
        var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
        var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi, investmentsManagerAddress);

        console.log(await investmentsManager.methods.tokensFromETH().call())

        var transaction = await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions())
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var logs = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Proposed(uint256,uint256,bytes32)'))[0]
        var proposalId = logs.topics[3]

        var value0 = utilities.numberToString(190000*1e18)
        var value1 = utilities.numberToString(10000*1e18)
        var payload0 = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value0, 0, utilities.voidEthereumAddress, false])
        var payload1 = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value1, 0, accounts[0], true])

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, data.OS_ID, value0, payload0).send(blockchainConnection.getSendingOptions({from : organizationHost}))
        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, data.OS_ID, value1, payload1).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        //await proposalsManager.methods.terminate([proposalId]).send(blockchainConnection.getSendingOptions())

        console.log((await proposalsManager.methods.list([proposalId]).call())[0])

        console.log(await investmentsManager.methods.tokensFromETH().call())

        await proposalsManager.methods.withdrawAll([proposalId], accounts[0], true).send(blockchainConnection.getSendingOptions({from: accounts[0]}))
        await proposalsManager.methods.withdrawAll([proposalId], organizationHost, true).send(blockchainConnection.getSendingOptions({from: accounts[0]}))

        console.log(await investmentsManager.methods.tokensFromETH().call())
    })

    it("TokenSell", async () => {

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)

        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi)

        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var tokens = [
            delegationAddress,
            delegationAddress,
            delegationAddress,
            delegationAddress,
            delegationAddress
        ]

        var percentages = [
            "50000000000000000",
            "1",
            "5000000000000000",
            "50000000000000000",
            "50000000000000000"
        ]

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [7]))[0],
                bytecode : abi.encode(["address[]", "uint256[]"], [tokens, percentages])
            }],
            alsoTerminate : false
        }]

        var investmentsManagerAddress = await organization.methods.get("0x4f3ad97a91794a00945c0ead3983f793d34044c6300048d8b4ef95636edd234b").call()
        var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
        var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi, investmentsManagerAddress);

        console.log(await investmentsManager.methods.tokensToETH().call())

        var transaction = await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions())
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var logs = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Proposed(uint256,uint256,bytes32)'))[0]
        var proposalId = logs.topics[3]

        var value0 = utilities.numberToString(190000*1e18)
        var value1 = utilities.numberToString(10000*1e18)
        var payload0 = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value0, 0, utilities.voidEthereumAddress, false])
        var payload1 = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value1, 0, accounts[0], true])

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        var OSERC20 = await compile('../node_modules/@openzeppelin/contracts/token/ERC20/IERC20')
        var osERC20 = new web3.eth.Contract(OSERC20.abi, data.OS_ADDRESS)

        await osERC20.methods.approve(proposalsManager.options.address, value0).send(blockchainConnection.getSendingOptions({from : organizationHost}));
        //await proposalsManager.methods.vote(osERC20.options.address, "0x", proposalId, value0, 0, utilities.voidEthereumAddress, false).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, data.OS_ID, value0, payload0).send(blockchainConnection.getSendingOptions({from : organizationHost}))
        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, data.OS_ID, value1, payload1).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        //await proposalsManager.methods.terminate([proposalId]).send(blockchainConnection.getSendingOptions())

        console.log(await investmentsManager.methods.tokensToETH().call())

        await proposalsManager.methods.withdrawAll([proposalId], accounts[0], true).send(blockchainConnection.getSendingOptions({from: accounts[0]}))
        await proposalsManager.methods.withdrawAll([proposalId], organizationHost, true).send(blockchainConnection.getSendingOptions({from: accounts[0]}))

        console.log(await investmentsManager.methods.tokensToETH().call())
    })

    it("Change Nerv", async () => {
        var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";
        try {
            await blockchainConnection.unlockAccounts(organizationHost)
        } catch(e) {
        }

        var organizationAddress = "0x3a91814680832154785996458E6f50fF824124b9"
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, organizationAddress)

        var oSFixedInlfationAddress = await organization.methods.get("0x9c4db151be7222e332a1dcdb260c7b85b81f214f6b6d83d96c94f814d48a75a5").call()
        var OSFixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
        var oSFixedInflation = new web3.eth.Contract(OSFixedInflationManager.abi, oSFixedInlfationAddress);

        var data = await oSFixedInflation.methods.destination().call()

        await catchCall(oSFixedInflation.methods.setDestination(organizationHost, accounts[5]))
        await oSFixedInflation.methods.setDestination(organizationHost, accounts[5]).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        var newData = await oSFixedInflation.methods.destination().call()

        assert.equal(data[0], newData[0])
        assert.notEqual(data[1], newData[1])
        assert.equal(accounts[5], newData[1])

        await oSFixedInflation.methods.setDestination(accounts[1], accounts[5]).send(blockchainConnection.getSendingOptions({from : organizationHost}))
        await catchCall(oSFixedInflation.methods.setDestination(organizationHost, accounts[5]))
        await catchCall(oSFixedInflation.methods.setDestination(organizationHost, accounts[5]).send(blockchainConnection.getSendingOptions({from : organizationHost})))
        await oSFixedInflation.methods.setDestination(accounts[1], accounts[5]).send(blockchainConnection.getSendingOptions({from : accounts[1]}))
    })
})