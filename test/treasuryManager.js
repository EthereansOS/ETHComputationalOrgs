var organizationManager = require('../resources/organization');
describe("TreasuryManager", () => {

    var organization;
    var manager;

    var erc20;
    var item;
    var itemIDs = [];

    var erc721;
    var erc721IDs = [];

    async function initTokens() {
        var valueToMint = utilities.numberToString(70000 * 1e18);

        var code = `
pragma solidity ^0.8.0;

contract ProposalCode {

    function callOneTime(address) external {
        IMVDProxy proxy = IMVDProxy(msg.sender);
        IVotingToken votingToken = IVotingToken(proxy.getToken());
        votingToken.mint(${valueToMint});
        proxy.flushToWallet(address(votingToken), false, 0);
    }
}

interface IVotingToken {
    function mint(uint256 amount) external;
}

interface IMVDProxy {
    function getToken() external view returns(address);
    function flushToWallet(address tokenAddress, bool is721, uint256 tokenId) external;
}
`;
        var proposal = await dfoHubManager.createProposal("dfoHub", "", true, code, "callOneTime(address)");
        await dfoHubManager.finalizeProposal(proposal);
        erc20 = new web3.eth.Contract(knowledgeBase.dfoVotingTokenABI, knowledgeBase.buidlTokenAddress);
        var walletAddress = await new web3.eth.Contract(knowledgeBase.dfoProxyABI, await erc20.methods.getProxy().call()).methods.getMVDWalletAddress().call();
        await blockchainConnection.unlockAccounts(walletAddress);

        var expectedProxyBalance = (await erc20.methods.balanceOf(walletAddress).call()).sub(valueToMint);
        var expectedTreasuryManagerBalance = valueToMint.add(await erc20.methods.balanceOf(manager.options.address).call());

        await erc20.methods.transfer(manager.options.address, valueToMint).send(blockchainConnection.getSendingOptions({from : walletAddress}));

        assert.equal(expectedProxyBalance, await erc20.methods.balanceOf(walletAddress).call());
        assert.equal(expectedTreasuryManagerBalance, await erc20.methods.balanceOf(manager.options.address).call());

        var items = "string,string,bool,string,address,bytes";
        item = new web3.eth.Contract(knowledgeBase.ethItemNativeABI, web3.eth.abi.decodeParameter("address", (await web3.eth.getTransactionReceipt((await new web3.eth.Contract(knowledgeBase.ethItemOrchestratorABI, knowledgeBase.ethItemOrchestratorAddress).methods.createNative(web3.utils.sha3(`init(${items})`).substring(0, 10) + web3.eth.abi.encodeParameters(items.split(','), ["Covenants Farming", "cFARM", true, "uri", accounts[0], "0x"]).substring(2), "").send(blockchainConnection.getSendingOptions())).transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("NewNativeCreated(address,uint256,address,address)"))[0].topics[3]));

        var amount = utilities.numberToString(100000 * 1e18);
        var valueToMint = utilities.numberToString(3000 * 1e18);

        for(var i = 0; i < 6; i++) {
            itemIDs.push(web3.eth.abi.decodeParameters(["uint256", "address", "uint256"], (await web3.eth.getTransactionReceipt((await item.methods.mint(amount, "a", "b", "c", true).send(blockchainConnection.getSendingOptions())).transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3('Mint(uint256,address,uint256)'))[0].data)[0]);

            var interoperable = new web3.eth.Contract(knowledgeBase.dfoVotingTokenABI, await item.methods.asInteroperable(itemIDs[itemIDs.length - 1]).call());

            var expectedProxyBalance = (await interoperable.methods.balanceOf(accounts[0]).call()).sub(valueToMint);
            var expectedTreasuryManagerBalance = valueToMint.add(await interoperable.methods.balanceOf(manager.options.address).call());

            await interoperable.methods.transfer(manager.options.address, valueToMint).send(blockchainConnection.getSendingOptions());

            assert.equal(expectedProxyBalance, await interoperable.methods.balanceOf(accounts[0]).call());
            assert.equal(expectedTreasuryManagerBalance, await interoperable.methods.balanceOf(manager.options.address).call());
        }

        var ERC721Mintable = await compile(`
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Mintable is ERC721 {

    uint256 public lastId;

    constructor (string memory name_, string memory symbol_) ERC721(name_, symbol_) {
    }

    function mint(address receiver) external {
        _mint(receiver, lastId++);
    }
}`, "ERC721Mintable");

        erc721 = await new web3.eth.Contract(ERC721Mintable.abi).deploy({data : ERC721Mintable.bin, arguments : ['erc721', '721']}).send(blockchainConnection.getSendingOptions());

        for(var i = 0; i < 30; i++) {
            await erc721.methods.mint(manager.options.address).send(blockchainConnection.getSendingOptions());
            erc721IDs.push(utilities.numberToString(i));
            assert.equal("1", await getBalance(manager.options.address, erc721.options.address, i));
        }
    };

    var getBalance = async function getBalance(subject, tokenAddress, objectId) {
        if(!tokenAddress || tokenAddress === utilities.voidEthereumAddress) {
            return await web3.eth.getBalance(subject);
        }
        if(tokenAddress === erc20.options.address) {
            return await erc20.methods.balanceOf(subject).call();
        }
        if(tokenAddress === erc721.options.address) {
            return (await erc721.methods.ownerOf(objectId).call()) === subject ? "1" : "0";
        }
        return await item.methods.balanceOf(subject, objectId).call();
    };

    before(async () => {
        manager = (organization = await organizationManager.createOrganization()).components.treasuryManager.contract;
        await initTokens();
    });

    it("AdditionalFunctionsServerManager", async () => {

        var additionalFunctionsServerManagerAddress = await manager.methods.additionalFunctionsServerManager().call();
        assert.notStrictEqual(additionalFunctionsServerManagerAddress, utilities.voidEthereumAddress);
        assert.equal("0x", await web3.eth.getCode(additionalFunctionsServerManagerAddress));

        var AdditionalFunctionsServerManager = await compile("base/impl/TreasuryManager", 'AdditionalFunctionsServerManager');

        var additionalFunctionsServerManager = await new web3.eth.Contract(AdditionalFunctionsServerManager.abi, additionalFunctionsServerManagerAddress);

        await catchCall(manager.methods.setAdditionalFunction("0x00000000", accounts[3], false), "unauthorized");

        await manager.methods.setAdditionalFunction("0x00000000", accounts[3], false).send(organization.asActiveComponent);

        assert.notStrictEqual("0x", await web3.eth.getCode(additionalFunctionsServerManagerAddress));

        assert.equal(accounts[3], await additionalFunctionsServerManager.methods.get('0x00000000').call());

        await catchCall(additionalFunctionsServerManager.methods.set("0x00000000", utilities.voidEthereumAddress));

        await additionalFunctionsServerManager.methods.set("0x00000000", utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from : manager.options.address}));

        assert.equal(utilities.voidEthereumAddress, await additionalFunctionsServerManager.methods.get('0x00000000').call());

        await catchCall(additionalFunctionsServerManager.methods.setReentrancyLock());

        await additionalFunctionsServerManager.methods.setReentrancyLock().send(blockchainConnection.getSendingOptions({from : manager.options.address}));

        var reentrancyLockKey = await web3.eth.getStorageAt(additionalFunctionsServerManager.options.address, 0);

        await catchCall(additionalFunctionsServerManager.methods.setReentrancyLock());
        await catchCall(additionalFunctionsServerManager.methods.setReentrancyLock().send(blockchainConnection.getSendingOptions({from : manager.options.address})));

        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(utilities.voidBytes32));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(web3.utils.sha3("ciccio")));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(utilities.voidBytes32).send(blockchainConnection.getSendingOptions({from : manager.options.address})));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(web3.utils.sha3("pino")).send(blockchainConnection.getSendingOptions({from : manager.options.address})));

        await additionalFunctionsServerManager.methods.releaseReentrancyLock(reentrancyLockKey).send(blockchainConnection.getSendingOptions({from : manager.options.address}));

        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(utilities.voidBytes32));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(web3.utils.sha3("ciccio")));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(reentrancyLockKey));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(utilities.voidBytes32).send(blockchainConnection.getSendingOptions({from : manager.options.address})));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(web3.utils.sha3("pino")).send(blockchainConnection.getSendingOptions({from : manager.options.address})));
        await catchCall(additionalFunctionsServerManager.methods.releaseReentrancyLock(reentrancyLockKey).send(blockchainConnection.getSendingOptions({from : manager.options.address})));
    });

    it("Receive, Transfer and batchTransfer ETH", async () => {

        var expectedManagerBalance = (await web3.eth.getBalance(manager.options.address)).add(1e18);

        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : manager.options.address,
            value : 1e18
        }));

        assert.equal(expectedManagerBalance, await web3.eth.getBalance(manager.options.address));

        expectedManagerBalance = await web3.eth.getBalance(manager.options.address);

        var value = utilities.numberToString(0.3*1e18);
        var receiver = accounts[1];

        expectedManagerBalance = expectedManagerBalance.sub(value);
        var expectedReceiverBalance = value.add(await web3.eth.getBalance(receiver));

        await manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent);

        var managerBalance = await web3.eth.getBalance(manager.options.address);
        var receiverBalance = await web3.eth.getBalance(receiver);

        assert.equal(expectedManagerBalance, managerBalance);
        assert.equal(expectedReceiverBalance, receiverBalance);

        var batchTransfer = async function batchTransfer(receivers) {
            var entries = await Promise.all(receivers.map(async it => {
                it.expectedBalance = (it.value *= 1e18).add(await web3.eth.getBalance(it.address));
                return {
                    token : utilities.voidEthereumAddress,
                    objectIds : [],
                    values : [utilities.numberToString(it.value)],
                    receiver : it.address,
                    safe : false,
                    batch : false,
                    withData : false,
                    data : "0x"
                }
            }));

            var expectedManagerBalance = (await web3.eth.getBalance(manager.options.address)).sub(receivers.map(it => it.value).reduce((cumulator, value) => cumulator.add(value)));

            await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

            assert.equal(expectedManagerBalance, await web3.eth.getBalance(manager.options.address));

            await Promise.all(receivers.map(async it => assert.equal(it.expectedBalance, await web3.eth.getBalance(it.address))));
        };

        await batchTransfer([{
            value : 0.003,
            address : accounts[2]
        }]);

        await batchTransfer([{
            value : 0.003,
            address : accounts[2]
        }, {
            value : 1,
            address : accounts[3]
        }, {
            value : 0.00009,
            address : accounts[4]
        }, {
            value : 0.123456,
            address : accounts[5]
        }]);
    });

    it("Transfer and batchTransfer ERC20", async () => {

        var expectedManagerBalance = await erc20.methods.balanceOf(manager.options.address).call();

        var value = utilities.numberToString(0.3*1e18);
        var receiver = accounts[1];

        expectedManagerBalance = expectedManagerBalance.sub(value);
        var expectedReceiverBalance = value.add(await erc20.methods.balanceOf(receiver).call());

        await manager.methods.transfer(erc20.options.address, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent);

        var managerBalance = await erc20.methods.balanceOf(manager.options.address).call();
        var receiverBalance = await erc20.methods.balanceOf(receiver).call();

        assert.equal(expectedManagerBalance, managerBalance);
        assert.equal(expectedReceiverBalance, receiverBalance);

        var batchTransfer = async function batchTransfer(receivers) {
            var entries = await Promise.all(receivers.map(async it => {
                it.expectedBalance = (it.value *= 1e18).add(await erc20.methods.balanceOf(it.address).call());
                return {
                    token : erc20.options.address,
                    objectIds : [],
                    values : [utilities.numberToString(it.value)],
                    receiver : it.address,
                    safe : false,
                    batch : false,
                    withData : false,
                    data : "0x"
                }
            }));

            var expectedManagerBalance = (await erc20.methods.balanceOf(manager.options.address).call()).sub(receivers.map(it => it.value).reduce((cumulator, value) => cumulator.add(value)));

            await catchCall(manager.methods.batchTransfer(entries), "unauthorized");

            await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

            assert.equal(expectedManagerBalance, await erc20.methods.balanceOf(manager.options.address).call());

            await Promise.all(receivers.map(async it => assert.equal(it.expectedBalance, await erc20.methods.balanceOf(it.address).call())));
        };

        await batchTransfer([{
            value : 0.003,
            address : accounts[2]
        }]);

        await batchTransfer([{
            value : 0.003,
            address : accounts[2]
        }, {
            value : 1,
            address : accounts[3]
        }, {
            value : 0.00009,
            address : accounts[4]
        }, {
            value : 0.123456,
            address : accounts[5]
        }]);
    });

    it("Transfer and batchTransfer ERC721", async () => {

        var receiver = accounts[1];

        var singleTransfer = async function (receiver, objectId, safe, withData, data) {
            var expectedManagerBalance = await getBalance(manager.options.address, erc721.options.address, objectId);

            expectedManagerBalance = expectedManagerBalance.sub(1);
            var expectedReceiverBalance = "1".add(await getBalance(receiver, erc721.options.address, objectId));

            await catchCall(manager.methods.transfer(erc721.options.address, 0, receiver, 1, objectId, safe || false, withData || false, data || "0x"), "unauthorized");

            var transaction = await manager.methods.transfer(erc721.options.address, 0, receiver, 1, objectId, safe || false, withData || false, data || "0x").send(organization.asActiveComponent);

            var managerBalance = await getBalance(manager.options.address, erc721.options.address, objectId);
            var receiverBalance = await getBalance(receiver, erc721.options.address, objectId)

            assert.equal(expectedManagerBalance, managerBalance);
            assert.equal(expectedReceiverBalance, receiverBalance);

            return transaction;
        }

        await singleTransfer(receiver, erc721IDs[0]);

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {

    event Test(string s);

    function onERC721Received(address, address, uint256, bytes calldata b) external returns (bytes4) {
        emit Test(b.length == 0 ? "defaultText" : abi.decode(b, (string)));
        return this.onERC721Received.selector;
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());
        var transaction = await singleTransfer(testContract.options.address, erc721IDs[1], true, false, web3.eth.abi.encodeParameter("string", "gnau"));
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("Test(string)"));
        assert.equal(1, logs.length);
        assert.equal("defaultText", web3.eth.abi.decodeParameter("string", logs[0].data));

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());
        var transaction = await singleTransfer(testContract.options.address, erc721IDs[2], true, true, web3.eth.abi.encodeParameter("string", "gnau"));
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("Test(string)"));
        assert.equal(1, logs.length);
        assert.equal("gnau", web3.eth.abi.decodeParameter("string", logs[0].data));

        var batchTransfer = async function batchTransfer(receivers) {
            var entries = await Promise.all(receivers.map(async it => {
                return {
                    token : erc721.options.address,
                    objectIds : [it.objectId],
                    values : [],
                    receiver : it.address,
                    safe : it.safe || false,
                    batch : it.batch || false,
                    withData : it.withData || false,
                    data : it.data || "0x"
                }
            }));

            await catchCall(manager.methods.batchTransfer(entries), "unauthorized");

            var transaction = await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

            await Promise.all(receivers.map(async it => assert.equal("0", await getBalance(manager.options.address, erc721.options.address, it.objectId))));
            await Promise.all(receivers.map(async it => assert.equal("1", await getBalance(it.address, erc721.options.address, it.objectId))));

            return transaction;
        };

        await batchTransfer([{
            objectId : erc721IDs[3],
            address : accounts[2]
        }]);

        transaction = await batchTransfer([{
            objectId : erc721IDs[4],
            address : testContract.options.address,
            safe : true
        }]);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("Test(string)"));
        assert.equal(1, logs.length);
        assert.equal("defaultText", web3.eth.abi.decodeParameter("string", logs[0].data));

        transaction = await batchTransfer([{
            objectId : erc721IDs[5],
            address : testContract.options.address,
            safe : true,
            withData : true,
            data : web3.eth.abi.encodeParameter("string", "gnau")
        }]);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("Test(string)"));
        assert.equal(1, logs.length);
        assert.equal("gnau", web3.eth.abi.decodeParameter("string", logs[0].data));

        transaction = await batchTransfer([{
            objectId : erc721IDs[6],
            address : accounts[2]
        }, {
            objectId : erc721IDs[7],
            address : accounts[3]
        }, {
            objectId : erc721IDs[8],
            address : testContract.options.address,
            safe : true,
            withData : false,
            data : web3.eth.abi.encodeParameter("string", "gnau")
        }, {
            objectId : erc721IDs[9],
            address : testContract.options.address,
            safe : true,
            withData : true,
            data : web3.eth.abi.encodeParameter("string", "gnau")
        }]);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("Test(string)"));
        assert.equal(2, logs.length);
        assert.equal(1, logs.filter(it => web3.eth.abi.decodeParameter("string", it.data) === 'defaultText').length);
        assert.equal(1, logs.filter(it => web3.eth.abi.decodeParameter("string", it.data) === 'gnau').length);
    });

    it("Transfer and batchTransfer ERC1155", async () => {

        var objectId = itemIDs[0];

        var value = utilities.numberToString(0.3*1e18);

        var expectedManagerBalance = await item.methods.balanceOf(manager.options.address, objectId).call();

        var receiver = accounts[1];

        expectedManagerBalance = expectedManagerBalance.sub(value);
        var expectedReceiverBalance = value.add(await item.methods.balanceOf(receiver, objectId).call());

        await catchCall(manager.methods.transfer(item.options.address, value, receiver, 2, objectId, false, false, "0x"), "unauthorized");

        await manager.methods.transfer(item.options.address, value, receiver, 2, objectId, false, false, "0x").send(organization.asActiveComponent);

        var managerBalance = await item.methods.balanceOf(manager.options.address, objectId).call();
        var receiverBalance = await item.methods.balanceOf(receiver, objectId).call();

        assert.equal(expectedManagerBalance, managerBalance);
        assert.equal(expectedReceiverBalance, receiverBalance);

        var batchTransfer = async function batchTransfer(receivers, batch) {
            var expectedBalances = {
                [manager.options.address] : {}
            };
            receivers.map(it => it.address).forEach(it => expectedBalances[it] = {});
            var allObjectIDs = [];
            receivers.map(it => it.objectIds).forEach(it => allObjectIDs.push(...it));
            allObjectIDs = allObjectIDs.filter((it, i) => allObjectIDs.indexOf(it) === i);
            await Promise.all(allObjectIDs.map(objectId => Promise.all(Object.keys(expectedBalances).map(async addr => expectedBalances[addr][objectId] = await item.methods.balanceOf(addr, objectId).call()))));
            var entries = receivers.map(it => {
                it.objectIds.forEach((objectId, i) => {
                    it.values[i] = utilities.toDecimals(it.values[i], 18);
                    expectedBalances[manager.options.address][objectId] = expectedBalances[manager.options.address][objectId].sub(it.values[i]);
                    expectedBalances[it.address][objectId] = expectedBalances[it.address][objectId].add(it.values[i]);
                });
                return {
                    token : item.options.address,
                    objectIds : it.objectIds,
                    values : it.values,
                    receiver : it.address,
                    safe : false,
                    batch : batch || false,
                    withData : false,
                    data : it.data || "0x"
                }
            });

            var transaction = await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);
            var topics = [
                batch ? web3.utils.sha3('TransferBatch(address,address,address,uint256[],uint256[])') : web3.utils.sha3('TransferSingle(address,address,address,uint256,uint256)'),
                web3.eth.abi.encodeParameter("address", manager.options.address),
                web3.eth.abi.encodeParameter("address", manager.options.address)
            ];
            var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.address === item.options.address && it.topics[0] === topics[0] && it.topics[1] === topics[1] && it.topics[2] === topics[2]);

            assert.equal(logs.length, receivers.length);

            await Promise.all(Object.keys(expectedBalances).map((address, addressIndex) => Promise.all(Object.entries(expectedBalances[address]).map(async (it, itemIndex) => assert.equal(it[1], await item.methods.balanceOf(address, it[0]).call(), `address: ${address}, objectId: ${it[0]}, addressIndex: ${addressIndex}, itemIndex: ${itemIndex}, isManager: ${address === manager.options.address}`)))));
        };

        await batchTransfer([{
            values : [0.003],
            address : accounts[2],
            objectIds : [itemIDs[0]]
        }]);

        await batchTransfer([{
            values : [0.003],
            address : accounts[2],
            objectIds : [itemIDs[0]]
        }, {
            values : [1],
            address : accounts[3],
            objectIds : [itemIDs[1]]
        }, {
            values : [0.00009],
            address : accounts[4],
            objectIds : [itemIDs[2]]
        }, {
            values : [0.123456],
            address : accounts[5],
            objectIds : [itemIDs[3]]
        }]);

        await batchTransfer([{
            values : [0.003],
            address : accounts[2],
            objectIds : [itemIDs[0]]
        }], true);

        await batchTransfer([{
            values : [0.003],
            address : accounts[2],
            objectIds : [itemIDs[0]]
        }, {
            values : [1],
            address : accounts[3],
            objectIds : [itemIDs[1]]
        }, {
            values : [0.00009],
            address : accounts[4],
            objectIds : [itemIDs[2]]
        }, {
            values : [0.123456],
            address : accounts[5],
            objectIds : [itemIDs[3]]
        }], true);

        await batchTransfer([{
            values : [0.003, 0.001, 0.0003, 0.1003],
            address : accounts[2],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]]
        }], true);

        await batchTransfer([{
            values : [0.003, 0.001, 0.0003, 0.1003],
            address : accounts[2],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]]
        }, {
            values : [0.0096, 1, 0.7, 0.70009],
            address : accounts[3],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]]
        }, {
            values : [0.00960, 0.0021, 0.005503, 0.10903],
            address : accounts[4],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]]
        }, {
            values : [0.40003, 0.105, 0.00096, 0.520],
            address : accounts[5],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]]
        }], true);

        var singleTransferPayload = web3.eth.abi.encodeParameter("string", "A single transfer has been sent");
        var multipleTransferPayload = web3.eth.abi.encodeParameter("string", "A multiple transfer has been sent");

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event SingleTransfer(string);
    event MultipleTransfer(string);

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        emit SingleTransfer(abi.decode(data, (string)));
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4) {
        emit MultipleTransfer(abi.decode(data, (string)));
        return this.onERC1155BatchReceived.selector;
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        var entries = [{
            token : item.options.address,
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]],
            values : [0.40003, 0.105, 0.00096, 0.520],
            receiver : testContract.options.address,
            safe : false,
            batch : false,
            withData : false,
            data : singleTransferPayload
        }, {
            token : item.options.address,
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]],
            values : [0.40003, 0.105, 0.00096, 0.520],
            receiver : testContract.options.address,
            safe : false,
            batch : true,
            withData : false,
            data : multipleTransferPayload
        }];

        entries.forEach(it => it.values.forEach((value, i) => it.values[i] = utilities.numberToString(value * 1e18)));

        var transaction = await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;

        var single = logs.filter(it => it.topics[0] === web3.utils.sha3('SingleTransfer(string)'))[0];
        assert.equal(singleTransferPayload, single.data);

        var multiple = logs.filter(it => it.topics[0] === web3.utils.sha3('MultipleTransfer(string)'))[0];
        assert.equal(multipleTransferPayload, multiple.data);

        var transaction = await manager.methods.transfer(entries[0].token, entries[0].values[0], entries[0].receiver, 2, entries[0].objectIds[0], false, true, entries[0].data).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;

        var single = logs.filter(it => it.topics[0] === web3.utils.sha3('SingleTransfer(string)'))[0];
        assert.equal(singleTransferPayload, single.data);
    });

    it("Multi Transfer", async () => {
        var receivers = [{
            values : [0.003, 0.001, 0.0003, 0.1003],
            address : accounts[2],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]]
        }, {
            token : erc20.options.address,
            values : [0.0096, 1, 0.7, 0.70009],
            address : accounts[3]
        }, {
            token : erc721.options.address,
            objectIds : [erc721IDs[10]],
            address : accounts[3]
        }, {
            token : item.options.address,
            values : [0.00960, 0.0021, 0.005503, 0.10903],
            address : accounts[4],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]],
            batch : false
        }, {
            token : item.options.address,
            values : [0.40003, 0.105, 0.00096, 0.520],
            address : accounts[5],
            objectIds : [itemIDs[0], itemIDs[1], itemIDs[2], itemIDs[3]],
            batch : true
        }];

        var expectedBalances = {
            [manager.options.address] : {
                [utilities.voidEthereumAddress] : await getBalance(manager.options.address),
                [erc20.options.address] : await getBalance(manager.options.address, erc20.options.address),
                [erc721.options.address] : {},
                [item.options.address] : {}
            }
        };
        await Promise.all(receivers.map(async it => expectedBalances[it.address] = {
            [utilities.voidEthereumAddress] : await getBalance(it.address),
            [erc20.options.address] : await getBalance(it.address, erc20.options.address),
            [erc721.options.address] : {},
            [item.options.address] : {}
        }));
        await Promise.all(itemIDs.map(objectId => Promise.all(Object.keys(expectedBalances).map(async addr => expectedBalances[addr][item.options.address][objectId] = await getBalance(addr, item.options.address, objectId)))));
        await Promise.all(erc721IDs.map(objectId => Promise.all(Object.keys(expectedBalances).map(async addr => expectedBalances[addr][erc721.options.address][objectId] = await getBalance(addr, erc721.options.address, objectId)))));

        var entries = receivers.map(it => {
            it.values && it.values.forEach((_, i) => {
                it.values[i] = utilities.toDecimals(it.values[i], 18);
                var t = it.token || utilities.voidEthereumAddress;
                if(i === 0 && (t === utilities.voidEthereumAddress || t === erc20.options.address)) {
                    expectedBalances[manager.options.address][t] = expectedBalances[manager.options.address][t].sub(it.values[i]);
                    expectedBalances[it.address][t] = expectedBalances[it.address][t].add(it.values[i]);
                }
            });
            it.token && it.token !== erc20.options.address && it.objectIds && it.objectIds.forEach((objectId, i) => {
                if(i > 0 && !it.batch) {
                    return;
                }
                expectedBalances[manager.options.address][it.token][objectId] = expectedBalances[manager.options.address][it.token][objectId].sub(!it.values ? "1" : it.values[i]);
                expectedBalances[it.address][it.token][objectId] = expectedBalances[it.address][it.token][objectId].add(!it.values ? "1" : it.values[i]);
            });
            return {
                token : it.token || utilities.voidEthereumAddress,
                objectIds : it.objectIds || [],
                values : it.values || [],
                receiver : it.address,
                safe : it.safe || false,
                batch : it.batch || false,
                withData : it.withData || false,
                data : it.data || "0x"
            }
        });

        await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

        await Promise.all(Object.keys(expectedBalances).map(address => Promise.all(Object.entries(expectedBalances[address]).map(async token => !token[1].length ? await Promise.all(Object.entries(token[1]).map(async objectId => assert.equal(objectId[1], await getBalance(address, token[0], objectId[0])))) : assert.equal(token[1], await getBalance(address, token[0]))))));
    });

    it("Patch receive ETH", async () => {

        var value = utilities.numberToString(1e18);

        var expectedBalance = (await web3.eth.getBalance(manager.options.address)).add(value);

        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : manager.options.address,
            value
        }));

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    receive() external payable {
        revert("ETH receive temporary not allowed");
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        await catchCall(manager.methods.setAdditionalFunction("0x00000000", testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction("0x00000000", testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === utilities.voidBytes32 && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        await catchCall(web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : manager.options.address,
            value
        })), "ETH receive temporary not allowed");

        transaction = await manager.methods.setAdditionalFunction("0x00000000", utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await web3.eth.getBalance(manager.options.address)).add(value);

        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : manager.options.address,
            value
        }));

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));

        TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event ETH();
    receive() external payable {
        emit ETH();
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        await catchCall(manager.methods.setAdditionalFunction("0x00000000", testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction("0x00000000", testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === utilities.voidBytes32 && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        var transaction = await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : manager.options.address,
            value
        }));
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('ETH()'));
        assert.equal(1, logs.length);

        transaction = await manager.methods.setAdditionalFunction("0x00000000", utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await web3.eth.getBalance(manager.options.address)).add(value);

        transaction = await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : manager.options.address,
            value
        }));
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('ETH()'));
        assert.equal(0, logs.length);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));
    });

    it("Patch receive ERC721", async () => {

        var objectId = await erc721.methods.lastId().call();
        await erc721.methods.mint(accounts[0]).send(blockchainConnection.getSendingOptions());

        var expectedBalance = (await getBalance(manager.options.address, erc721.options.address, objectId)).add(1);

        await erc721.methods.safeTransferFrom(accounts[0], manager.options.address, objectId).send(blockchainConnection.getSendingOptions());

        assert.equal(expectedBalance, await getBalance(manager.options.address, erc721.options.address, objectId));

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    function onERC721Received(address, address, uint256, bytes calldata b) external returns (bytes4) {
        revert("ERC721 receive temporary not allowed");
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        var selector = web3.utils.sha3("onERC721Received(address,address,uint256,bytes)").substring(0, 10) + utilities.voidBytes32.substring(10);

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        objectId = await erc721.methods.lastId().call();
        await erc721.methods.mint(accounts[0]).send(blockchainConnection.getSendingOptions());

        await catchCall(erc721.methods.safeTransferFrom(accounts[0], manager.options.address, objectId), "ERC721 receive temporary not allowed");

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await getBalance(manager.options.address, erc721.options.address, objectId)).add(1);

        await erc721.methods.safeTransferFrom(accounts[0], manager.options.address, objectId).send(blockchainConnection.getSendingOptions());

        assert.equal(expectedBalance, await getBalance(manager.options.address, erc721.options.address, objectId));

        TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event ERC721();
    function onERC721Received(address, address, uint256, bytes calldata b) external returns (bytes4) {
        emit ERC721();
        return this.onERC721Received.selector;
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        objectId = await erc721.methods.lastId().call();
        await erc721.methods.mint(accounts[0]).send(blockchainConnection.getSendingOptions());

        transaction = await erc721.methods.safeTransferFrom(accounts[0], manager.options.address, objectId).send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('ERC721()'));
        assert.equal(1, logs.length);

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        objectId = await erc721.methods.lastId().call();
        await erc721.methods.mint(accounts[0]).send(blockchainConnection.getSendingOptions());

        expectedBalance = (await getBalance(manager.options.address, erc721.options.address, objectId)).add(1);

        transaction = await erc721.methods.safeTransferFrom(accounts[0], manager.options.address, objectId).send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('ERC721()'));
        assert.equal(0, logs.length);

        assert.equal(expectedBalance, await getBalance(manager.options.address, erc721.options.address, objectId));
    });

    it("Patch receive ERC1155", async () => {

        var value = utilities.numberToString(0.003 * 1e18);
        var itemId = itemIDs[0];

        var expectedBalance = (await getBalance(manager.options.address, item.options.address, itemId)).add(value);

        var transaction = await item.methods.safeTransferFrom(accounts[0], manager.options.address, itemId, value, "0x").send(blockchainConnection.getSendingOptions());
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('SingleTransfer()'));
        assert.equal(0, logs.length);

        assert.equal(expectedBalance, (await getBalance(manager.options.address, item.options.address, itemId)));

        expectedBalance = (await getBalance(manager.options.address, item.options.address, itemId)).add(value);

        transaction = await item.methods.safeBatchTransferFrom(accounts[0], manager.options.address, [itemId], [value], "0x").send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('MultipleTransfer()'));
        assert.equal(0, logs.length);

        assert.equal(expectedBalance, (await getBalance(manager.options.address, item.options.address, itemId)));

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event SingleTransfer();
    event MultipleTransfer();

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        emit SingleTransfer();
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4) {
        emit MultipleTransfer();
        return this.onERC1155BatchReceived.selector;
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        var selector = web3.utils.sha3("onERC1155Received(address,address,uint256,uint256,bytes)").substring(0, 10) + utilities.voidBytes32.substring(10);

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        expectedBalance = (await getBalance(manager.options.address, item.options.address, itemId)).add(value);

        transaction = await item.methods.safeTransferFrom(accounts[0], manager.options.address, itemId, value, "0x").send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('SingleTransfer()'));
        assert.equal(1, logs.length);

        assert.equal(expectedBalance, (await getBalance(manager.options.address, item.options.address, itemId)));

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await getBalance(manager.options.address, item.options.address, itemId)).add(value);

        transaction = await item.methods.safeTransferFrom(accounts[0], manager.options.address, itemId, value, "0x").send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('SingleTransfer()'));
        assert.equal(0, logs.length);

        assert.equal(expectedBalance, (await getBalance(manager.options.address, item.options.address, itemId)));

        selector = web3.utils.sha3("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)").substring(0, 10) + utilities.voidBytes32.substring(10);

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        expectedBalance = (await getBalance(manager.options.address, item.options.address, itemId)).add(value);

        transaction = await item.methods.safeBatchTransferFrom(accounts[0], manager.options.address, [itemId], [value], "0x").send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('MultipleTransfer()'));
        assert.equal(1, logs.length);

        assert.equal(expectedBalance, (await getBalance(manager.options.address, item.options.address, itemId)));

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await getBalance(manager.options.address, item.options.address, itemId)).add(value);

        transaction = await item.methods.safeBatchTransferFrom(accounts[0], manager.options.address, [itemId], [value], "0x").send(blockchainConnection.getSendingOptions());
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('MultipleTransfer()'));
        assert.equal(0, logs.length);

        assert.equal(expectedBalance, (await getBalance(manager.options.address, item.options.address, itemId)));

    });

    it("Patch transfer", async () => {

        var value = utilities.numberToString(0.0054*1e18);
        var receiver = accounts[1];

        var expectedBalance = (await web3.eth.getBalance(manager.options.address)).sub(value);

        await manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    function transfer(address token, uint256 value, address receiver, uint256 tokenType, uint256 objectId, bool safe, bool withData, bytes calldata data) external returns(bool result, bytes memory returnData) {
        revert("transfer temporary not allowed");
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        var selector = web3.utils.sha3("transfer(address,uint256,address,uint256,uint256,bool,bool,bytes)").substring(0, 10) + utilities.voidBytes32.substring(10);

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        await catchCall(manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x"), "unauthorized");
        await catchCall(manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent), "transfer temporary not allowed");

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await web3.eth.getBalance(manager.options.address)).sub(value);

        await manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));

        TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event Transfer();
    function transfer(address token, uint256 value, address receiver, uint256 tokenType, uint256 objectId, bool safe, bool withData, bytes calldata data) external returns(bool result, bytes memory returnData) {
        emit Transfer();
    }
}`, 'TestContract');

        testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        await catchCall(manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x"), "unauthorized");
        transaction = await manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('Transfer()'));
        assert.equal(1, logs.length);

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await web3.eth.getBalance(manager.options.address)).sub(value);

        await manager.methods.transfer(utilities.voidEthereumAddress, value, receiver, 0, 0, false, false, "0x").send(organization.asActiveComponent);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));
    });

    it("Patch batchTransfer", async () => {

        var value = utilities.numberToString(0.0054*1e18);
        var receiver = accounts[1];

        var expectedBalance = (await web3.eth.getBalance(manager.options.address)).sub(value);

        var entries = [{
            token : utilities.voidEthereumAddress,
            objectIds : [],
            values : [value],
            receiver,
            safe : false,
            batch : false,
            withData : false,
            data : "0x"
        }];

        var selector = manager.methods.batchTransfer(entries).encodeABI().substring(0, 10) + utilities.voidBytes32.substring(10);

        await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    struct TransferEntry {
        address token;
        uint256[] objectIds;
        uint256[] values;
        address receiver;
        bool safe;
        bool batch;
        bool withData;
        bytes data;
    }

    function batchTransfer(TransferEntry[] calldata transferEntries) external returns(bool[] memory results, bytes[] memory returnDatas) {
        revert("batchTransfer temporary not allowed");
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        await catchCall(manager.methods.batchTransfer(entries), "unauthorized");
        await catchCall(manager.methods.batchTransfer(entries).send(organization.asActiveComponent), "transfer temporary not allowed");

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await web3.eth.getBalance(manager.options.address)).sub(value);

        await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));

        TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event BatchTransfer();

    struct TransferEntry {
        address token;
        uint256[] objectIds;
        uint256[] values;
        address receiver;
        bool safe;
        bool batch;
        bool withData;
        bytes data;
    }

    function batchTransfer(TransferEntry[] calldata transferEntries) external returns(bool[] memory results, bytes[] memory returnDatas) {
        emit BatchTransfer();
    }
}`, 'TestContract');

        testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        await catchCall(manager.methods.batchTransfer(entries), "unauthorized");
        transaction = await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('BatchTransfer()'));
        assert.equal(1, logs.length);

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        expectedBalance = (await web3.eth.getBalance(manager.options.address)).sub(value);

        await manager.methods.batchTransfer(entries).send(organization.asActiveComponent);

        assert.equal(expectedBalance, await web3.eth.getBalance(manager.options.address));
    });

    it("Patch setAdditionalFunction", async () => {

        var TestContract = await compile(`
pragma solidity ^0.8.0;

interface IAdditionalFunctionsServerManager {
    function set(bytes4 selector, address newServer) external returns (address oldServer);
}

contract TestContract {
    event Ciccio();

    address private immutable _dictionary = ${await manager.methods.additionalFunctionsServerManager().call()};

    function setAdditionalFunction(bytes4 selector, address newServer, bool log) external returns (address oldServer) {
        if(selector == 0x12345678) {
            emit Ciccio();
            return address(0);
        }
        IAdditionalFunctionsServerManager(_dictionary).set(selector, newServer);
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        var selector = web3.utils.sha3("setAdditionalFunction(bytes4,address,bool)").substring(0, 10) + utilities.voidBytes32.substring(10);

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        transaction = await manager.methods.setAdditionalFunction("0x12345678", utilities.voidEthereumAddress, false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('Ciccio()'));
        assert.equal(1, logs.length);

        assert(!(await manager.methods.supportsInterface("0x12345678").call()));

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(0, logs.length);

        transaction = await manager.methods.setAdditionalFunction("0x12345678", accounts[3], false).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('Ciccio()'));
        assert.equal(0, logs.length);

        assert(await manager.methods.supportsInterface("0x12345678").call());

        transaction = await manager.methods.setAdditionalFunction("0x12345678", utilities.voidEthereumAddress, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(1, logs.length);

        assert(!(await manager.methods.supportsInterface("0x12345678").call()));
    });

    it("Add random function", async () => {

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    event Ciccio();

    function test() external {
        emit Ciccio();
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());

        var dummyContract = new web3.eth.Contract(TestContract.abi, manager.options.address);

        var selector = web3.utils.sha3("test()").substring(0, 10) + utilities.voidBytes32.substring(10);

        assert(!(await manager.methods.supportsInterface(selector.substring(0, 10)).call()));

        await catchCall(dummyContract.methods.test(), "unauthorized");
        await catchCall(dummyContract.methods.test().send(organization.asActiveComponent), "none");
        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        var transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        assert(await manager.methods.supportsInterface(selector.substring(0, 10)).call());

        await catchCall(dummyContract.methods.test(), "unauthorized");

        transaction = await dummyContract.methods.test().send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('Ciccio()'));
        assert.equal(1, logs.length);

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(1, logs.length);

        assert(!(await manager.methods.supportsInterface(selector.substring(0, 10)).call()));

        await catchCall(dummyContract.methods.test().send(organization.asActiveComponent), "none");

        var TestContract = await compile(`
pragma solidity ^0.8.0;

contract TestContract {
    function test() external returns(address) {
        return address(this);
    }
}`, 'TestContract');

        var testContract = await new web3.eth.Contract(TestContract.abi).deploy({data : TestContract.bin}).send(blockchainConnection.getSendingOptions());
        var transaction = await testContract.methods.test().call(organization.asActiveComponent);
        assert.equal(testContract.options.address, transaction);

        var dummyContract = new web3.eth.Contract(TestContract.abi, manager.options.address);

        var selector = web3.utils.sha3("test()").substring(0, 10) + utilities.voidBytes32.substring(10);

        assert(!(await manager.methods.supportsInterface(selector.substring(0, 10)).call()));

        await catchCall(dummyContract.methods.test().call(), "unauthorized");
        await catchCall(dummyContract.methods.test().call(organization.asActiveComponent), "none");
        await catchCall(manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true), "unauthorized");

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), testContract.options.address, true).send(organization.asActiveComponent);
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)') && it.topics[1] === selector && it.topics[2] === web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress) && it.topics[3] === web3.eth.abi.encodeParameter("address", testContract.options.address));
        assert.equal(1, logs.length);

        assert(await manager.methods.supportsInterface(selector.substring(0, 10)).call());

        await catchCall(dummyContract.methods.test().call(), "unauthorized");

        transaction = await dummyContract.methods.test().call(organization.asActiveComponent);
        assert.equal(manager.options.address, transaction);

        transaction = await manager.methods.setAdditionalFunction(selector.substring(0, 10), utilities.voidEthereumAddress, true).send(organization.asActiveComponent);
        logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        logs = logs.filter(it => it.topics[0] === web3.utils.sha3('AdditionalFunction(address,bytes4,address,address)'));
        assert.equal(1, logs.length);

        assert(!(await manager.methods.supportsInterface(selector.substring(0, 10)).call()));

        await catchCall(dummyContract.methods.test().call(organization.asActiveComponent), "none");
    });
});