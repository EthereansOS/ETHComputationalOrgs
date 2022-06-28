var keccak = require('keccak')

var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";

var rootAddress = "0xc9EbaD0f2D24Df4cD3617b374260c4CA28A3ae39";
var subDAOAddress = "0x5906b9D616C93074B5EF2E7e5f0F244D43527265";
var delegationAddress = "0x5d0251606DbE03Fc20073741705444f5fFe07173";
var delegationFactory="0x1D58d708927ff60F53f230478C2bF3b4Fe47bB4A";

var code =`
pragma solidity ^0.8.0;

contract Contract {

    function execute(bytes32) external {
        address[] memory factories = new address[](1);
        factories[0] = FACTORIES;
        bool[] memory allowed = new bool[](1);
        allowed[0] = VALUE;
        address delegationsManagerAddress = IOrganization(IOrganization(msg.sender).host()).get(0x49b87f4ee20613c184485be8eadb46851dd4294a8359f902606085b8be6e7ae6);
        IDelegationsManager(delegationsManagerAddress).setFactoriesAllowed(factories, allowed);
    }
}

interface IOrganization {
    function host() external view returns(address);
    function get(bytes32 key) external view returns(address componentAddress);
}

interface IDelegationsManager {
    function setFactoriesAllowed(address[] memory factoryAddresses, bool[] memory allowed) external;
}
`

var proposal = `
pragma solidity ^0.8.0;

contract FlashLoanProposal {

    address public mainInterfaceAddress = 0xbF7a3908427cfD975CFcEb0e37aaa2d49d72b60A;
    uint256 public tokenId = 183566810637946288783052219345925780922728756567;

    function doIt(address proposalsManagerAddress, address location, bytes calldata bytecode, bool andVote, bool andTerminate, bool andWithdraw) external {
        ProposalCodes[] memory proposalCodes = new ProposalCodes[](1);
        ProposalCode[] memory array = new ProposalCode[](1);
        array[0] = ProposalCode(location, bytecode);
        proposalCodes[0] = ProposalCodes(array, false);
        IProposalsManager proposalsManager = IProposalsManager(proposalsManagerAddress);
        bytes32[] memory proposalIds = proposalsManager.batchCreate(proposalCodes);
        if(andVote) {
            vote(proposalsManagerAddress, proposalIds[0], andTerminate, andWithdraw);
        }
    }

    function vote(address proposalsManagerAddress, bytes32 proposalId, bool andTerminate, bool andWithdraw) public {
        bytes[] memory data = new bytes[](2);
        uint256[] memory values = new uint256[](2);
        values[0] = 190000*1e18;
        values[1] = 10000*1e18;
        data[0] = abi.encode(proposalId, 0, values[0], address(0), false);
        data[1] = abi.encode(proposalId, values[1], 0, address(0), andTerminate);
        uint256[] memory ids = new uint256[](2);
        ids[0] = tokenId;
        ids[1] = tokenId;
        IERC1155(mainInterfaceAddress).safeBatchTransferFrom(msg.sender, proposalsManagerAddress, ids, values, abi.encode(data));
        if(andWithdraw) {
            withdraw(proposalsManagerAddress, proposalId, andTerminate);
        }
    }

    function withdraw(address proposalsManagerAddress, bytes32 proposalId, bool forTermination) public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = proposalId;
        IProposalsManager proposalsManager = IProposalsManager(proposalsManagerAddress);
        proposalsManager.withdrawAll(ids, msg.sender, forTermination);
    }
}

interface IProposalsManager {
    function batchCreate(ProposalCodes[] calldata codeSequences) external returns(bytes32[] memory createdProposalIds);
    function withdrawAll(bytes32[] memory proposalIds, address voterOrReceiver, bool afterTermination) external;
}

interface IERC1155 {
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

struct ProposalCode {
    address location;
    bytes bytecode;
}

struct ProposalCodes {
    ProposalCode[] codes;
    bool alsoTerminate;
}

struct Proposal {
    address proposer;
    address[] codeSequence;
    uint256 creationBlock;
    uint256 accept;
    uint256 refuse;
    address triggeringRules;
    address[] canTerminateAddresses;
    address[] validatorsAddresses;
    bool validationPassed;
    uint256 terminationBlock;
    bytes votingTokens;
}

struct ProposalConfiguration {
    address[] collections;
    uint256[] objectIds;
    uint256[] weights;
    address creationRules;
    address triggeringRules;
    address[] canTerminateAddresses;
    address[] validatorsAddresses;
}
`

describe("Delegation Changes", async () => {

    var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
    var osAddress;
    var mainInterface;
    before(async () => {
        osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        try {
            await blockchainConnection.unlockAccounts(organizationHost)
        } catch(e) {
        }
    })

    it("Uri", async () => {

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, delegationAddress)
        console.log("Old URI", await organization.methods.uri().call())
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)
        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [1]))[0],
                bytecode : abi.encode(["string"], ["Uri changed by proposal"])
            }],
            alsoTerminate : true
        }]

        await catchCall(proposalsManager.methods.batchCreate(codes), "creation")
        console.log("Old URI", await organization.methods.uri().call())

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))
        console.log("New URI", await organization.methods.uri().call())

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [1]))[0],
                bytecode : abi.encode(["string"], ["vorrei una villa con piscina grazie"])
            }],
            alsoTerminate : true
        }]

        await catchCall(proposalsManager.methods.batchCreate(codes), "creation")
        console.log("Old URI", await organization.methods.uri().call())

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))
        console.log("New URI", await organization.methods.uri().call(), "creation")

        await catchCall(proposalsManager.methods.batchCreate(codes), "creation")
        console.log("New URI", await organization.methods.uri().call())
    })

    var fs = require('fs');

    it("Rules", async () => {
        global.web3 = new(require('web3'))(process.env.BLOCKCHAIN_CONNECTION_STRING);

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, delegationAddress)

        var rules = await organization.methods.proposalModels().call()
        var rules2 = await organization.methods.proposalModels().call()
        assert.equal(JSON.stringify(rules), JSON.stringify(rules2))

        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var quorum = 0;

        var validationBomb = 0;

        var blockLength = 30;

        var hardCap = 0;

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [2]))[0],
                bytecode : abi.encode(["uint256", "uint256", "uint256", "uint256"], [quorum, validationBomb, blockLength, hardCap])
            }],
            alsoTerminate : true
        }]

        await blockchainCall(proposalsManager.methods.batchCreate, codes, { from: "e83f9e61897beea2dbdca702a1452c871dbc5f5025a823998cc0f7be466833ca"})

        rules2 = await organization.methods.proposalModels().call()
        assert.notEqual(JSON.stringify(rules), JSON.stringify(rules2))
    })

    async function attach() {
        var Organization = await compile('ext/subdao/impl/SubDAO')

        var root = new web3.eth.Contract(Organization.abi, rootAddress);
        var delegationsManagerAddress = await root.methods.get("0x49b87f4ee20613c184485be8eadb46851dd4294a8359f902606085b8be6e7ae6").call()

        var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager')
        var delegationsManager = new web3.eth.Contract(DelegationsManager.abi, delegationsManagerAddress)

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

        console.log(await delegationsManager.methods.getByIndex(0).call())
    }

    async function voteToDFO(value, getproposalId) {

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, rootAddress)

        var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager')

        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var realCode = code.split('FACTORIES').join(web3.utils.toChecksumAddress(delegationFactory)).split('VALUE').join(value);
        var Contract = await compile(realCode, "Contract");
        var contract = new web3.eth.Contract(Contract.abi);
        var bytecode = contract.deploy({data: Contract.bin}).encodeABI();
        var data = "0xe751f271" + utilities.voidBytes32.substring(2);
        try {
            await blockchainConnection.unlockAccounts(proposalsManager.options.address);
        } catch(e) {}
        await proposalsManager.methods.tryExecute([utilities.voidEthereumAddress], data, [bytecode]).send(blockchainConnection.getSendingOptions({from : proposalsManager.options.address}))

        var ProposalFlashLoan = await compile(proposal, "FlashLoanProposal");
        var proposalFlashLoan = new web3.eth.Contract(ProposalFlashLoan.abi);
        proposalFlashLoan = await proposalFlashLoan.deploy({data : ProposalFlashLoan.bin}).send(blockchainConnection.getSendingOptions());

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);
        await mainInterface.methods.setApprovalForAll(proposalFlashLoan.options.address, true).send(blockchainConnection.getSendingOptions({from : organizationHost}));

        await mainInterface.methods.safeTransferFrom(organizationHost, accounts[0], data.OS_ID, utilities.numberToString(100*1e18), "0x").send(blockchainConnection.getSendingOptions({from : organizationHost}))

        //await proposalFlashLoan.methods.doIt(proposalsManager.options.address, bytecode, false, false, false).send(blockchainConnection.getSendingOptions());

        var codes = [{
            codes : [{
                location : utilities.voidEthereumAddress,
                bytecode
            }],
            alsoTerminate : false
        }]

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        var proposalId = await proposalsManager.methods.lastProposalId().call();

        if(getproposalId) {
            return {proposalId, proposalsManagerAddress}
        }

        var value = utilities.numberToString(10*1e18)
        await mainInterface.methods.safeTransferFrom(accounts[0], proposalsManager.options.address, data.OS_ID, value, web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, false])).send(blockchainConnection.getSendingOptions({from : accounts[0]}))

        console.log("0", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())

        await proposalFlashLoan.methods.vote(proposalsManager.options.address, proposalId, false, false).send(blockchainConnection.getSendingOptions({from : organizationHost}));

        console.log("1", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())
        console.log(await mainInterface.methods.balanceOf(proposalsManager.options.address, data.OS_ID).call())

        await blockchainConnection.fastForward(106)

        console.log("2", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())
        console.log(await mainInterface.methods.balanceOf(proposalsManager.options.address, data.OS_ID).call())

        //await proposalsManager.methods.terminate([proposalId]).send(blockchainConnection.getSendingOptions())

        console.log("3", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())
        console.log(await mainInterface.methods.balanceOf(proposalsManager.options.address, data.OS_ID).call())

        await proposalFlashLoan.methods.withdraw(proposalsManager.options.address, proposalId, false).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        //await proposalsManager.methods.withdrawAll([proposalId], utilities.voidEthereumAddress, false).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        console.log("4", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())
        console.log(await mainInterface.methods.balanceOf(proposalsManager.options.address, data.OS_ID).call())

        await proposalFlashLoan.methods.withdraw(proposalsManager.options.address, proposalId, false).send(blockchainConnection.getSendingOptions({from : accounts[0]}))

        console.log("5", await mainInterface.methods.balanceOf(proposalsManager.options.address, data.OS_ID).call())
    }

    it("Attach", async () => {
        //await voteToDFO(false)
        await attach()
        //await voteToDFO(true)
        //await attach()
    })

    it("Wrap/Unwrap", async() => {
        await attach()

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var root = new web3.eth.Contract(Organization.abi, rootAddress);
        var delegationsManagerAddress = await root.methods.get("0x49b87f4ee20613c184485be8eadb46851dd4294a8359f902606085b8be6e7ae6").call()

        var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager')
        var delegationsManager = new web3.eth.Contract(DelegationsManager.abi, delegationsManagerAddress)

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
        var value = utilities.numberToString(375*1e17)

        console.log(await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())

        await mainInterface.methods.safeTransferFrom(organizationHost, delegationTokensManager.options.address, data.OS_ID, value, delegationTokenData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        console.log(await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())

        var delegationData = await delegationsManager.methods.get(delegationAddress).call()

        var wrapped = await delegationTokensManager.methods.wrapped(data.ITEM_MAININTERFACE, data.OS_ID, delegationsManagerAddress).call()
        var source = await delegationTokensManager.methods.source(wrapped.wrappedObjectId).call()

        console.log({
            delegationData,
            wrapped,
            source
        })

        var OSERC20 = await compile('../node_modules/@openzeppelin/contracts/token/ERC20/IERC20')
        var osERC20 = new web3.eth.Contract(OSERC20.abi, data.OS_ADDRESS)

        await osERC20.methods.approve(delegationTokensManager.options.address, value).send(blockchainConnection.getSendingOptions({from : organizationHost}));
        /*await delegationTokensManager.methods.wrap(
            [data.OS_ADDRESS, data.OS_ADDRESS],
            [[value],[value]],
            [[utilities.voidEthereumAddress]],
            [delegationsManagerAddress]
        ).send(blockchainConnection.getSendingOptions({from : organizationHost}))*/

        value = value.div(2)

        var delegationTokenData = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress,
                web3.eth.abi.encodeParameter("string", "tutta colpa del pappagallo di alfredo")
            ]
        )

        console.log("WRAPPED", await mainInterface.methods.balanceOf(organizationHost, wrapped.wrappedObjectId).call())
        console.log("OS", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())

        await mainInterface.methods.safeTransferFrom(organizationHost, delegationTokensManager.options.address, wrapped.wrappedObjectId, value, delegationTokenData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        console.log("WRAPPED", await mainInterface.methods.balanceOf(organizationHost, wrapped.wrappedObjectId).call())
        console.log("OS", await mainInterface.methods.balanceOf(organizationHost, data.OS_ID).call())

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : delegationData.treasury,
            value
        })

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, delegationAddress)
        var treasuryManagerAddress = await organization.methods.get("0xcfe1633df53a0649d88d788961f26058c5e7a0b5644675f19f67bb2975827ba2").call();
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var types = [
            "address[]",
            "uint256[]",
            "uint256[]",
            "address",
            "bool",
            "bool",
            "bool",
            "bytes"
        ];

        var values = [
            [utilities.voidEthereumAddress],
            [],
            [value],
            organizationHost,
            false,
            false,
            false,
            "0x"
        ]

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [3]))[0],
                bytecode : abi.encode(["address", `tuple(${types.join(',')})[]`], [delegationData.treasury, [values]])
            }],
            alsoTerminate : false
        }]

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        var proposalId = await proposalsManager.methods.lastProposalId().call()

        //console.log("proposal", (await proposalsManager.methods.list([proposalId]).call())[0])

        var wrappedData = abi.encode(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, true]);
        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, wrapped.wrappedObjectId, value, wrappedData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        await proposalsManager.methods.withdrawAll([proposalId], organizationHost, true).send(blockchainConnection.getSendingOptions())

        var rootProposalId = await voteToDFO(true, true);
        var rootPropMan = rootProposalId.proposalsManagerAddress;
        var rootPM = new web3.eth.Contract(ProposalsManager.abi, rootPropMan)
        rootProposalId = rootProposalId.proposalId

        var bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool"], [
            data.OS_ID,
            value,
            0,
            true,
            false
        ])

        bytecode = web3.eth.abi.encodeParameters(["address", "address", "bytes32", "address", "bytes"], [
            delegationAddress,
            rootPropMan,
            rootProposalId,
            data.ITEM_MAININTERFACE,
            bytecode
        ])

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }]

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        var proposalId = await proposalsManager.methods.lastProposalId().call()

        var wrappedData = abi.encode(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, false]);
        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, wrapped.wrappedObjectId, value, wrappedData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        await blockchainConnection.fastForward(30)

        await proposalsManager.methods.terminate([proposalId]).send(blockchainConnection.getSendingOptions())

        await proposalsManager.methods.withdrawAll([proposalId], organizationHost, true).send(blockchainConnection.getSendingOptions())

        await blockchainConnection.fastForward(90)

        await rootPM.methods.terminate([rootProposalId]).send(blockchainConnection.getSendingOptions())

        await rootPM.methods.withdrawAll([rootProposalId], treasuryManagerAddress, true).send(blockchainConnection.getSendingOptions())

        /*=== WRONG VOTE ===*/

        rootProposalId = await wrongVote()

        var bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool"], [
            data.OS_ID,
            value,
            0,
            true,
            false
        ])

        bytecode = web3.eth.abi.encodeParameters(["address", "address", "bytes32", "address", "bytes"], [
            delegationAddress,
            rootPropMan,
            rootProposalId,
            data.ITEM_MAININTERFACE,
            bytecode
        ])

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }]

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        var proposalId = await proposalsManager.methods.lastProposalId().call()

        var wrappedData = abi.encode(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, false]);
        await mainInterface.methods.safeTransferFrom(organizationHost, proposalsManager.options.address, wrapped.wrappedObjectId, value, wrappedData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        await blockchainConnection.fastForward(30)

        await proposalsManager.methods.terminate([proposalId]).send(blockchainConnection.getSendingOptions())

        await proposalsManager.methods.withdrawAll([proposalId], organizationHost, true).send(blockchainConnection.getSendingOptions())

        var hostValue = utilities.numberToString(150000 * 1e18)
        var hostData = abi.encode(["bytes32", "uint256", "uint256", "address", "bool"], [rootProposalId, hostValue, 0, utilities.voidEthereumAddress, false]);
        await mainInterface.methods.safeTransferFrom(organizationHost, rootPM.options.address, data.OS_ID, hostValue, hostData).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        await blockchainConnection.fastForward(90)

        await rootPM.methods.terminate([rootProposalId]).send(blockchainConnection.getSendingOptions())

        await rootPM.methods.withdrawAll([rootProposalId], treasuryManagerAddress, true).send(blockchainConnection.getSendingOptions())
    })

    async function wrongVote() {

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, rootAddress)

        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress)

        var realCode =
`pragma solidity ^0.8.0;

contract Contract {
    function execute(bytes32) external {
        revert("I Wanna die");
    }
}`
        var Contract = await compile(realCode, "Contract");
        var bytecode = new web3.eth.Contract(Contract.abi).deploy({data: Contract.bin}).encodeABI();

        var codes = [{
            codes : [{
                location : utilities.voidEthereumAddress,
                bytecode
            }],
            alsoTerminate : false
        }]

        await proposalsManager.methods.batchCreate(codes).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        return await proposalsManager.methods.lastProposalId().call();
    }
})