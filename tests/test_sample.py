from src import greet


def test_greet():
    assert greet("World") == "Hello, World!"


def test_greet_name():
    assert greet("Agentic AI") == "Hello, Agentic AI!"
