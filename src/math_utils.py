def fibonacci(n):
    """Return the first n Fibonacci numbers."""
    if n <= 0:
        return []
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]


def is_prime(n):
    """Check if a number is prime."""
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True


def factorial(n):
    """Return the factorial of n (iterative)."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


def gcd(a, b):
    """Return the greatest common divisor of a and b."""
    while b:
        a, b = b, a % b
    return abs(a)


def lcm(a, b):
    """Return the least common multiple of a and b."""
    return abs(a * b) // gcd(a, b)
