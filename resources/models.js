async function createModel(commonData, path, contract, compilerVersion) {
    try {
        var Contracts = await compile(path, contract, compilerVersion);
        Contracts = Contracts.abi ? [Contracts] : Object.values(Contracts);
        Contracts = Contracts.filter(it => it.abi && it.bin);
        for(var Contract of Contracts) {
            console.log("Creating Model", `${Contract.contractName} (${path})`);
            var contract = await deployContract(new web3.eth.Contract(Contract.abi), Contract.bin, ["0x"], {from : commonData.from});
            commonData.models[Contract.contractName] = contract.options.address;
            console.log(" -> ", contract.options.address, "\n");
        }
    } catch(e) {
        console.log("Creating Model", contract ? `${contract} (${path})` : path);
        throw e;
    }
}

module.exports = async function deploy(commonData) {

    console.log("\nCreating Models\n");

    commonData.models = commonData.models || {};

    await createModel(commonData, '../resources/FarmMainRegularMinStake', 'FarmMainRegularMinStake', '0.7.6');
    await createModel(commonData, '../resources/FarmExtension', 'FarmExtension', '0.7.6');
    await createModel(commonData, '../resources/FixedInflationExtension', 'FixedInflationExtension', '0.7.6');
    await createModel(commonData, '../resources/FixedInflationUniV3', 'FixedInflationUniV3', '0.7.6');

    await createModel(commonData, 'core/impl/Organization');

    await createModel(commonData, 'base/impl/StateManager');
    await createModel(commonData, 'base/impl/TreasuryManager');
    await createModel(commonData, 'base/impl/MicroservicesManager');

    await createModel(commonData, 'ext/investmentsManager/impl/InvestmentsManager');

    await createModel(commonData, 'ext/subDAO/impl/SubDAO');
    await createModel(commonData, 'ext/subDAOsManager/impl/SubDAOsManager');

    await createModel(commonData, 'ext/delegationsManager/impl/DelegationsManager');

    await createModel(commonData, 'ext/treasurySplitterManager/impl/TreasurySplitterManager');

    await createModel(commonData, 'ethereans/osFixedInflationManager/impl/OSFixedInflationManager');
    await createModel(commonData, 'ethereans/osMinter/impl/OSMinter');

    await createModel(commonData, 'ext/delegation/impl/DelegationTokensManager');
    await createModel(commonData, 'ext/delegation/impl/DelegationProposals');

    return commonData;
}