var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";

var rootAddress = "0x67b387Cd6F30769D73C1c508Abcde31FaDE9C938";
var subDAOAddress = "0x5906b9D616C93074B5EF2E7e5f0F244D43527265";
var delegationAddress = "0x95eab297b6a4A881ef70A2ebf5b80984EC264B3f";
var delegationFactory="0xeCaa0B4e3a5725b2E588229337ede9c324619f6d";
var farmingFactoryAddress = "0x7016c53F202124FB510E74c35a0644be6C815AD7";

var fs = require('fs');
const { wrap } = require('module');

describe("Delegations Manager Splitter", () => {

    var commonData;
    try {
        commonData = {...commonData, ...JSON.parse(fs.readFileSync("C:/Users/Marco/Desktop/dump_rinkeby_json.json", 'utf-8'))}
    } catch(e) {
    }

    var mainInterface;

    before(async () => {

        try {
            await blockchainConnection.unlockAccounts(organizationHost)
        } catch(e) {
        }

        mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, commonData.ITEM_MAININTERFACE);

        //await instrumentDelegationsManager()
    })

    async function createDelegationAndAttach(value) {
        var quorumPercentage = utilities.numberToString(1*1e12)
        var hardCapPercentage = utilities.numberToString(1*1e12)
        var blockLength = 0;
        var validationBomb = 0;

        var DelegationFactory = await compile('ethereans/factories/impl/DelegationFactory')
        var delegationFactory = new web3.eth.Contract(DelegationFactory.abi, commonData.DELEGATION_FACTORY)

        var mandatoryComponentsDeployData = [
            "0x",
            "0x",
            abi.encode(["string"], ["cicciopollo"])
        ]

        var deployOrganizationDataType = [
            "string",
            "bytes[]",
            "uint256[]",
            "bytes[]",
            "bytes[]",
            "bytes"
        ]

        var deployOrganizationDataValue = [
            "myuri",
            mandatoryComponentsDeployData,
            [],
            [],
            [],
            "0x"
        ]

        var deployOrganizationData = abi.encode([`tuple(${deployOrganizationDataType.join(',')})`], [deployOrganizationDataValue])

        var transaction = await blockchainCall(delegationFactory.methods.deploy, deployOrganizationData)

        var transactionReceipt = await web3.eth.getTransactionReceipt(transaction.transactionHash)
        var logs = transactionReceipt.logs
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3("Deployed(address,address,address,bytes)"))[0]
        var address = logs.topics[2]
        var delegationAddress = abi.decode(["address"], address)[0]

        await blockchainCall(delegationFactory.methods.initializeProposalModels,
            delegationAddress,
            organizationHost,
            quorumPercentage,
            validationBomb,
            blockLength,
            hardCapPercentage
        )

        var delegationsManager = await attach(delegationAddress)

        var tokenId;

        if(value) {
            value = utilities.numberToString(value)
            tokenId = await wrap(delegationsManager.options.address, delegationAddress, value)
        }

        return {delegationAddress, tokenId, value, delegationsManager}
    }

    async function wrap(delegationsManagerAddress, delegationAddress, value) {

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, delegationAddress)

        var delegationTokensManagerAddress = await organization.methods.get("0x62b56c3ab20613c184485be8eadb46851dd4294a8359f902606085b8be9f7dc5").call()
        var DelegationTokensManager = await compile('ext/delegation/impl/DelegationTokensManager')
        var delegationTokensManager = new web3.eth.Contract(DelegationTokensManager.abi, delegationTokensManagerAddress)

        var delegationTokenData = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [
                delegationsManagerAddress,
                utilities.voidEthereumAddress,
                "0x"
            ]
        )

        await mainInterface.methods.safeTransferFrom(organizationHost, delegationTokensManager.options.address, commonData.OS_ID, value, delegationTokenData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        var wrapped = await delegationTokensManager.methods.wrapped(commonData.ITEM_MAININTERFACE, commonData.OS_ID, delegationsManagerAddress).call()

        return wrapped.wrappedObjectId
    }

    async function attach(delegationAddress) {
        var Organization = await compile('ext/subdao/impl/SubDAO')

        var root = new web3.eth.Contract(Organization.abi, commonData.ourDFO);
        var delegationsManagerAddress = await root.methods.get("0x49b87f4ee20613c184485be8eadb46851dd4294a8359f902606085b8be6e7ae6").call()

        var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager')
        var delegationsManager = new web3.eth.Contract(DelegationsManager.abi, delegationsManagerAddress)

        await compile('ext/delegationsManager/impl/DelegationsManager')

        var organization = new web3.eth.Contract(Organization.abi, delegationAddress)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [0]))[0],
                bytecode : abi.encode(["address", "bool"], [delegationsManagerAddress, true])
            }],
            alsoTerminate : true
        }]

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))
        return delegationsManager
    }

    it("Delegations", async () => {

        var delegations = [50*1e18,0,20*1e18,30*1e18,0]

        for(var i in delegations) {
            delegations[i] = await createDelegationAndAttach(delegations[i])
        }

        var delegationsManager = delegations[0].delegationsManager;

        value = utilities.numberToString(15*1e17)

        await catchCall(delegationsManager.methods.split(utilities.voidEthereumAddress), "no eth")

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : delegationsManager.options.address,
            value
        })

        await delegationsManager.methods.split(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        await catchCall(delegationsManager.methods.split(utilities.voidEthereumAddress), "no eth")
    })

    async function instrumentDelegationsManager() {
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, rootAddress)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        var delegationsManagerAddress = "";

        var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager')
        var delegationsManager = new web3.eth.Contract(DelegationsManager.abi)

        var delegationsManagerDeployData = web3.eth.abi.encodeParameters(["address[]", "address[]"], [
            [commonData.DELEGATION_FACTORY], []
        ]);

        delegationsManagerDeployData = web3.eth.abi.encodeParameters(["bytes32", "uint256", "address", "uint256", "bytes"], [commonData.grimoire.COMPONENT_KEY_TREASURY_SPLITTER_MANAGER, commonData.executorRewardPercentage, commonData.ITEM_MAININTERFACE, commonData.OS_ID, delegationsManagerDeployData])
        delegationsManagerDeployData = web3.eth.abi.encodeParameters(["uint256", "address", "bytes"], [commonData.presetValues, commonData.models.TreasuryManager, delegationsManagerDeployData])
        delegationsManagerDeployData = web3.eth.abi.encodeParameters(["address", "bytes"], [rootAddress, delegationsManagerDeployData])

        delegationsManager = await deployContract(delegationsManager, DelegationsManager.bin, [delegationsManagerDeployData])

        delegationsManagerAddress = delegationsManager.options.address

        await organization.methods.set({
            location : delegationsManagerAddress,
            key : "0x49b87f4ee20613c184485be8eadb46851dd4294a8359f902606085b8be6e7ae6",
            active : false,
            log : true
        }).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))
    }
})