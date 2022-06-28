var commonData = {
    delegationFactoryUri : 'REAL_URI_HERE',
    subDAOFactoryUri : 'REAL_URI_HERE',
    dfoFactoryUri : 'REAL_URI_HERE',
    ourDFOUri : 'ipfs://ipfs/QmcoCXWR49UiQNBiwodjSHv3RTLsmard3rwYCexeB4Mt3j',
    ourSubDAOUri : 'ipfs://ipfs/QmcoCXWR49UiQNBiwodjSHv3RTLsmard3rwYCexeB4Mt3j',
    fixedInflationFactoryUri : 'REAL_URI_HERE',
    farmingFactoryUri : 'REAL_URI_HERE',
    proposalsFactoryUri : 'REAL_URI_HERE',
    fixedInflationStartBlock : '',//BLOCK_HERE
    treasurySplitterStartBlock : '',//BLOCK_HERE
    OSFarmingStartBlock : '',//BLOCK_HERE
    swapToETHStartBlock : '',//BLOCK_HERE
    executorRewardPercentage : utilities.numberToString(5 * 1e16),//5%
    DAYS_IN_YEAR : "365",
    ONE_YEAR_IN_BLOCKS : "2336000",
    WEEK_IN_BLOCKS : "44800",
    MONTH_IN_BLOCKS : '192000',
    DAY_IN_BLOCKS : '6400',
    ONE_HUNDRED : utilities.numberToString(1e18),
    OS_ADDRESS : '0x6100dd79fCAA88420750DceE3F735d168aBcB771',
    PRESTO_ADDRESS : utilities.voidEthereumAddress,
    UINT256_MAX : "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    presetValues : '7',
    delegationsMaxSize : '15',
    DIVIDENDS_FARMING : utilities.voidEthereumAddress,
    OS_FARMING : utilities.voidEthereumAddress,
    AMM_AGGREGATOR : '0x81391d117a03A6368005e447197739D06550D4CD',
    UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER : "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    WETH_ADDRESS : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    OS_ETH_LP : "0xccc42cf5d6a2f3ed8f948541455950ed6ce14707",
    delegationFactoryCollectionHeader : {
        host : utilities.voidEthereumAddress,
        name : "Ethereans Delegations",
        symbol : 'D',
        uri : 'REAL_URI_HERE'
    },
    OS_MINT_AUTH : {
        lastTokenPercentage : utilities.numberToString("8".mul(1e16))
    },
    TREASURY_SPLITTER_MANAGER : {
        splitInterval : 'THREE_MONTHS_IN_BLOCKS',
        keys : [
            "DIVIDENDS_FARMING",
            "INVESTMENTS_MANAGER",
            "DELEGATIONS_MANAGER",
            "TREASURY_MANAGER"
        ],
        flushKey : "INVESTMENTS_MANAGER",
        percentages : [
            utilities.numberToString(27 * 1e16),//27%
            utilities.numberToString(25 * 1e16),//25%
            utilities.numberToString(40 * 1e16),//40%
        ]
    },
    INVESTMENTS_MANAGER : {
        componentManager : 'TREASURY_SPLITTER_MANAGER',
        swapToETHInterval : 'WEEK_IN_BLOCKS',
        tokensFromETH : [
            "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",//ENS
            "0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F",//GTC
            "0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b",//DPI
            "0x72e364F2ABdC788b7E918bc238B21f109Cd634D7",//MVI
        ].map(it => web3.utils.toChecksumAddress(it)),
        tokensToETH : [
            "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",//ENS
            "0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F",//GTC
            "0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b",//DPI
            "0x72e364F2ABdC788b7E918bc238B21f109Cd634D7",//MVI
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"//USDC
        ].map(it => web3.utils.toChecksumAddress(it)),
        tokensToETHPercentages : [
            utilities.numberToString(1 * 1e16),//1%
            utilities.numberToString(1 * 1e16),//1%
            utilities.numberToString(3 * 1e16),//3%
            utilities.numberToString(3 * 1e16),//3%
            utilities.numberToString(5 * 1e16) //5%
        ],
    }
}

async function extractKeys(path, contract, grimoire) {
    return (await compile(path, contract)).parsed.children.filter(it => it.type === 'ContractDefinition' && it.name === contract)[0].subNodes.filter(it => it.variables && it.variables[0] && it.type === 'StateVariableDeclaration').reduce((acc, it) => ({...acc, [it.variables[0].name]: it.initialValue.number || it.initialValue.value}), grimoire || {});
}

module.exports = async function getCommonData(from, mintOwner) {

    var data = {...commonData};

    try {
        data.fromAddress = web3.eth.accounts.privateKeyToAccount(from).address;
        data.from = from;
    } catch(e) {
    }

    try {
        data.mintOwnerAddress = web3.eth.accounts.privateKeyToAccount(mintOwner).address;
        data.mintOwner = mintOwner;
    } catch(e) {
    }

    data.balanceBefore = await web3.eth.getBalance(data.fromAddress);
    data.balanceBeforePlain = utilities.fromDecimals(data.balanceBefore, 18);

    data.grimoire = await extractKeys('base/lib/KnowledgeBase', 'Grimoire');
    data.grimoire = await extractKeys('base/lib/KnowledgeBase', 'State', data.grimoire);

    data.grimoire = await extractKeys('ethereans/lib/KnowledgeBase', 'Grimoire', data.grimoire);
    data.grimoire = await extractKeys('ethereans/lib/KnowledgeBase', 'ComponentsGrimoire', data.grimoire);
    data.grimoire = await extractKeys('ethereans/lib/KnowledgeBase', 'State', data.grimoire);

    data.grimoire = await extractKeys('ext/lib/KnowledgeBase', 'Grimoire', data.grimoire);
    data.grimoire = await extractKeys('ext/lib/KnowledgeBase', 'DelegationGrimoire', data.grimoire);

    data.chainId = parseInt(await web3.eth.net.getId());
    if(data.chainId === 4) {
        data = {...data,
            DAY_IN_BLOCKS : "15",
            ONE_YEAR_IN_BLOCKS : "180",
            DAYS_IN_YEAR : "10",
            WEEK_IN_BLOCKS : "40",
            MONTH_IN_BLOCKS : "62",
            OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557",
            AMM_AGGREGATOR : '0x6BAD2Db0aEf60986a31eb9cC1180564e3d660f86',
            WETH_ADDRESS : "0xc778417e063141139fce010982780140aa0cd5ab",
            OS_ETH_LP : "0x537D7928Cbf601275eCc67AaB6d544B25eD0938b"
        }
    }

    data.THREE_MONTHS_IN_BLOCKS = data.MONTH_IN_BLOCKS.mul(3);
    data.TREASURY_SPLITTER_MANAGER.splitInterval = data[data.TREASURY_SPLITTER_MANAGER.splitInterval];
    data.TREASURY_SPLITTER_MANAGER.keys = data.TREASURY_SPLITTER_MANAGER.keys.map(it => data.grimoire["COMPONENT_KEY_" + it]);
    data.TREASURY_SPLITTER_MANAGER.flushKey = data.grimoire["COMPONENT_KEY_" + data.TREASURY_SPLITTER_MANAGER.flushKey];

    data.INVESTMENTS_MANAGER.componentManager = data.grimoire["COMPONENT_KEY_" + data.INVESTMENTS_MANAGER.componentManager];
    data.INVESTMENTS_MANAGER.swapToETHInterval = data[data.INVESTMENTS_MANAGER.swapToETHInterval];
    try {
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        data.OS_COLLECTION_ID = (await mainInterface.methods.item(data.OS_ID).call()).collectionId;
        data.OS_PROJECTION = (await mainInterface.methods.collection(data.OS_COLLECTION_ID).call()).host;

        data.DYNAMIC_URI_RESOLVER = await mainInterface.methods.dynamicUriResolver().call();
        data.ITEM_PROJECTION_FACTORY = await mainInterface.methods.hostInitializer().call();
    } catch(e) {
    }

    return data;
}