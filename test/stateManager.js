var organizationManager = require('../resources/organization');
describe("StateManager", () => {

    var organization;
    var manager;
    var entries = {};

    var utilityOrganizationComponent;

    async function checkEntryStuff(type, key, value) {
        var exists = await manager.methods.exists(key).call();
        assert.equal(true, exists.result);
        var index = -1;
        Object.keys(entries).forEach((it, i) => it === key && (index = i));
        assert.equal(utilities.numberToString(index === -1 ? Object.keys(entries).length : index), exists.index);

        var entryByName = await manager.methods.get(key).call();
        assert.equal(key, entryByName.key);

        var entryByIndex = await manager.methods.getByIndex(exists.index).call();
        assert.equal(key, entryByIndex.key);

        assert.equal(JSON.stringify(entryByName), JSON.stringify(entryByIndex));

        var data = [{
            key,
            entryType : web3.utils.sha3(utilities.numberToString(new Date().getTime() * Math.random() + Math.random())),
            value : web3.utils.sha3(JSON.stringify(value))
        }];

        await catchCall(manager.methods.set(data[0]), "unauthorized");
        await catchCall(manager.methods.set(data[0]).send(organization.asActiveComponent), "type");
        await catchCall(manager.methods.batchSet(data), "unauthorized");
        await catchCall(manager.methods.batchSet(data).send(organization.asActiveComponent), "type");

        entries[key] = entries[key] || {
            key,
            type,
            value
        };
    }

    async function setSingleTypedEntry(type, key, value) {
        type = type[0].toUpperCase() + type.substring(1);

        await utilityOrganizationComponent.methods[`set${type}`](key, value).send(organization.asActiveComponent);
        value = typeof value === 'number' ? utilities.numberToString(value) : value;
        value instanceof Array && value.forEach((it, i) => value[i] = typeof it === 'number' ? utilities.numberToString(it) : it);
        assert.equal(JSON.stringify(value), JSON.stringify(await utilityOrganizationComponent.methods[`get${type}`](key).call()));

        var otherType = type === 'Uint256' ? 'String' : 'Uint256';
        var otherValue = type === 'Uint256' ? 'non andare in un quartiere poco conosciuto senza aver fatto prima il pieno alla macchina' : 139;

        await catchCall(utilityOrganizationComponent.methods[`set${otherType}`](key, otherValue).send(organization.asActiveComponent), "type");

        await checkEntryStuff(type, key, value);
    }

    before(async () => {
        manager = (organization = await organizationManager.createOrganization()).components.stateManager.contract;
        var UtilityOrganizationComponent = await compile('../resources/UtilityOrganizationComponent');
        utilityOrganizationComponent = await new web3.eth.Contract(UtilityOrganizationComponent.abi).deploy({data: UtilityOrganizationComponent.bin, arguments: [web3.eth.abi.encodeParameters(["address", "bytes"], [organization.contract.options.address, "0x"])]}).send(blockchainConnection.getSendingOptions());
        await organization.contract.methods.set({
            key : await utilityOrganizationComponent.methods.KEY().call(),
            location : utilityOrganizationComponent.options.address,
            active : true,
            log : false
        }).send(organization.asActiveComponent);
    });

    it("initialFill", async () => {
        var entries = [{
            key : "mi piace",
            entryType : "0x97fc46276c172633607a331542609db1e3da793fca183d594ed5a61803a10792",
            plainEntryType : "String",
            plainValue : "franco"
        }, {
            key : "pero il fatto",
            entryType : "0xec13d6d12b88433319b64e1065a96ea19cd330ef6603f5f6fb685dde3959a320",
            plainEntryType : "Uint256",
            plainValue : 30
        }, {
            key : "nasce la nuova popolazione",
            entryType : "0xc1053bdab4a5cf55238b667c39826bbb11a58be126010e7db397c1b67c24271b",
            plainEntryType : "Bool",
            plainValue : true
        }];
        entries.forEach(it => it.value = web3.eth.abi.encodeParameter(it.plainEntryType.toLowerCase(), it.plainValue));

        var type = "tuple(string,bytes32,bytes)[]";
        var value = entries.map(it => [it.key, it.entryType, it.value]);

        assert.equal(utilities.numberToString(0), utilities.numberToString(await manager.methods.size().call()));

        var StateManager = await compile('base/impl/StateManager');
        var data = abi.encode([type], [value]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, data]);
        var stateManager = await new web3.eth.Contract(StateManager.abi).deploy({data : StateManager.bin, arguments : [data]}).send(blockchainConnection.getSendingOptions());

        assert.equal(utilities.numberToString(entries.length), utilities.numberToString(await stateManager.methods.size().call()));

        for(var entry of entries) {
            var exists = await stateManager.methods.exists(entry.key).call();
            assert(exists[0]);
            assert.equal(utilities.numberToString(entries.indexOf(entry)), utilities.numberToString(exists[1]));
            var builtEntry = await stateManager.methods.get(entry.key).call();
            assert.equal(entry.key, builtEntry[0]);
            assert.equal(entry.entryType, builtEntry[1]);
            assert.equal(entry.value, builtEntry[2]);
        }
    });

    it("string", () => setSingleTypedEntry("string", "ciao", "marella"));

    it("uint256", () => setSingleTypedEntry("uint256", "setter", 35));

    it("bytes", () => setSingleTypedEntry("bytes", "elettra", "0x012396"));

    it("address", () => setSingleTypedEntry("address", "losco", accounts[5]));

    it("false", () => setSingleTypedEntry("bool", "magrebino", false));

    it("true", () => setSingleTypedEntry("bool", "tesoro", true));

    it("string[0]", () => setSingleTypedEntry("stringArray", "testare0", []));

    it("string[1]", () => setSingleTypedEntry("stringArray", "testare0", ["marella"]));

    it("string[+]", () => setSingleTypedEntry("stringArray", "testare0", ["marella", "paralisi"]));

    it("uint256[0]", () => setSingleTypedEntry("uint256Array", "testare1", []));

    it("uint256[1]", () => setSingleTypedEntry("uint256Array", "testare1", [10]));

    it("uint256[+]", () => setSingleTypedEntry("uint256Array", "testare1", [17, 89]));

    it("bool[0]", () => setSingleTypedEntry("boolArray", "testare2", []));

    it("bool[1]", () => setSingleTypedEntry("boolArray", "testare2", [false]));

    it("bool[+]", () => setSingleTypedEntry("boolArray", "testare2", [true, true]));

    it("address[0]", () => setSingleTypedEntry("addressArray", "testare3", []));

    it("address[1]", () => setSingleTypedEntry("addressArray", "testare3", [accounts[4]]));

    it("address[+]", () => setSingleTypedEntry("addressArray", "testare3", accounts));

    it("bytes[0]", () => setSingleTypedEntry("bytesArray", "testare4", []));

    it("bytes[1]", () => setSingleTypedEntry("bytesArray", "testare4", [accounts[4].toLowerCase()]));

    it("bytes[+]", () => setSingleTypedEntry("bytesArray", "testare4", accounts.map(it => it.toLowerCase())));

    it("batchSet", async () => {
        var entries = await Promise.all([0,0,0,0].map(async () => {
            return {
                key : utilities.numberToString(new Date().getTime() * Math.random() + Math.random()).split('.')[0],
                entryType : web3.utils.sha3(utilities.numberToString(new Date().getTime() * Math.random() + Math.random())),
                value : web3.utils.sha3(utilities.numberToString(new Date().getTime() * Math.random() + Math.random()))
            }
        }));

        await catchCall(manager.methods.batchSet(entries), "unauthorized");
        await manager.methods.batchSet(entries).send(organization.asActiveComponent);

        for(var it of entries) {
            await checkEntryStuff(it.entryType, it.key, it.value);
        }
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