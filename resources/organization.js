var fs = require('fs')
async function saveCurrentBalance(commonData, alsoStart) {
    commonData.balanceAfter = await web3.eth.getBalance(commonData.fromAddress);
    commonData.balanceAfterPlain = utilities.fromDecimals(commonData.balanceAfter, 18);
    commonData.spent = commonData.balanceBefore.sub(commonData.balanceAfter);
    commonData.spentPlain = utilities.fromDecimals(commonData.spent, 18);

    console.log("==== COMPLETED ===");
    alsoStart && console.log("Start Balance:", commonData.balanceBeforePlain, "ETH", " -> ", commonData.balanceBefore);
    console.log("End Balance:", commonData.balanceAfterPlain, "ETH", " -> ", commonData.balanceAfter);
    console.log("Spent:", commonData.spentPlain, "ETH", " -> " , commonData.spent);
    console.log("====\n");

    return commonData
}

module.exports = {
    async createOrganization() {
        var commonData;
        var hostAddress = accounts[0];
        try {

            var from = hostAddress;

            try {
                hostAddress = global.web3.eth.accounts.privateKeyToAccount(from = process.env.private_key).address;
                accounts[0] = hostAddress;
                await blockchainConnection.unlockAccounts(hostAddress, true);
            } catch (e) {}

            //global.web3 = new(require('web3'))(process.env.BLOCKCHAIN_CONNECTION_STRING);

            try {
                commonData = {...commonData, ...JSON.parse(fs.readFileSync("C:/Users/Marco/Desktop/dump_rinkeby_json.json", 'utf-8'))}
            } catch(e) {
            }

            //commonData = commonData || await require('./commonData')(from, process.env.MINT_OWNER);

            //commonData = commonData.chainId === 1 ? commonData : await require("./ammAggregator")(commonData);

            var sleep = millis => new Promise(ok => setTimeout(ok, millis))

            console.log('\n=== DID U REMEMBER TO UPDATE STUFF LIKE FARMING CONTRACT??????? ===\n');
            await sleep(2300);
            !web3.currentProvider.blockchainConnection && console.log('\n=== WILL WAIT FOR 7 seconds before start ===\n');
            !web3.currentProvider.blockchainConnection && await sleep(7000);

            console.log(new Date().toUTCString(), "=== DEPLOY START ===");
            console.log("Start Balance:", commonData.balanceBeforePlain, "ETH", commonData.balanceBefore);
            console.log("Chain ID is:", commonData.chainId);
            console.log("Environment is:", (commonData.chainId === 1 ? "Mainnet" : "Testnet") + " " + (global.web3.currentProvider.blockchainConnection ? "Multiverse" : "Real"));
            commonData.chainId === 1 && console.log("OS Token Address is:", commonData.OS_ADDRESS);
            console.log("FROM ADDRESS:", commonData.fromAddress);
            console.log("MINT OWNER:", commonData.mintOwnerAddress);

            await require('./investmentsManagerSellTokens')(commonData)

            //commonData = commonData.chainId === 1 ? commonData : await require("./itemV2")(commonData);

            /*commonData = await require("./proposalModelsFactory")(commonData);
            commonData = await saveCurrentBalance(commonData);

            commonData = await require('./proposalsManagerModel')(commonData);
            commonData = await require("./models")(commonData);
            commonData = await saveCurrentBalance(commonData);

            commonData = await require("./covenantsNew")(commonData);
            commonData = await saveCurrentBalance(commonData);

            commonData = await require("./factoryOfFactories")(commonData);
            commonData = await saveCurrentBalance(commonData);

            commonData = await require("./delegationFactory")(commonData);
            commonData = await saveCurrentBalance(commonData);

            commonData = await require("./ourEcosystemDFO")(commonData);
            commonData = await saveCurrentBalance(commonData);

            commonData = await require("./pollMaker")(commonData);
            commonData = await saveCurrentBalance(commonData);

            await require("./mintOS")(commonData);*/

            //commonData = await require("./itemV2Projections")(commonData);
            //commonData = await saveCurrentBalance(commonData);

            throw new Error("APPOSTO ZIO");

            /*var organizationFactory = await new web3.eth.Contract(OrganizationFactory.abi, (await blockchainCall(factoryOfFactories.methods.partialList, 0, 3000))[2][0][0]);

            mandatoryComponentsDeployData[0] = abi.encode(['tuple(address[],uint256[],uint256[],address,address,address[],address[])'], [
                [
                    [],
                    [],
                    [], utilities.voidEthereumAddress, utilities.voidEthereumAddress, [],
                    []
                ]
            ]);

            var additionalComponentsDeployData = [
                web3.eth.abi.encodeParameters(["uint256", "uint256", "bytes32[]", "uint256[]", "bytes32"], [0, 0, [],
                    [], utilities.voidBytes32
                ]),
                "0x",
                web3.eth.abi.encodeParameters(["uint256", "uint256[]", "uint256[]", "uint256", "uint256", "bytes"], [0, [],
                    [utilities.voidEthereumAddress, web3.eth.abi.encodeParameter("address", knowledgeBase.osTokenAddress)], 0, 0, "0x"
                ])
            ];

            var subDAOProposalModelTypes = [
                "address",
                "string",
                "bool",
                "bytes[]",
                "bytes32[]",
                "address",
                "address",
                "uint256",
                "address[][]",
                "address[][]"
            ];

            var subDAOProposalModels = [{
                source : utilities.voidEthereumAddress,
                uri : "str",
                perpetual : false,
                bytes : [],
                bytes32 : [],
                a : utilities.voidEthereumAddress,
                b : utilities.voidEthereumAddress,
                c : 0,
                d : [[utilities.voidEthereumAddress]],
                e : [[utilities.voidEthereumAddress]]
            }];

            var organizationDeployData = {
                uri: "",
                permitSignature: '0x',
                mandatoryComponentsDeployData,
                additionalComponents: [3, 4, 5],
                additionalComponentsDeployData,
                specificOrganizationData: abi.encode(["bool", "address", `tuple(${subDAOProposalModelTypes.join(',')})[]`, "bytes"], [false, utilities.voidEthereumAddress, subDAOProposalModels.map(it => Object.values(it)), "0x"])
            }

            data = abi.encode(["tuple(string,bytes,bytes[],uint256[],bytes[],bytes)"], [Object.values(organizationDeployData)]);
            var transaction = await blockchainCall(organizationFactory.methods.deploy, data, { from });
            var transactionReceipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);

            organization.address = web3.eth.abi.decodeParameter("address", transactionReceipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Deployed(address,address,address,bytes)'))[0].topics[2]);
            organization.contract = new web3.eth.Contract(Organization.abi, organization.address);

            await blockchainCall(factoryOfFactories.methods.setHost, organization.address, { from });

            organization.creationTransaction = {
                events: {
                    ComponentSet: transactionReceipt.logs.filter(it => it.address === organization.address && it.topics[0] === web3.utils.sha3("ComponentSet(bytes32,address,address,bool)") && it.topics[2] === utilities.voidBytes32).map(it => {
                        var key = web3.eth.abi.decodeParameter("bytes32", it.topics[1]);
                        var component = Object.values(organization.components).filter(it => it.value === key)[0];
                        component.active = web3.eth.abi.decodeParameter("bool", it.data);
                        component.address = web3.eth.abi.decodeParameter("address", it.topics[3]);
                        component.contract = new web3.eth.Contract(component.Contract.abi, component.address);
                        delete component.Contract;
                        component.active && !organization.asActiveComponent && (organization.asActiveComponent = blockchainConnection.getSendingOptions({ from: component.address }));
                        return {
                            returnValues: {
                                key,
                                from: utilities.voidEthereumAddress,
                                to: component.address,
                                active: component.active
                            }
                        }
                    })
                }
            };

            await blockchainConnection.unlockAccounts([organization.address, ...Object.values(organization.components).map(it => it.address).filter(it => it !== undefined && it !== null)]);

            return organization;*/

        } catch (e) {
            commonData = await saveCurrentBalance(commonData, true);
            console.log("\n\n====\n\n");
            console.log(JSON.stringify(commonData));
            console.log("\n\n====\n\n");
            console.log("END TIME", new Date().toUTCString())
            console.error(e);
            if((e.message || e).toLowerCase().indexOf('apposto') === -1) {
                throw e;
            }
        }
    }
};