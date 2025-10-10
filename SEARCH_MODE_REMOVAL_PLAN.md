# Search Mode Removal Plan

This document details all files and code sections that need to be modified or deleted to remove "Search" mode from the application, keeping only "Docs" mode.

## Files to DELETE (Search mode only)

These files appear to be used exclusively for Search mode functionality:

1. ✅ `components/enhanced-search.tsx`
2. ✅ `components/enhanced-search-results.tsx`
3. ✅ `components/search-analytics.tsx`
4. ✅ `components/search-controls.tsx`

**Action**: Delete these files entirely after verifying they're not imported elsewhere.

---

## Files to MODIFY

### 1. `components/chat-interface.tsx` (PRIMARY CHANGES)

**Lines to remove/modify:**

#### State declarations (around line 361)
```typescript
// REMOVE THIS:
const [chatMode, setChatMode] = useState<'docs' | 'search'>('docs')
```

#### Imports to remove (if not used elsewhere)
```typescript
// Line 15: Remove if only used for Search mode
import { Search } from "lucide-react"

// Line 52: Remove if only used for Search mode
import { SearchAnalytics } from "@/components/search-analytics"

// Line 59: Remove if only used for Search mode
import { EnhancedSearchResults } from "./enhanced-search-results"
```

#### Mode toggle UI (lines 1685-1695)
```typescript
// REMOVE THIS ENTIRE SECTION:
<div className="flex items-center rounded-full border-2 border-black overflow-hidden w-full sm:w-auto">
  <button type="button" onClick={() => setChatMode('docs')} className={...}>
    Docs
  </button>
  <button type="button" onClick={() => setChatMode('search')} className={...}>
    Search
  </button>
</div>
```

#### Search mode conditional logic
Remove all conditionals checking `chatMode === 'search'`:
- Line 652: `setShowStepper(chatMode === 'search')`
- Lines 663-667: Search mode stepper labels
- Lines 670-673: Docs mode message handling
- Lines 702-940: Search mode web research logic (large block)
- Lines 1070-1074: Context toggle disabled in Search mode
- Lines 1665-1669: Search mode LLM configuration warning
- Lines 1698-1718: Output mode selector (Search only)
- Lines 1722-1728: Placeholder text conditionals
- Lines 1738-1750: Submit button conditionals
- Lines 1754-1757: Search mode URL guidance

#### Simplify to Docs-only
Replace conditional logic with direct Docs mode behavior:

**Before:**
```typescript
placeholder={
  (chatMode === 'docs' && disabled)
    ? 'Configure AI provider and upload documents to start chatting...'
    : chatMode === 'search'
      ? (isLLMConfigured ? 'Search the web...' : 'Configure AI provider...')
      : 'Ask a question about your documents...'
}
```

**After:**
```typescript
placeholder={
  disabled
    ? 'Configure AI provider and upload documents to start chatting...'
    : 'Ask a question about your documents... (Shift+Enter for new line)'
}
```

**Before:**
```typescript
disabled={(chatMode === 'docs' ? (disabled || isProcessing) : (isProcessing || !isLLMConfigured))}
```

**After:**
```typescript
disabled={disabled || isProcessing}
```

#### Remove outputMode state (Search only)
```typescript
// REMOVE:
const [outputMode, setOutputMode] = useState<'summary' | 'detailed'>('summary')
```

---

### 2. `app/page.tsx` (Minor cleanup)

**No changes needed** - The file uses `activeTab` for tab navigation (chat/documents/settings/status), which is separate from the Docs/Search mode toggle.

---

### 3. API Routes (if they exist)

Check `app/api/` directory for Search mode specific endpoints:
- Web search endpoints
- Web scraping endpoints
- SSE (Server-Sent Events) endpoints for streaming search results

**Action**: Delete any Search mode specific API routes.

---

### 4. Documentation Updates

#### `RAG_ARCHITECTURE.md`
- Update to reflect Docs-only mode
- Remove any Search mode references
- Update screenshots/diagrams if they show Search toggle

#### `README.md` (if exists)
- Remove Search mode from feature list
- Update usage instructions to remove Search mode references

---

## Verification Checklist

After making changes:

- [ ] Run `npm run build` - should complete without errors
- [ ] Run `npm run lint` - should pass without warnings about unused imports
- [ ] Search codebase for `chatMode` - should return 0 results
- [ ] Search codebase for `'search'` string literal in chat context - should return 0 results
- [ ] Search codebase for `SearchAnalytics` - should return 0 results
- [ ] Search codebase for `EnhancedSearchResults` - should return 0 results
- [ ] Test Docs mode functionality:
  - [ ] Upload PDF
  - [ ] Ask questions
  - [ ] Verify responses
  - [ ] Check citations
- [ ] Verify no "Search" button appears in UI
- [ ] Check browser console for errors

---

## Code Search Commands

Use these to find remaining references:

```bash
# Search for chatMode references
grep -r "chatMode" components/ app/ lib/

# Search for Search mode string literals
grep -r "'search'" components/ app/ lib/

# Search for Search mode components
grep -r "SearchAnalytics\|EnhancedSearchResults\|EnhancedSearch" components/ app/

# Search for Search icon usage
grep -r "Search.*from.*lucide" components/
```

---

## Estimated Impact

- **Files to delete**: 4
- **Files to modify**: 1 (chat-interface.tsx)
- **Lines to remove**: ~300-400 lines
- **Risk level**: Low (Search mode is isolated feature)
- **Testing effort**: Medium (verify Docs mode still works)

---

## Rollback Plan

If issues arise:
1. Git revert to commit before Search mode removal
2. Or restore deleted files from backup
3. Re-test Docs mode functionality

---

**Last Updated**: 2025-10-11
**Status**: In Progress

---

## Hotfix for Current Lints (chat-interface.tsx)

Use this checklist to resolve the current IDE errors without reintroducing Search mode. All changes are in `components/chat-interface.tsx`.

- [ ] Remove URL guidance hook usage
  - [ ] Delete the line: `const urlDetection = useURLDetection(input)`
  - [ ] Remove any remaining `<URLGuidance ... />` JSX blocks
  - [ ] Ensure no import of `useURLDetection` or `URLGuidance` remains

- [ ] Simplify `handleSubmitStreaming()` to Docs-only
  - [ ] Keep only:
    ```ts
    setInput("")
    onSendMessage(text, { useContext, showThinking: enhancedOptions.showThinking, complexityLevel: enhancedOptions.complexityLevel === 'auto' ? undefined : (enhancedOptions.complexityLevel as any) })
    return
    ```
  - [ ] Delete all code after this early `return` (this removes references to `userMessage`, `AIClient`, `numberMatch`, `response.body`, SSE, etc.)
  - [ ] Quick replace (anchor-based):
    - Find the function header:
      ```ts
      const handleSubmitStreaming = async (e: React.FormEvent) => {
      ```
    - Replace the entire function body with:
      ```ts
      const handleSubmitStreaming = async (e: React.FormEvent) => {
        e.preventDefault()
        const text = (input || "").trim()
        if (!text) return
        setInput("")
        onSendMessage(text, {
          useContext,
          showThinking: enhancedOptions.showThinking,
          complexityLevel: enhancedOptions.complexityLevel === 'auto' ? undefined : (enhancedOptions.complexityLevel as any)
        })
      }
      ```

- [ ] Remove Stepper UI and state
  - [ ] Delete states: `stepperSteps`, `showStepper`, `stepperError`, and any `typingPulse`/`typingTimeoutRef`
  - [ ] Remove `<Stepper ... />` and `<ChatTypingIndicator />` JSX blocks
  - [ ] Remove any `setShowStepper(...)` and `setStepperSteps(...)` calls
  - [ ] Anchors to locate:
    - State block:
      ```ts
      const [stepperSteps, setStepperSteps] = useState<...>([
      ```
    - UI block:
      ```tsx
      {/* Stepper UI */}
      ```

- [ ] Clean the context toggle
  - [ ] Replace the label to static Docs text:
    ```tsx
    <Switch id="context-toggle" checked={useContext} onCheckedChange={setUseContext} />
    <Label htmlFor="context-toggle" className="text-sm">Use Document Context</Label>
    ```
  - [ ] Ensure no `disabled={chatMode === 'search'}` or `chatMode` usage remains

- [ ] Remove remaining Search-only UI
  - [ ] Docs/Search toggle group
  - [ ] Output mode selector (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`)
  - [ ] Search analytics and refine bar blocks (`SearchAnalytics`, `sourceFilters`, `predictiveCountsRef`)
  - [ ] Interactive sources grid (`EnhancedSearchResults`)
  - [ ] Anchors to locate:
    - Toggle group: `/* Mode selector */`
    - Output selector: `/* Output mode selector (Phase 3B) */`
    - Analytics: `/* Visual Search Analytics (Phase 3A) */`
    - Refine: `/* Refine bar (Phase 2B) */`
    - Interactive sources: `/* Interactive Sources (Phase 2C) */`

### Verification (post-fix)

- [ ] `grep -n "chatMode" components/chat-interface.tsx` → no matches
- [ ] `grep -n "useURLDetection\|URLGuidance" components/chat-interface.tsx` → no matches
- [ ] Build: `npm run build` passes
- [ ] Lint: `npm run lint` passes

---

## Progress

- **Completed**
  - [x] Drafted Docs-only flow (submit path now early-returns to `onSendMessage()`)
  - [x] Removed Search icon usage in submit button/placeholder logic
  - [x] Added explicit hotfix steps mapping each IDE error to precise code changes
  - [x] Deleted the unreachable Search pipeline block after early return in `handleSubmitStreaming()`
  - [x] Removed all Stepper states/UI (and `ChatTypingIndicator`)
  - [x] Removed all `chatMode` usages and Docs/Search toggle remnants
  - [x] Removed URL guidance hook and imports (`useURLDetection`, `URLGuidance`)
  - [x] Build + Lint clean

- **Pending (apply in code)**
  - [ ] None (Phase 1 complete)

### Verification Results

- **[passed]** `grep -n "chatMode" components/chat-interface.tsx` → no matches
- **[passed]** `grep -n "useURLDetection\|URLGuidance" components/chat-interface.tsx` → no matches
- **[passed]** Build and Lint: no errors
