# EL-0035 — Security Coverage Relied on CodeQL and Dependabot Alone

## Category

`security-scanning-coverage`

## Root-cause ID

`ROOT-SECURITY-SCANNING-SINGLE-TOOL-COVERAGE`

## Root cause

The repository's automated security posture relied on a single static-analysis engine (CodeQL) and a single dependency-vulnerability source (Dependabot alerts). Neither tool catches every class of finding: CodeQL's query packs miss some logic-level and framework-specific patterns that a second SAST engine with a different rule set can catch, and Dependabot alerts report known CVEs without a second, independently-sourced vulnerability database or license-risk view to cross-check against.

## Unsuccessful method

Treat one static-analysis engine and one dependency-alert source as complete security coverage, with no second opinion from a differently-sourced tool.

## Successful method

Add Semgrep (a second, differently-sourced SAST engine covering OWASP Top Ten and language-specific rule packs) and Snyk (a second, independently-sourced dependency-vulnerability scanner) as informational, non-blocking workflows that upload findings to GitHub's existing Code Scanning UI alongside CodeQL, so security signal accumulates in one place without introducing a new required check or blocking existing merges.

## Prevention control

`.github/workflows/semgrep.yml` and `.github/workflows/snyk.yml` run on push, pull request, and a weekly schedule, uploading SARIF results to GitHub Code Scanning. Snyk requires a `SNYK_TOKEN` repository secret; its workflow detects the secret's absence and skips its scan steps with an explicit warning rather than failing, until the token is configured.

## Required evidence

- confirmation that both workflows parse as valid YAML and match the repository's existing workflow conventions (checkout, pnpm, Node.js setup);
- confirmation that neither workflow is registered as a required branch-protection status check;
- confirmation that the Snyk workflow degrades gracefully (skips, does not fail) when `SNYK_TOKEN` is absent.

## Regression boundary

Neither new workflow may become a required status check without explicit approval, since neither tool's findings have been triaged for false-positive rate yet. The Snyk workflow must never fail a run solely because `SNYK_TOKEN` has not yet been configured.
