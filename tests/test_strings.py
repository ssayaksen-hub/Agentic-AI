from src.strings import reverse_string, is_palindrome, count_vowels, is_anagram, capitalize_words


def test_reverse_string():
    assert reverse_string("hello") == "olleh"
    assert reverse_string("") == ""
    assert reverse_string("a") == "a"


def test_is_palindrome():
    assert is_palindrome("racecar") is True
    assert is_palindrome("Race Car") is True
    assert is_palindrome("hello") is False


def test_count_vowels():
    assert count_vowels("hello") == 2
    assert count_vowels("AEIOU") == 5
    assert count_vowels("rhythm") == 0


def test_is_anagram():
    assert is_anagram("listen", "silent") is True
    assert is_anagram("hello", "world") is False
    assert is_anagram("Astronomer", "Moon starer") is True


def test_capitalize_words():
    assert capitalize_words("hello world") == "Hello World"
    assert capitalize_words("python is fun") == "Python Is Fun"
