/**
 * components/wizard/steps/NameStep.tsx
 *
 * Step 1 of 7 — Name, project, and execution mode.
 *
 * Execution mode selection is the most important decision here.
 * The rest of the wizard adapts its labels and fields based on this choice.
 *
 *   REPLAY_VALIDATE — Capture Env A → replay to Env B → compare
 *   TRUE_PARALLEL   — Inject same data to both envs → reconcile (future phase)
 */
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { WizardStep1 } from '../../../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  projectId: z.string().uuid('Invalid project'),
  description: z.string().max(1000).optional(),
  executionMode: z.enum(['REPLAY_VALIDATE', 'TRUE_PARALLEL']),
});

interface NameStepProps {
  projectId: string;          // pre-filled from the current project context
  initialValues?: WizardStep1;
  onNext: (data: WizardStep1) => void;
}

export const NameStep: React.FC<NameStepProps> = ({
  projectId,
  initialValues,
  onNext,
}) => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<WizardStep1>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? {
      projectId,
      executionMode: 'REPLAY_VALIDATE',
    },
  });

  const executionMode = watch('executionMode');

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <h2 className="text-sm font-semibold text-white mb-1">Name & project</h2>
      <p className="text-xs text-gray-500 mb-5">
        Give this parallel a name and choose how it will run.
      </p>

      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
          NAME
        </label>
        <input
          {...register('name')}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
          placeholder="e.g. Policy Renewal Q3"
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="mb-5">
        <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
          DESCRIPTION (optional)
        </label>
        <textarea
          {...register('description')}
          rows={2}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none resize-none"
          placeholder="What does this parallel test?"
        />
      </div>

      {/* Execution mode — the critical choice */}
      <div className="mb-5">
        <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-2">
          EXECUTION MODE
        </label>
        <div className="grid grid-cols-2 gap-3">

          <label className={`relative flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
            executionMode === 'REPLAY_VALIDATE'
              ? 'border-indigo-500 bg-indigo-950/40'
              : 'border-gray-700 bg-gray-900 hover:border-gray-600'
          }`}>
            <input
              type="radio"
              {...register('executionMode')}
              value="REPLAY_VALIDATE"
              className="sr-only"
            />
            <span className="text-sm font-medium text-white mb-1">
              Replay &amp; Validate
            </span>
            <span className="text-xs text-gray-400 leading-relaxed">
              Capture from Env A, replay to Env B, compare outputs.
              Env A is the known-good baseline.
            </span>
            {executionMode === 'REPLAY_VALIDATE' && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </span>
            )}
          </label>

          <label className={`relative flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
            executionMode === 'TRUE_PARALLEL'
              ? 'border-blue-500 bg-blue-950/40'
              : 'border-gray-700 bg-gray-900 hover:border-gray-600'
          }`}>
            <input
              type="radio"
              {...register('executionMode')}
              value="TRUE_PARALLEL"
              className="sr-only"
            />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white">True Parallel</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-medium">
                Future phase
              </span>
            </div>
            <span className="text-xs text-gray-400 leading-relaxed">
              Inject same data to both environments simultaneously.
              Reconcile outputs — neither env is the master.
            </span>
            {executionMode === 'TRUE_PARALLEL' && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </span>
            )}
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-800">
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          Next: {executionMode === 'TRUE_PARALLEL' ? 'Injection config' : 'Source binding'} →
        </button>
      </div>
    </form>
  );
};

export default NameStep;
