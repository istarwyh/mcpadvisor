Please analyze and fix the Github pull request: $ARGUMENTS.

Follow these steps for comprehensive PR review and fixing:

# PLAN

1. **Switch to PR branch first**:
   ```bash
   gh pr checkout $PR_NUMBER
   ```
   This ensures you're working on the correct branch for the PR.
   
   **Important Branch Management**:
   - The PR branch should already be based on main when created
   - If you need to sync with latest main (e.g., for conflicts or outdated base):
   ```bash
   # Update your local main first
   git checkout main
   git pull origin main
   
   # Switch back to PR branch and rebase on main
   gh pr checkout $PR_NUMBER
   git rebase main
   
   # If there are conflicts, resolve them and continue:
   # git add .
   # git rebase --continue
   ```

2. Use `gh pr view $PR_NUMBER` to get the PR details and description
3. Use `gh pr view $PR_NUMBER --json reviews,comments` to get review comments and feedback
4. Use `gh api repos/:owner/:repo/pulls/$PR_NUMBER/comments` to get detailed code review comments
5. Understand all the feedback and suggestions from reviewers
6. Ask clarifying questions if any feedback is unclear
7. Analyze the codebase context:
   - Search for related files mentioned in the review
   - Understand the code patterns and conventions
   - Check existing tests that might be affected
8. Break down all review feedback into manageable tasks using TodoWrite tool
9. Prioritize fixes: Critical > Major > Minor issues

# PRE-TEST VALIDATION

- Run the full test suite to understand current state:
  ```bash
  pnpm run check     # Lint and format check
  pnpm run test      # Unit tests
  pnpm run test:e2e  # End-to-end tests (if applicable)
  ```
- Document any existing test failures before making changes
- Ensure you understand which tests are related to the PR changes

# SYSTEMATIC FIXING

For each review comment/suggestion:

1. **Mark todo as in_progress** using TodoWrite tool
2. **Read the relevant files** to understand context
3. **Implement the fix** following project conventions:
   - Follow naming conventions from CLAUDE.md
   - Maintain code style consistency
   - Use existing patterns and utilities
   - Follow TypeScript best practices
4. **Verify the fix** addresses the reviewer's concern
5. **Mark todo as completed** using TodoWrite tool

## Common Review Categories to Address:

### Code Quality Issues
- Remove redundant code or comments
- Fix inconsistent naming or formatting
- Improve error handling and logging
- Add missing type definitions

### Documentation Issues
- Update or clarify comments
- Fix unclear documentation
- Add missing API documentation
- Improve README or guides

### Testing Issues
- Add missing test cases
- Fix broken tests
- Improve test coverage
- Add integration tests

### Security Issues
- Remove hardcoded secrets or keys
- Fix security vulnerabilities
- Improve input validation
- Add proper error handling

# POST-FIX TESTING

After implementing all fixes:

1. **Run comprehensive tests**:
   ```bash
   pnpm run check          # Code quality
   pnpm run test           # Unit tests
   pnpm run test:coverage  # Coverage report
   pnpm run test:e2e       # End-to-end tests
   ```

2. **Verify specific scenarios** mentioned in review comments

3. **Test edge cases** that reviewers highlighted

4. **Ensure no regressions** in existing functionality

# COMMIT AND PUSH

1. **Stage relevant changes only**:
   ```bash
   git add [specific-files-related-to-fixes]
   ```

2. **Create descriptive commit message** following conventional commits:
   ```
   fix(scope): address code review feedback

   - Fix specific issue 1 mentioned by reviewer
   - Improve specific issue 2 from review
   - Add specific improvement 3 suggested

   Addresses review comments in PR #$PR_NUMBER
   ```

3. **Push changes**:
   ```bash
   git push origin [branch-name]
   ```

# FOLLOW-UP

1. **Comment on the PR** to acknowledge fixes:
   - Thank reviewers for their feedback
   - Summarize what was fixed
   - Ask for re-review if needed

2. **Address any new feedback** that comes in

3. **Ensure CI/CD passes** after your changes

# BEST PRACTICES

- **Be thorough**: Address every single review comment, even minor ones
- **Be respectful**: Thank reviewers and explain your changes
- **Be consistent**: Follow the project's existing patterns and conventions
- **Be testing-focused**: Ensure all tests pass and add new tests if needed
- **Be communicative**: Keep reviewers informed of your progress
- **Be patient**: Some reviews may require multiple iterations

# QUALITY CHECKLIST

Before considering the PR review complete:

- [ ] All review comments have been addressed
- [ ] All tests are passing (unit, integration, e2e)
- [ ] Code follows project conventions and style guide
- [ ] Documentation is updated where necessary
- [ ] No new security vulnerabilities introduced
- [ ] Performance impact considered and acceptable
- [ ] Changes are backward compatible (if required)
- [ ] Commit messages are clear and follow conventions

Remember to use the GitHub CLI ('gh') for all Github-related tasks and maintain clear communication with reviewers throughout the process.