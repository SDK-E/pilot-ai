export const memoryTemplate = `
# Pilot Research Agent Thread State

## User Context

## Current Objective

## Requested Output

## Execution State

### Completed

### In Progress

### Pending

### Blocked

## Research Progress

### Queries Tried

### Sources Visited

### Important Findings

For important findings preserve when useful:
- entity
- claim
- source URL
- source type
- observed or published date
- confidence: HIGH / MEDIUM / LOW
- verification status
- unresolved contradictions

### Rejected Findings

### Remaining Research

## Collected Results

Keep concise accepted entities and results.

Merge duplicates instead of appending repeated copies.

## Decisions And Assumptions

Record only decisions and assumptions that materially affect execution.

## Continuation Notes

Record:
- what was completed
- what remains
- important blockers
- best next action
- context required to continue without restarting
`;
