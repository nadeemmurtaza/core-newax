# EL-0027: Tool and AI mistakes were not analyzed as attributable quality evidence

## Root cause

AI and engineering-tool outputs, validation failures, corrections and regression evidence could exist across pull requests, issues, comments and reviews without one normalized quality record connecting the generated output to the verified mistake.

## Failed method

Label any bug in AI-assisted work as a hallucination, rely on keywords or recollection, apply current package or documentation status retroactively, or copy raw prompts and generated code into an informal dataset.

## Successful method

Record attributable output metadata and hashes, correlate evidence effective at output time, preserve uncertainty and lifecycle state, and generate a versioned privacy-safe dataset from verified findings.

## Prevention control

Pull-request governance analyzes structured AI-quality evidence and blocks only unresolved, unwaived, high-confidence findings tied to attributable AI or tool output. Dataset rows exclude raw prompts, raw output, generated code and private repository content by default.
