# Refactoring Plan for vercel-chatbot

## Executive Summary
The current diff against main shows **84 files changed** with **4,490 insertions** and **6,726 deletions**. While there's a net reduction of ~2,236 lines, there are significant opportunities to further reduce the diff size and eliminate code duplication.

**Critical Constraint**: Much of the apparent duplication is due to Next.js server/client separation requirements:
- `databricks-auth.ts` imports `'server-only'` - for Next.js Server Components/API routes
- `databricks-auth-node.ts` has NO `'server-only'` - for Node.js/tsx scripts (build time)
- Client components can only import types, not implementations

## Major Areas of Change

### 1. Authentication System Overhaul
- **Removed**: NextAuth-based authentication system (7 files, ~500 lines)
- **Added**: Databricks OAuth/CLI authentication system (3 new auth files)
- **Issue**: Significant duplication between auth implementations

### 2. AI Provider Refactoring
- **Split**: Original `providers.ts` (517 lines) split into 3 files
  - `providers.ts` (46 lines - client stub)
  - `providers-server.ts` (437 lines - server implementation)
  - `server-provider-action.ts` (11 lines - server action wrapper)
- **Issue**: Much of the OAuth logic duplicated from auth modules

## Identified Code Duplication Patterns

### 1. Authentication Functions (Necessary Duplication?)

**Duplicated across `databricks-auth.ts` and `databricks-auth-node.ts`:**
- `getAuthMethod()` - Identical implementation (15 lines each)
- `getAuthMethodDescription()` - Identical implementation (12 lines each)
- `getDatabricksToken()` - Nearly identical (20 lines each)
- `getDatabaseUsername()` - Nearly identical (15 lines each)
- OAuth token fetching logic - Duplicated in 3 places

**Why it exists**:
- `databricks-auth.ts` has `'server-only'` import → Cannot be imported by tsx/Node.js scripts
- `databricks-auth-node.ts` is for build-time scripts (like migrations)
- Client components import only types from `databricks-auth.ts`

**Can we reduce it?** YES - through careful restructuring
**Estimated reduction**: ~100 lines (less than initially thought)

### 2. Database Connection Logic (Necessary Duplication)

**Files**: `connection.ts` vs `connection-migrate.ts`
- 95% identical code
- Only difference is import statement (`databricks-auth` vs `databricks-auth-node`)
- Both files ~52 lines

**Why it exists**:
- `connection.ts` imports from `databricks-auth.ts` (has `'server-only'`)
- `connection-migrate.ts` imports from `databricks-auth-node.ts` (Node.js compatible)
- Migration scripts run with tsx/Node.js, not in Next.js server environment

**Can we reduce it?** SOMEWHAT - through shared core logic
**Estimated reduction**: ~20 lines (less than initially thought)

### 3. OAuth Token Management (Mixed: Some Necessary, Some Reducible)

**Duplicated logic found in:**
- `lib/auth/databricks-auth.ts` (OAuth implementation) - **Server-only**
- `lib/auth/databricks-auth-node.ts` (OAuth implementation) - **Node.js**
- `lib/ai/providers-server.ts` (Token fetching) - **Server-only**
- `scripts/get-oauth-token.ts` (Token fetching) - **Node.js**

**Common pattern repeated 4 times:**
```typescript
const tokenUrl = `${host}/oidc/v1/token`;
const response = await fetch(tokenUrl, {
  method: 'POST',
  headers: { /* OAuth headers */ },
  body: 'grant_type=client_credentials&scope=all-apis',
});
```

**Analysis**:
- Auth files duplication is necessary (server-only vs Node.js)
- Providers-server.ts and scripts duplication can be eliminated
- Both can use shared OAuth utilities

**Estimated reduction**: ~40 lines (less than initially thought)

### 4. Subprocess Utilities

**Good consolidation done**, but opportunity for further improvement:
- `spawnWithOutput` and `spawnWithInherit` share 80% of code
- Could use a single base function with options

**Estimated reduction**: ~20 lines

### 5. Host URL Utilities

**Scattered host normalization logic:**
- `databricks-host-utils.ts` has the utilities
- But similar logic reimplemented in auth modules
- Pattern of checking/normalizing DATABRICKS_HOST repeated

**Estimated reduction**: ~30 lines

## Proposed Refactoring Actions (Revised for Server/Client Constraints)

### Priority 1: Smart Authentication Consolidation (Saves ~60 lines)

**APPROACH**: Accept necessary duplication but share implementation details

1. **Create `lib/auth/oauth-core.ts`** (Environment-agnostic)
   - Pure OAuth token fetching logic
   - No server-only imports, works in both contexts
   - Shared by both auth implementations

2. **Create `lib/auth/cli-core.ts`** (Environment-agnostic)
   - CLI command building utilities
   - Host extraction and caching logic
   - Shared by both auth implementations

3. **Keep existing separation but reduce duplication**
   - `databricks-auth.ts` imports core modules + adds `'server-only'`
   - `databricks-auth-node.ts` imports same core modules (no server-only)
   - Remove ~60 lines of duplicated implementation details

### Priority 2: Smart Database Connection (Saves ~15 lines)

**APPROACH**: Extract connection logic, keep import separation

1. **Create `lib/db/connection-core.ts`**
   - Pure connection string building logic
   - No auth imports, accepts tokens/usernames as parameters

2. **Slim down connection files**
   - Both files become thin wrappers around core
   - Still maintain separate auth imports
   - Reduce from ~52 lines each to ~20 lines each

### Priority 3: Consolidate Provider Logic (Saves ~30 lines)

**APPROACH**: Extract utilities while respecting server-only boundaries

1. **Create `lib/ai/databricks-provider-utils.ts`** (Server-only)
   - Move `databricksFetch`, stream transformers, etc.
   - Import `'server-only'` since providers are server-side
   - Share between server provider implementations

2. **Consolidate OAuth logic in providers**
   - Remove duplicated token fetching from `providers-server.ts`
   - Use centralized auth module instead
   - ~30 lines reduction (providers must stay server-only)

### Priority 4: Reduce Boilerplate (Saves ~50 lines)

1. **Standardize error messages**
   - Create error message constants
   - Reduce repetitive error formatting

2. **Extract common patterns**
   - CLI command building
   - Environment variable checking
   - Token expiration logic

### Priority 5: Clean up removed files

1. **Ensure complete removal of NextAuth remnants**
   - Remove any lingering imports or references
   - Clean up package.json dependencies
   - Update any documentation

## Implementation Strategy

### Phase 1: Core Refactoring (Week 1)
1. Create auth core module
2. Refactor auth implementations
3. Unify database connections
4. Test thoroughly

### Phase 2: Provider Consolidation (Week 2)
1. Extract provider utilities
2. Consolidate provider files
3. Update all imports
4. Test AI functionality

### Phase 3: Cleanup (Week 3)
1. Remove all dead code
2. Update documentation
3. Optimize imports
4. Final testing

## Expected Outcome (Revised)

### Current State
- 84 files changed
- 4,490 insertions, 6,726 deletions
- ~450 lines of duplicated code

### Target State (Respecting Server/Client Boundaries)
- ~75 files changed (less reduction due to necessary separation)
- ~4,200 insertions, 6,726 deletions (~290 line reduction)
- **Necessary duplication**: ~150 lines (server/client separation)
- **Eliminated duplication**: ~300 lines
- Cleaner, more maintainable codebase with clear boundaries

## Risk Mitigation

1. **Testing Strategy**
   - Unit tests for each refactored module
   - Integration tests for auth flows
   - End-to-end tests for critical paths

2. **Rollback Plan**
   - Each phase in separate PR
   - Feature flags for major changes
   - Maintain backwards compatibility where possible

## Alternative Approaches Considered

1. **Monolithic Auth Module**
   - Pros: No duplication at all
   - Cons: Complex conditionals, harder to maintain
   - Decision: Rejected in favor of cleaner separation

2. **Complete Provider Rewrite**
   - Pros: Could optimize further
   - Cons: High risk, time consuming
   - Decision: Incremental refactoring preferred

## Success Metrics (Revised)

1. **Code Quality**
   - Diff size reduced by ~290 lines while respecting boundaries
   - **Acceptable duplication**: Server/client separation (~150 lines)
   - **Zero unnecessary duplication**: No logic duplicated within same environment
   - All tests passing

2. **Performance**
   - No regression in auth performance
   - Token caching working correctly
   - Database connections stable

3. **Maintainability**
   - Clear server/client separation maintained
   - Shared core logic for environment-agnostic functions
   - Well-documented interfaces
   - Easy to add new auth methods without breaking boundaries

## Next Steps

1. Review this plan with team
2. Prioritize based on immediate needs
3. Create tickets for each refactoring task
4. Begin with Priority 1 items

## Appendix: Detailed Duplication Analysis

### OAuth Token Fetching (4 occurrences)
```
lib/auth/databricks-auth.ts:150-180
lib/auth/databricks-auth-node.ts:45-75
lib/ai/providers-server.ts:25-35
scripts/get-oauth-token.ts:14-26
```

### CLI Command Building (3 occurrences)
```
lib/auth/databricks-auth.ts:220-240
lib/auth/databricks-auth.ts:315-335
lib/auth/databricks-auth-node.ts:80-100
```

### Host Normalization (5 occurrences)
```
lib/databricks-host-utils.ts:10-20
lib/auth/databricks-auth.ts:55-60
lib/auth/databricks-auth-node.ts:100-105
lib/ai/providers-server.ts:48-55
Multiple inline implementations
```