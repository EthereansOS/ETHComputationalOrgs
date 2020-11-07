var organizationManager = require('../resources/organization');
describe("MicroservicesManager", () => {

    var organization;
    var manager;
    var entries = {};

    async function checkEntryStuff(entryInput) {
        var entry = {...entryInput};
        delete entry.optionalStuff;

        var exists = await manager.methods.exists(entry.key).call();
        assert.equal(true, exists.result);
        var index = -1;
        Object.keys(entries).forEach((it, i) => it === entry.key && (index = i));
        assert.equal(utilities.numberToString(index === -1 ? Object.keys(entries).length : index), exists.index);

        var entryByName = await manager.methods.get(entry.key).call();
        assert.equal(entry.key, entryByName.key);
        Object.keys(entryByName = {...entryByName}).forEach(it => !isNaN(parseInt(it)) && delete entryByName[it]);

        var entryByIndex = await manager.methods.getByIndex(exists.index).call();
        assert.equal(entry.key, entryByIndex.key);
        Object.keys(entryByIndex = {...entryByIndex}).forEach(it => !isNaN(parseInt(it)) && delete entryByIndex[it]);

        assert.equal(JSON.stringify(entryByName), JSON.stringify(entryByIndex));
        assert.equal(JSON.stringify(entry), JSON.stringify(entryByIndex));

        var logs = await web3.eth.getPastLogs({
            address : manager.options.address,
            topics : [
                web3.utils.sha3('MicroserviceAdded(address,bytes32,string,address,string,bool,string,bool,bool)'),
                null,
                web3.utils.sha3(entry.key)
            ],
            fromBlock : utilities.numberToString(blockchainConnection.forkBlock),
            toBlock : 'latest'
        });

        var log = logs[logs.length - 1];

        var data = web3.eth.abi.decodeParameters(["string", "string", "bool", "string", "bool", "bool"], log.data);

        var rebuiltEntry = {
            key : data[0],
            location : web3.eth.abi.decodeParameter("address", log.topics[3]),
            methodSignature : data[1],
            submittable : data[2],
            returnAbiParametersArray : data[3],
            isInternal : data[4],
            needsSender : data[5]
        };

        assert.equal(JSON.stringify(entry), JSON.stringify(rebuiltEntry));

        if(logs.length > 1) {
            var transaction = await web3.eth.getTransactionReceipt(log.transactionHash);
            var topic = web3.utils.sha3('MicroserviceRemoved(address,bytes32,string,address,string,bool,string,bool,bool)');
            log = transaction.logs.filter(it => it.topics[0] === topic)[0];

            data = web3.eth.abi.decodeParameters(["string", "string", "bool", "string", "bool", "bool"], log.data);

            rebuiltEntry = {
                key : data[0],
                location : web3.eth.abi.decodeParameter("address", log.topics[3]),
                methodSignature : data[1],
                submittable : data[2],
                returnAbiParametersArray : data[3],
                isInternal : data[4],
                needsSender : data[5]
            };

            var oldEntry = {...entries[entry.key]};
            delete oldEntry.optionalStuff;

            assert.equal(JSON.stringify(oldEntry), JSON.stringify(rebuiltEntry));
        }

        entries[entry.key] = entryInput;
    }

    async function createMicroserviceEntry(key, needsSender, code, isInternal) {
        code = code.trim();
        var Contract = await compile(code, 'Microservice');
        var contract = await new web3.eth.Contract(Contract.abi).deploy({data: Contract.bin}).send(blockchainConnection.getSendingOptions());
        var funct = Contract.abi.filter(it => it.type === 'function')[0];
        return {
            key,
            location : contract.options.address,
            methodSignature : `${funct.name}(${(funct.inputs || []).map(it => it.type).join(',')})`.split(' ').join(''),
            submittable : funct.stateMutability !== 'view' && funct.stateMutability !== 'pure',
            returnAbiParametersArray : JSON.stringify((funct.outputs || []).map(it => it.type)),
            isInternal : isInternal || false,
            needsSender : needsSender || false,
            optionalStuff : {
                contract,
                code
            }
        };
    }

    before(async () => {
        manager = (organization = await organizationManager.createOrganization()).components.microservicesManager.contract;
    });

    it("set", async () => {

        var entry = await createMicroserviceEntry("mario", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256) payable public returns(uint256) {
        return msg.value;
    }
}`);

        await catchCall(manager.methods.set(entry), "unauthorized");
        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);
    });

    it("batchSet", async () => {
        var entriesToAdd = [
            await createMicroserviceEntry("mario", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256) payable public returns(uint256) {
        return msg.value;
    }
}`),
            await createMicroserviceEntry("marino", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`),
            await createMicroserviceEntry("marino2", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`),
            await createMicroserviceEntry("marino3", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`),
            await createMicroserviceEntry("mariello2", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`),
            await createMicroserviceEntry("mariello6", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`),
            await createMicroserviceEntry("mariello7", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`),
            await createMicroserviceEntry("mariello8", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 input) external pure returns(uint256) {
        return input;
    }
}`)
        ];

        await catchCall(manager.methods.batchSet(entriesToAdd), "unauthorized");
        await manager.methods.batchSet(entriesToAdd).send(organization.asActiveComponent);

        for(var it of entriesToAdd) {
            await checkEntryStuff(it);
        }
    });

    it("read", async () => {
        var entry = await createMicroserviceEntry("read", false, `
        pragma solidity ^0.8.0;

        contract Microservice {
            function test() public view returns(uint256) {
                return address(this).balance;
            }
        }`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();
        await blockchainConnection.safeTransferETH(onchainEntry.location);

        var balance = await web3.eth.getBalance(onchainEntry.location);

        var data = await manager.methods.read(onchainEntry.key, "0x").call();

        data = web3.eth.abi.decodeParameters(JSON.parse(onchainEntry.returnAbiParametersArray), data)[0];

        assert.equal(balance, data);
    });

    it("read with payload", async () => {
        var entry = await createMicroserviceEntry("read", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(uint256 i) public view returns(uint256) {
        return i + address(this).balance;
    }
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();
        await blockchainConnection.safeTransferETH(onchainEntry.location);

        await catchCall(manager.methods.read(onchainEntry.key, "0x").call());

        var input = 30;

        var data = await manager.methods.read(onchainEntry.key, web3.eth.abi.encodeParameter("uint256", input)).call();
        data = web3.eth.abi.decodeParameters(JSON.parse(onchainEntry.returnAbiParametersArray), data)[0];

        var expected = input.add(await web3.eth.getBalance(onchainEntry.location));

        assert.equal(expected, data);
    });

    it("read with needs sender", async () => {
        var entry = await createMicroserviceEntry("read", true, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(address s) public view returns(address) {
        return s;
    }
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();
        await blockchainConnection.safeTransferETH(onchainEntry.location);

        await catchCall(manager.methods.read(onchainEntry.key, "0x").call(), "payload");

        var data = await manager.methods.read(onchainEntry.key, web3.eth.abi.encodeParameter("address", accounts[1])).call();
        data = web3.eth.abi.decodeParameters(JSON.parse(onchainEntry.returnAbiParametersArray), data)[0];

        assert.equal(accounts[0], data);

        data = await manager.methods.read(onchainEntry.key, web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress)).call();
        data = web3.eth.abi.decodeParameters(JSON.parse(onchainEntry.returnAbiParametersArray), data)[0];

        assert.equal(accounts[0], data);
    });

    it("read with needs sender (fail)", async () => {
        var entry = await createMicroserviceEntry("read", true, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(string memory s) public view returns(string memory) {
        return s;
    }
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();

        await catchCall(manager.methods.read(onchainEntry.key, "0x").call(), "payload");

        await catchCall(manager.methods.read(onchainEntry.key, web3.eth.abi.encodeParameter("string", accounts[1])).call());

        await catchCall(manager.methods.read(onchainEntry.key, web3.eth.abi.encodeParameters(["address", "string"], [accounts[1], accounts[5]])).call());
    });

    it("submit", async () => {
        var receiver = web3.utils.toChecksumAddress(accounts[1]);
        var amount = 1e18;
        var entry = await createMicroserviceEntry("submit", false, `
        pragma solidity ^0.8.0;

        contract Microservice {
            function test() public {
                address(${receiver}).call{value : ${amount}}("");
            }
        }`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();
        await blockchainConnection.safeTransferETH(onchainEntry.location);

        var microserviceBalanceExpected = (await web3.eth.getBalance(onchainEntry.location)).sub(amount);
        var accountBalanceExpected = amount.add(await web3.eth.getBalance(receiver));

        await manager.methods.submit(onchainEntry.key, "0x").send(blockchainConnection.getSendingOptions());

        var microserviceBalance = await web3.eth.getBalance(onchainEntry.location);
        var accountBalance = await web3.eth.getBalance(receiver);

        assert.equal(microserviceBalanceExpected, microserviceBalance);
        assert.equal(accountBalanceExpected, accountBalance);
    });

    it("submit with payload", async () => {
        var entry = await createMicroserviceEntry("submit", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(address a, uint256 b) public returns(uint256) {
        a.call{value : b}("");
        return address(this).balance;
    }
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();
        await blockchainConnection.safeTransferETH(onchainEntry.location);

        var receiver = web3.utils.toChecksumAddress(accounts[1]);
        var amount = utilities.numberToString(1e18);

        var microserviceBalanceExpected = (await web3.eth.getBalance(onchainEntry.location)).sub(amount);
        var accountBalanceExpected = amount.add(await web3.eth.getBalance(receiver));

        await catchCall(manager.methods.submit(onchainEntry.key, "0x"));

        await manager.methods.submit(onchainEntry.key, web3.eth.abi.encodeParameters(["address", "uint256"], [receiver, amount])).send(blockchainConnection.getSendingOptions());

        var microserviceBalance = await web3.eth.getBalance(onchainEntry.location);
        var accountBalance = await web3.eth.getBalance(receiver);

        assert.equal(microserviceBalanceExpected, microserviceBalance);
        assert.equal(accountBalanceExpected, accountBalance);
    });

    it("submit with needs sender", async () => {
        var entry = await createMicroserviceEntry("submit", true, `
pragma solidity ^0.8.0;

contract Microservice {
    function test(address a, uint256 b) public returns(uint256) {
        a.call{value : b}("");
        return address(this).balance;
    }
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();
        await blockchainConnection.safeTransferETH(onchainEntry.location);

        var receiver = web3.utils.toChecksumAddress(accounts[0]);
        var amount = utilities.numberToString(0);

        var microserviceBalanceExpected = (await web3.eth.getBalance(onchainEntry.location)).sub(amount);
        var accountBalanceExpected = amount.add(await web3.eth.getBalance(receiver));

        await catchCall(manager.methods.submit(onchainEntry.key, "0x"), "payload");

        var transaction = await manager.methods.submit(onchainEntry.key, web3.eth.abi.encodeParameters(["address", "uint256"], [accounts[5], "9".mul(1e18)])).send(blockchainConnection.getSendingOptions());

        var microserviceBalance = await web3.eth.getBalance(onchainEntry.location);
        var accountBalance = await web3.eth.getBalance(receiver);
        accountBalanceExpected = accountBalanceExpected.sub(await blockchainConnection.calculateTransactionFee(transaction));

        assert.equal(microserviceBalanceExpected, microserviceBalance);
        assert.equal(utilities.fromDecimals(accountBalanceExpected, 18), utilities.fromDecimals(accountBalance, 18));

        var amount = utilities.numberToString(2*1e18);

        var microserviceBalanceExpected = (await web3.eth.getBalance(onchainEntry.location)).sub(amount);
        var accountBalanceExpected = amount.add(await web3.eth.getBalance(receiver));

        await catchCall(manager.methods.submit(onchainEntry.key, "0x"), "payload");

        var transaction = await manager.methods.submit(onchainEntry.key, web3.eth.abi.encodeParameters(["address", "uint256"], [accounts[5], "9".mul(1e18)])).send(blockchainConnection.getSendingOptions({value : amount}));

        var microserviceBalance = await web3.eth.getBalance(onchainEntry.location);
        var accountBalance = await web3.eth.getBalance(receiver);
        accountBalanceExpected = accountBalanceExpected.sub(await blockchainConnection.calculateTransactionFee(transaction));

        assert.equal(microserviceBalanceExpected, microserviceBalance);
        assert.equal(utilities.fromDecimals(accountBalanceExpected, 18), utilities.fromDecimals(accountBalance, 18));
    });

    it("submit with needs sender(fail)", async () => {
        var entry = await createMicroserviceEntry("submit", true, `
pragma solidity ^0.8.0;

contract Microservice {

    event Test(string);

    function test(string memory s) public {
        emit Test(s);
    }
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);

        var onchainEntry = await manager.methods.get(entry.key).call();

        await catchCall(manager.methods.submit(onchainEntry.key, "0x"), "payload");

        await catchCall(manager.methods.submit(onchainEntry.key, web3.eth.abi.encodeParameter("string", accounts[1])).call());

        await catchCall(manager.methods.submit(onchainEntry.key, web3.eth.abi.encodeParameters(["address", "uint256", "string"], [accounts[1], utilities.numberToString(9*1e18), accounts[5]])).call());
    });

    it("internal", async () => {

        var entry = await createMicroserviceEntry("submit", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test() public returns(uint256) {
        return abi.decode(IMicroservicesManager(msg.sender).submit("submitInternal", ""), (uint256));
    }
}

interface IMicroservicesManager {
    function submit(string calldata name, bytes calldata data) external payable returns(bytes memory returnData);
}`);

        await manager.methods.set(entry).send(organization.asActiveComponent);
        await checkEntryStuff(entry);
        entry = await manager.methods.get(entry.key).call();

        var entryInternal = await createMicroserviceEntry("submitInternal", false, `
pragma solidity ^0.8.0;

contract Microservice {
    function test() public view returns(uint256) {
        return address(this).balance;
    }
}`, true);

        await catchCall(manager.methods.set(entryInternal).send(organization.asActiveComponent), "Internal view");

        entryInternal = await createMicroserviceEntry("submitInternal", false, `
pragma solidity ^0.8.0;

contract Microservice {

    event Test(uint256);

    function test() public returns(uint256) {
        emit Test(address(this).balance);
        return address(this).balance;
    }
}`, true);

        await manager.methods.set(entryInternal).send(organization.asActiveComponent);
        await checkEntryStuff(entryInternal);
        entryInternal = await manager.methods.get(entryInternal.key).call();
        await blockchainConnection.safeTransferETH(entryInternal.location);

        var balance = await web3.eth.getBalance(entryInternal.location);

        await catchCall(manager.methods.submit(entryInternal.key, "0x"), "internal");

        var transaction = await manager.methods.submit(entry.key, "0x").send(blockchainConnection.getSendingOptions());
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var log = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('Test(uint256)'))[0];
        var data = web3.eth.abi.decodeParameter("uint256", log.data);

        assert.equal(balance, data);
    });

    it("list", async () => {
        var list = await manager.methods.all().call();
        assert.equal(list.length, Object.entries(entries).length);
        assert.equal(utilities.numberToString(list.length), await manager.methods.size().call());
        list.forEach(it => assert.notStrictEqual(Object.keys(entries).indexOf(it.key), -1));

        list = await manager.methods.list(Object.keys(entries)).call();
        assert.equal(list.length, Object.entries(entries).length);
        assert.equal(utilities.numberToString(list.length), await manager.methods.size().call());
        list.forEach(it => assert.notStrictEqual(Object.keys(entries).indexOf(it.key), -1));

        list = await manager.methods.partialList(0, 999999999).call();
        assert.equal(list.length, Object.entries(entries).length);
        assert.equal(utilities.numberToString(list.length), await manager.methods.size().call());
        list.forEach(it => assert.notStrictEqual(Object.keys(entries).indexOf(it.key), -1));

        var l = parseInt(list.length / 2);
        list = [
            ...(await manager.methods.partialList(l, list.length).call()),
            ...(await manager.methods.partialList(0, l).call())
        ];
        list = (list = list.map(it => it.key)).filter((it, i) => list.indexOf(it) === i);
        assert.equal(list.length, Object.entries(entries).length);
        assert.equal(utilities.numberToString(list.length), await manager.methods.size().call());
        list.forEach(it => assert.notStrictEqual(Object.keys(entries).indexOf(it), -1));

        var start = 2;
        var offset = 3;
        var sublist = Object.keys(entries).splice(start, offset);
        list = await manager.methods.partialList(start, offset).call();
        list = (list = list.map(it => it.key)).filter((it, i) => list.indexOf(it) === i);
        assert.equal(list.length, sublist.length);
        list.forEach(it => assert.notStrictEqual(sublist.indexOf(it), -1));
    });

    it("remove", async () => {
        var list = await manager.methods.all().call();
        var originalList = list;

        var indices = [3, 5];

        await catchCall(manager.methods.removeByIndices(indices), 'unauthorized');
        await catchCall(manager.methods.removeByIndices(indices).send(organization.asActiveComponent), 'DESC');

        indices = [originalList.length, 3];
        await manager.methods.removeByIndices(indices).send(organization.asActiveComponent);

        assert.equal(list.length.sub(indices.length - 1), await manager.methods.size().call());

        await Promise.all(indices.map(async it => {
            var exists = await manager.methods.exists((list[it] && list[it].key) || "").call();
            assert(!exists.result);
        }));

        originalList = list;
        list = await manager.methods.all().call();
        assert.equal(originalList.length - 1, list.length);

        indices = [list.length - 1, 5, 3, 3];
        await manager.methods.removeByIndices(indices).send(organization.asActiveComponent);

        assert.equal(list.length.sub(indices.length), await manager.methods.size().call());

        await Promise.all(indices.map(async it => {
            var exists = await manager.methods.exists((list[it] && list[it].key) || "").call();
            assert(!exists.result);
        }));

        originalList = list;
        list = await manager.methods.all().call();
        assert.equal(originalList.length - indices.length, list.length);

        var start = 2;
        var offset = 3;
        var sublist = list.map(it => it.key).splice(start, offset);

        await catchCall(manager.methods.batchRemove(sublist), 'unauthorized');

        originalList = list;
        await manager.methods.batchRemove(sublist).send(organization.asActiveComponent);

        assert.equal(list.length.sub(sublist.length), await manager.methods.size().call());

        list = await manager.methods.all().call();
        assert.equal(originalList.length - sublist.length, list.length);

        await Promise.all(sublist.map(async it => {
            var exists = await manager.methods.exists(it).call();
            assert(!exists.result);
        }));

        list = list.map(it => it.key);
        sublist.forEach(it => assert.equal(list.indexOf(it), -1));
    });
});