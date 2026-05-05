// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ArbBot.sol";

interface Vm {
    function createFork(string calldata urlOrAlias, bytes32 txHash) external returns (uint256 forkId);
    function selectFork(uint256 forkId) external;
    function envString(string calldata key) external returns (string memory value);
    function envOr(string calldata key, string calldata defaultValue) external returns (string memory value);
    function deal(address account, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
}

interface IWETH is IERC20Minimal {
    function deposit() external payable;
}

contract ArbBotTest {
    Vm private constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    bytes32 private constant TARGET_TX =
        0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant EMP = 0x39D5313C3750140E5042887413bA8AA6145a9bd2;
    address private constant PEMP = 0x4343A06B930Cf7Ca0459153C62CC5a47582099E1;
    address private constant PFWETH = 0x395dA89bDb9431621A75DF4e2E3B993Acc2CaB3D;

    address private constant UNI_V3_EMP_WETH = 0xe092769bc1fa5262D4f48353f90890Dcc339BF80;
    address private constant UNI_V2_PFWETH_PEMP = 0x9FF3226906eB460E11d88f4780C84457A2f96C3e;

    uint256 private constant AMOUNT_IN = 562_611_020_353_505_727;
    uint256 private constant EMP_EXACT_OUT = 17_975_419_691_953_642_945;
    uint256 private constant TARGET_AMOUNT_OUT = 569_640_303_749_166_945;
    uint256 private constant TARGET_GROSS_PROFIT = 7_029_283_395_661_218;

    ArbBot private bot;
    uint256 private forkId;

    error AssertionFailed(uint256 actual, uint256 expected);

    function setUp() external {
        forkId = vm.createFork(_rpcUrl(), TARGET_TX);
        vm.selectFork(forkId);
        bot = new ArbBot();
    }

    function test_arb() external {
        vm.selectFork(forkId);

        vm.deal(address(this), AMOUNT_IN);
        IWETH(WETH).deposit{value: AMOUNT_IN}();
        IERC20Minimal(WETH).transfer(address(bot), AMOUNT_IN);

        Path[] memory paths = new Path[](4);
        paths[0] = Path({
            protocol: Protocol.UniswapV3ExactOutput,
            edge: UNI_V3_EMP_WETH,
            tokenIn: WETH,
            tokenOut: EMP,
            fixedAmount: EMP_EXACT_OUT
        });
        paths[1] = Path({protocol: Protocol.PeapodsBond, edge: PEMP, tokenIn: EMP, tokenOut: PEMP, fixedAmount: 0});
        paths[2] = Path({
            protocol: Protocol.UniswapV2ExactInput,
            edge: UNI_V2_PFWETH_PEMP,
            tokenIn: PEMP,
            tokenOut: PFWETH,
            fixedAmount: 0
        });
        paths[3] = Path({protocol: Protocol.PeapodsRedeem, edge: PFWETH, tokenIn: PFWETH, tokenOut: WETH, fixedAmount: 0});

        uint256 amountOut = bot.executeExactInput(paths, AMOUNT_IN);
        _assertEq(amountOut, TARGET_AMOUNT_OUT);
        _assertEq(amountOut - AMOUNT_IN, TARGET_GROSS_PROFIT);
    }

    function _assertEq(uint256 actual, uint256 expected) private pure {
        if (actual != expected) revert AssertionFailed(actual, expected);
    }

    function _rpcUrl() private returns (string memory rpcUrl) {
        rpcUrl = vm.envOr("RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            rpcUrl = vm.envString("INFURA_URL");
        }
    }

    receive() external payable {}
}
