// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum Protocol {
    UniswapV3ExactInput,
    UniswapV3ExactOutput,
    PeapodsBond,
    UniswapV2ExactInput,
    PeapodsRedeem
}

struct Path {
    Protocol protocol;
    address edge;
    address tokenIn;
    address tokenOut;
    uint256 fixedAmount;
}

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

interface IPeapodsPod {
    function bond(address token, uint256 amount, uint256 minAmountOut) external;
}

interface IERC4626LikeRedeemer {
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

library SafeTransferLib {
    error TokenCallFailed(address token, bytes data);

    function safeTransfer(address token, address to, uint256 value) internal {
        bytes memory data = abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, value);
        (bool success, bytes memory result) = token.call(data);
        if (!success || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TokenCallFailed(token, data);
        }
    }

    function safeApprove(address token, address spender, uint256 value) internal {
        bytes memory data = abi.encodeWithSelector(IERC20Minimal.approve.selector, spender, value);
        (bool success, bytes memory result) = token.call(data);
        if (!success || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TokenCallFailed(token, data);
        }
    }
}

contract ArbBot is IUniswapV3SwapCallback {
    using SafeTransferLib for address;

    uint160 private constant MIN_SQRT_RATIO_PLUS_ONE = 4_295_128_740;
    uint160 private constant MAX_SQRT_RATIO_MINUS_ONE = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341;

    error EmptyPath();
    error InvalidTokenPath(address edge, address tokenIn, address tokenOut);
    error InvalidAmount(uint256 amount);
    error InvalidProtocol(Protocol protocol);
    error UnauthorizedCallback(address caller, address expectedPool);

    event StepExecuted(
        uint256 indexed index,
        Protocol indexed protocol,
        address indexed edge,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    struct V3CallbackData {
        address pool;
    }

    function executeExactInput(Path[] calldata paths, uint256 amountIn) external returns (uint256 amountOut) {
        if (paths.length == 0) revert EmptyPath();
        if (amountIn == 0) revert InvalidAmount(amountIn);

        amountOut = amountIn;
        for (uint256 i = 0; i < paths.length; i++) {
            Path calldata path = paths[i];
            uint256 stepInput = amountOut;

            if (path.protocol == Protocol.UniswapV3ExactInput) {
                amountOut = _swapV3(path, stepInput, false);
            } else if (path.protocol == Protocol.UniswapV3ExactOutput) {
                amountOut = _swapV3(path, stepInput, true);
            } else if (path.protocol == Protocol.PeapodsBond) {
                amountOut = _bond(path, stepInput);
            } else if (path.protocol == Protocol.UniswapV2ExactInput) {
                amountOut = _swapV2(path, stepInput);
            } else if (path.protocol == Protocol.PeapodsRedeem) {
                amountOut = _redeem(path, stepInput);
            } else {
                revert InvalidProtocol(path.protocol);
            }

            emit StepExecuted(i, path.protocol, path.edge, path.tokenIn, path.tokenOut, stepInput, amountOut);
        }
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        V3CallbackData memory callbackData = abi.decode(data, (V3CallbackData));
        if (msg.sender != callbackData.pool) {
            revert UnauthorizedCallback(msg.sender, callbackData.pool);
        }

        if (amount0Delta > 0) {
            IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
            pool.token0().safeTransfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
            pool.token1().safeTransfer(msg.sender, uint256(amount1Delta));
        }
    }

    function _swapV3(Path calldata path, uint256 amountIn, bool exactOutput) private returns (uint256 amountOut) {
        IUniswapV3Pool pool = IUniswapV3Pool(path.edge);
        address token0 = pool.token0();
        address token1 = pool.token1();

        bool zeroForOne;
        if (path.tokenIn == token0 && path.tokenOut == token1) {
            zeroForOne = true;
        } else if (path.tokenIn == token1 && path.tokenOut == token0) {
            zeroForOne = false;
        } else {
            revert InvalidTokenPath(path.edge, path.tokenIn, path.tokenOut);
        }

        uint256 amountSpecifiedAbs = exactOutput && path.fixedAmount != 0 ? path.fixedAmount : amountIn;
        uint256 balanceBefore = IERC20Minimal(path.tokenOut).balanceOf(address(this));
        pool.swap(
            address(this),
            zeroForOne,
            exactOutput ? -int256(amountSpecifiedAbs) : int256(amountSpecifiedAbs),
            zeroForOne ? MIN_SQRT_RATIO_PLUS_ONE : MAX_SQRT_RATIO_MINUS_ONE,
            abi.encode(V3CallbackData({pool: path.edge}))
        );

        amountOut = IERC20Minimal(path.tokenOut).balanceOf(address(this)) - balanceBefore;
    }

    function _swapV2(Path calldata path, uint256 amountIn) private returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(path.edge);
        address token0 = pair.token0();
        address token1 = pair.token1();
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        uint256 amount0Out;
        uint256 amount1Out;
        uint256 balanceBefore = IERC20Minimal(path.tokenOut).balanceOf(address(this));
        path.tokenIn.safeTransfer(path.edge, amountIn);

        if (path.tokenIn == token0 && path.tokenOut == token1) {
            uint256 actualAmountIn = IERC20Minimal(token0).balanceOf(path.edge) - uint256(reserve0);
            amount1Out = _getAmountOut(actualAmountIn, uint256(reserve0), uint256(reserve1));
        } else if (path.tokenIn == token1 && path.tokenOut == token0) {
            uint256 actualAmountIn = IERC20Minimal(token1).balanceOf(path.edge) - uint256(reserve1);
            amount0Out = _getAmountOut(actualAmountIn, uint256(reserve1), uint256(reserve0));
        } else {
            revert InvalidTokenPath(path.edge, path.tokenIn, path.tokenOut);
        }

        pair.swap(amount0Out, amount1Out, address(this), new bytes(0));
        amountOut = IERC20Minimal(path.tokenOut).balanceOf(address(this)) - balanceBefore;
    }

    function _bond(Path calldata path, uint256 amountIn) private returns (uint256 amountOut) {
        uint256 balanceBefore = IERC20Minimal(path.tokenOut).balanceOf(address(this));
        _approveMaxIfNeeded(path.tokenIn, path.edge, amountIn);
        IPeapodsPod(path.edge).bond(path.tokenIn, amountIn, path.fixedAmount);
        amountOut = IERC20Minimal(path.tokenOut).balanceOf(address(this)) - balanceBefore;
    }

    function _redeem(Path calldata path, uint256 amountIn) private returns (uint256 amountOut) {
        uint256 balanceBefore = IERC20Minimal(path.tokenOut).balanceOf(address(this));
        IERC4626LikeRedeemer(path.edge).redeem(amountIn, address(this), address(this));
        amountOut = IERC20Minimal(path.tokenOut).balanceOf(address(this)) - balanceBefore;
    }

    function _approveMaxIfNeeded(address token, address spender, uint256 amount) private {
        if (IERC20Minimal(token).allowance(address(this), spender) >= amount) return;
        token.safeApprove(spender, 0);
        token.safeApprove(spender, type(uint256).max);
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
        if (amountIn == 0) revert InvalidAmount(amountIn);
        uint256 amountInWithFee = amountIn * 997;
        return (amountInWithFee * reserveOut) / ((reserveIn * 1000) + amountInWithFee);
    }
}
