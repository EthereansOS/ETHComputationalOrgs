var keccak = require('keccak');

describe("ProposalsManager", () => {

    it("test", async () => {

        var ProposalsManagerLibrary = await compile('base/impl/ProposalsManager', "ProposalsManagerLibrary");

        console.log("Creating ProposalsManagerLibrary");
        var proposalsManagerLibrary = await deployContract(new web3.eth.Contract(ProposalsManagerLibrary.abi), ProposalsManagerLibrary.bin);
        console.log(" -> ", proposalsManagerLibrary.options.address, "\n");

        var path = ProposalsManagerLibrary.ast.absolutePath + ":" + ProposalsManagerLibrary.contractName;
        var key = '__$' + keccak('keccak256').update(path).digest().toString('hex').slice(0, 34) + '$__';

        var ProposalsManager = await compile('base/impl/ProposalsManager', "ProposalsManager");
        ProposalsManager.bin = ProposalsManager.bin.split(key).join(proposalsManagerLibrary.options.address.substring(2));

        console.log("Creating Model", `${ProposalsManager.contractName}`);
        var proposalsManager = await deployContract(new web3.eth.Contract(ProposalsManager.abi), ProposalsManager.bin, ["0x"]);
        console.log(" -> ", proposalsManager.options.address, "\n");
    });
});