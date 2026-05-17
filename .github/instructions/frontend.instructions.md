---
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# Frontend TypeScript / React Instructions

## Stack

- React 18 with TypeScript (strict mode)
- TanStack Query (React Query) v5 for all server state
- React Router v6 for routing
- Axios in `services/` for HTTP — never `fetch` directly in components
- WebSocket via native browser API wrapped in `hooks/useRunProgress.ts`

## Component Rules

- All components are functional — no class components
- Props always typed with an interface named `{ComponentName}Props`
- No `any` — use `unknown` and narrow, or define a proper type
- Co-locate component, its types, and its styles in one file unless the file exceeds ~200 lines
- Extract reusable UI to `components/shared/`

## File Structure per Feature

```
components/
  parallels/
    ParallelList.tsx         # list view
    ParallelListItem.tsx     # single row
    ParallelActions.tsx      # run / edit / clone buttons
  wizard/
    ParallelWizard.tsx       # wizard shell + step routing
    steps/
      NameStep.tsx
      SourceBindingStep.tsx
      TransformStep.tsx
      TargetBindingStep.tsx
      OutputPullStep.tsx
      AssertionsStep.tsx
      ReviewStep.tsx
  results/
    ResultsDashboard.tsx
    RecordDiffView.tsx
    FieldDiffRow.tsx
```

## API Call Pattern

All API calls go through typed service functions in `services/`:

```typescript
// services/parallelService.ts
import api from './api'; // axios instance with base URL + auth headers

export const parallelService = {
  list: (projectId: string) =>
    api.get<ApiResponse<ParallelSummary[]>>(`/api/v1/parallels?projectId=${projectId}`),

  getById: (id: string) =>
    api.get<ApiResponse<ParallelDetail>>(`/api/v1/parallels/${id}`),

  create: (data: CreateParallelRequest) =>
    api.post<ApiResponse<ParallelDetail>>('/api/v1/parallels', data),
};
```

## TanStack Query Pattern

```typescript
// In a component:
const { data, isLoading, error } = useQuery({
  queryKey: ['parallels', projectId],
  queryFn: () => parallelService.list(projectId).then(r => r.data.data),
});
```

Mutations use `useMutation` with `onSuccess` query invalidation.

## Types Mirror the Backend DTOs

Keep `types/` in sync with backend DTOs. Structure:

```typescript
// types/parallel.ts
export interface ParallelSummary { id: string; name: string; status: RunStatus; ... }
export interface ParallelDetail extends ParallelSummary { sourceBinding: SourceBinding; ... }
export interface CreateParallelRequest { name: string; projectId: string; ... }
```

## WebSocket Hook Pattern

```typescript
// hooks/useRunProgress.ts
export function useRunProgress(runId: string, onEvent: (event: StepStatusEvent) => void) {
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/runs/${runId}`);
    ws.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => ws.close();
  }, [runId]);
}
```

## Styling

- Tailwind CSS utility classes
- No inline `style={{}}` except for dynamic values that can't be expressed as classes
- Dark theme: use CSS variables defined in `index.css` (matches the design system in the prototype)
- Component variants (e.g. badge colours) use a `cn()` helper (`clsx` + `tailwind-merge`)

## Form Pattern (Wizard Steps)

- Use React Hook Form for all wizard steps
- Each step receives `onNext(data)` and `onBack()` callbacks from the wizard shell
- Validation schema defined with Zod, passed to `useForm({ resolver: zodResolver(schema) })`
