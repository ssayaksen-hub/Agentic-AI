import pytest
from src.math_utils import fibonacci, is_prime, factorial, gcd, lcm


def test_fibonacci():
    assert fibonacci(0) == []
    assert fibonacci(1) == [0]
    assert fibonacci(5) == [0, 1, 1, 2, 3]
    assert fibonacci(8) == [0, 1, 1, 2, 3, 5, 8, 13]


def test_is_prime():
    assert is_prime(2) is True
    assert is_prime(17) is True
    assert is_prime(1) is False
    assert is_prime(4) is False
    assert is_prime(-5) is False


def test_factorial():
    assert factorial(0) == 1
    assert factorial(1) == 1
    assert factorial(5) == 120
    with pytest.raises(ValueError):
        factorial(-1)


def test_gcd():
    assert gcd(12, 8) == 4
    assert gcd(17, 13) == 1
    assert gcd(0, 5) == 5


def test_lcm():
    assert lcm(4, 6) == 12
    assert lcm(3, 7) == 21
