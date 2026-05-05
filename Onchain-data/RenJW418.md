---
timezone: UTC+8
---

> 请在上边的 timezone 添加你的当地时区(UTC)，这会有助于你的打卡状态的自动化更新，如果没有添加，默认为北京时间 UTC+8 时区


# 你的名字

1. 自我介绍 我是任纪武 2023级前沿交叉学科研究院直博生
2. 你认为你会完成这次共学小组吗？可以
3. 你感兴趣的小组 Onchain-data
4. 你的联系方式（Wechat or Telegram）Wechat: 15265978697
5. 质押的交易哈希：0x1760e86d7c46111ac14792631f891f1376b1794f86d857c955b8168291a75d09

## Notes

<!-- Content_START -->

### 2025.11.23

#### Part I - 动手部署一个智能合约

1.在Remix中创建合约并编译部署

```jsx
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWeb3 {
    event Greeting(address indexed sender, uint256 timestamp);
    
    constructor() {}

    function hello() external {
        emit Greeting(msg.sender, block.timestamp);
    }
}
```

<img width="1917" height="1269" alt="image" src="https://github.com/user-attachments/assets/d1d48668-4b81-4d54-8ef8-801582b9871d" />

2.运行hello方法 并在区块链浏览器查看结果

<img width="1923" height="1268" alt="image" src="https://github.com/user-attachments/assets/9cbaa5c2-6975-43e7-ae6b-69f7bec03399" />


Transactions:

<img width="1391" height="737" alt="image" src="https://github.com/user-attachments/assets/d819fb26-be9a-4aed-8b44-092aef7afd2c" />


Events:

<img width="1392" height="843" alt="image" src="https://github.com/user-attachments/assets/7eccd22c-bb3f-4cf9-850c-ee0be4f13898" />

#### Part II - 智能合约编写

成功获取FLAG: PKU_Blockchain_Colearn_Week1_Success

交易哈希: 0x7661fbb60c03948fb20c9bc7f13de6e45dc3933ca0b2963b01ec73d5446b99fb

<img width="1921" height="1268" alt="image" src="https://github.com/user-attachments/assets/9e7314b0-b716-479a-90c2-30109f5123b0" />

```jsx
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWeb3 {
    event Greeting(address indexed sender, uint256 timestamp);
    
    constructor() {}

    function hello() external {
        emit Greeting(msg.sender, block.timestamp);
    }
}
```

<img width="1917" height="1269" alt="image" src="https://github.com/user-attachments/assets/c01b0f7c-e85c-49ed-af4a-fb19e694f172" />


2.运行hello方法 并在区块链浏览器查看结果

<img width="1923" height="1268" alt="image" src="https://github.com/user-attachments/assets/7c7f9e74-bab1-4156-a24d-299f9ba9429a" />


Transactions结果

<img width="1391" height="737" alt="image" src="https://github.com/user-attachments/assets/207e4c9f-6480-4500-959b-7e3b6069413b" />


Events结果

<img width="1392" height="843" alt="image" src="https://github.com/user-attachments/assets/2962beff-4de0-440f-a766-d200fc60a4ae" />

### 2025.11.27
#### Part II - 智能合约编写

成功获取FLAG: PKU_Blockchain_Colearn_Week1_Success

交易哈希: 0x7661fbb60c03948fb20c9bc7f13de6e45dc3933ca0b2963b01ec73d5446b99fb

<img width="1921" height="1268" alt="image" src="https://github.com/user-attachments/assets/4439525e-4d45-4798-a97f-5edf3dc2d9b9" />

### 2025.12.5
#### Part I - Geth 简介
以太坊客户端、节点、RPC是维持以太坊正常运行的三个概念。  
以太坊客户端：协议的具体实现  
节点：全节点、轻节点、归档节点  
RPC：外部接口  
#### Part II - Go 语言环境准备
1.安装Go  
<img width="265" height="36" alt="image" src="https://github.com/user-attachments/assets/c8b9896f-6d54-471c-83e7-e69ae57b2f89" />  
2.新建项目  
<img width="367" height="142" alt="image" src="https://github.com/user-attachments/assets/06b19187-7fc3-4ec1-b106-a2f5a5adf8b3" />  
3.安装 go-ethereum 库  
<img width="778" height="412" alt="image" src="https://github.com/user-attachments/assets/1cde788e-c410-4e18-a064-8befff8ac990" />  
<img width="1048" height="715" alt="image" src="https://github.com/user-attachments/assets/52f50f6a-78b5-4de8-8191-07d8b2a86b7b" />  
#### Part III - 使用 go-ethereum 读取链上数据
<img width="1440" height="853" alt="image" src="https://github.com/user-attachments/assets/10d4da65-76e2-4e1c-9ae6-d0b48269d7db" />  
<img width="797" height="660" alt="image" src="https://github.com/user-attachments/assets/2415e5c9-90f1-4328-8bca-868e9f68a4d0" />  
<img width="799" height="870" alt="image" src="https://github.com/user-attachments/assets/6560dd78-618c-46d1-8fd4-9b196d6b243d" />  
<img width="658" height="470" alt="image" src="https://github.com/user-attachments/assets/27a17f1f-3d23-48e3-840c-01d139fcdaed" />  

#### Follow Up - 理解 block, transaction, receipt 的结构
##### 关于 Block 建议理解的字段包括：
number:区块高度（第几块）  
hash:该区块的唯一哈希值  
parentHash:上一个区块的 hash  
timestamp:出块时间  
gasUsed / gasLimit:此区块内所有交易消耗的总gas/一个区块能容纳的最大gas  
transactions:交易  
为何 parentHash 能形成区块链？每个区块都通过哈希指针包含前一区块的 hash。由于密码学哈希函数具备 puzzle-friendliness、collision resistance 和 hiding 等性质，这种哈希指针可以安全且唯一地将区块串接起来，从而形成不可篡改的区块链结构。  
gasLimit 如何影响合约执行？交易gasLimit决定单次合约执行能否成功；区块gasLimit决定区块一次能加入多少复杂交易。如果执行需要的gas超过gasLimit，交易会失败或无法被链接受。

##### 关于 Transcation 建议理解的字段包括：
nonce:某个地址从 0 开始递增的交易计数  
from / to:交易的发送者地址，接收方地址  
input (call data):输入数据，是调用合约的“函数选择器 + 参数”的编码结果  
gas / gasPrice:gasLimit/单价gas的价格  
value:交易中转账的 ETH 数额  
type (legacy, EIP-1559):交易类型.type = 0 → Legacy 交易（老式，只有 gasPrice）type = 2 → EIP-1559 交易（主流，包含 maxFeePerGas、maxPriorityFeePerGas）type = 1 → EIP-2930（带 access list）  
Follow-Up：  
什么是 ABI ？一笔交易最终执行逻辑是如何解析 input 的? Application Binary Interface（应用二进制接口）;把人类可读的函数调用编码成交易 input 中的字节序列,并且能在 EVM 中被正确反解码.  
Step 1：取出 input 前 4 字节 → 函数选择器（Function Selector）  
Step 2：EVM 用 ABI 将选择器映射到合约内函数  
Step 3：继续根据 ABI 规则解析参数  
Step 4：执行对应函数逻辑  
Step 5：如果未匹配任何函数 → fallback() / receive()  

##### 关于 Receipt 建议理解的字段包括:
status:交易执行结果的状态  
logs:合约执行过程中emit的事件列表  
contractAddress:部署合约生成的新地址  

### 2025.12.14
学习本周内容
在b站学习肖老师公开课 受益匪浅

### 2025.12.21
继续消化上次内容 + 学习肖老师以太坊部分

### 2025.12.28
1.创建telegram robot
2.将live monitor整合到消息发送中
![image](https://github.com/user-attachments/assets/456de2a0-3f87-46c9-9d1d-529bc9dbfb83)

### 2026.01.04
暂无内容更新 所以继续消化之前的内容

### 2026.01.11
暂无内容更新 所以继续消化之前的内容
### 2026.05.04

## 大作业第二弹：Intro to Atomic Arb

### 1. 交易分析与套利路径

复刻目标交易：[0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730](https://etherscan.io/tx/0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730)

**套利路径（4 步）：**

```
WETH → EMP → pEMP → pfWETH → WETH
```

| 步骤 | TokenIn | TokenOut | 协议 | 合约地址 |
|------|---------|----------|------|----------|
| 1 | WETH | EMP | Uniswap V3 swap | `0xe092769bc1fa5262D4f48353f90890Dcc339BF80` |
| 2 | EMP | pEMP | Peapods `bond()` | `0x4343A06B930Cf7Ca0459153C62CC5a47582099E1` |
| 3 | pEMP | pfWETH | Uniswap V2 swap | `0x9FF3226906eB460E11d88f4780C84457A2f96C3e` |
| 4 | pfWETH | WETH | ERC-4626 `redeem()` | `0x395dA89bDb9431621A75DF4e2E3B993Acc2CaB3D` |

**套利原理：**
- pEMP/EMP 的 Peapods 内部兑换比率与 Uniswap V2 市价出现偏差
- bot 在 V3 买入 EMP，通过 Peapods bond 包装成 pEMP，在 V2 的溢价中换出 pfWETH，最后 redeem 回 WETH
- 一圈下来 WETH 数量净增加 → 无风险套利

**几个关键坑：**
1. `bond()` 有 3 个参数（含 `amountMintMin`），不是 2 个
2. pEMP 是 fee-on-transfer token，转给 V2 Pair 时有税；必须用"到账前后余额之差"作为实际 amountIn 来计算 amountOut，否则触发 `UniswapV2: K` 错误
3. Step 4 的 PFWETH_POD 不是普通 Peapods Pod，而是 ERC-4626 标准的 Vault，需调用 `redeem(shares, receiver, owner)` 而非 `debond()`
4. Fork 必须用 TX_HASH 而非 block number，否则 block 内该 TX 之前的其他交易改变了池子状态，导致结果偏差（相差约 18 gwei 的利息）

---

### 2. 套利合约 ArbBot.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IUniswapV2Pair {
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
}

// pEMP Pod（Peapods WeightedIndex，bond 有 3 个参数）
interface IPeapodsPod {
    function bond(address token, uint256 amount, uint256 amountMintMin) external;
}

// pfWETH Pod（ERC-4626 Vault）
interface IERC4626 {
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

contract ArbBot {
    address constant WETH       = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant V3_POOL    = 0xe092769bc1fa5262D4f48353f90890Dcc339BF80;
    address constant PEMP_POD   = 0x4343A06B930Cf7Ca0459153C62CC5a47582099E1;
    address constant V2_PAIR    = 0x9FF3226906eB460E11d88f4780C84457A2f96C3e;
    address constant PFWETH_POD = 0x395dA89bDb9431621A75DF4e2E3B993Acc2CaB3D;

    uint160 constant MIN_SQRT_RATIO = 4295128739;
    uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    function executeArb(uint256 amountIn) external returns (uint256 amountOut) {
        // Step 1: WETH → EMP via Uniswap V3
        bool zeroForOne = (IUniswapV3Pool(V3_POOL).token0() == WETH);
        uint160 sqrtLimit = zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;
        IUniswapV3Pool(V3_POOL).swap(address(this), zeroForOne, int256(amountIn), sqrtLimit, "");

        address emp = zeroForOne
            ? IUniswapV3Pool(V3_POOL).token1()
            : IUniswapV3Pool(V3_POOL).token0();
        uint256 empBal = IERC20(emp).balanceOf(address(this));

        // Step 2: EMP → pEMP via Peapods bond
        IERC20(emp).approve(PEMP_POD, empBal);
        IPeapodsPod(PEMP_POD).bond(emp, empBal, 0);
        uint256 pempBal = IERC20(PEMP_POD).balanceOf(address(this));

        // Step 3: pEMP → pfWETH via Uniswap V2
        // pEMP 是 fee-on-transfer token，用快照法量实际到账量
        bool pempIsToken0 = (IUniswapV2Pair(V2_PAIR).token0() == PEMP_POD);
        uint256 pairPempBefore = IERC20(PEMP_POD).balanceOf(V2_PAIR);
        (uint112 r0, uint112 r1,) = IUniswapV2Pair(V2_PAIR).getReserves();
        IERC20(PEMP_POD).transfer(V2_PAIR, pempBal);
        uint256 actualPempIn = IERC20(PEMP_POD).balanceOf(V2_PAIR) - pairPempBefore;

        if (pempIsToken0) {
            uint256 pfwethOut = _getAmountOut(actualPempIn, r0, r1);
            IUniswapV2Pair(V2_PAIR).swap(0, pfwethOut, address(this), "");
        } else {
            uint256 pfwethOut = _getAmountOut(actualPempIn, r1, r0);
            IUniswapV2Pair(V2_PAIR).swap(pfwethOut, 0, address(this), "");
        }

        // Step 4: pfWETH → WETH via ERC-4626 redeem
        uint256 pfwethBal = IERC20(PFWETH_POD).balanceOf(address(this));
        IERC4626(PFWETH_POD).redeem(pfwethBal, address(this), address(this));

        amountOut = IERC20(WETH).balanceOf(address(this));
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        require(msg.sender == V3_POOL, "ArbBot: unauthorized callback");
        if (amount0Delta > 0) {
            IERC20(IUniswapV3Pool(V3_POOL).token0()).transfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            IERC20(IUniswapV3Pool(V3_POOL).token1()).transfer(msg.sender, uint256(amount1Delta));
        }
    }

    function _getAmountOut(uint256 amtIn, uint256 resIn, uint256 resOut) internal pure returns (uint256) {
        uint256 amtInWithFee = amtIn * 997;
        return (amtInWithFee * resOut) / (resIn * 1000 + amtInWithFee);
    }
}
```

---

### 3. Foundry Fork 测试 ArbTest.t.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ArbBot.sol";

contract ArbTest is Test {
    bytes32 constant TX_HASH =
        0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    uint256 constant AMOUNT_IN  = 562611020353505727;
    uint256 constant AMOUNT_OUT = 569640303749166946;

    uint256 forkId;
    ArbBot  bot;

    function setUp() public {
        // 用 TX_HASH fork，精确定位到该 TX 执行前的链上状态
        forkId = vm.createFork(vm.envString("RPC_URL"), TX_HASH);
        vm.selectFork(forkId);
        bot = new ArbBot();
        vm.makePersistent(address(bot));
    }

    function test_arb() public {
        vm.selectFork(forkId);
        deal(WETH, address(bot), AMOUNT_IN);

        uint256 amountOut = bot.executeArb(AMOUNT_IN);

        console.log("=== Arb Result ===");
        console.log("amountIn  :", AMOUNT_IN);
        console.log("amountOut :", amountOut);
        console.log("profit    :", amountOut - AMOUNT_IN);

        // wei 级别精确匹配链上原始结果
        assertEq(amountOut, AMOUNT_OUT, "amountOut mismatch: result differs from on-chain truth");
    }
}
```

---

### 4. 测试结果（精确匹配链上）

```
=== Arb Result ===
amountIn  : 562611020353505727
amountOut : 569640303749166946
profit    : 7029283395661219

Suite result: ok. 1 passed; 0 failed; 0 skipped ✅
```

- **amountIn**：562611020353505727 wei（~0.5626 WETH）
- **amountOut**：569640303749166946 wei（~0.5696 WETH）
- **gross profit**：7029283395661219 wei（~0.00703 WETH ≈ $16.8）
- 结果与链上原始交易**精确到 wei 完全一致** ✅

<!-- Content_END -->
