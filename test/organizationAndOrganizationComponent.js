var organizationManager = require('../resources/organization');
describe("Organization and OrganizationComponent", () => {

    var organization;

    before(async () => {
        organization = await organizationManager.createOrganization();
    });

    it("OrganizationComponent", async() => {

        var components = Object.keys(organization.components).map(key => {
            var component = organization.components[key];
            return {
                component: key,
                key: component.value,
                location: component.address,
                active: component.active,
                log: true
            };
        });

        var transaction = organization.creationTransaction;
        assert.equal(components.length, transaction.events.ComponentSet.length);
        transaction.events.ComponentSet.map(it => it.returnValues).forEach(it => {
            var contractComponent = components.filter(cc => cc.key === it.key)[0];
            var organizationComponent = organization.components[contractComponent.component];
            assert.equal(it.from, utilities.voidEthereumAddress);
            assert.equal(it.key, contractComponent.key);
            assert.equal(contractComponent.key, organizationComponent.value);
            assert.equal(it.active, contractComponent.active);
            assert.equal(contractComponent.active, organizationComponent.active);
            assert.equal(it.to, organizationComponent.address);
        });
        var keys = Object.values(organization.components).map(it => it.value);
        for(var key of keys) {
            var component = Object.values(organization.components).filter(it => it.value === key)[0];
            assert.equal(key, await organization.contract.methods.keyOf(component.address).call());
            assert.equal(JSON.stringify([component.address]), JSON.stringify(await organization.contract.methods.history(key).call()));
            assert.equal(component.address, await organization.contract.methods.get(key).call());
            assert.equal(component.active, await organization.contract.methods.isActive(component.address).call());
            assert.equal(component.active, await organization.contract.methods.keyIsActive(key).call());
        }

        var addresses = Object.values(organization.components).map(it => [it.address]);
        assert.equal(JSON.stringify(addresses), JSON.stringify(await organization.contract.methods.batchHistory(keys).call()));
    });

    it("Organization", async () => {
        var UtilityOrganizationComponent = await compile('../resources/UtilityOrganizationComponent');
        var utilityOrganizationComponent = await blockchainConnection.createAndUnlockContract(UtilityOrganizationComponent, ["0x"]);

        assert.equal(utilities.voidEthereumAddress, await utilityOrganizationComponent.methods.host().call());
        await catchCall(utilityOrganizationComponent.methods.setHost(organization.address), "unauthorized");
        await utilityOrganizationComponent.methods.lazyInit(web3.eth.abi.encodeParameters(["address", "bytes"], [organization.address, "0x"])).send(blockchainConnection.getSendingOptions());
        assert.equal(organization.address, await utilityOrganizationComponent.methods.host().call());
        await catchCall(utilityOrganizationComponent.methods.lazyInit(web3.eth.abi.encodeParameters(["address", "bytes"], [organization.address, "0x"])), "init");
        await catchCall(utilityOrganizationComponent.methods.setHost(organization.address), "unauthorized");

        var components = [{
            key : utilities.voidBytes32,
            location : accounts[1],
            active : true,
            log : false
        }];

        await catchCall(organization.contract.methods.batchSet(components).send(blockchainConnection.getSendingOptions({from : utilityOrganizationComponent.options.address})), "unauthorized");
        await catchCall(organization.contract.methods.batchSet(components), "unauthorized");

        await catchCall(organization.contract.methods.batchSet(components).send(organization.asActiveComponent), "key");

        var key = await utilityOrganizationComponent.methods.KEY().call();
        components[0].key = key;

        await catchCall(organization.contract.methods.batchSet(components).send(organization.asActiveComponent), "address");

        components[0].location = utilityOrganizationComponent.options.address;

        var transaction = await organization.contract.methods.batchSet(components).send(organization.asActiveComponent);
        assert.equal(undefined, transaction.events.ComponentSet);
        assert.equal(JSON.stringify([]), JSON.stringify(await organization.contract.methods.history(key).call()));
        assert.equal(JSON.stringify([[]]), JSON.stringify(await organization.contract.methods.batchHistory([key]).call()));
        assert.equal(true, await organization.contract.methods.isActive(utilityOrganizationComponent.options.address).call());
        assert.equal(true, await organization.contract.methods.keyIsActive(key).call());
        assert.equal(key, await organization.contract.methods.keyOf(utilityOrganizationComponent.options.address).call());
        assert.equal(JSON.stringify([utilityOrganizationComponent.options.address]), JSON.stringify(await organization.contract.methods.list([key]).call()));
        assert.equal(utilityOrganizationComponent.options.address, await organization.contract.methods.get(key).call());

        var newUtilityOrganizationComponent = await blockchainConnection.createAndUnlockContract(UtilityOrganizationComponent, [web3.eth.abi.encodeParameters(["address", "bytes"], [organization.address, "0x"])]);
        assert.equal(organization.address, await newUtilityOrganizationComponent.methods.host().call());
        var component = {
            key,
            location : newUtilityOrganizationComponent.options.address,
            active : true,
            log : false
        };
        await catchCall(organization.contract.methods.set(component), "Unauthorized");
        var transaction = await organization.contract.methods.set(component).send(organization.asActiveComponent);
        assert.equal(undefined, transaction.events.ComponentSet);
        assert.equal(JSON.stringify([]), JSON.stringify(await organization.contract.methods.history(key).call()));
        assert.equal(JSON.stringify([[]]), JSON.stringify(await organization.contract.methods.batchHistory([key]).call()));
        assert.equal(false, await organization.contract.methods.isActive(utilityOrganizationComponent.options.address).call());
        assert.equal(true, await organization.contract.methods.isActive(newUtilityOrganizationComponent.options.address).call());
        assert.equal(true, await organization.contract.methods.keyIsActive(key).call());
        assert.equal(key, await organization.contract.methods.keyOf(newUtilityOrganizationComponent.options.address).call());
        assert.equal(JSON.stringify([newUtilityOrganizationComponent.options.address]), JSON.stringify(await organization.contract.methods.list([key]).call()));
        assert.equal(newUtilityOrganizationComponent.options.address, await organization.contract.methods.get(key).call());

        await catchCall(organization.contract.methods.set(component), "unauthorized");

        transaction = await organization.contract.methods.set(component).send(blockchainConnection.getSendingOptions({from : newUtilityOrganizationComponent.options.address}));
        assert.equal(undefined, transaction.events.ComponentSet);
        assert.equal(JSON.stringify([]), JSON.stringify(await organization.contract.methods.history(key).call()));
        assert.equal(JSON.stringify([[]]), JSON.stringify(await organization.contract.methods.batchHistory([key]).call()));
        assert.equal(true, await organization.contract.methods.isActive(newUtilityOrganizationComponent.options.address).call());
        assert.equal(true, await organization.contract.methods.keyIsActive(key).call());
        assert.equal(key, await organization.contract.methods.keyOf(newUtilityOrganizationComponent.options.address).call());
        assert.equal(JSON.stringify([newUtilityOrganizationComponent.options.address]), JSON.stringify(await organization.contract.methods.list([key]).call()));
        assert.equal(newUtilityOrganizationComponent.options.address, await organization.contract.methods.get(key).call());

        //First component is not an active Organization component anymore in its organization so it does not have permission to change neither its organization neither others' organization
        await catchCall(utilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress), "unauthorized");

        //Second component is active in Organization so it can change its organization or other Organization Components of the same organization (it doesn't matter if it changed component is active or not)
        transaction = await utilityOrganizationComponent.methods.setHost(organization.address).send(blockchainConnection.getSendingOptions({from : newUtilityOrganizationComponent.options.address}));
        assert.equal(organization.address, await utilityOrganizationComponent.methods.host().call());

        //Organization can also be changed by the organization itself
        transaction = await utilityOrganizationComponent.methods.setHost(organization.address).send(blockchainConnection.getSendingOptions({from : organization.address}));
        assert.equal(organization.address, await utilityOrganizationComponent.methods.host().call());

        //Organization can also be changed with a normal address
        transaction = await utilityOrganizationComponent.methods.setHost(accounts[1]).send(blockchainConnection.getSendingOptions({from : organization.address}));
        assert.equal(accounts[1], await utilityOrganizationComponent.methods.host().call());
        await catchCall(utilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress), "unauthorized");

        //Organization component's organization can be changed with the organization itself
        await catchCall(newUtilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress), "unauthorized");
        await catchCall(newUtilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from : utilityOrganizationComponent.options.address})), "unauthorized");
        transaction = await newUtilityOrganizationComponent.methods.setHost(await newUtilityOrganizationComponent.methods.host().call()).send(blockchainConnection.getSendingOptions({from : newUtilityOrganizationComponent.options.address}));
        assert.equal(organization.address, await newUtilityOrganizationComponent.methods.host().call());

        //Once a OrganizationComponent is bricked (organization address === address(0)) it cannot be changed anymore
        await catchCall(utilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from : newUtilityOrganizationComponent.options.address})), "unauthorized");
        transaction = await utilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from : accounts[1]}));
        assert.equal(utilities.voidEthereumAddress, await utilityOrganizationComponent.methods.host().call());
        await catchCall(utilityOrganizationComponent.methods.setHost(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from : newUtilityOrganizationComponent.options.address})), "unauthorized");

        components = [{
            key,
            location: utilities.voidEthereumAddress,
            active: false,
            log: false
        }];

        data = abi.encode(["tuple(bytes32,address,bool,bool)[]"], [components.map(it => [it.key, it.location, it.active, it.log])]);
        data = web3.eth.abi.encodeParameters(["address", "string", "bytes"], [utilities.voidEthereumAddress, "", data]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, data]);
        await catchCall(organization.contract.methods.lazyInit(data), "init");
        await catchCall(organization.contract.methods.batchSet(components), "unauthorized");

        await organization.contract.methods.batchSet(components).send(blockchainConnection.getSendingOptions({from : newUtilityOrganizationComponent.options.address}));

        assert.equal(utilities.voidEthereumAddress, await organization.contract.methods.get(key).call());
        assert.equal(key, await organization.contract.methods.keyOf(newUtilityOrganizationComponent.options.address).call());
        assert.equal(false, await organization.contract.methods.isActive(newUtilityOrganizationComponent.options.address).call());
        assert.equal(false, await organization.contract.methods.keyIsActive(key).call());

        var Contract = await compile(`
pragma solidity ^0.8.0;

contract Contract {

    event Test(uint256 _var, address from, address to);

    uint256 public immutable _var;

    constructor(uint256 __var) {
        _var = __var;
    }

    function test() external {
        emit Test(_var, msg.sender, address(this));
    }
}`);

        var __var = utilities.numberToString(50);

        var contract = await new web3.eth.Contract(Contract.abi).deploy({data : Contract.bin, arguments : [__var]}).send(blockchainConnection.getSendingOptions());

        var data = web3.utils.sha3("test()").substring(0, 10);

        await catchCall(organization.contract.methods.submit(contract.options.address, data, utilities.voidEthereumAddress), "unauthorized");

        var transaction = await organization.contract.methods.submit(contract.options.address, data, utilities.voidEthereumAddress).send(organization.asActiveComponent);
        var log = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3('Test(uint256,address,address)'))[0];
        assert(log !== undefined && log !== null);
        var data = web3.eth.abi.decodeParameters(["uint256", "address", "address"], log.data);
        assert.equal(__var, data[0]);
        assert.equal(organization.address, data[1]);
        assert.equal(contract.options.address, data[2]);
    });
});