---
applyTo: "paralleliq-ui/src/**/*.{ts,tsx}"
---

# Frontend Instructions — paralleliq-ui

## Stack
- React 18, TypeScript (strict)
- TanStack Query v5 for all server state
- React Router v6 for routing
- React Hook Form + Zod for all wizard forms
- Axios via `services/api.ts` — never call `fetch` directly in components
- Tailwind CSS for styling

## Critical rules

### Types must stay in sync with Java DTOs
All types live in `src/types/index.ts` and mirror:
- `paralleliq-common/src/main/java/com/paralleliq/common/dto/AgentDtos.java`
- `paralleliq-common/src/main/java/com/paralleliq/common/model/*.java`

When a field is added to a Java DTO, add it to `types/index.ts` in the same PR.
No `any` — use `unknown` and narrow, or define a proper type.

### ExecutionMode awareness — mandatory
Every component that touches a `Run` or `ParallelDetail` must handle both modes:
```typescript
// Wrong — hardcodes single mode
<th>Expected</th><th>Actual</th>

// Right — adapts to mode
<th>{run.executionMode === 'TRUE_PARALLEL' ? 'Env A output' : 'Expected (Env A)'}</th>
<th>{run.executionMode === 'TRUE_PARALLEL' ? 'Env B output' : 'Actual (Env B)'}</th>
```

### Services — all API calls go through typed functions
```typescript
// Never do this in a component:
const res = await axios.get('/api/v1/parallels');

// Always use the service:
import { parallelService } from '../services/paralleliqService';
const { data } = useQuery({
  queryKey: ['parallels', projectId],
  queryFn: () => parallelService.list(projectId).then(r => r.data.data?.content ?? []),
});
```

## Component patterns

### TanStack Query
```typescript
// Read
const { data, isLoading, error } = useQuery({
  queryKey: ['parallels', projectId, page],
  queryFn: () => parallelService.list(projectId, page).then(r => r.data.data),
});

// Write
const mutation = useMutation({
  mutationFn: (data: CreateParallelRequest) =>
    parallelService.create(data).then(r => r.data.data!),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['parallels', projectId] });
    navigate('/parallels');
  },
});
```

### Wizard steps — always this pattern
```typescript
interface StepProps {
  initialValues?: StepData;     // for back-navigation pre-fill
  onNext: (data: StepData) => void;
  onBack: () => void;
}
// Each step is a self-contained form with its own Zod schema.
// The wizard shell (ParallelWizard.tsx) composes them.
```

### Pagination — all list views
```typescript
const [page, setPage] = useState(0);
const { data } = useQuery({
  queryKey: ['parallels', projectId, page],
  queryFn: () => parallelService.list(projectId, page, 20).then(r => r.data.data),
  keepPreviousData: true,  // smooth page transitions
});
// data.content = current page items
// data.totalElements = total count for pagination controls
```

## File structure
```
src/
  types/index.ts            ← single source of truth for all types
  services/
    api.ts                  ← Axios instance
    paralleliqService.ts    ← all typed API calls
  hooks/
    useRunProgress.ts       ← WebSocket hook for live run updates
  components/
    wizard/
      ParallelWizard.tsx    ← wizard shell, step routing
      steps/
        NameStep.tsx        ← Step 1: name, project, executionMode
        SourceBindingStep.tsx
        TransformStep.tsx
        TargetBindingStep.tsx
        OutputPullStep.tsx
        AssertionStep.tsx
        ReviewStep.tsx
    results/
      RecordDiffView.tsx    ← field-level diff, mode-aware column labels
      ResultsDashboard.tsx
    parallels/
      ParallelList.tsx
      ParallelListItem.tsx
    shared/
      StatusBadge.tsx       ← RunStatus badge with colour coding
      ProtocolBadge.tsx     ← Protocol tag
      PageControls.tsx      ← pagination component
  pages/
    DashboardPage.tsx
    ParallelsPage.tsx
    ParallelDetailPage.tsx
    CreateParallelPage.tsx
    ResultsPage.tsx
    RuleSetsPage.tsx
```

## Environment variables
```
VITE_API_BASE_URL=https://paralleliq-api.your-pcf-domain.com/api/v1
```
Set in `.env.production` for PCF deployment.
In dev, the Vite proxy in `vite.config.ts` forwards `/api` to `localhost:8080`.

## PCF deployment
Build output is `dist/` — deploy as a static site in PCF.
The React app calls the API at `VITE_API_BASE_URL`.
No server-side rendering — pure SPA.
Set `VITE_API_BASE_URL` as a PCF environment variable at deploy time.
