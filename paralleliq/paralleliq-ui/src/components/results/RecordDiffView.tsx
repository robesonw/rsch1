/**
 * components/results/RecordDiffView.tsx
 *
 * Field-level diff for a single record (one correlation key).
 *
 * REPLAY_VALIDATE mode: shows "Expected (Env A)" vs "Actual (Env B)"
 * TRUE_PARALLEL mode:   shows "Env A output" vs "Env B output" — neither is master
 *
 * The column labels and colouring adapt to the execution mode so testers
 * never see confusing "expected/actual" language for a TRUE_PARALLEL run.
 */
import React from 'react';
import type { ExecutionMode, RecordDiff } from '../../types';

interface RecordDiffViewProps {
  diff: RecordDiff;
  executionMode: ExecutionMode;
}

export const RecordDiffView: React.FC<RecordDiffViewProps> = ({
  diff,
  executionMode,
}) => {
  const isReplay = executionMode === 'REPLAY_VALIDATE';

  // Column labels differ by mode
  const colA = isReplay ? 'EXPECTED (Env A)' : 'ENV A OUTPUT';
  const colB = isReplay ? 'ACTUAL (Env B)'   : 'ENV B OUTPUT';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-gray-400">Record: </span>
          <span className="text-xs font-mono text-white">{diff.recordKey}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
          diff.allMatched
            ? 'bg-green-900 text-green-400'
            : 'bg-red-900 text-red-400'
        }`}>
          {diff.allMatched ? 'PASS' : `${diff.mismatchCount} MISMATCH${diff.mismatchCount > 1 ? 'ES' : ''}`}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[160px_1fr_1fr_64px] text-xs font-semibold tracking-wider text-gray-500 border-b border-gray-700">
        <div className="px-3 py-2">FIELD</div>
        <div className="px-3 py-2">{colA}</div>
        <div className="px-3 py-2">{colB}</div>
        <div className="px-3 py-2">RESULT</div>
      </div>

      {/* Field rows */}
      {diff.fields.map((field, idx) => (
        <div
          key={`${field.fieldName}-${idx}`}
          className={`grid grid-cols-[160px_1fr_1fr_64px] border-b border-gray-800 last:border-0 ${
            !field.matched ? 'bg-red-950/20' : ''
          }`}
        >
          <div className="px-3 py-1.5 text-xs font-mono text-gray-400">
            {field.fieldName}
          </div>
          <div className="px-3 py-1.5 text-xs font-mono text-gray-200">
            {field.expectedValue ?? <span className="text-gray-600 italic">—</span>}
          </div>
          <div className={`px-3 py-1.5 text-xs font-mono ${
            field.matched ? 'text-green-400' : 'text-red-400'
          }`}>
            {field.actualValue ?? <span className="italic">—</span>}
          </div>
          <div className="px-3 py-1.5">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              field.matched
                ? 'bg-green-900 text-green-400'
                : 'bg-red-900 text-red-400'
            }`}>
              {field.matched ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>
      ))}

      {/* TRUE_PARALLEL reconciliation note */}
      {!isReplay && (
        <div className="px-4 py-2 bg-blue-950/20 border-t border-blue-900/30">
          <p className="text-xs text-blue-400">
            True Parallel mode — both values captured live. Neither environment is the baseline.
          </p>
        </div>
      )}
    </div>
  );
};

export default RecordDiffView;
