# Security Policy

## Supported Versions

SkillArena is pre-1.0. Only the latest release receives security updates.

## Reporting a Vulnerability

If you discover a security vulnerability in SkillArena, please report it responsibly.

**Do not open a public issue for security vulnerabilities.**

Instead, please email the maintainers directly or use GitHub's private vulnerability reporting feature if available.

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce or proof-of-concept
- Potential impact
- Suggested fix (if you have one)

We will acknowledge receipt of your report within 48 hours and provide a timeline for a fix.

## Security Considerations

SkillArena is a local-first evaluation harness that:

- Executes Codex CLI commands in isolated workspaces
- Reads and writes files in the project directory
- Does not require or store authentication credentials (except for optional OpenAI API key for rubric judging)
- Does not run a web server or accept network connections

The tool is designed for developer use on trusted code. It is not a security sandbox for untrusted code.

## Dependency Security

SkillArena depends on a minimal set of npm packages. We monitor dependencies for known vulnerabilities and update them promptly.

If you discover a vulnerability in a dependency, please report it to us so we can assess the impact and update accordingly.

## Disclosure Policy

We follow coordinated disclosure:

1. Reporter submits vulnerability privately
2. Maintainers verify and assess impact
3. Fix is developed and tested
4. Security release is published
5. Public disclosure after users have had time to update

## Security Best Practices for Users

- Keep SkillArena updated to the latest version
- Review eval cases before running them, as they execute Codex commands
- Do not run evals with `--keep-workspace` on untrusted code without reviewing the fixtures
- Store your OpenAI API key securely if using rubric judging
- Report any suspicious behavior to the maintainers

## Contact

For security concerns, please contact the maintainers through GitHub or the project's issue tracker (use discretion for sensitive information).
