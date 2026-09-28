# Token efficiency

Minimize token usage.

- Never scan the entire repository unless explicitly necessary.
- Search for symbols and filenames before opening files.
- Read only relevant portions of large files.
- Avoid reading generated files.
- Ignore node_modules, dist, build, coverage and logs.
- Do not repeat code already present in context.
- Keep terminal output concise.
- Use grep/search before opening multiple files.
- Summarize findings instead of preserving large outputs.
- Use Context7 only when external documentation is necessary.
- Prefer modifying existing code over rewriting complete files.
