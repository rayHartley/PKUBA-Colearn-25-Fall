"""Tests for oracle price computation logic."""

import pytest
from src.oracle import compute_gross_revenue


class TestComputeGrossRevenue:
    """Test the gross revenue computation logic."""

    def test_basic_profit(self):
        """When collateral value exceeds repaid, revenue is positive."""
        # If oracle price is 1.01 * 10^36 (collateral worth 1.01x loan token)
        # repaid = 100 * 10^18, seized = 100 * 10^18
        # collateral_value = 100 * 1.01 = 101
        # gross_revenue = 101 - 100 = 1
        oracle_price = 1_010_000_000_000_000_000_000_000_000_000_000_000  # 1.01 * 10^36
        repaid_assets = 100 * 10**18
        seized_assets = 100 * 10**18

        result = compute_gross_revenue(
            repaid_assets=repaid_assets,
            seized_assets=seized_assets,
            oracle_price=oracle_price,
            loan_decimals=18,
            collateral_decimals=18,
        )

        assert result["gross_revenue"] == pytest.approx(1.0, rel=1e-6)
        assert result["repaid"] == pytest.approx(100.0)
        assert result["collateral_value"] == pytest.approx(101.0)

    def test_zero_revenue(self):
        """When oracle price = 1.0, no profit (liquidation at par)."""
        oracle_price = 10**36  # exactly 1.0
        repaid_assets = 50 * 10**18
        seized_assets = 50 * 10**18

        result = compute_gross_revenue(
            repaid_assets=repaid_assets,
            seized_assets=seized_assets,
            oracle_price=oracle_price,
        )

        assert result["gross_revenue"] == pytest.approx(0.0)

    def test_large_liquidation(self):
        """Large liquidation values compute correctly."""
        # oracle price: 1.05 (5% discount for liquidator)
        oracle_price = 1_050_000_000_000_000_000_000_000_000_000_000_000  # 1.05 * 10^36
        repaid_assets = 10000 * 10**18  # 10000 WHYPE
        seized_assets = 10000 * 10**18  # 10000 kHYPE

        result = compute_gross_revenue(
            repaid_assets=repaid_assets,
            seized_assets=seized_assets,
            oracle_price=oracle_price,
        )

        # collateral_value = 10000 * 1.05 = 10500
        # gross_revenue = 10500 - 10000 = 500
        assert result["gross_revenue"] == pytest.approx(500.0)
        assert result["collateral_value"] == pytest.approx(10500.0)

    def test_different_decimals(self):
        """Handle tokens with different decimal places."""
        # loan: 6 decimals (like USDC), collateral: 18 decimals
        # scale = 10^(36 + 6 - 18) = 10^24
        oracle_price = 2000 * 10**24  # 1 collateral = 2000 loan tokens
        repaid_assets = 1900 * 10**6  # 1900 USDC
        seized_assets = 1 * 10**18  # 1 ETH

        result = compute_gross_revenue(
            repaid_assets=repaid_assets,
            seized_assets=seized_assets,
            oracle_price=oracle_price,
            loan_decimals=6,
            collateral_decimals=18,
        )

        # collateral value = 1 * 2000 = 2000 USDC
        # gross revenue = 2000 - 1900 = 100 USDC
        assert result["gross_revenue"] == pytest.approx(100.0)
