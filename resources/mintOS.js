module.exports = async function mint(commonData) {

    console.log("Minting OS");

    console.log("balance", await web3.eth.getBalance(commonData.mintOwnerAddress))

    var destination = commonData.OS_FARMING;
    var value = utilities.numberToString(6000*1e18);

    var osToken = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-v2/contracts/model/IItemInteroperableInterface')).abi, commonData.OS_ADDRESS);

    mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-v2/contracts/model/IItemMainInterface')).abi, commonData.ITEM_MAININTERFACE);

    var MultiOperatorHost = await compile('../node_modules/@ethereansos/items-v2/contracts/projection/multiOperatorHost/impl/MultiOperatorHost')
    var multiOperatorHost = new web3.eth.Contract(MultiOperatorHost.abi, commonData.OS_PROJECTION);

    var createItems = [{
        header : {
            host : utilities.voidEthereumAddress,
            name : "",
            symbol : "",
            uri : ""
        },
        collectionId: commonData.OS_COLLECTION_ID,
        id: commonData.OS_ID,
        accounts: [
            destination
        ],
        amounts: [
            value
        ]
    }]

    console.log("TS Before", await osToken.methods.totalSupply().call())

    await blockchainCall(multiOperatorHost.methods.mintItems, createItems, {from : commonData.mintOwner})

    console.log("TS After", await osToken.methods.totalSupply().call())
    console.log("Name After", await osToken.methods.name().call())
    console.log("Symbol After", await osToken.methods.symbol().call())
    console.log("Decimals After", await osToken.methods.decimals().call())

    var Organization = await compile('ext/subdao/impl/SubDAO')
    var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
    var osMinter = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_TOKEN_MINTER).call()

    console.log("Transfering OS Miniting priviledges");

    await blockchainCall(multiOperatorHost.methods.setOperator, 1, osMinter, {from : commonData.mintOwner})

    await catchCall(blockchainCall(multiOperatorHost.methods.setOperator, 1, osMinter, {from : commonData.mintOwner}), "unauthorized")

}