"""Embed PDFs from data/ into Chroma for document search.

Before running, make sure Ollama has an embedding model:
    ollama pull nomic-embed-text
"""

from pathlib import Path

from app.rag import create_vectorstore


def main() -> None:
    data_dir = Path("data")
    pdf_files = sorted(data_dir.glob("*.pdf"))

    if not pdf_files:
        print("No PDF files found in data/.")
        print("Add one or more PDFs, then re-run: python SETUP_RAG.py")
        return

    success_count = 0
    failed_files: list[tuple[str, str]] = []

    # Process each PDF independently so one bad file doesn't block all indexing.
    for pdf in pdf_files:
        try:
            create_vectorstore(file_path=str(pdf), collection_name="my_documents")
            success_count += 1
            print(f"Indexed: {pdf}")
        except Exception as exc:
            failed_files.append((str(pdf), str(exc)))
            print(f"Skipped: {pdf}")

    print("\n--- RAG Setup Summary ---")
    print(f"Indexed PDFs: {success_count}")
    print(f"Skipped PDFs: {len(failed_files)}")

    if failed_files:
        print("\nSkipped file details:")
        for file_name, reason in failed_files:
            print(f"- {file_name}: {reason}")
        print(
            "\nTip: If a PDF is scanned/image-only, it has no selectable text. "
            "Use a text-based PDF or OCR it first, then run this script again."
        )

    if success_count > 0:
        print("\nSetup complete. Run: python run.py")
    else:
        print("\nNo PDFs were indexed. Please fix at least one PDF and retry.")


if __name__ == "__main__":
    main()
