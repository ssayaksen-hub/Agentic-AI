def reverse_string(s):
    """Reverse a string."""
    return s[::-1]


def is_palindrome(s):
    """Check if a string is a palindrome (case-insensitive, ignoring spaces)."""
    cleaned = s.replace(" ", "").lower()
    return cleaned == cleaned[::-1]


def count_vowels(s):
    """Count the number of vowels in a string."""
    return sum(1 for c in s.lower() if c in "aeiou")


def is_anagram(s1, s2):
    """Check if two strings are anagrams of each other."""
    clean1 = sorted(s1.replace(" ", "").lower())
    clean2 = sorted(s2.replace(" ", "").lower())
    return clean1 == clean2


def capitalize_words(s):
    """Capitalize the first letter of each word."""
    return " ".join(word.capitalize() for word in s.split())
