const fs = require('fs');
const path = require('path');
const { deploy, voteAndTerminate } = require('../resources/firstProposal/procedure');

describe("First Proposal", () => {

    var commonData;
    var itemMainInterface;

    before(async () => {
        global.web3 = new(require('web3'))(process.env.BLOCKCHAIN_CONNECTION_STRING);
        var chainId = parseInt(await web3.eth.net.getId());
        try {
            var dumpPath = path.resolve(__dirname, `../resources/firstProposal/0.5_dump_${chainId}.json`)
            commonData = {...commonData, ...JSON.parse(fs.readFileSync(dumpPath, 'utf-8'))}
            commonData.from = commonData.fromAddress
            commonData = !process.env.PRIVATE_KEY ? commonData : {...commonData, fromAddress : web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address, from : process.env.PRIVATE_KEY}
        } catch(e) {}
        try {
            await blockchainConnection.unlockAccounts(commonData.fromAddress, true);
        } catch(e) {}

        accounts[0] = commonData.fromAddress;

        itemMainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, commonData.ITEM_MAININTERFACE);

        /*if(web3.currentProvider.blockchainConnection) {
            var SubDAO = await compile('ext/subDAO/impl/SubDAO');
            var subDAO = new web3.eth.Contract(SubDAO.abi, commonData.ourSubDAO);
            var osMinterAddress = await blockchainCall(subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_TOKEN_MINTER);
            await blockchainConnection.unlockAccounts(osMinterAddress);
            var itemProjection = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/Item')).abi, commonData.OS_PROJECTION);
            await blockchainCall(itemProjection.methods.mintItems, [{
                header : {
                    host : utilities.voidEthereumAddress,
                    name : '',
                    symbol : '',
                    uri : ''
                },
                collectionId : commonData.OS_COLLECTION_ID,
                id : commonData.OS_ID,
                accounts : [
                    commonData.fromAddress
                ],
                amounts : [
                    utilities.toDecimals("350000", 18)
                ]
            }], {from : osMinterAddress})
        }*/
    });

    it("Action", async () => {

        console.log("=== BEFORE: ", utilities.fromDecimals(await web3.eth.getBalance(accounts[0]), 18), "ETH");

        var data = await deploy(commonData);

        console.log("=== AFTER: ", utilities.fromDecimals(await web3.eth.getBalance(accounts[0]), 18), "ETH");

        commonData = data.commonData;
        data = data.data;

        /*if(web3.currentProvider.blockchainConnection) {
            var proposalId = await blockchainCall(data.proposalsManager.methods.lastProposalId)
            var list = await blockchainCall(data.proposalsManager.methods.list, [proposalId])
            list = list[0]
            var input = [{
                codes : [{
                    location : list.codeSequence[0],
                    bytecode : "0x"
                }],
                alsoTerminate : false
            }];
            await blockchainCall(data.proposalsManager.methods.batchCreate, input, {from : commonData.from});
        }*/

        if(commonData.chainId === 4)
        {
            var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager')
            var delegationsManagerAddress = await blockchainCall(data.subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER)
            var delegationsManager = new web3.eth.Contract(DelegationsManager.abi, delegationsManagerAddress)
            assert(!(await blockchainCall(delegationsManager.methods.factoryIsAllowed, commonData.DELEGATION_FACTORY)))

            assert.equal(await blockchainCall(data.ourSubDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), await blockchainCall(data.ourDFO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER))
            assert.equal(await blockchainCall(data.ourSubDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), delegationsManagerAddress)
            assert.equal(await blockchainCall(data.ourDFO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), delegationsManagerAddress)

            await voteAndTerminate(commonData, data.proposalsManager, itemMainInterface);

            assert(!(await blockchainCall(delegationsManager.methods.factoryIsAllowed, commonData.DELEGATION_FACTORY)))
            var oldDelegationsManagerAddress = delegationsManagerAddress
            delegationsManagerAddress = await blockchainCall(data.subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER)
            delegationsManager = new web3.eth.Contract(DelegationsManager.abi, delegationsManagerAddress)
            assert(await blockchainCall(delegationsManager.methods.factoryIsAllowed, commonData.DELEGATION_FACTORY))
            assert.notStrictEqual(oldDelegationsManagerAddress, delegationsManagerAddress)

            assert.equal(await blockchainCall(data.ourSubDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), await blockchainCall(data.ourDFO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER))
            assert.equal(await blockchainCall(data.ourSubDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), delegationsManagerAddress)
            assert.equal(await blockchainCall(data.ourDFO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), delegationsManagerAddress)

            assert.notStrictEqual(await blockchainCall(data.ourSubDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), oldDelegationsManagerAddress)
            assert.notStrictEqual(await blockchainCall(data.ourDFO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER), oldDelegationsManagerAddress)
        }
    });
});